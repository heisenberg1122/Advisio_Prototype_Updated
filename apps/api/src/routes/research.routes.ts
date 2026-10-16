import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import {
  createResearchSchema,
  updateResearchSchema,
  assignMemberSchema,
} from "@research-management/validations";
import { Permissions } from "@research-management/auth";
import { validateBody } from "../middleware/validate";
import { requireAuth, type AuthenticatedUser } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { randomBytes } from "node:crypto";
import { getCollegeScope } from "../lib/college-scope.js";

const router = Router();

function researchScopeWhere(user: AuthenticatedUser) {
  const scope = getCollegeScope(user);
  const collegeWhere = scope.kind === "college" ? { collegeId: scope.collegeId } : {};
  if (scope.kind === "institution" || user.roles.includes("RESEARCH_COORDINATOR")) return collegeWhere;

  const access: any[] = [];
  if (user.roles.includes("RESEARCHER")) {
    access.push({ OR: [{ createdBy: user.id }, { members: { some: { userId: user.id, leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] } } } }, { workspace: { is: { members: { some: { userId: user.id, leftAt: null } } } } }] });
  }
  if (user.roles.includes("ADVISER")) {
    access.push({ members: { some: { userId: user.id, leftAt: null, projectRole: "ADVISER" } } });
  }
  if (user.roles.includes("PANELIST")) {
    access.push({
      OR: [
        { members: { some: { userId: user.id, leftAt: null, projectRole: "PANELIST" } } },
        { defenseSessions: { some: { invitations: { some: { inviteeId: user.id, status: { not: "REMOVED" } } } } } },
      ],
    });
  }
  return { ...collegeWhere, ...(access.length ? { OR: access } : { createdBy: user.id }) };
}

const PARTICIPATION_MODES = new Set(["SOLO", "GROUP"]);
const ACCESS_MODES = new Set([
  "INVITE_ONLY",
  "PUBLIC_APPROVAL",
  "PUBLIC_OPEN",
]);

const makeInviteCode = () => randomBytes(6).toString("hex").toUpperCase();

async function activeResearchMembership(userId: string, exceptResearchId?: string) {
  return prisma.researchMember.findFirst({
    where: {
      userId,
      leftAt: null,
      projectRole: { in: ["LEADER", "MEMBER"] },
      research: { status: { not: "ARCHIVED" } },
      ...(exceptResearchId ? { researchId: { not: exceptResearchId } } : {}),
    },
  });
}

