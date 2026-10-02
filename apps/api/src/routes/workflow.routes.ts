import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { createWorkflowSchema, workflowTransitionSchema } from "@research-management/validations";
import { Permissions } from "@research-management/auth";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

const router = Router();

// GET /api/workflows
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { researchTypeId } = req.query;

    const workflows = await prisma.workflow.findMany({
      where: {
        ...(researchTypeId && { researchTypeId: String(researchTypeId) }),
      },
      include: {
        stages: {
          orderBy: { sequence: "asc" },
          include: { tasks: { orderBy: { sequence: "asc" } } },
        },
      },
    });

    res.json({ workflows });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch workflows" });
  }
});

// POST /api/workflows
router.post(
  "/",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_CREATE),
  validateBody(createWorkflowSchema),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { researchTypeId, name, description, stages } = req.body;

      const workflow = await prisma.workflow.create({
        data: {
          researchTypeId,
          name,
          description: description || null,
          version: 1,
          status: "PUBLISHED",
          createdBy: req.user.id,
          stages: {
            create: stages.map((s: any) => ({
              name: s.name,
              description: s.description || null,
              category: s.category || "Milestone",
              sequence: s.sequence,
              responsibleRoleId: s.responsibleRoleId,
              requiresApproval: s.requiresApproval,
              deadlineDays: s.deadlineDays || null,
              isFinal: s.isFinal,
            })),
          },
        },
        include: {
          stages: {
            orderBy: { sequence: "asc" },
          },
        },
      });

      res.status(201).json({ workflow });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create workflow" });
    }
  }
);

// POST /api/workflows/:id/stages
router.post(
  "/:id/stages",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const workflowId = req.params.id as string;
      const { name, description, category = "Milestone", deadlineDays, requiresApproval = false, requiresDocument = true, isFinal = false } = req.body;

      if (!name || typeof name !== "string" || name.trim().length < 3) {
        res.status(400).json({ error: "Milestone name must be at least 3 characters long." });
        return;
      }

      const deadline = deadlineDays === null || deadlineDays === undefined || deadlineDays === ""
        ? null
        : Number(deadlineDays);
      if (deadline !== null && (!Number.isInteger(deadline) || deadline < 0 || deadline > 3650)) {
        res.status(400).json({ error: "Deadline must be a whole number between 0 and 3650 days." });
        return;
      }

      const [workflow, researcherRole, lastStage] = await Promise.all([
        prisma.workflow.findUnique({ where: { id: workflowId } }),
        prisma.role.findUnique({ where: { name: "RESEARCHER" } }),
        prisma.workflowStage.findFirst({ where: { workflowId }, orderBy: { sequence: "desc" } }),
      ]);
      if (!workflow) {
        res.status(404).json({ error: "Workflow not found." });
        return;
      }
      if (!researcherRole) {
        res.status(500).json({ error: "Researcher role is not configured." });
        return;
      }

      const stage = await prisma.$transaction(async (tx) => {
        const createdStage = await tx.workflowStage.create({
          data: {
            workflowId,
            name: name.trim(),
            description: typeof description === "string" && description.trim() ? description.trim() : null,
            category: ["Milestone", "Compliance", "Pre-requisite"].includes(category) ? category : "Milestone",
            sequence: (lastStage?.sequence || 0) + 1,
            responsibleRoleId: researcherRole.id,
            requiresApproval: Boolean(requiresApproval),
            requiresDocument: Boolean(requiresDocument),
            deadlineDays: deadline,
            isFinal: Boolean(isFinal),
          },
        });
        if (createdStage.requiresDocument) {
          await tx.workflowTask.create({
            data: {
              stageId: createdStage.id,
              title: name.trim(),
              instructions: `Submit the required deliverable for ${name.trim()}.`,
              sequence: 1,
              dueDays: deadline,
              allowedFileTypes: "PDF,DOCX",
              isRequired: true,
            },
          });
        }
        return createdStage;
      });
      res.status(201).json({ stage });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create workflow milestone" });
    }
  }
);

// DELETE /api/workflows/stages/:stageId
router.delete(
  "/stages/:stageId",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const stageId = req.params.stageId as string;
      const activeUsage = await prisma.workflowInstance.count({ where: { currentStageId: stageId } });
      if (activeUsage > 0) {
        res.status(409).json({ error: "This milestone is currently active for one or more groups and cannot be deleted." });
        return;
      }
      await prisma.workflowStage.delete({ where: { id: stageId } });
      res.status(204).send();
    } catch (error: any) {
      if (error?.code === "P2025") {
        res.status(404).json({ error: "Workflow milestone not found." });
        return;
      }
      res.status(500).json({ error: error.message || "Failed to delete workflow milestone" });
    }
  }
);

