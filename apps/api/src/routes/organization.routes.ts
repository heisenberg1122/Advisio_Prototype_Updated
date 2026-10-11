import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { AuditAction } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  academicYearSchema,
  collegeMutationSchema,
  collegeUpdateSchema,
  programMajorMutationSchema,
  programMajorUpdateSchema,
  programMutationSchema,
  programUpdateSchema,
} from "@research-management/validations";
import { Permissions } from "@research-management/auth";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

const router = Router();
const configureAccess = [
  requireAuth,
  requirePermission(Permissions.SYSTEM_CONFIGURE),
] as const;

function normalizedCode(value: string | null | undefined) {
  const code = value?.trim().toUpperCase();
  return code || null;
}

function normalizedText(value: string | null | undefined) {
  const text = value?.trim();
  return text || null;
}

async function verifyPassword(userId: string, password: string) {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return Boolean(
    account?.passwordHash &&
    (await bcrypt.compare(password, account.passwordHash)),
  );
}

function mutationError(res: Response, error: any, fallback: string) {
  if (error?.code === "P2002")
    return res
      .status(409)
      .json({ error: "That name or code is already in use." });
  return res.status(500).json({ error: error?.message || fallback });
}

function auditContext(req: Request) {
  return { ipAddress: req.ip, userAgent: req.get("user-agent") || null };
}

// Public catalog endpoints intentionally return active records only.
router.get("/colleges", async (_req: Request, res: Response) => {
  try {
    const colleges = await prisma.college.findMany({
      where: { isActive: true },
      include: {
        programs: {
          where: { isActive: true },
          include: { majors: { where: { isActive: true } } },
        },
      },
      orderBy: { name: "asc" },
    });
    res.json({ colleges });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch colleges" });
  }
});

router.get("/programs", async (req: Request, res: Response) => {
  try {
    const { collegeId } = req.query;
    const programs = await prisma.program.findMany({
      where: {
        isActive: true,
        college: { isActive: true },
        ...(collegeId && { collegeId: String(collegeId) }),
      },
      include: {
        college: true,
        researchTypes: true,
        majors: { where: { isActive: true }, orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    });
    res.json({ programs });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch programs" });
  }
});

// System administrators receive inactive entries and dependency counts here.
router.get(
  "/academic-structure",
  ...configureAccess,
  async (_req: Request, res: Response) => {
    try {
      const colleges = await prisma.college.findMany({
        include: {
          programs: {
            include: {
              majors: { orderBy: { name: "asc" } },
              _count: {
                select: {
                  users: true,
                  researchProjects: true,
                  researchTypes: true,
                  calendarEvents: true,
                },
              },
            },
            orderBy: { name: "asc" },
          },
          _count: {
            select: { users: true, researchProjects: true, programs: true },
          },
        },
        orderBy: { name: "asc" },
      });
      res.json({ colleges });
    } catch (error: any) {
      res
        .status(500)
        .json({
          error: error.message || "Failed to fetch the academic structure",
        });
    }
  },
);

router.post(
  "/colleges",
  ...configureAccess,
  validateBody(collegeMutationSchema),
  async (req: Request, res: Response) => {
    try {
      const { password, code, name, description, isActive } = req.body;
      if (!(await verifyPassword(req.user!.id, password)))
        return void res
          .status(401)
          .json({ error: "Your password could not be verified." });

      const college = await prisma.$transaction(async (tx) => {
        const created = await tx.college.create({
          data: {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            description: normalizedText(description),
            isActive,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: AuditAction.CREATE,
            entityType: "College",
            entityId: created.id,
            newValues: {
              code: created.code,
              name: created.name,
              description: created.description,
              isActive: created.isActive,
            },
            ...auditContext(req),
          },
        });
        return created;
      });
      res.status(201).json({ college });
    } catch (error: any) {
      mutationError(res, error, "Failed to create college");
    }
  },
);

router.patch(
  "/colleges/:id",
  ...configureAccess,
  validateBody(collegeUpdateSchema),
  async (req: Request, res: Response) => {
    try {
      const { password, code, name, description, isActive } = req.body;
      if (!(await verifyPassword(req.user!.id, password)))
        return void res
          .status(401)
          .json({ error: "Your password could not be verified." });

      const existing = await prisma.college.findUnique({
        where: { id: req.params.id as string },
        include: {
          _count: {
            select: {
              programs: { where: { isActive: true } },
              users: true,
              researchProjects: true,
            },
          },
        },
      });
      if (!existing)
        return void res.status(404).json({ error: "College not found." });
      if (isActive === false && existing._count.programs > 0)
        return void res
          .status(409)
          .json({
            error:
              "Archive or move the college's active programs before archiving this college.",
          });

      const data = {
        ...(code !== undefined && { code: code.trim().toUpperCase() }),
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && {
          description: normalizedText(description),
        }),
        ...(isActive !== undefined && { isActive }),
      };
      const college = await prisma.$transaction(async (tx) => {
        const updated = await tx.college.update({
          where: { id: existing.id },
          data,
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: AuditAction.UPDATE,
            entityType: "College",
            entityId: updated.id,
            oldValues: {
              code: existing.code,
              name: existing.name,
              description: existing.description,
              isActive: existing.isActive,
            },
            newValues: {
              code: updated.code,
              name: updated.name,
              description: updated.description,
              isActive: updated.isActive,
            },
            ...auditContext(req),
          },
        });
        return updated;
      });
      res.json({ college });
    } catch (error: any) {
      mutationError(res, error, "Failed to update college");
    }
  },
);

