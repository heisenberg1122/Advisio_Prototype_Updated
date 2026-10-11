import { Router, Request, Response, NextFunction } from "express";
import { AuditAction, prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import {
  ACTIVE_ADVISEE_STATUSES,
  capacitySummary,
} from "../lib/adviser-capacity.js";

const router = Router();
const DEAN_ROLES = new Set(["RPO", "SYSTEM_ADMIN", "VPAA"]);

function requireDean(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.roles.some((role) => DEAN_ROLES.has(role))) {
    res.status(403).json({ error: "Dean access is required" });
    return;
  }
  next();
}

function daysSince(value: Date) {
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 86_400_000));
}

router.get(
  "/dean/dashboard",
  requireAuth,
  requireDean,
  async (req: Request, res: Response) => {
    try {
      const requestedCollegeId =
        typeof req.query.collegeId === "string"
          ? req.query.collegeId
          : undefined;
      const collegeId = req.user!.roles.includes("SYSTEM_ADMIN")
        ? requestedCollegeId || req.user!.collegeId || undefined
        : req.user!.collegeId || undefined;

      if (!collegeId) {
        res
          .status(400)
          .json({ error: "This dean account is not assigned to a college." });
        return;
      }

      const programId =
        typeof req.query.programId === "string" && req.query.programId !== "all"
          ? req.query.programId
          : undefined;
      const academicYearId =
        typeof req.query.academicYearId === "string" &&
        req.query.academicYearId !== "all"
          ? req.query.academicYearId
          : undefined;

      const [college, programs, academicYears, users, projects, adviserUsers, adviserCandidates] =
        await Promise.all([
          prisma.college.findUnique({
            where: { id: collegeId },
            select: { id: true, code: true, name: true },
          }),
          prisma.program.findMany({
            where: { collegeId, isActive: true },
            orderBy: { name: "asc" },
          }),
          prisma.academicYear.findMany({
            where: { isActive: true },
            orderBy: { startDate: "desc" },
          }),
          prisma.user.findMany({
            where: {
              collegeId,
              ...(programId && { programId }),
              roles: { some: { role: { name: "RESEARCHER" } } },
            },
            include: {
              program: true,
              roles: { include: { role: true } },
              memberships: {
                where: { leftAt: null },
                select: { researchId: true },
              },
            },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          }),
          prisma.researchProject.findMany({
            where: {
              collegeId,
              ...(programId && { programId }),
              ...(academicYearId && { academicYearId }),
            },
            include: {
              program: true,
              academicYear: true,
              researchType: true,
              members: { where: { leftAt: null }, include: { user: true } },
              workflowInstance: {
                include: {
                  currentStage: true,
                  workflow: {
                    include: {
                      stages: {
                        where: { category: { not: "Archived" } },
                        orderBy: { sequence: "asc" },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { updatedAt: "desc" },
          }),
          prisma.user.findMany({
            where: {
              collegeId,
              status: "ACTIVE",
              ...(programId && { programId }),
              roles: { some: { role: { name: "ADVISER" } } },
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              program: { select: { id: true, code: true, name: true } },
              maxAdviseeGroups: true,
              isAcceptingAdvisees: true,
              adviserCapacityNote: true,
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
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          }),
          prisma.user.findMany({
            where: {
              collegeId,
              status: "ACTIVE",
              id: { not: req.user!.id },
              roles: {
                none: { role: { name: "ADVISER" } },
                some: { role: { name: { in: ["PANELIST", "RESEARCH_COORDINATOR", "RPO", "REB", "VPAA"] } } },
              },
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              program: { select: { id: true, code: true, name: true } },
              roles: { select: { role: { select: { name: true } } } },
            },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          }),
        ]);

      if (!college) {
        res.status(404).json({ error: "Assigned college was not found." });
        return;
      }

      const projectRows = projects.map((project) => {
        const stages = project.workflowInstance?.workflow.stages || [];
        const currentSequence =
          project.workflowInstance?.currentStage?.sequence || 0;
        const progress =
          project.completedAt || project.status === "COMPLETED"
            ? 100
            : stages.length
              ? Math.max(
                  0,
                  Math.round(((currentSequence - 1) / stages.length) * 100),
                )
              : 0;
        const adviser = project.members.find(
          (member) => member.projectRole === "ADVISER",
        );
        const students = project.members.filter(
          (member) =>
            member.projectRole === "LEADER" || member.projectRole === "MEMBER",
        );
        const inactiveDays = daysSince(project.updatedAt);
        const risk =
          !adviser || inactiveDays >= 30
            ? "high"
            : inactiveDays >= 14
              ? "medium"
              : "low";
        const riskReason = !adviser
          ? "No adviser assigned"
          : inactiveDays >= 30
            ? `No activity for ${inactiveDays} days`
            : inactiveDays >= 14
              ? `Last activity ${inactiveDays} days ago`
              : "On schedule";
        return {
          id: project.id,
          title: project.title,
          program: project.program,
          academicYear: project.academicYear,
          researchType: project.researchType.name,
          status: project.status,
          stage: project.workflowInstance?.currentStage?.name || "Not started",
          progress,
          risk,
          riskReason,
          updatedAt: project.updatedAt,
          adviser: adviser
            ? `${adviser.user.firstName} ${adviser.user.lastName}`
            : null,
          students: students.map((member) => ({
            id: member.user.id,
            name: `${member.user.firstName} ${member.user.lastName}`,
          })),
        };
      });

      const projectById = new Map(
        projectRows.map((project) => [project.id, project]),
      );
      const studentRows = users.map((user) => {
        const project = user.memberships
          .map((membership) => projectById.get(membership.researchId))
          .find(Boolean);
        return {
          id: user.id,
          universityId: user.universityId,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          program: user.program,
          accountStatus: user.status,
          project: project ? { id: project.id, title: project.title } : null,
          adviser: project?.adviser || null,
          stage: project?.stage || "No project",
          progress: project?.progress || 0,
          risk: project?.risk || "high",
          lastLoginAt: user.lastLoginAt,
        };
      });

      const advisers = adviserUsers.map(({ _count, ...adviser }) => {
        const attention = projects.filter(
          (project) =>
            project.members.some(
              (member) =>
                member.projectRole === "ADVISER" &&
                member.user.id === adviser.id,
            ) &&
            projectRows.find((item) => item.id === project.id)?.risk !== "low",
        ).length;
        return {
          id: adviser.id,
          name: `${adviser.firstName} ${adviser.lastName}`,
          email: adviser.email,
          groups: _count.memberships,
          attention,
          capacityNote: adviser.adviserCapacityNote,
          ...capacitySummary(adviser, _count.memberships),
        };
      });

      const stageCounts = new Map<string, number>();
      for (const project of projectRows)
        stageCounts.set(
          project.stage,
          (stageCounts.get(project.stage) || 0) + 1,
        );
      const programSummary = programs.map((program) => {
        const rows = projectRows.filter(
          (project) => project.program.id === program.id,
        );
        return {
          id: program.id,
          code: program.code,
          name: program.name,
          students: studentRows.filter(
            (student) => student.program?.id === program.id,
          ).length,
          projects: rows.length,
          averageProgress: rows.length
            ? Math.round(
                rows.reduce((sum, row) => sum + row.progress, 0) / rows.length,
              )
            : 0,
          atRisk: rows.filter((row) => row.risk === "high").length,
        };
      });

      res.json({
        scope: { college, programs, academicYears },
        metrics: {
          students: studentRows.length,
          projects: projectRows.length,
          onTrack: projectRows.filter((project) => project.risk === "low")
            .length,
          atRisk: projectRows.filter((project) => project.risk === "high")
            .length,
          pendingAccounts: studentRows.filter(
            (student) => student.accountStatus === "PENDING",
          ).length,
          withoutProject: studentRows.filter((student) => !student.project)
            .length,
          withoutAdviser: projectRows.filter((project) => !project.adviser)
            .length,
        },
        programSummary,
        stageDistribution: Array.from(stageCounts, ([stage, count]) => ({
          stage,
          count,
        })),
        attention: projectRows
          .filter((project) => project.risk !== "low")
          .slice(0, 8),
        students: studentRows,
        projects: projectRows,
        advisers: advisers.sort((a, b) => b.groups - a.groups),
        adviserCandidates: adviserCandidates.map((candidate) => ({
          id: candidate.id,
          name: `${candidate.firstName} ${candidate.lastName}`,
          email: candidate.email,
          program: candidate.program,
          roles: candidate.roles.map((entry) => entry.role.name),
        })),
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to load dean dashboard" });
    }
  },
);

function validCapacity(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 50 ? parsed : null;
}

async function deanProgram(programId: string, collegeId: string) {
  return prisma.program.findFirst({
    where: { id: programId, collegeId, isActive: true },
    select: { id: true, code: true, name: true },
  });
}

router.post(
  "/dean/advisers",
  requireAuth,
  requireDean,
  async (req: Request, res: Response) => {
    try {
      const collegeId = req.user!.collegeId;
      if (!collegeId) return void res.status(400).json({ error: "This dean account is not assigned to a college." });
      const userId = String(req.body.userId || "");
      const programId = String(req.body.programId || "");
      const maxAdviseeGroups = validCapacity(req.body.maxAdviseeGroups);
      const isAcceptingAdvisees = req.body.isAcceptingAdvisees;
      if (maxAdviseeGroups == null) return void res.status(400).json({ error: "Maximum groups must be a whole number from 0 to 50." });
      if (typeof isAcceptingAdvisees !== "boolean") return void res.status(400).json({ error: "Choose whether this adviser accepts new requests." });

      const [target, program, adviserRole] = await Promise.all([
        prisma.user.findFirst({ where: { id: userId, collegeId, status: "ACTIVE" }, include: { roles: { include: { role: true } } } }),
        deanProgram(programId, collegeId),
        prisma.role.findUnique({ where: { name: "ADVISER" } }),
      ]);
      if (!target) return void res.status(404).json({ error: "Choose an active faculty account from your college." });
      if (!program) return void res.status(400).json({ error: "Choose an active program from your college." });
      if (!adviserRole) return void res.status(500).json({ error: "The Adviser role is not configured." });
      if (target.roles.some((entry) => entry.role.name === "ADVISER")) return void res.status(409).json({ error: "This faculty member is already an adviser." });

      const adviser = await prisma.$transaction(async (tx) => {
        await tx.userRole.create({ data: { userId: target.id, roleId: adviserRole.id, grantedBy: req.user!.id } });
        const updated = await tx.user.update({
          where: { id: target.id },
          data: { programId: program.id, maxAdviseeGroups, isAcceptingAdvisees, adviserCapacitySetBy: req.user!.id, adviserCapacitySetAt: new Date() },
          select: { id: true, firstName: true, lastName: true, email: true },
        });
        await tx.auditLog.create({
          data: { userId: req.user!.id, action: AuditAction.ROLE_CHANGE, entityType: "ADVISER", entityId: target.id, oldValues: { roles: target.roles.map((entry) => entry.role.name) }, newValues: { addedRole: "ADVISER", programId: program.id, maxAdviseeGroups, isAcceptingAdvisees }, ipAddress: req.ip, userAgent: req.get("user-agent") || null },
        });
        await tx.notification.create({ data: { recipientId: target.id, type: "WORKFLOW_CHANGED", title: "Adviser access added", message: `You are now an adviser for ${program.code}.`, entityType: "ADVISER", entityId: target.id } });
        return updated;
      });
      res.status(201).json({ adviser });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to add adviser." });
    }
  },
);

router.patch(
  "/dean/advisers/:id",
  requireAuth,
  requireDean,
  async (req: Request, res: Response) => {
    try {
      const collegeId = req.user!.collegeId;
      if (!collegeId) return void res.status(400).json({ error: "This dean account is not assigned to a college." });
      const programId = String(req.body.programId || "");
      const maxAdviseeGroups = validCapacity(req.body.maxAdviseeGroups);
      const isAcceptingAdvisees = req.body.isAcceptingAdvisees;
      const note = String(req.body.note || "").trim();
      if (maxAdviseeGroups == null) return void res.status(400).json({ error: "Maximum groups must be a whole number from 0 to 50." });
      if (typeof isAcceptingAdvisees !== "boolean") return void res.status(400).json({ error: "Choose whether this adviser accepts new requests." });
      if (note.length < 10) return void res.status(400).json({ error: "Add a reason of at least 10 characters for the audit record." });
      const [target, program] = await Promise.all([
        prisma.user.findFirst({ where: { id: req.params.id as string, collegeId, roles: { some: { role: { name: "ADVISER" } } } } }),
        deanProgram(programId, collegeId),
      ]);
      if (!target) return void res.status(404).json({ error: "Adviser not found in your college." });
      if (!program) return void res.status(400).json({ error: "Choose an active program from your college." });

      const adviser = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: target.id },
          data: { programId: program.id, maxAdviseeGroups, isAcceptingAdvisees, adviserCapacityNote: note, adviserCapacitySetBy: req.user!.id, adviserCapacitySetAt: new Date() },
          select: { id: true, firstName: true, lastName: true, email: true },
        });
        await tx.auditLog.create({
          data: { userId: req.user!.id, action: AuditAction.UPDATE, entityType: "ADVISER", entityId: target.id, oldValues: { programId: target.programId, maxAdviseeGroups: target.maxAdviseeGroups, isAcceptingAdvisees: target.isAcceptingAdvisees }, newValues: { programId: program.id, maxAdviseeGroups, isAcceptingAdvisees, note }, ipAddress: req.ip, userAgent: req.get("user-agent") || null },
        });
        await tx.notification.create({ data: { recipientId: target.id, type: "WORKFLOW_CHANGED", title: "Adviser assignment updated", message: `Your adviser settings were updated for ${program.code}.`, entityType: "ADVISER", entityId: target.id } });
        return updated;
      });
      res.json({ adviser });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update adviser." });
    }
  },
);

router.delete(
  "/dean/advisers/:id",
  requireAuth,
  requireDean,
  async (req: Request, res: Response) => {
    try {
      const collegeId = req.user!.collegeId;
      if (!collegeId) return void res.status(400).json({ error: "This dean account is not assigned to a college." });
      const target = await prisma.user.findFirst({
        where: { id: req.params.id as string, collegeId, roles: { some: { role: { name: "ADVISER" } } } },
        include: { roles: { include: { role: true } } },
      });
      if (!target) return void res.status(404).json({ error: "Adviser not found in your college." });
      const activeGroups = await prisma.researchMember.count({
        where: { userId: target.id, projectRole: "ADVISER", leftAt: null, research: { status: { in: ACTIVE_ADVISEE_STATUSES } } },
      });
      if (activeGroups > 0) return void res.status(409).json({ error: `Reassign ${activeGroups} active ${activeGroups === 1 ? "group" : "groups"} before removing this adviser.` });
      const adviserRole = target.roles.find((entry) => entry.role.name === "ADVISER");
      if (!adviserRole) return void res.status(404).json({ error: "Adviser role not found." });

      await prisma.$transaction(async (tx) => {
        await tx.userRole.delete({ where: { userId_roleId: { userId: target.id, roleId: adviserRole.roleId } } });
        await tx.adviserRequest.updateMany({ where: { adviserId: target.id, status: "PENDING" }, data: { status: "REJECTED", responseNote: "Adviser access was removed by the Dean.", respondedAt: new Date() } });
        await tx.auditLog.create({ data: { userId: req.user!.id, action: AuditAction.ROLE_CHANGE, entityType: "ADVISER", entityId: target.id, oldValues: { roles: target.roles.map((entry) => entry.role.name), programId: target.programId }, newValues: { removedRole: "ADVISER" }, ipAddress: req.ip, userAgent: req.get("user-agent") || null } });
        await tx.notification.create({ data: { recipientId: target.id, type: "WORKFLOW_CHANGED", title: "Adviser access removed", message: "The Dean removed your adviser assignment. Your other account access is unchanged.", entityType: "ADVISER", entityId: target.id } });
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to remove adviser." });
    }
  },
);

router.patch(
  "/dean/users/:id/status",
  requireAuth,
  requireDean,
  async (req: Request, res: Response) => {
    try {
      const status = String(req.body.status || "").toUpperCase();
      if (!["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING"].includes(status)) {
        res.status(400).json({ error: "Invalid account status." });
        return;
      }
      const target = await prisma.user.findUnique({
        where: { id: req.params.id as string },
        select: { id: true, collegeId: true },
      });
      if (
        !target ||
        (!req.user!.roles.includes("SYSTEM_ADMIN") &&
          target.collegeId !== req.user!.collegeId)
      ) {
        res.status(404).json({ error: "User was not found in your college." });
        return;
      }
      const user = await prisma.user.update({
        where: { id: target.id },
        data: { status: status as any },
      });
      res.json({ user });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to update account status" });
    }
  },
);

export default router;