// POST /api/workflows/instances/:id/transition
router.post(
  "/instances/:id/transition",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  validateBody(workflowTransitionSchema),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const id = req.params.id as string;
      const { toStageId, remarks } = req.body;

      const instance = await prisma.workflowInstance.findUnique({
        where: { id },
        include: {
          currentStage: true,
          research: true,
        },
      });

      if (!instance) {
        res.status(404).json({ error: "Workflow instance not found" });
        return;
      }

      const targetStage = await prisma.workflowStage.findUnique({
        where: { id: toStageId },
      });

      if (!targetStage) {
        res.status(404).json({ error: "Target workflow stage not found" });
        return;
      }

      // Record transition and advance stage in transaction
      const updatedInstance = await prisma.$transaction(async (tx) => {
        await tx.workflowTransition.create({
          data: {
            workflowInstanceId: instance.id,
            fromStageId: instance.currentStageId,
            toStageId: targetStage.id,
            performedBy: req.user!.id,
            remarks: remarks || null,
          },
        });

        const updated = await tx.workflowInstance.update({
          where: { id: instance.id },
          data: {
            currentStageId: targetStage.id,
            ...(targetStage.isFinal && { completedAt: new Date() }),
          },
          include: {
            currentStage: true,
            transitions: {
              orderBy: { createdAt: "desc" },
            },
          },
        });

        // If target stage is final, update research project status
        if (targetStage.isFinal) {
          await tx.researchProject.update({
            where: { id: instance.researchId },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
            },
          });
        }

        return updated;
      });

      res.json({ workflowInstance: updatedInstance });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to execute workflow transition" });
    }
  }
);

// PATCH /api/workflows/stages/:stageId
router.patch(
  "/stages/:stageId",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const stageId = req.params.stageId as string;
      const { name, description, category, deadlineDays, requiresApproval, requiresDocument, isFinal } = req.body;

      const stage = await prisma.workflowStage.update({
        where: { id: stageId },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(category !== undefined && { category }),
          ...(deadlineDays !== undefined && { deadlineDays: deadlineDays ? Number(deadlineDays) : null }),
          ...(requiresApproval !== undefined && { requiresApproval: Boolean(requiresApproval) }),
          ...(requiresDocument !== undefined && { requiresDocument: Boolean(requiresDocument) }),
          ...(isFinal !== undefined && { isFinal: Boolean(isFinal) }),
        },
      });

      res.json({ stage });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update workflow stage" });
    }
  }
);

// POST /api/workflows/stages/:stageId/toggle-lock
router.post(
  "/stages/:stageId/toggle-lock",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const stageId = req.params.stageId as string;

      const currentStage = await prisma.workflowStage.findUnique({
        where: { id: stageId },
      });

      if (!currentStage) {
        res.status(404).json({ error: "Workflow stage not found" });
        return;
      }

      const updated = await prisma.workflowStage.update({
        where: { id: stageId },
        data: {
          requiresApproval: !currentStage.requiresApproval,
        },
      });

      res.json({ stage: updated, locked: updated.requiresApproval });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to toggle stage lock" });
    }
  }
);

// POST /api/workflows/stages/:stageId/tasks — professor creates a requirement under a milestone.
router.post("/stages/:stageId/tasks", requireAuth, requirePermission(Permissions.WORKFLOW_EDIT), async (req: Request, res: Response) => {
  try {
    const stageId = req.params.stageId as string;
    const { title, instructions, dueDays, allowedFileTypes = "PDF,DOCX", isRequired = true } = req.body;
    if (!title || typeof title !== "string" || title.trim().length < 3) return void res.status(400).json({ error: "Task title must be at least 3 characters." });
    const deadline = dueDays === null || dueDays === undefined || dueDays === "" ? null : Number(dueDays);
    if (deadline !== null && (!Number.isInteger(deadline) || deadline < 0 || deadline > 3650)) return void res.status(400).json({ error: "Due days must be between 0 and 3650." });
    const stage = await prisma.workflowStage.findUnique({ where: { id: stageId } });
    if (!stage) return void res.status(404).json({ error: "Workflow milestone not found." });
    const lastTask = await prisma.workflowTask.findFirst({ where: { stageId }, orderBy: { sequence: "desc" } });
    const task = await prisma.workflowTask.create({
      data: { stageId, title: title.trim(), instructions: instructions?.trim() || null, sequence: (lastTask?.sequence || 0) + 1, dueDays: deadline, allowedFileTypes: String(allowedFileTypes || "PDF,DOCX").toUpperCase(), isRequired: Boolean(isRequired) },
    });
    res.status(201).json({ task });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create workflow task" });
  }
});