// GET /api/research
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, programId, academicYearId } = req.query;
    const scope = getCollegeScope(req.user!);
    if (scope.kind === "unassigned") {
      res.status(403).json({ error: "Your account has not been assigned to a college or school. Contact the System Administrator." });
      return;
    }

    const projects = await prisma.researchProject.findMany({
      where: {
        ...researchScopeWhere(req.user!),
        ...(status
          ? { status: String(status) as any }
          : req.user!.roles.includes("RESEARCHER")
            ? { status: { not: "ARCHIVED" as const } }
            : {}),
        ...(programId && { programId: String(programId) }),
        ...(academicYearId && { academicYearId: String(academicYearId) }),
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
                stages: {
                  where: { category: { not: "Archived" } },
                  orderBy: { sequence: "asc" },
                  include: { topic: true, tasks: { orderBy: { sequence: "asc" } } },
                },
              },
            },
            transitions: { orderBy: { createdAt: "desc" } },
          },
        },
        taskSubmissions: {
          include: {
            task: true,
            documentVersion: {
              select: {
                id: true,
                versionNumber: true,
                fileName: true,
                manuscriptStatus: true,
              },
            },
            attempts: {
              orderBy: { attemptNumber: "asc" },
              include: {
                documentVersion: {
                  select: {
                    id: true,
                    versionNumber: true,
                    fileName: true,
                    manuscriptStatus: true,
                  },
                },
                submittedByUser: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    universityId: true,
                  },
                },
              },
            },
            document: {
              select: {
                id: true,
                title: true,
                currentVersion: true,
                versions: {
                  orderBy: { versionNumber: "desc" },
                  select: {
                    id: true,
                    versionNumber: true,
                    fileName: true,
                    mimeType: true,
                    googleDriveFileId: true,
                    uploadedAt: true,
                    sourceSignature: { select: { signedVersionId: true, signedAt: true } },
                    signedSignature: {
                      select: {
                        signedAt: true,
                        verificationCode: true,
                        revokedAt: true,
                        signedBy: { select: { firstName: true, lastName: true } },
                      },
                    },
                  },
                },
              },
            },
            submittedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                universityId: true,
              },
            },
          },
        },
        titleRevisions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ projects });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch research projects" });
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
      let participationMode = PARTICIPATION_MODES.has(
        String(req.body.participationMode || "SOLO").toUpperCase(),
      )
        ? String(req.body.participationMode || "SOLO").toUpperCase()
        : "SOLO";
      const requestedAccessMode = String(
        req.body.accessMode || "INVITE_ONLY",
      ).toUpperCase();
      let accessMode = ACCESS_MODES.has(requestedAccessMode)
        ? requestedAccessMode
        : "INVITE_ONLY";
      let groupName =
        typeof req.body.groupName === "string" ? req.body.groupName.trim() : "";
      const workspaceId = typeof req.body.workspaceId === "string" ? req.body.workspaceId : null;
      if (groupName.length > 120) {
        res.status(400).json({ error: "Group name must be 120 characters or fewer." });
        return;
      }

      const scope = getCollegeScope(req.user);
      if (scope.kind === "unassigned") {
        res.status(403).json({ error: "Your account has not been assigned to a college or school. Contact the System Administrator." });
        return;
      }
      if (scope.kind === "college") {
        if (collegeId && collegeId !== scope.collegeId) {
          res.status(403).json({ error: "You cannot create research outside your assigned college or school." });
          return;
        }
        collegeId = scope.collegeId;
      }

      let workspace: { id: string; name: string; inviteCode: string; participationMode: "SOLO" | "GROUP"; accessMode: "INVITE_ONLY" | "PUBLIC_APPROVAL" | "PUBLIC_OPEN"; inviteCodeEnabled: boolean; collegeId: string; programId: string } | null = null;
      if (workspaceId) {
        workspace = await prisma.researchWorkspace.findFirst({
          where: { id: workspaceId, members: { some: { userId: req.user.id, role: "LEADER", leftAt: null } } },
          select: { id: true, name: true, inviteCode: true, participationMode: true, accessMode: true, inviteCodeEnabled: true, collegeId: true, programId: true },
        }) as typeof workspace;
        if (!workspace) { res.status(403).json({ error: "Only a workspace leader can register its research project." }); return; }
        participationMode = workspace.participationMode;
        groupName = workspace.participationMode === "GROUP" ? workspace.name : "";
        accessMode = workspace.accessMode;
        collegeId = workspace.collegeId;
        programId = workspace.programId;
      }

      if (!title || typeof title !== "string" || title.trim().length < 3) {
        res.status(400).json({
          error: "Research title must be at least 3 characters long.",
        });
        return;
      }

      // Auto-resolve missing IDs from active database records
      if (!collegeId || !programId) {
        const userDb = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { collegeId: true, programId: true },
        });
        if (!collegeId) collegeId = userDb?.collegeId;
        if (!programId) {
          programId =
            userDb?.programId || (await prisma.program.findFirst({ where: collegeId ? { collegeId, isActive: true } : { isActive: true } }))?.id;
        }
      }

      if (!academicYearId) {
        const defaultAY =
          (await prisma.academicYear.findFirst({
            where: { isCurrent: true },
          })) || (await prisma.academicYear.findFirst());
        academicYearId = defaultAY?.id;
      }

      if (programId && collegeId) {
        const program = await prisma.program.findFirst({ where: { id: programId, collegeId, isActive: true }, select: { id: true } });
        if (!program) {
          res.status(400).json({ error: "The selected program does not belong to your assigned college or school." });
          return;
        }
      }

      const existingProject = academicYearId
        ? await prisma.researchProject.findFirst({
            where: {
              academicYearId,
              // A disbanded group is retained as an archived academic record,
              // but must not prevent its former leader from registering a
              // replacement project in the same academic year.
              status: { not: "ARCHIVED" },
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
          error:
            existingProject.status === "REJECTED"
              ? "Revise the rejected title in My Projects instead of creating a replacement."
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
                  where: { category: { not: "Archived" } },
                  orderBy: { sequence: "asc" },
                  include: { topic: true, tasks: { orderBy: { sequence: "asc" } } },
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
                  where: { category: { not: "Archived" } },
                  orderBy: { sequence: "asc" },
                  include: {
                    topic: true,
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

      if (
        !researchType ||
        !researchTypeId ||
        !collegeId ||
        !programId ||
        !academicYearId
      ) {
        res.status(400).json({
          error:
            "Unable to resolve required academic program, college, or workflow type.",
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
            groupName: groupName || null,
            participationMode: participationMode as any,
            accessMode:
              participationMode === "GROUP" ? (accessMode as any) : "INVITE_ONLY",
            inviteCode:
              participationMode === "GROUP" ? (workspace?.participationMode === "GROUP" ? workspace.inviteCode : makeInviteCode()) : null,
            inviteCodeEnabled: participationMode === "GROUP" && (workspace ? workspace.inviteCodeEnabled : true),
            abstract: abstract?.trim() || null,
            status: "DRAFT",
            createdBy: req.user!.id,
            workspaceId: workspace?.id,
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

          // The creator is the project's active leader and receives this
          // workflow automatically, so keep their enrollment badge in sync.
          await tx.workflowEnrollment.upsert({
            where: {
              workflowId_userId: {
                workflowId: researchType.workflow.id,
                userId: req.user!.id,
              },
            },
            update: { status: "ACTIVE", joinedAt: new Date() },
            create: {
              workflowId: researchType.workflow.id,
              userId: req.user!.id,
            },
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

        if (workspace) {
          const otherMembers = await tx.workspaceMember.findMany({ where: { workspaceId: workspace.id, leftAt: null, userId: { not: req.user!.id } }, select: { userId: true } });
          if (otherMembers.length) await tx.researchMember.createMany({
            data: otherMembers.map(({ userId }) => ({ researchId: newProject.id, userId, projectRole: "MEMBER" as const })),
            skipDuplicates: true,
          });
          if (researchType.workflow && otherMembers.length) {
            for (const { userId } of otherMembers) await tx.workflowEnrollment.upsert({
              where: { workflowId_userId: { workflowId: researchType.workflow.id, userId } },
              update: { status: "ACTIVE", joinedAt: new Date() },
              create: { workflowId: researchType.workflow.id, userId },
            });
          }
        }

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
      res
        .status(500)
        .json({ error: error.message || "Failed to create research project" });
    }
  },
);

// GET /api/research/:id
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const scope = getCollegeScope(req.user!);
    if (scope.kind === "unassigned") {
      res.status(403).json({ error: "Your account has not been assigned to a college or school. Contact the System Administrator." });
      return;
    }

    const project = await prisma.researchProject.findFirst({
      where: { id, ...researchScopeWhere(req.user!) },
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
                  where: { category: { not: "Archived" } },
                  orderBy: { sequence: "asc" },
                  include: {
                    topic: true,
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
            documentVersion: {
              select: {
                id: true,
                versionNumber: true,
                fileName: true,
                manuscriptStatus: true,
              },
            },
            attempts: {
              orderBy: { attemptNumber: "asc" },
              include: {
                documentVersion: {
                  select: {
                    id: true,
                    versionNumber: true,
                    fileName: true,
                    manuscriptStatus: true,
                  },
                },
                submittedByUser: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    universityId: true,
                  },
                },
              },
            },
            submittedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                universityId: true,
              },
            },
            document: {
              include: {
                versions: {
                  orderBy: { versionNumber: "desc" },
                  take: 1,
                  select: {
                    id: true,
                    fileName: true,
                    mimeType: true,
                    storagePath: true,
                    sourceSignature: { select: { signedVersionId: true, signedAt: true } },
                    signedSignature: {
                      select: {
                        signedAt: true,
                        verificationCode: true,
                        revokedAt: true,
                        signedBy: { select: { firstName: true, lastName: true } },
                      },
                    },
                  },
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
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch research project" });
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
      if (
        req.user!.roles.includes("RESEARCHER") &&
        !req.user!.roles.includes("SYSTEM_ADMIN")
      ) {
        res.status(403).json({
          error:
            "Researchers must update project details through the leader-managed project editor.",
        });
        return;
      }
      const scope = getCollegeScope(req.user!);
      if (scope.kind === "unassigned") {
        res.status(403).json({ error: "Your account has not been assigned to a college or school. Contact the System Administrator." });
        return;
      }
      const accessible = await prisma.researchProject.findFirst({ where: { id, ...researchScopeWhere(req.user!) }, select: { id: true } });
      if (!accessible) {
        res.status(404).json({ error: "Research project not found in your college scope." });
        return;
      }
      const updatedProject = await prisma.researchProject.update({
        where: { id },
        data: req.body,
      });

      res.json({ project: updatedProject });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to update research project" });
    }
  },
);

// POST /api/research/:id/remove-from-workflow — detach a project from the
// professor's active workflow without changing or deleting the project itself.
router.post(
  "/:id/remove-from-workflow",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const reason =
        typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (reason.length < 5 || reason.length > 500) {
        return void res.status(400).json({
          error: "Provide a removal reason between 5 and 500 characters.",
        });
      }
      const scope = getCollegeScope(req.user!);
      if (scope.kind === "unassigned") {
        return void res.status(403).json({
          error: "Your account has not been assigned to a college or school.",
        });
      }

      const project = await prisma.researchProject.findFirst({
        where: { id, ...researchScopeWhere(req.user!) },
        select: { id: true, status: true, workflowInstanceId: true },
      });
      if (!project) {
        return void res.status(404).json({
          error: "Research project was not found in your academic scope.",
        });
      }

      if (!project.workflowInstanceId) {
        return void res.status(409).json({
          error: "This project is not currently assigned to a workflow.",
        });
      }

      const detachedProject = await prisma.$transaction(async (tx) => {
        const detached = await tx.researchProject.update({
          where: { id: project.id },
          data: { workflowInstanceId: null },
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "UPDATE",
            entityType: "ResearchProject",
            entityId: project.id,
            oldValues: {
              status: project.status,
              workflowInstanceId: project.workflowInstanceId,
            },
            newValues: {
              status: project.status,
              workflowInstanceId: null,
              removalReason: reason,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
        return detached;
      });

      res.json({ project: detachedProject });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to remove the project from the workflow.",
      });
    }
  },
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
      res.status(403).json({
        error:
          "Only the project creator or group leader may delete this project.",
      });
      return;
    }
    if (project.status !== "REJECTED") {
      res.status(409).json({
        error: "Only a rejected project can be deleted and replaced.",
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.researchProject.delete({ where: { id: project.id } });
      if (project.workflowInstanceId) {
        await tx.workflowInstance.delete({
          where: { id: project.workflowInstanceId },
        });
      }
    });

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({
      error: error.message || "Failed to delete rejected research project",
    });
  }
});

// PATCH /api/research/:id/group-name — optional group label, separate from the official title.
router.patch(
  "/:id/group-name",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Unauthorized" });
      const id = req.params.id as string;
      const groupName =
        typeof req.body.groupName === "string" ? req.body.groupName.trim() : "";
      if (groupName.length > 120)
        return void res
          .status(400)
          .json({ error: "Group name must be 120 characters or fewer." });
      const leader = await prisma.researchMember.findFirst({
        where: {
          researchId: id,
          userId: req.user.id,
          projectRole: "LEADER",
          leftAt: null,
        },
      });
      if (!leader)
        return void res.status(403).json({
          error: "Only the current group leader may rename the group.",
        });
      const project = await prisma.researchProject.update({
        where: { id },
        data: { groupName: groupName || null },
      });
      res.json({ project });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to update group name" });
    }
  },
);

