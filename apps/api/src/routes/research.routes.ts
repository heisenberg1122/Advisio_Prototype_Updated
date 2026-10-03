import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { createResearchSchema, updateResearchSchema, assignMemberSchema } from "@research-management/validations";
import { Permissions } from "@research-management/auth";
import { validateBody } from "../middleware/validate";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { randomBytes } from "node:crypto";

const router = Router();

// GET /api/research
router.get("/", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { status, programId, academicYearId } = req.query;
    const isResearcher = req.user?.roles.includes("RESEARCHER");

    const projects = await prisma.researchProject.findMany({
      where: {
        ...(status ? { status: String(status) as any } : isResearcher ? { status: { not: "ARCHIVED" as const } } : {}),
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

// PATCH /api/research/:id/group-name — optional group label, separate from the official title.
router.patch("/:id/group-name", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const id = req.params.id as string;
    const groupName = typeof req.body.groupName === "string" ? req.body.groupName.trim() : "";
    if (groupName.length > 120) return void res.status(400).json({ error: "Group name must be 120 characters or fewer." });
    const leader = await prisma.researchMember.findFirst({ where: { researchId: id, userId: req.user.id, projectRole: "LEADER", leftAt: null } });
    if (!leader) return void res.status(403).json({ error: "Only the current group leader may rename the group." });
    const project = await prisma.researchProject.update({ where: { id }, data: { groupName: groupName || null } });
    res.json({ project });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update group name" });
  }
});

// POST /api/research/:id/invite-code — leader creates or rotates a shareable group invite.
router.post("/:id/invite-code", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const id = req.params.id as string;
    const leader = await prisma.researchMember.findFirst({ where: { researchId: id, userId: req.user.id, projectRole: "LEADER", leftAt: null } });
    if (!leader) return void res.status(403).json({ error: "Only the current group leader may create an invitation." });
    const inviteCode = randomBytes(6).toString("hex").toUpperCase();
    await prisma.researchProject.update({ where: { id }, data: { inviteCode } });
    res.json({ inviteCode });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create group invitation" });
  }
});

// POST /api/research/join/:code — researcher joins a group through its current invite.
router.post("/join/:code", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const code = String(req.params.code || "").trim().toUpperCase();
    const project = await prisma.researchProject.findFirst({
      where: { inviteCode: code, status: { notIn: ["ARCHIVED", "COMPLETED", "REJECTED"] } },
      include: { members: { where: { leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] } } } },
    });
    if (!project) return void res.status(404).json({ error: "This invitation is invalid or no longer active." });
    const otherMembership = await prisma.researchMember.findFirst({
      where: { userId: req.user.id, leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] }, research: { status: { not: "ARCHIVED" } }, researchId: { not: project.id } },
    });
    if (otherMembership) return void res.status(409).json({ error: "Leave your current group before joining another project." });
    const existing = await prisma.researchMember.findFirst({ where: { researchId: project.id, userId: req.user.id, projectRole: { in: ["LEADER", "MEMBER"] } } });
    const member = existing
      ? await prisma.researchMember.update({ where: { id: existing.id }, data: { projectRole: existing.projectRole === "LEADER" ? "LEADER" : "MEMBER", leftAt: null, joinedAt: new Date() } })
      : await prisma.researchMember.create({ data: { researchId: project.id, userId: req.user.id, projectRole: "MEMBER" } });
    res.status(201).json({ member, project: { id: project.id, title: project.title, groupName: project.groupName } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to join research group" });
  }
});

router.post("/:id/transfer-leadership", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const researchId = req.params.id as string;
    const targetUserId = String(req.body.userId || "");
    const members = await prisma.researchMember.findMany({ where: { researchId, leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] } } });
    const currentLeader = members.find((member) => member.userId === req.user!.id && member.projectRole === "LEADER");
    const target = members.find((member) => member.userId === targetUserId && member.projectRole === "MEMBER");
    if (!currentLeader) return void res.status(403).json({ error: "Only the current leader may transfer leadership." });
    if (!target) return void res.status(400).json({ error: "Select an active group member to become leader." });
    await prisma.$transaction([
      prisma.researchMember.update({ where: { id: currentLeader.id }, data: { projectRole: "MEMBER" } }),
      prisma.researchMember.update({ where: { id: target.id }, data: { projectRole: "LEADER" } }),
    ]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to transfer leadership" });
  }
});