// POST /api/workflows/stages/:stageId/start — initialize an older milestone as a shared group task.
router.post("/stages/:stageId/start", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const stageId = req.params.stageId as string;
    const { researchId } = req.body;
    if (!researchId) return void res.status(400).json({ error: "researchId is required." });

    const project = await prisma.researchProject.findFirst({
      where: {
        id: researchId,
        members: { some: { userId: req.user.id, projectRole: { in: ["LEADER", "MEMBER"] }, leftAt: null } },
      },
      include: { workflowInstance: { include: { currentStage: true } } },
    });
    if (!project?.workflowInstance) return void res.status(403).json({ error: "You are not an active member of this research group." });

    const stage = await prisma.workflowStage.findFirst({
      where: { id: stageId, workflowId: project.workflowInstance.workflowId },
    });
    if (!stage) return void res.status(404).json({ error: "This milestone is not part of the project workflow." });
    if (project.workflowInstance.currentStage && stage.sequence > project.workflowInstance.currentStage.sequence) {
      return void res.status(409).json({ error: "Complete the preceding milestone before starting this task." });
    }

    if (!stage.requiresDocument) {
      res.status(200).json({ task: null, requiresDocument: false, stage });
      return;
    }

    const task = await prisma.workflowTask.upsert({
      where: { stageId_sequence: { stageId, sequence: 1 } },
      update: {},
      create: {
        stageId,
        title: stage.name,
        instructions: stage.description || `Complete the ${stage.name} milestone and submit the required deliverable.`,
        sequence: 1,
        dueDays: stage.deadlineDays,
        allowedFileTypes: "PDF,DOCX",
        isRequired: true,
      },
    });
    res.status(201).json({ task, requiresDocument: true, stage });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to start milestone task" });
  }
});

router.delete("/tasks/:taskId", requireAuth, requirePermission(Permissions.WORKFLOW_EDIT), async (req: Request, res: Response) => {
  try {
    const taskId = req.params.taskId as string;
    const submissions = await prisma.taskSubmission.count({ where: { taskId } });
    if (submissions) return void res.status(409).json({ error: "A task with student submissions cannot be deleted." });
    await prisma.workflowTask.delete({ where: { id: taskId } });
    res.status(204).send();
  } catch (error: any) {
    if (error?.code === "P2025") return void res.status(404).json({ error: "Workflow task not found." });
    res.status(500).json({ error: error.message || "Failed to delete workflow task" });
  }
});

// POST /api/workflows/tasks/:taskId/submissions — group links an uploaded document to a valid workflow task.
router.post("/tasks/:taskId/submissions", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return void res.status(401).json({ error: "Unauthorized" });
    const taskId = req.params.taskId as string;
    const { researchId, documentId, note } = req.body;
    if (!researchId || !documentId) return void res.status(400).json({ error: "researchId and documentId are required." });
    const project = await prisma.researchProject.findFirst({
      where: { id: researchId, members: { some: { userId: req.user.id, projectRole: { in: ["LEADER", "MEMBER"] }, leftAt: null } } },
      include: {
        members: { where: { leftAt: null }, select: { userId: true, projectRole: true } },
        workflowInstance: { include: { workflow: { select: { createdBy: true } } } },
      },
    });
    if (!project) return void res.status(403).json({ error: "You are not an active member of this research group." });
    const task = await prisma.workflowTask.findFirst({ where: { id: taskId, stage: { workflowId: project.workflowInstance?.workflowId } } });
    if (!task) return void res.status(400).json({ error: "This task is not part of the project workflow." });
    const document = await prisma.document.findFirst({ where: { id: documentId, researchId } });
    if (!document) return void res.status(400).json({ error: "The uploaded document does not belong to this project." });
    const submission = await prisma.taskSubmission.upsert({
      where: { researchId_taskId: { researchId, taskId } },
      update: { documentId, submittedBy: req.user.id, note: note?.trim() || null, status: "SUBMITTED", submittedAt: new Date(), reviewedAt: null, reviewNote: null },
      create: { researchId, taskId, documentId, submittedBy: req.user.id, note: note?.trim() || null },
      include: {
        document: true,
        task: true,
        submittedByUser: { select: { id: true, firstName: true, lastName: true, universityId: true } },
      },
    });

    // Notifications are best-effort and must never roll back a valid group submission.
    const candidateRecipientIds = new Set<string>();
    const workflowOwnerId = project.workflowInstance?.workflow.createdBy;
    if (workflowOwnerId && workflowOwnerId !== req.user.id) candidateRecipientIds.add(workflowOwnerId);
    project.members.filter((member) => member.projectRole === "ADVISER").forEach((member) => {
      if (member.userId !== req.user!.id) candidateRecipientIds.add(member.userId);
    });
    if (candidateRecipientIds.size) {
      try {
        const validRecipients = await prisma.user.findMany({
          where: { id: { in: Array.from(candidateRecipientIds) }, status: "ACTIVE" },
          select: { id: true },
        });
        if (validRecipients.length) {
          await prisma.notification.createMany({
            data: validRecipients.map(({ id: recipientId }) => ({
              recipientId,
              type: "DOCUMENT_UPLOADED" as const,
              title: "Research task submitted",
              message: `${project.title}: ${task.title} was submitted for review.`,
              entityType: "TaskSubmission",
              entityId: submission.id,
            })),
          });
        }
      } catch (notificationError) {
        console.error("Task submission saved, but reviewer notifications failed:", notificationError);
      }
    }
    res.status(201).json({ submission });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to submit task requirement" });
  }
});