// POST /api/research/:id/invite-code — leader creates or rotates a shareable group invite.
router.post(
  "/:id/invite-code",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Unauthorized" });
      const id = req.params.id as string;
      const leader = await prisma.researchMember.findFirst({
        where: {
          researchId: id,
          userId: req.user.id,
          projectRole: "LEADER",
          leftAt: null,
        },
      });
      if (!leader)
        return void res.status(403).json({
          error: "Only the current group leader may create an invitation.",
        });
      const requestedAccessMode = String(
        req.body.accessMode || "INVITE_ONLY",
      ).toUpperCase();
      if (!ACCESS_MODES.has(requestedAccessMode))
        return void res.status(400).json({ error: "Choose a valid group access mode." });
      const inviteCode = makeInviteCode();
      const project = await prisma.researchProject.update({
        where: { id },
        data: {
          inviteCode,
          inviteCodeEnabled: true,
          inviteCodeExpiresAt: null,
          participationMode: "GROUP",
          accessMode: requestedAccessMode as any,
        },
      });
      res.json({ inviteCode, project });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to create group invitation" });
    }
  },
);

// PATCH /api/research/:id/access — leader controls solo/group mode and joining.
router.patch("/:id/access", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const researchId = req.params.id as string;
    const leader = await prisma.researchMember.findFirst({
      where: {
        researchId,
        userId: req.user.id,
        projectRole: "LEADER",
        leftAt: null,
      },
    });
    if (!leader)
      return void res.status(403).json({
        error: "Only the current group leader may change project access.",
      });
    const project = await prisma.researchProject.findUnique({
      where: { id: researchId },
      include: {
        members: {
          where: {
            leftAt: null,
            projectRole: { in: ["LEADER", "MEMBER"] },
          },
        },
      },
    });
    if (!project)
      return void res.status(404).json({ error: "Research project not found." });
    const participationMode = String(
      req.body.participationMode || project.participationMode,
    ).toUpperCase();
    const accessMode = String(req.body.accessMode || project.accessMode).toUpperCase();
    if (!PARTICIPATION_MODES.has(participationMode))
      return void res.status(400).json({ error: "Choose Solo or Group." });
    if (!ACCESS_MODES.has(accessMode))
      return void res.status(400).json({ error: "Choose a valid group access mode." });
    if (participationMode === "SOLO" && project.members.length > 1)
      return void res.status(409).json({
        error: "Remove or transfer all other active members before switching to Solo.",
      });
    const inviteCodeEnabled =
      participationMode === "GROUP" && req.body.inviteCodeEnabled !== false;
    const expiresAt = req.body.inviteCodeExpiresAt
      ? new Date(req.body.inviteCodeExpiresAt)
      : null;
    if (expiresAt && !Number.isFinite(expiresAt.getTime()))
      return void res.status(400).json({ error: "Choose a valid invitation expiry." });
    const updated = await prisma.researchProject.update({
      where: { id: researchId },
      data: {
        participationMode: participationMode as any,
        accessMode:
          participationMode === "SOLO" ? "INVITE_ONLY" : (accessMode as any),
        inviteCodeEnabled,
        inviteCodeExpiresAt: inviteCodeEnabled ? expiresAt : null,
        inviteCode:
          inviteCodeEnabled && !project.inviteCode
            ? makeInviteCode()
            : participationMode === "SOLO"
              ? null
              : project.inviteCode,
      },
    });
    res.json({ project: updated });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to update project access." });
  }
});

