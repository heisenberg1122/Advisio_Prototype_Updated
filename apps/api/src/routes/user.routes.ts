import { Router, Request, Response, NextFunction } from "express";
import { prisma, InstitutionalRole, AuditAction } from "../lib/prisma.js";
import { Permissions } from "@research-management/auth";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { ACTIVE_ADVISEE_STATUSES, capacitySummary, countActiveAdviseeGroups } from "../lib/adviser-capacity.js";

const router = Router();
const CAPACITY_MANAGER_ROLES = new Set(["RPO", "VPAA", "SYSTEM_ADMIN"]);

function requireCapacityManager(req: Request, res: Response, next: NextFunction) {
  if (!req.user || (!req.user.permissions.includes(Permissions.USER_MANAGE) && !req.user.roles.some((role) => CAPACITY_MANAGER_ROLES.has(role)))) {
    return void res.status(403).json({ error: "Dean or system administrator access is required" });
  }
  next();
}

// GET /api/users
router.get(
  "/",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { role, collegeId, programId, status } = req.query;
      const canManageUsers = req.user?.permissions.includes(Permissions.USER_MANAGE);
      const isSafeAdviserDirectory = String(role || "").toUpperCase() === "ADVISER" && String(status || "").toUpperCase() === "ACTIVE";
      if (!canManageUsers && !isSafeAdviserDirectory) {
        res.status(403).json({ error: "Forbidden: user directory access is restricted" });
        return;
      }

      const users = await prisma.user.findMany({
        where: {
          ...(status && { status: String(status) as any }),
          ...(collegeId && { collegeId: String(collegeId) }),
          ...(programId && { programId: String(programId) }),
          ...(role && {
            roles: {
              some: {
                role: {
                  name: String(role) as InstitutionalRole,
                },
              },
            },
          }),
        },
        select: {
          id: true,
          universityId: true,
          email: true,
          firstName: true,
          middleName: true,
          lastName: true,
          status: true,
          maxAdviseeGroups: true,
          isAcceptingAdvisees: true,
          college: true,
          program: true,
          roles: {
            include: {
              role: true,
            },
          },
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              memberships: {
                where: {
                  projectRole: "ADVISER",
                  leftAt: null,
                  research: { status: { in: ACTIVE_ADVISEE_STATUSES } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({
        users: users.map(({ _count, ...user }) => ({
          ...user,
          ...capacitySummary(user, _count.memberships),
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch users" });
    }
  }
);

// GET /api/users/me/adviser-capacity
router.get("/me/adviser-capacity", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    if (!req.user.roles.includes("ADVISER")) return void res.status(403).json({ error: "Adviser access is required" });
    const adviser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { maxAdviseeGroups: true, isAcceptingAdvisees: true, adviserCapacityNote: true, adviserCapacitySetAt: true },
    });
    if (!adviser) return void res.status(404).json({ error: "Adviser not found" });
    const activeGroups = await countActiveAdviseeGroups(prisma, req.user.id);
    res.json({ capacity: { ...capacitySummary(adviser, activeGroups), note: adviser.adviserCapacityNote, updatedAt: adviser.adviserCapacitySetAt } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load adviser capacity" });
  }
});

// PATCH /api/users/:id/adviser-capacity — dean/system administration only.
router.patch("/:id/adviser-capacity", requireAuth, requireCapacityManager, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const maxAdviseeGroups = Number(req.body.maxAdviseeGroups);
    const isAcceptingAdvisees = req.body.isAcceptingAdvisees;
    const note = String(req.body.note || "").trim();
    if (!Number.isInteger(maxAdviseeGroups) || maxAdviseeGroups < 0 || maxAdviseeGroups > 50) {
      return void res.status(400).json({ error: "Maximum advisee groups must be a whole number from 0 to 50" });
    }
    if (typeof isAcceptingAdvisees !== "boolean") {
      return void res.status(400).json({ error: "Accepting requests must be true or false" });
    }
    if (note.length < 10) return void res.status(400).json({ error: "Add a reason of at least 10 characters" });

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id: req.params.id as string },
        include: { roles: { include: { role: true } } },
      });
      if (!existing?.roles.some((item) => item.role.name === "ADVISER")) throw new Error("ADVISER_NOT_FOUND");
      if (!req.user!.roles.includes("SYSTEM_ADMIN") && existing.collegeId !== req.user!.collegeId) throw new Error("ADVISER_NOT_FOUND");
      const activeGroups = await countActiveAdviseeGroups(tx, existing.id);
      const adviser = await tx.user.update({
        where: { id: existing.id },
        data: { maxAdviseeGroups, isAcceptingAdvisees, adviserCapacityNote: note, adviserCapacitySetBy: req.user!.id, adviserCapacitySetAt: new Date() },
        select: { id: true, firstName: true, lastName: true, email: true, maxAdviseeGroups: true, isAcceptingAdvisees: true, adviserCapacitySetAt: true },
      });
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: AuditAction.UPDATE,
          entityType: "ADVISER_CAPACITY",
          entityId: existing.id,
          oldValues: { maxAdviseeGroups: existing.maxAdviseeGroups, isAcceptingAdvisees: existing.isAcceptingAdvisees },
          newValues: { maxAdviseeGroups, isAcceptingAdvisees, note },
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });
      await tx.notification.create({
        data: {
          recipientId: existing.id,
          type: "WORKFLOW_CHANGED",
          title: "Adviser capacity updated",
          message: `Your advising capacity is now ${activeGroups}/${maxAdviseeGroups} active groups. ${isAcceptingAdvisees ? "New requests are enabled." : "New requests are paused."}`,
          entityType: "ADVISER_CAPACITY",
          entityId: existing.id,
        },
      });
      return { ...adviser, ...capacitySummary(adviser, activeGroups) };
    });
    res.json({ adviser: result });
  } catch (error: any) {
    if (error.message === "ADVISER_NOT_FOUND") return void res.status(404).json({ error: "Adviser not found" });
    res.status(500).json({ error: error.message || "Failed to update adviser capacity" });
  }
});