router.patch("/tasks/submissions/:submissionId/review", requireAuth, requirePermission(Permissions.WORKFLOW_EDIT), async (req: Request, res: Response) => {
  try {
    const { status, reviewNote } = req.body;
    const allowed = ["UNDER_REVIEW", "REVISION_REQUIRED", "APPROVED", "REJECTED"];
    if (!allowed.includes(status)) return void res.status(400).json({ error: "Invalid task review status." });
    if (["REVISION_REQUIRED", "REJECTED"].includes(status) && (!reviewNote || !String(reviewNote).trim())) {
      return void res.status(400).json({ error: "Feedback is required when requesting a revision or rejecting a submission." });
    }
    const submissionId = req.params.submissionId as string;
    const existing = await prisma.taskSubmission.findUnique({
      where: { id: submissionId },
      include: {
        task: { include: { stage: true } },
        research: {
          include: {
            members: { where: { leftAt: null }, select: { userId: true, projectRole: true } },
            workflowInstance: { include: { currentStage: true } },
          },
        },
      },
    });
    if (!existing) return void res.status(404).json({ error: "Task submission not found." });
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.taskSubmission.update({ where: { id: submissionId }, data: { status, reviewNote: reviewNote?.trim() || null, reviewedAt: new Date() } });
      let progression: { advanced: boolean; completed: boolean; nextStageName?: string } = { advanced: false, completed: false };

      const instance = existing.research.workflowInstance;
      const reviewedStage = existing.task.stage;
      if (status === "APPROVED" && instance?.currentStageId === reviewedStage.id) {
        const requiredTasks = await tx.workflowTask.findMany({
          where: { stageId: reviewedStage.id, isRequired: true },
          select: { id: true },
        });
        const approvedTaskCount = await tx.taskSubmission.count({
          where: {
            researchId: existing.researchId,
            taskId: { in: requiredTasks.map((task) => task.id) },
            status: "APPROVED",
          },
        });

        if (requiredTasks.length > 0 && approvedTaskCount === requiredTasks.length) {
          if (reviewedStage.isFinal) {
            const completedAt = new Date();
            await tx.workflowInstance.update({ where: { id: instance.id }, data: { completedAt } });
            await tx.researchProject.update({ where: { id: existing.researchId }, data: { status: "COMPLETED", completedAt } });
            progression = { advanced: true, completed: true };
          } else {
            const nextStage = await tx.workflowStage.findFirst({
              where: { workflowId: reviewedStage.workflowId, sequence: { gt: reviewedStage.sequence } },
              orderBy: { sequence: "asc" },
            });
            if (nextStage) {
              await tx.workflowTransition.create({
                data: {
                  workflowInstanceId: instance.id,
                  fromStageId: reviewedStage.id,
                  toStageId: nextStage.id,
                  performedBy: req.user!.id,
                  remarks: `Advanced automatically after all required submissions for ${reviewedStage.name} were approved.`,
                },
              });
              await tx.workflowInstance.update({ where: { id: instance.id }, data: { currentStageId: nextStage.id } });
              progression = { advanced: true, completed: false, nextStageName: nextStage.name };
            }
          }
        }
      }

      const recipients = new Set(existing.research.members
        .filter((member) => ["LEADER", "MEMBER", "ADVISER"].includes(member.projectRole) && member.userId !== req.user!.id)
        .map((member) => member.userId));
      if (recipients.size) {
        await tx.notification.createMany({
          data: Array.from(recipients).map((recipientId) => ({
            recipientId,
            type: status === "REVISION_REQUIRED" || status === "REJECTED" ? "REVISION_REQUESTED" as const : "DOCUMENT_REVIEWED" as const,
            title: `Task ${String(status).toLowerCase().replace(/_/g, " ")}`,
            message: `${existing.task.title} for ${existing.research.title} is now ${String(status).toLowerCase().replace(/_/g, " ")}.`,
            entityType: "TaskSubmission",
            entityId: updated.id,
          })),
        });
      }
      return { submission: updated, progression };
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to review task submission" });
  }
});

export default router;