router.post("/:id/leave", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const membership = await prisma.researchMember.findFirst({ where: { researchId: req.params.id as string, userId: req.user.id, leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] } } });
    if (!membership) return void res.status(404).json({ error: "Active group membership not found." });
    if (membership.projectRole === "LEADER") return void res.status(409).json({ error: "Transfer leadership before leaving, or disband the group." });
    await prisma.researchMember.update({ where: { id: membership.id }, data: { leftAt: new Date() } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to leave research group" });
  }
});

router.post("/:id/disband", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const researchId = req.params.id as string;
    const leader = await prisma.researchMember.findFirst({ where: { researchId, userId: req.user.id, projectRole: "LEADER", leftAt: null } });
    if (!leader) return void res.status(403).json({ error: "Only the current leader may disband the group." });
    await prisma.$transaction([
      prisma.researchMember.updateMany({ where: { researchId, leftAt: null }, data: { leftAt: new Date() } }),
      prisma.researchProject.update({ where: { id: researchId }, data: { status: "ARCHIVED", inviteCode: null } }),
    ]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to disband research group" });
  }
});

router.delete("/:id/members/:memberId", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const researchId = req.params.id as string;
    const leader = await prisma.researchMember.findFirst({ where: { researchId, userId: req.user.id, projectRole: "LEADER", leftAt: null } });
    if (!leader) return void res.status(403).json({ error: "Only the current leader may remove group members." });
    const member = await prisma.researchMember.findFirst({ where: { id: req.params.memberId as string, researchId, projectRole: "MEMBER", leftAt: null } });
    if (!member) return void res.status(404).json({ error: "Active group member not found." });
    await prisma.researchMember.update({ where: { id: member.id }, data: { leftAt: new Date() } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to remove group member" });
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

// POST /api/research/:id/adviser-withdrawal
// Preserve the assignment history while releasing an active adviser from a group.
router.post("/:id/adviser-withdrawal", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
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
    if (!reason || !allowedReasons.includes(reason)) return void res.status(400).json({ error: "Select a valid withdrawal reason." });
    if (!note || note.trim().length < 10) return void res.status(400).json({ error: "A note of at least 10 characters is required." });

    const project = await prisma.researchProject.findUnique({
      where: { id: researchId },
      include: {
        members: {
          where: { leftAt: null },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!project) return void res.status(404).json({ error: "Research group not found." });
    const adviserMembership = project.members.find((member) => member.userId === req.user!.id && member.projectRole === "ADVISER");
    if (!adviserMembership) return void res.status(403).json({ error: "You are not the active adviser for this group." });

    const adviserName = `${req.user.firstName || "Faculty"} ${req.user.lastName || "Adviser"}`.trim();
    const groupRecipients = project.members.filter((member) => member.projectRole !== "ADVISER").map((member) => member.userId);
    const coordinators = await prisma.user.findMany({
      where: { roles: { some: { role: { name: "RESEARCH_COORDINATOR" } } }, status: "ACTIVE" },
      select: { id: true },
    });
    const recipients = [...new Set([...groupRecipients, ...coordinators.map((coordinator) => coordinator.id)])];

    const result = await prisma.$transaction(async (tx) => {
      const membership = await tx.researchMember.update({
        where: { id: adviserMembership.id },
        data: { leftAt: new Date() },
      });
      const cancelledConsultations = await tx.consultation.updateMany({
        where: { researchId, status: "SCHEDULED", scheduledStart: { gt: new Date() } },
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
          newValues: { projectRole: "ADVISER", leftAt: membership.leftAt, withdrawalReason: reason, withdrawalNote: note.trim() },
        },
      });
      return { membership, cancelledConsultations: cancelledConsultations.count };
    });

    res.json({ ...result, groupStatus: "NEEDS_ADVISER" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to withdraw from the research group." });
  }
});

export default router;