// GET /api/users/meta/roles
router.get("/meta/roles", requireAuth, requirePermission(Permissions.ROLE_MANAGE), async (_req: Request, res: Response) => {
  try {
    const roles = await prisma.role.findMany({
      select: { id: true, name: true, description: true, isSystem: true },
      orderBy: { name: "asc" },
    });
    res.json({ roles });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch roles" });
  }
});

// GET /api/users/:id
router.get("/:id", requireAuth, requirePermission(Permissions.USER_MANAGE), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        universityId: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
        status: true,
        college: true,
        program: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch user" });
  }
});

// PATCH /api/users/:id/status
router.patch("/:id/status", requireAuth, requirePermission(Permissions.USER_MANAGE), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status || !["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING"].includes(String(status).toUpperCase())) {
      res.status(400).json({ error: "Invalid status value" });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status: String(status).toUpperCase() as any },
      select: {
        id: true,
        universityId: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });

    res.json({ message: `User status updated to ${updatedUser.status}`, user: updatedUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update user status" });
  }
});

// POST /api/users/:id/approve
router.post("/:id/approve", requireAuth, requirePermission(Permissions.USER_MANAGE), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const verificationNote = String(req.body.verificationNote || "").trim();

    if (!req.body.verificationConfirmed || verificationNote.length < 10) {
      res.status(400).json({ error: "Identity and requested roles must be verified, with a verification note of at least 10 characters" });
      return;
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id },
        include: { roles: { include: { role: true } } },
      });
      if (!existing) throw new Error("User not found");

      const updated = await tx.user.update({
        where: { id },
        data: { status: "ACTIVE" },
        select: { id: true, universityId: true, email: true, firstName: true, lastName: true, status: true },
      });
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: AuditAction.APPROVE,
          entityType: "USER_ACCOUNT",
          entityId: id,
          oldValues: { status: existing.status },
          newValues: { status: "ACTIVE", verifiedRoles: existing.roles.map((item) => item.role.name), verificationNote },
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });
      return updated;
    });

    res.json({ message: "User account verified and approved successfully", user: updatedUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to approve user account" });
  }
});