router.post(
  "/programs",
  ...configureAccess,
  validateBody(programMutationSchema),
  async (req: Request, res: Response) => {
    try {
      const {
        password,
        majors = [],
        code,
        name,
        description,
        collegeId,
        hasMajors,
        isActive,
      } = req.body;
      if (!(await verifyPassword(req.user!.id, password)))
        return void res
          .status(401)
          .json({ error: "Your password could not be verified." });
      const college = await prisma.college.findFirst({
        where: { id: collegeId, isActive: true },
        select: { id: true },
      });
      if (!college)
        return void res
          .status(400)
          .json({ error: "Select an active college." });
      if (!hasMajors && majors.length)
        return void res
          .status(400)
          .json({ error: "Enable majors before adding major entries." });

      const program = await prisma.$transaction(async (tx) => {
        const created = await tx.program.create({
          data: {
            collegeId,
            code: code.trim().toUpperCase(),
            name: name.trim(),
            description: normalizedText(description),
            hasMajors,
            isActive,
            ...(hasMajors && majors.length
              ? {
                  majors: {
                    create: majors.map(
                      (major: {
                        code?: string;
                        name: string;
                        description?: string;
                      }) => ({
                        code: normalizedCode(major.code),
                        name: major.name.trim(),
                        description: normalizedText(major.description),
                      }),
                    ),
                  },
                }
              : {}),
          },
          include: { majors: true },
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: AuditAction.CREATE,
            entityType: "Program",
            entityId: created.id,
            newValues: {
              collegeId,
              code: created.code,
              name: created.name,
              hasMajors,
              isActive,
              majors: created.majors.map((major) => ({
                id: major.id,
                code: major.code,
                name: major.name,
                isActive: major.isActive,
              })),
            },
            ...auditContext(req),
          },
        });
        return created;
      });
      res.status(201).json({ program });
    } catch (error: any) {
      mutationError(res, error, "Failed to create program");
    }
  },
);

router.patch(
  "/programs/:id",
  ...configureAccess,
  validateBody(programUpdateSchema),
  async (req: Request, res: Response) => {
    try {
      const {
        password,
        collegeId,
        code,
        name,
        description,
        hasMajors,
        isActive,
      } = req.body;
      if (!(await verifyPassword(req.user!.id, password)))
        return void res
          .status(401)
          .json({ error: "Your password could not be verified." });

      const existing = await prisma.program.findUnique({
        where: { id: req.params.id as string },
        include: {
          majors: true,
          _count: {
            select: {
              users: true,
              researchProjects: true,
              researchTypes: true,
              calendarEvents: true,
            },
          },
        },
      });
      if (!existing)
        return void res.status(404).json({ error: "Program not found." });
      if (collegeId && collegeId !== existing.collegeId) {
        const dependencyCount = Object.values(existing._count).reduce(
          (total, count) => total + count,
          0,
        );
        if (dependencyCount > 0)
          return void res
            .status(409)
            .json({
              error:
                "This program cannot be moved because it already has related records.",
            });
        const college = await prisma.college.findFirst({
          where: { id: collegeId, isActive: true },
          select: { id: true },
        });
        if (!college)
          return void res
            .status(400)
            .json({ error: "Select an active college." });
      }
      if (isActive === true && !existing.isActive) {
        const parentCollege = await prisma.college.findFirst({
          where: { id: collegeId || existing.collegeId, isActive: true },
          select: { id: true },
        });
        if (!parentCollege)
          return void res
            .status(409)
            .json({
              error:
                "Restore the parent college before restoring this program.",
            });
      }

      const data = {
        ...(collegeId !== undefined && { collegeId }),
        ...(code !== undefined && { code: code.trim().toUpperCase() }),
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && {
          description: normalizedText(description),
        }),
        ...(hasMajors !== undefined && { hasMajors }),
        ...(isActive !== undefined && { isActive }),
      };
      const program = await prisma.$transaction(async (tx) => {
        const updated = await tx.program.update({
          where: { id: existing.id },
          data,
          include: { majors: true },
        });
        if (hasMajors === false)
          await tx.programMajor.updateMany({
            where: { programId: existing.id, isActive: true },
            data: { isActive: false },
          });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: AuditAction.UPDATE,
            entityType: "Program",
            entityId: updated.id,
            oldValues: {
              collegeId: existing.collegeId,
              code: existing.code,
              name: existing.name,
              description: existing.description,
              hasMajors: existing.hasMajors,
              isActive: existing.isActive,
            },
            newValues: {
              collegeId: updated.collegeId,
              code: updated.code,
              name: updated.name,
              description: updated.description,
              hasMajors: updated.hasMajors,
              isActive: updated.isActive,
            },
            ...auditContext(req),
          },
        });
        return updated;
      });
      res.json({ program });
    } catch (error: any) {
      mutationError(res, error, "Failed to update program");
    }
  },
);