// GET /api/research/join/:code/preview — safe confirmation before joining.
router.get("/join/:code/preview", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const code = String(req.params.code || "").trim().toUpperCase();
    const project = await prisma.researchProject.findFirst({
      where: {
        inviteCode: code,
        inviteCodeEnabled: true,
        OR: [
          { inviteCodeExpiresAt: null },
          { inviteCodeExpiresAt: { gt: new Date() } },
        ],
        status: { notIn: ["ARCHIVED", "COMPLETED", "REJECTED"] },
      },
      include: {
        program: { select: { id: true, code: true, name: true } },
        members: {
          where: {
            leftAt: null,
            projectRole: { in: ["LEADER", "MEMBER", "ADVISER"] },
          },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        adviserRequests: {
          where: { status: "ACCEPTED" },
          include: {
            adviser: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });
    if (!project)
      return void res.status(404).json({
        error: "This group code is invalid, disabled, or expired.",
      });
    const researcherCount = project.members.filter((member) =>
      ["LEADER", "MEMBER"].includes(member.projectRole),
    ).length;
    const leader = project.members.find((member) => member.projectRole === "LEADER");
    const memberAdviser = project.members.find(
      (member) => member.projectRole === "ADVISER",
    );
    const adviser = memberAdviser?.user || project.adviserRequests[0]?.adviser || null;
    res.json({
      project: {
        id: project.id,
        title: project.title,
        groupName: project.groupName,
        participationMode: project.participationMode,
        accessMode: project.accessMode,
        program: project.program,
        memberCount: researcherCount,
        leader: leader?.user || null,
        adviser,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || "Failed to preview the research group.",
    });
  }
});

// POST /api/research/join/:code — researcher joins a group through its current invite.
router.post("/join/:code", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const code = String(req.params.code || "")
      .trim()
      .toUpperCase();
    const project = await prisma.researchProject.findFirst({
      where: {
        inviteCode: code,
        inviteCodeEnabled: true,
        OR: [
          { inviteCodeExpiresAt: null },
          { inviteCodeExpiresAt: { gt: new Date() } },
        ],
        status: { notIn: ["ARCHIVED", "COMPLETED", "REJECTED"] },
      },
      include: {
        members: {
          where: { leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] } },
        },
        workflowInstance: { select: { workflowId: true } },
      },
    });
    if (!project)
      return void res
        .status(404)
        .json({ error: "This invitation is invalid or no longer active." });
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { collegeId: true, programId: true },
    });
    if (!user || user.collegeId !== project.collegeId || user.programId !== project.programId)
      return void res.status(403).json({
        error: "This group is only available to researchers in the same program.",
      });
    const otherMembership = await activeResearchMembership(req.user.id, project.id);
    if (otherMembership)
      return void res.status(409).json({
        error: "Leave your current group before joining another project.",
      });
    const existing = await prisma.researchMember.findFirst({
      where: {
        researchId: project.id,
        userId: req.user.id,
        projectRole: { in: ["LEADER", "MEMBER"] },
      },
    });
    if (existing && !existing.leftAt)
      return void res.status(409).json({
        error: "You are already an active member of this research group.",
      });
    if (project.accessMode === "PUBLIC_APPROVAL") {
      const request = await prisma.researchJoinRequest.upsert({
        where: {
          researchId_requesterId: {
            researchId: project.id,
            requesterId: req.user.id,
          },
        },
        update: {
          status: "PENDING",
          responseNote: null,
          respondedBy: null,
          respondedAt: null,
        },
        create: { researchId: project.id, requesterId: req.user.id },
      });
      const leader = project.members.find((member) => member.projectRole === "LEADER");
      if (leader)
        await prisma.notification.create({
          data: {
            recipientId: leader.userId,
            type: "WORKFLOW_CHANGED",
            title: "New research group join request",
            message: "A researcher requested to join your research group.",
            entityType: "ResearchProject",
            entityId: project.id,
          },
        });
      return void res.status(202).json({
        pendingApproval: true,
        request,
        project: { id: project.id, title: project.title, groupName: project.groupName },
      });
    }
    const { member, enrollment } = await prisma.$transaction(async (tx) => {
      const member = existing
        ? await tx.researchMember.update({
            where: { id: existing.id },
            data: {
              projectRole:
                existing.projectRole === "LEADER" ? "LEADER" : "MEMBER",
              leftAt: null,
              joinedAt: new Date(),
            },
          })
        : await tx.researchMember.create({
            data: {
              researchId: project.id,
              userId: req.user!.id,
              projectRole: "MEMBER",
            },
          });
      const enrollment = project.workflowInstance?.workflowId
        ? await tx.workflowEnrollment.upsert({
            where: {
              workflowId_userId: {
                workflowId: project.workflowInstance.workflowId,
                userId: req.user!.id,
              },
            },
            update: { status: "ACTIVE", joinedAt: new Date() },
            create: {
              workflowId: project.workflowInstance.workflowId,
              userId: req.user!.id,
            },
          })
        : null;
      if (project.workspaceId) await tx.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: req.user!.id } },
        update: { leftAt: null },
        create: { workspaceId: project.workspaceId, userId: req.user!.id, role: "MEMBER" },
      });
      await tx.researchProject.update({
        where: { id: project.id },
        data: { participationMode: "GROUP" },
      });
      return { member, enrollment };
    });
    res.status(201).json({
      member,
      enrollment,
      project: {
        id: project.id,
        title: project.title,
        groupName: project.groupName,
      },
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to join research group" });
  }
});

