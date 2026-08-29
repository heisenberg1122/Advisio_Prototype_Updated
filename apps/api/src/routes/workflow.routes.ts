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
      const { name, description, deadlineDays, requiresApproval, isFinal } = req.body;

      const stage = await prisma.workflowStage.update({
        where: { id: stageId },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(deadlineDays !== undefined && { deadlineDays: deadlineDays ? Number(deadlineDays) : null }),
          ...(requiresApproval !== undefined && { requiresApproval: Boolean(requiresApproval) }),
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

export default router;
