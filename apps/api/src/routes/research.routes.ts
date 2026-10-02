import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { createResearchSchema, updateResearchSchema, assignMemberSchema } from "@research-management/validations";
import { Permissions } from "@research-management/auth";
import { validateBody } from "../middleware/validate";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

const router = Router();

// GET /api/research
router.get("/", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { status, programId, academicYearId } = req.query;
    const isResearcher = req.user?.roles.includes("RESEARCHER");

    const projects = await prisma.researchProject.findMany({
      where: {
        ...(status && { status: String(status) as any }),
        ...(programId && { programId: String(programId) }),
        ...(academicYearId && { academicYearId: String(academicYearId) }),
        ...(isResearcher && req.user && {
          OR: [
            { createdBy: req.user.id },
            { members: { some: { userId: req.user.id, leftAt: null } } },
          ],
        }),
      },
      include: {
        researchType: true,
        program: true,
        college: true,
        academicYear: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                universityId: true,
              },
            },
          },
        },
        workflowInstance: {
          include: {
            currentStage: true,
            workflow: {
              include: {
                stages: { orderBy: { sequence: "asc" }, include: { tasks: { orderBy: { sequence: "asc" } } } },
              },
            },
            transitions: { orderBy: { createdAt: "desc" } },
          },
        },
        taskSubmissions: {
          include: {
            task: true,
            document: {
              select: {
                id: true,
                title: true,
                currentVersion: true,
                versions: {
                  where: { status: "ACTIVE" },
                  orderBy: { versionNumber: "desc" },
                  take: 1,
                  select: {
                    id: true,
                    versionNumber: true,
                    fileName: true,
                    mimeType: true,
                    googleDriveFileId: true,
                    uploadedAt: true,
                  },
                },
              },
            },
            submittedByUser: {
              select: { id: true, firstName: true, lastName: true, universityId: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ projects });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch research projects" });
  }
});

// POST /api/research
router.post(
  "/",
  requireAuth,
  requirePermission(Permissions.RESEARCH_CREATE),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { title, abstract } = req.body;
      let { researchTypeId, programId, collegeId, academicYearId } = req.body;

      if (!title || typeof title !== "string" || title.trim().length < 3) {
        res.status(400).json({ error: "Research title must be at least 3 characters long." });
        return;
      }

      // Auto-resolve missing IDs from active database records
      if (!collegeId || !programId) {
        const userDb = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { collegeId: true, programId: true },
        });
        if (!collegeId) {
          collegeId = userDb?.collegeId || (await prisma.college.findFirst())?.id;
        }
        if (!programId) {
          programId = userDb?.programId || (await prisma.program.findFirst())?.id;
        }
      }

      if (!academicYearId) {
        const defaultAY = (await prisma.academicYear.findFirst({ where: { isCurrent: true } }))
          || (await prisma.academicYear.findFirst());
        academicYearId = defaultAY?.id;
      }

      const existingProject = academicYearId
        ? await prisma.researchProject.findFirst({
            where: {
              academicYearId,
              OR: [
                { createdBy: req.user.id },
                { members: { some: { userId: req.user.id, leftAt: null } } },
              ],
            },
            select: { id: true, title: true, status: true },
          })
        : null;

      if (existingProject) {
        res.status(409).json({
          error: existingProject.status === "REJECTED"
            ? "Your rejected project must be deleted before you can register a replacement."
            : "You already have a research project for the current academic year.",
          project: existingProject,
        });
        return;
      }

      let researchType = null;
      if (researchTypeId) {
        researchType = await prisma.researchType.findUnique({
          where: { id: researchTypeId },
          include: {
            workflow: {
              include: {
                stages: {
                  orderBy: { sequence: "asc" },
                  include: { tasks: { orderBy: { sequence: "asc" } } },
                },
              },
            },
          },
        });
      } else {
        researchType = await prisma.researchType.findFirst({
          include: {
            workflow: {
              include: {
                stages: {
                  orderBy: { sequence: "asc" },
                  include: {
                    tasks: { orderBy: { sequence: "asc" } },
                  },
                },
              },
            },
          },
        });
        if (researchType) {
          researchTypeId = researchType.id;
        }
      }

      if (!researchType || !researchTypeId || !collegeId || !programId || !academicYearId) {
        res.status(400).json({
          error: "Unable to resolve required academic program, college, or workflow type.",
        });
        return;
      }

      const initialStage = researchType.workflow?.stages[0];

      // Create project in a transaction
      const project = await prisma.$transaction(async (tx) => {
        const newProject = await tx.researchProject.create({
          data: {
            researchTypeId,
            programId,
            collegeId,
            academicYearId,
            title: title.trim(),
            abstract: abstract?.trim() || null,
            status: "DRAFT",
            createdBy: req.user!.id,
          },
        });

        // Instantiate workflow if template exists
        if (researchType.workflow && initialStage) {
          const wfInstance = await tx.workflowInstance.create({
            data: {
              researchId: newProject.id,
              workflowId: researchType.workflow.id,
              workflowVersion: researchType.workflow.version,
              currentStageId: initialStage.id,
            },
          });

          await tx.researchProject.update({
            where: { id: newProject.id },
            data: { workflowInstanceId: wfInstance.id },
          });
        }

        // Add creator as LEADER
        await tx.researchMember.create({
          data: {
            researchId: newProject.id,
            userId: req.user!.id,
            projectRole: "LEADER",
          },
        });

        return newProject;
      });

      const fullProject = await prisma.researchProject.findUnique({
        where: { id: project.id },
        include: {
          researchType: true,
          program: true,
          college: true,
          academicYear: true,
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  universityId: true,
                },
              },
            },
          },
          workflowInstance: {
            include: {
              currentStage: true,
            },
          },
        },
      });

      res.status(201).json({ project: fullProject });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create research project" });
    }
  }
);