// GET /api/research/:id/join-requests — group leader reviews pending requests.
router.get(
  "/:id/join-requests",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
      const researchId = req.params.id as string;
      const leader = await prisma.researchMember.findFirst({
        where: {
          researchId,
          userId: req.user.id,
          projectRole: "LEADER",
          leftAt: null,
        },
      });
      if (!leader)
        return void res.status(403).json({
          error: "Only the current group leader may view join requests.",
        });
      const requests = await prisma.researchJoinRequest.findMany({
        where: { researchId },
        orderBy: { createdAt: "desc" },
      });
      const users = await prisma.user.findMany({
        where: { id: { in: requests.map((request) => request.requesterId) } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          universityId: true,
        },
      });
      const usersById = new Map(users.map((user) => [user.id, user]));
      res.json({
        requests: requests.map((request) => ({
          ...request,
          requester: usersById.get(request.requesterId) || null,
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to load group join requests.",
      });
    }
  },
);

// PATCH /api/research/:id/join-requests/:requestId — approve or reject.
router.patch(
  "/:id/join-requests/:requestId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
      const researchId = req.params.id as string;
      const requestId = req.params.requestId as string;
      const action = String(req.body.action || "").toUpperCase();
      if (!["ACCEPT", "REJECT"].includes(action))
        return void res.status(400).json({ error: "Choose Accept or Reject." });
      const leader = await prisma.researchMember.findFirst({
        where: {
          researchId,
          userId: req.user.id,
          projectRole: "LEADER",
          leftAt: null,
        },
      });
      if (!leader)
        return void res.status(403).json({
          error: "Only the current group leader may decide join requests.",
        });
      const joinRequest = await prisma.researchJoinRequest.findFirst({
        where: { id: requestId, researchId, status: "PENDING" },
      });
      if (!joinRequest)
        return void res.status(404).json({
          error: "This pending join request was not found.",
        });
      if (action === "REJECT") {
        const rejected = await prisma.researchJoinRequest.update({
          where: { id: joinRequest.id },
          data: {
            status: "REJECTED",
            responseNote:
              typeof req.body.responseNote === "string"
                ? req.body.responseNote.trim() || null
                : null,
            respondedBy: req.user.id,
            respondedAt: new Date(),
          },
        });
        await prisma.notification.create({
          data: {
            recipientId: joinRequest.requesterId,
            type: "WORKFLOW_CHANGED",
            title: "Research group request declined",
            message: "Your request to join the research group was declined.",
            entityType: "ResearchProject",
            entityId: researchId,
          },
        });
        return void res.json({ request: rejected });
      }
      const otherMembership = await activeResearchMembership(
        joinRequest.requesterId,
        researchId,
      );
      if (otherMembership)
        return void res.status(409).json({
          error: "This researcher already belongs to another active project.",
        });
      const project = await prisma.researchProject.findUnique({
        where: { id: researchId },
        select: {
          title: true,
          groupName: true,
          workspaceId: true,
          workflowInstance: { select: { workflowId: true } },
        },
      });
      if (!project)
        return void res.status(404).json({ error: "Research project not found." });
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.researchMember.findFirst({
          where: {
            researchId,
            userId: joinRequest.requesterId,
            projectRole: { in: ["LEADER", "MEMBER"] },
          },
        });
        const member = existing
          ? await tx.researchMember.update({
              where: { id: existing.id },
              data: { leftAt: null, joinedAt: new Date(), projectRole: "MEMBER" },
            })
          : await tx.researchMember.create({
              data: {
                researchId,
                userId: joinRequest.requesterId,
                projectRole: "MEMBER",
              },
            });
        const enrollment = project.workflowInstance?.workflowId
          ? await tx.workflowEnrollment.upsert({
              where: {
                workflowId_userId: {
                  workflowId: project.workflowInstance.workflowId,
                  userId: joinRequest.requesterId,
                },
              },
              update: { status: "ACTIVE", joinedAt: new Date() },
              create: {
                workflowId: project.workflowInstance.workflowId,
                userId: joinRequest.requesterId,
              },
            })
          : null;
        if (project.workspaceId) await tx.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: joinRequest.requesterId } },
          update: { leftAt: null },
          create: { workspaceId: project.workspaceId, userId: joinRequest.requesterId, role: "MEMBER" },
        });
        const request = await tx.researchJoinRequest.update({
          where: { id: joinRequest.id },
          data: {
            status: "ACCEPTED",
            responseNote: null,
            respondedBy: req.user!.id,
            respondedAt: new Date(),
          },
        });
        await tx.researchProject.update({
          where: { id: researchId },
          data: { participationMode: "GROUP" },
        });
        await tx.notification.create({
          data: {
            recipientId: joinRequest.requesterId,
            type: "WORKFLOW_CHANGED",
            title: "Research group request accepted",
            message: `You are now a member of ${project.groupName || project.title}.`,
            entityType: "ResearchProject",
            entityId: researchId,
          },
        });
        return { member, enrollment, request };
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to decide the join request.",
      });
    }
  },
);

