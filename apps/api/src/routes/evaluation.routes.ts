import { Router, Request, Response } from "express";
import { prisma, ReviewRecommendation, EvaluationStatus } from "../lib/prisma.js";
import { evaluationTemplateSchema, submitEvaluationSchema } from "@research-management/validations";
import { Permissions } from "@research-management/auth";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

const router = Router();

// GET /api/evaluation-templates
router.get("/evaluation-templates", requireAuth, async (req: Request, res: Response) => {
  try {
    const { researchTypeId } = req.query;

    const templates = await prisma.evaluationTemplate.findMany({
      where: {
        ...(researchTypeId && { researchTypeId: String(researchTypeId) }),
      },
      include: {
        criteria: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    res.json({ templates });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch evaluation templates" });
  }
});

// POST /api/evaluation-templates
router.post(
  "/evaluation-templates",
  requireAuth,
  requirePermission(Permissions.SYSTEM_CONFIGURE),
  validateBody(evaluationTemplateSchema),
  async (req: Request, res: Response) => {
    try {
      const { name, researchTypeId, totalScore, criteria } = req.body;

      const template = await prisma.evaluationTemplate.create({
        data: {
          name,
          researchTypeId,
          totalScore,
          version: 1,
          criteria: {
            create: criteria.map((c: any) => ({
              criterion: c.criterion,
              description: c.description || null,
              maxScore: c.maxScore,
              weight: c.weight || 1.0,
              sequence: c.sequence,
            })),
          },
        },
        include: {
          criteria: {
            orderBy: { sequence: "asc" },
          },
        },
      });

      res.status(201).json({ template });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create evaluation template" });
    }
  }
);

// POST /api/evaluations
router.post(
  "/evaluations",
  requireAuth,
  requirePermission(Permissions.EVALUATION_SUBMIT),
  validateBody(submitEvaluationSchema),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { templateId, researchId, totalScore, recommendation } = req.body;

      const evaluation = await prisma.evaluation.upsert({
        where: {
          templateId_researchId_evaluatorId: {
            templateId,
            researchId,
            evaluatorId: req.user.id,
          },
        },
        update: {
          totalScore,
          recommendation: recommendation as ReviewRecommendation,
          status: EvaluationStatus.SUBMITTED,
          submittedAt: new Date(),
        },
        create: {
          templateId,
          researchId,
          evaluatorId: req.user.id,
          totalScore,
          recommendation: recommendation as ReviewRecommendation,
          status: EvaluationStatus.SUBMITTED,
          submittedAt: new Date(),
        },
        include: {
          template: true,
          evaluator: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      res.status(201).json({ evaluation });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to submit evaluation" });
    }
  }
);

// GET /api/research/:researchId/evaluations
router.get("/research/:researchId/evaluations", requireAuth, async (req: Request, res: Response) => {
  try {
    const researchId = req.params.researchId as string;

    const evaluations = await prisma.evaluation.findMany({
      where: { researchId },
      include: {
        template: {
          include: {
            criteria: {
              orderBy: { sequence: "asc" },
            },
          },
        },
        evaluator: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    res.json({ evaluations });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch evaluations" });
  }
});

export default router;