// PUT /api/users/:id/roles — verified, multi-role assignment
router.put(
  "/:id/roles",
  requireAuth,
  requirePermission(Permissions.ROLE_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const roleNames: InstitutionalRole[] = Array.from(
        new Set<InstitutionalRole>(
          Array.isArray(req.body.roleNames)
            ? req.body.roleNames.map((role: unknown) => String(role).toUpperCase() as InstitutionalRole)
            : []
        )
      );
      const verificationNote = String(req.body.verificationNote || "").trim();
      const validRoles = Object.values(InstitutionalRole);

      if (!req.body.verificationConfirmed || verificationNote.length < 10) {
        res.status(400).json({ error: "Role eligibility must be verified, with a verification note of at least 10 characters" });
        return;
      }
      if (roleNames.length === 0 || roleNames.some((role) => !validRoles.includes(role as InstitutionalRole))) {
        res.status(400).json({ error: "At least one valid institutional role is required" });
        return;
      }

      const result = await prisma.$transaction(async (tx) => {
        const target = await tx.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
        if (!target) throw new Error("User not found");
        const oldRoleNames = target.roles.map((item) => item.role.name);

        if (oldRoleNames.includes(InstitutionalRole.SYSTEM_ADMIN) && !roleNames.includes(InstitutionalRole.SYSTEM_ADMIN)) {
          const systemAdminCount = await tx.user.count({
            where: { status: "ACTIVE", roles: { some: { role: { name: InstitutionalRole.SYSTEM_ADMIN } } } },
          });
          if (systemAdminCount <= 1) throw new Error("The last active System Administrator cannot lose that role");
        }

        const roles = await tx.role.findMany({ where: { name: { in: roleNames as InstitutionalRole[] } } });
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: roles.map((role) => ({ userId: id, roleId: role.id, grantedBy: req.user!.id })),
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: AuditAction.ROLE_CHANGE,
            entityType: "USER",
            entityId: id,
            oldValues: { roles: oldRoleNames },
            newValues: { roles: roleNames, verificationNote },
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
        return tx.user.findUnique({
          where: { id },
          select: { id: true, universityId: true, roles: { include: { role: true } } },
        });
      });

      res.json({ message: "Verified roles updated successfully", user: result });
    } catch (error: any) {
      const message = error.message || "Failed to update roles";
      res.status(message.includes("last active") ? 409 : message === "User not found" ? 404 : 500).json({ error: message });
    }
  }
);

// DELETE /api/users/:id — destructive action guarded by an exact confirmation phrase
router.delete(
  "/:id",
  requireAuth,
  requirePermission(Permissions.USER_MANAGE),
  requirePermission(Permissions.ROLE_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (id === req.user!.id) {
        res.status(409).json({ error: "You cannot delete your own signed-in account" });
        return;
      }

      const target = await prisma.user.findUnique({
        where: { id },
        include: { roles: { include: { role: true } } },
      });
      if (!target) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const requiredConfirmation = `delete ${target.universityId} sudo`;
      if (req.body.confirmation !== requiredConfirmation) {
        res.status(400).json({ error: "Confirmation phrase does not match", requiredConfirmation });
        return;
      }

      if (target.roles.some((item) => item.role.name === InstitutionalRole.SYSTEM_ADMIN)) {
        const systemAdminCount = await prisma.user.count({
          where: { status: "ACTIVE", roles: { some: { role: { name: InstitutionalRole.SYSTEM_ADMIN } } } },
        });
        if (systemAdminCount <= 1) {
          res.status(409).json({ error: "The last active System Administrator cannot be deleted" });
          return;
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: AuditAction.DELETE,
            entityType: "USER",
            entityId: target.id,
            oldValues: {
              universityId: target.universityId,
              email: target.email,
              name: `${target.firstName} ${target.lastName}`,
              roles: target.roles.map((item) => item.role.name),
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
        await tx.user.delete({ where: { id } });
      });

      res.json({ message: `User ${target.universityId} was permanently deleted` });
    } catch (error: any) {
      if (error.code === "P2003") {
        res.status(409).json({ error: "This user owns protected institutional records and cannot be permanently deleted. Suspend the account instead." });
        return;
      }
      res.status(500).json({ error: error.message || "Failed to delete user" });
    }
  }
);

export default router;