// PATCH /api/research/:id/details — leader edits group details and revises titles.
router.patch(
  "/:id/details",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
      const researchId = req.params.id as string;
      const leader = await prisma.researchMember.findFirst({
        where: {
          researchId,
          userId: req.user.id,
          projectRole: "LEADER",
          leftAt: null,
        },
      });
      if (!leader)
        return void res.status(403).json({
          error: "Only the current group leader may edit project details.",
        });
      const project = await prisma.researchProject.findUnique({
        where: { id: researchId },
      });
      if (!project)
        return void res.status(404).json({ error: "Research project not found." });
      const groupName =
        typeof req.body.groupName === "string"
          ? req.body.groupName.trim()
          : project.groupName || "";
      const title =
        typeof req.body.title === "string"
          ? req.body.title.trim()
          : project.title;
      const abstract =
        typeof req.body.abstract === "string"
          ? req.body.abstract.trim()
          : project.abstract || "";
      const reason =
        typeof req.body.reason === "string" ? req.body.reason.trim() : "";
      if (groupName.length > 120)
        return void res.status(400).json({
          error: "Group name must be 120 characters or fewer.",
        });
      if (title.length < 5)
        return void res.status(400).json({
          error: "Research title must be at least 5 characters long.",
        });
      const titleChanged = title !== project.title;
      if (titleChanged && ["DEFENSE", "COMPLETED", "ARCHIVED"].includes(project.status))
        return void res.status(409).json({
          error: "The research title is locked at this project stage. Ask the coordinator for an amendment.",
        });
      if (titleChanged && project.status === "APPROVED") {
        await prisma.researchTitleRevision.updateMany({
          where: { researchId, status: "PENDING" },
          data: { status: "SUPERSEDED" },
        });
        const revision = await prisma.researchTitleRevision.create({
          data: {
            researchId,
            previousTitle: project.title,
            proposedTitle: title,
            reason: reason || null,
            status: "PENDING",
            requestedBy: req.user.id,
          },
        });
        const updated = await prisma.$transaction(async (tx) => {
          const value = await tx.researchProject.update({
            where: { id: researchId },
            data: { groupName: groupName || null, abstract: abstract || null },
          });
          if (project.workspaceId) await tx.researchWorkspace.update({ where: { id: project.workspaceId }, data: { name: groupName || project.title } });
          return value;
        });
        return void res.json({
          project: updated,
          titleRevision: revision,
          titleChangePending: true,
        });
      }
      const updated = await prisma.$transaction(async (tx) => {
        if (titleChanged)
          await tx.researchTitleRevision.create({
            data: {
              researchId,
              previousTitle: project.title,
              proposedTitle: title,
              reason: reason || null,
              status: "APPLIED",
              requestedBy: req.user!.id,
              reviewedAt: new Date(),
            },
          });
        const value = await tx.researchProject.update({
          where: { id: researchId },
          data: {
            title,
            groupName: groupName || null,
            abstract: abstract || null,
            ...(titleChanged && project.status === "REJECTED"
              ? { status: "REVISION" }
              : {}),
          },
        });
        if (project.workspaceId) await tx.researchWorkspace.update({ where: { id: project.workspaceId }, data: { name: groupName || title } });
        return value;
      });
      res.json({ project: updated, titleChangePending: false });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to update project details.",
      });
    }
  },
);