// GET /api/research/:id
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const project = await prisma.researchProject.findUnique({
      where: { id },
      include: {
        researchType: true,
        program: true,
        college: true,
        academicYear: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                universityId: true,
              },
            },
          },
        },
        workflowInstance: {
          include: {
            workflow: {
              include: {
                stages: {
                  orderBy: { sequence: "asc" },
                  include: {
                    tasks: { orderBy: { sequence: "asc" } },
                  },
                },
              },
            },
            currentStage: true,
            transitions: {
              include: {
                fromStage: true,
                toStage: true,
                performedByUser: {
                  select: { firstName: true, lastName: true },
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
        documents: {
          include: {
            versions: {
              orderBy: { versionNumber: "desc" },
            },
          },
        },
        taskSubmissions: {
          include: {
            task: true,
            submittedByUser: {
              select: { id: true, firstName: true, lastName: true, universityId: true },
            },
            document: {
              include: {
                versions: {
                  orderBy: { versionNumber: "desc" },
                  take: 1,
                  select: { id: true, fileName: true, mimeType: true, storagePath: true },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: "Research project not found" });
      return;
    }

    res.json({ project });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch research project" });
  }
});

// PATCH /api/research/:id
router.patch(
  "/:id",
  requireAuth,
  requirePermission(Permissions.RESEARCH_EDIT),
  validateBody(updateResearchSchema),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const updatedProject = await prisma.researchProject.update({
        where: { id },
        data: req.body,
      });

      res.json({ project: updatedProject });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update research project" });
    }
  }
);

// DELETE /api/research/:id
// Researchers may only remove their own rejected project before registering a replacement.
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const id = req.params.id as string;
    const project = await prisma.researchProject.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        createdBy: true,
        workflowInstanceId: true,
        members: {
          where: { userId: req.user.id, projectRole: "LEADER" },
          select: { id: true },
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: "Research project not found." });
      return;
    }
    if (project.createdBy !== req.user.id && project.members.length === 0) {
      res.status(403).json({ error: "Only the project creator or group leader may delete this project." });
      return;
    }
    if (project.status !== "REJECTED") {
      res.status(409).json({ error: "Only a rejected project can be deleted and replaced." });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.researchProject.delete({ where: { id: project.id } });
      if (project.workflowInstanceId) {
        await tx.workflowInstance.delete({ where: { id: project.workflowInstanceId } });
      }
    });

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete rejected research project" });
  }
});

// POST /api/research/:id/members
router.post(
  "/:id/members",
  requireAuth,
  requirePermission(Permissions.RESEARCH_ASSIGN),
  validateBody(assignMemberSchema),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { userId, projectRole } = req.body;

      const member = await prisma.researchMember.upsert({
        where: {
          researchId_userId_projectRole: {
            researchId: id,
            userId,
            projectRole,
          },
        },
        update: { projectRole },
        create: {
          researchId: id,
          userId,
          projectRole,
        },
      });

      res.status(201).json({ member });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to assign project member" });
    }
  }
);

export default router;