router.post(
  "/programs/:programId/majors",
  ...configureAccess,
  validateBody(programMajorMutationSchema),
  async (req: Request, res: Response) => {
    try {
      const { password, code, name, description } = req.body;
      if (!(await verifyPassword(req.user!.id, password)))
        return void res
          .status(401)
          .json({ error: "Your password could not be verified." });
      const program = await prisma.program.findUnique({
        where: { id: req.params.programId as string },
        select: { id: true },
      });
      if (!program)
        return void res.status(404).json({ error: "Program not found." });

      const major = await prisma.$transaction(async (tx) => {
        const created = await tx.programMajor.create({
          data: {
            programId: program.id,
            code: normalizedCode(code),
            name: name.trim(),
            description: normalizedText(description),
          },
        });
        await tx.program.update({
          where: { id: program.id },
          data: { hasMajors: true },
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: AuditAction.CREATE,
            entityType: "ProgramMajor",
            entityId: created.id,
            newValues: {
              programId: program.id,
              code: created.code,
              name: created.name,
              isActive: created.isActive,
            },
            ...auditContext(req),
          },
        });
        return created;
      });
      res.status(201).json({ major });
    } catch (error: any) {
      mutationError(res, error, "Failed to create major");
    }
  },
);

router.patch(
  "/program-majors/:id",
  ...configureAccess,
  validateBody(programMajorUpdateSchema),
  async (req: Request, res: Response) => {
    try {
      const { password, code, name, description, isActive } = req.body;
      if (!(await verifyPassword(req.user!.id, password)))
        return void res
          .status(401)
          .json({ error: "Your password could not be verified." });
      const existing = await prisma.programMajor.findUnique({
        where: { id: req.params.id as string },
      });
      if (!existing)
        return void res.status(404).json({ error: "Major not found." });

      const data = {
        ...(code !== undefined && { code: normalizedCode(code) }),
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && {
          description: normalizedText(description),
        }),
        ...(isActive !== undefined && { isActive }),
      };
      const major = await prisma.$transaction(async (tx) => {
        const updated = await tx.programMajor.update({
          where: { id: existing.id },
          data,
        });
        if (isActive === true)
          await tx.program.update({
            where: { id: existing.programId },
            data: { hasMajors: true },
          });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: AuditAction.UPDATE,
            entityType: "ProgramMajor",
            entityId: updated.id,
            oldValues: {
              code: existing.code,
              name: existing.name,
              description: existing.description,
              isActive: existing.isActive,
            },
            newValues: {
              code: updated.code,
              name: updated.name,
              description: updated.description,
              isActive: updated.isActive,
            },
            ...auditContext(req),
          },
        });
        return updated;
      });
      res.json({ major });
    } catch (error: any) {
      mutationError(res, error, "Failed to update major");
    }
  },
);

// ─── ACADEMIC YEARS ──────────────────────────────────────────────────
router.get("/academic-years", async (_req: Request, res: Response) => {
  try {
    const academicYears = await prisma.academicYear.findMany({
      where: { isActive: true },
      orderBy: { startDate: "desc" },
    });
    res.json({ academicYears });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch academic years" });
  }
});

router.post(
  "/academic-years",
  ...configureAccess,
  validateBody(academicYearSchema),
  async (req: Request, res: Response) => {
    try {
      const { name, startDate, endDate, isCurrent, isActive } = req.body;
      if (isCurrent)
        await prisma.academicYear.updateMany({
          where: { isCurrent: true },
          data: { isCurrent: false },
        });
      const academicYear = await prisma.academicYear.create({
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isCurrent,
          isActive,
        },
      });
      res.status(201).json({ academicYear });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to create academic year" });
    }
  },
);

export default router;