// PATCH /api/research/:id/title-revisions/:revisionId — faculty amendment decision.
router.patch(
  "/:id/title-revisions/:revisionId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
      const researchId = req.params.id as string;
      const revisionId = req.params.revisionId as string;
      const action = String(req.body.action || "").toUpperCase();
      if (!["ACCEPT", "REJECT"].includes(action))
        return void res.status(400).json({ error: "Choose Accept or Reject." });
      const institutionalReviewer = req.user.roles.some((role) =>
        ["RESEARCH_COORDINATOR", "RPO", "SYSTEM_ADMIN"].includes(role),
      );
      const adviser = institutionalReviewer
        ? null
        : await prisma.researchMember.findFirst({
            where: {
              researchId,
              userId: req.user.id,
              projectRole: "ADVISER",
              leftAt: null,
            },
          });
      if (!institutionalReviewer && !adviser)
        return void res.status(403).json({
          error: "An assigned adviser or research coordinator must review title amendments.",
        });
      const revision = await prisma.researchTitleRevision.findFirst({
        where: { id: revisionId, researchId, status: "PENDING" },
      });
      if (!revision)
        return void res.status(404).json({
          error: "This pending title amendment was not found.",
        });
      const reviewNote =
        typeof req.body.reviewNote === "string"
          ? req.body.reviewNote.trim() || null
          : null;
      const result = await prisma.$transaction(async (tx) => {
        const decided = await tx.researchTitleRevision.update({
          where: { id: revision.id },
          data: {
            status: action === "ACCEPT" ? "ACCEPTED" : "REJECTED",
            reviewedBy: req.user!.id,
            reviewNote,
            reviewedAt: new Date(),
          },
        });
        const project =
          action === "ACCEPT"
            ? await tx.researchProject.update({
                where: { id: researchId },
                data: { title: revision.proposedTitle },
              })
            : await tx.researchProject.findUnique({ where: { id: researchId } });
        await tx.notification.create({
          data: {
            recipientId: revision.requestedBy,
            type: "WORKFLOW_CHANGED",
            title:
              action === "ACCEPT"
                ? "Research title amendment approved"
                : "Research title amendment returned",
            message:
              action === "ACCEPT"
                ? `Your official research title is now “${revision.proposedTitle}”.`
                : reviewNote || "Your proposed title amendment was not approved.",
            entityType: "ResearchProject",
            entityId: researchId,
          },
        });
        return { revision: decided, project };
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to review the title amendment.",
      });
    }
  },
);

router.post(
  "/:id/transfer-leadership",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Unauthorized" });
      const researchId = req.params.id as string;
      const targetUserId = String(req.body.userId || "");
      const members = await prisma.researchMember.findMany({
        where: {
          researchId,
          leftAt: null,
          projectRole: { in: ["LEADER", "MEMBER"] },
        },
      });
      const currentLeader = members.find(
        (member) =>
          member.userId === req.user!.id && member.projectRole === "LEADER",
      );
      const target = members.find(
        (member) =>
          member.userId === targetUserId && member.projectRole === "MEMBER",
      );
      if (!currentLeader)
        return void res
          .status(403)
          .json({ error: "Only the current leader may transfer leadership." });
      if (!target)
        return void res
          .status(400)
          .json({ error: "Select an active group member to become leader." });
      await prisma.$transaction([
        prisma.researchMember.update({
          where: { id: currentLeader.id },
          data: { projectRole: "MEMBER" },
        }),
        prisma.researchMember.update({
          where: { id: target.id },
          data: { projectRole: "LEADER" },
        }),
      ]);
      res.json({ success: true });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to transfer leadership" });
    }
  },
);

router.post("/:id/leave", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const membership = await prisma.researchMember.findFirst({
      where: {
        researchId: req.params.id as string,
        userId: req.user.id,
        leftAt: null,
        projectRole: { in: ["LEADER", "MEMBER"] },
      },
    });
    if (!membership)
      return void res
        .status(404)
        .json({ error: "Active group membership not found." });
    if (membership.projectRole === "LEADER")
      return void res.status(409).json({
        error: "Transfer leadership before leaving, or disband the group.",
      });
    await prisma.researchMember.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });
    res.json({ success: true });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to leave research group" });
  }
});

router.post(
  "/:id/disband",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Unauthorized" });
      const researchId = req.params.id as string;
      const leader = await prisma.researchMember.findFirst({
        where: {
          researchId,
          userId: req.user.id,
          projectRole: "LEADER",
          leftAt: null,
        },
      });
      if (!leader)
        return void res
          .status(403)
          .json({ error: "Only the current leader may disband the group." });
      await prisma.$transaction([
        prisma.researchMember.updateMany({
          where: { researchId, leftAt: null },
          data: { leftAt: new Date() },
        }),
        prisma.researchProject.update({
          where: { id: researchId },
          data: {
            status: "ARCHIVED",
            inviteCode: null,
            inviteCodeEnabled: false,
            inviteCodeExpiresAt: null,
          },
        }),
      ]);
      res.json({ success: true });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to disband research group" });
    }
  },
);

router.delete(
  "/:id/members/:memberId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Unauthorized" });
      const researchId = req.params.id as string;
      const leader = await prisma.researchMember.findFirst({
        where: {
          researchId,
          userId: req.user.id,
          projectRole: "LEADER",
          leftAt: null,
        },
      });
      if (!leader)
        return void res
          .status(403)
          .json({ error: "Only the current leader may remove group members." });
      const member = await prisma.researchMember.findFirst({
        where: {
          id: req.params.memberId as string,
          researchId,
          projectRole: "MEMBER",
          leftAt: null,
        },
      });
      if (!member)
        return void res
          .status(404)
          .json({ error: "Active group member not found." });
      await prisma.researchMember.update({
        where: { id: member.id },
        data: { leftAt: new Date() },
      });
      res.json({ success: true });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to remove group member" });
    }
  },
);

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
      res
        .status(500)
        .json({ error: error.message || "Failed to assign project member" });
    }
  },
);

// POST /api/research/:id/adviser-withdrawal
// Preserve the assignment history while releasing an active adviser from a group.
router.post(
  "/:id/adviser-withdrawal",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Unauthorized" });
      const researchId = req.params.id as string;
      const { reason, note } = req.body as { reason?: string; note?: string };
      const allowedReasons = [
        "GROUP_REQUESTED_CHANGE",
        "OUTSIDE_EXPERTISE",
        "WORKLOAD_AVAILABILITY",
        "GROUP_INACTIVE",
        "PROJECT_DISCONTINUED",
        "STUDENT_WITHDREW",
        "OTHER",
      ];
      if (!reason || !allowedReasons.includes(reason))
        return void res
          .status(400)
          .json({ error: "Select a valid withdrawal reason." });
      if (!note || note.trim().length < 10)
        return void res
          .status(400)
          .json({ error: "A note of at least 10 characters is required." });

      const project = await prisma.researchProject.findUnique({
        where: { id: researchId },
        include: {
          members: {
            where: { leftAt: null },
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });
      if (!project)
        return void res
          .status(404)
          .json({ error: "Research group not found." });
      const adviserMembership = project.members.find(
        (member) =>
          member.userId === req.user!.id && member.projectRole === "ADVISER",
      );
      if (!adviserMembership)
        return void res
          .status(403)
          .json({ error: "You are not the active adviser for this group." });

      const adviserName =
        `${req.user.firstName || "Faculty"} ${req.user.lastName || "Adviser"}`.trim();
      const groupRecipients = project.members
        .filter((member) => member.projectRole !== "ADVISER")
        .map((member) => member.userId);
      const coordinators = await prisma.user.findMany({
        where: {
          roles: { some: { role: { name: "RESEARCH_COORDINATOR" } } },
          status: "ACTIVE",
        },
        select: { id: true },
      });
      const recipients = [
        ...new Set([
          ...groupRecipients,
          ...coordinators.map((coordinator) => coordinator.id),
        ]),
      ];

      const result = await prisma.$transaction(async (tx) => {
        const membership = await tx.researchMember.update({
          where: { id: adviserMembership.id },
          data: { leftAt: new Date() },
        });
        const cancelledConsultations = await tx.consultation.updateMany({
          where: {
            researchId,
            status: "SCHEDULED",
            scheduledStart: { gt: new Date() },
          },
          data: { status: "CANCELLED" },
        });
        if (recipients.length) {
          await tx.notification.createMany({
            data: recipients.map((recipientId) => ({
              recipientId,
              type: "WORKFLOW_CHANGED" as const,
              title: "Research group needs an adviser",
              message: `${adviserName} withdrew as adviser for “${project.title}”. Reason: ${reason.replace(/_/g, " ").toLowerCase()}. Note: ${note.trim()}`,
              entityType: "ResearchProject",
              entityId: project.id,
            })),
          });
        }
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "UPDATE",
            entityType: "ResearchMember",
            entityId: adviserMembership.id,
            oldValues: { projectRole: "ADVISER", leftAt: null },
            newValues: {
              projectRole: "ADVISER",
              leftAt: membership.leftAt,
              withdrawalReason: reason,
              withdrawalNote: note.trim(),
            },
          },
        });
        return {
          membership,
          cancelledConsultations: cancelledConsultations.count,
        };
      });

      res.json({ ...result, groupStatus: "NEEDS_ADVISER" });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to withdraw from the research group.",
      });
    }
  },
);

export default router;
