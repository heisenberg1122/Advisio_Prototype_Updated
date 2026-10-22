import { getReleasedGradeReport } from "../services/grade-report.service.js";
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { evaluationTemplateSchema } from "@research-management/validations";
import { Permissions } from "@research-management/auth";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { canAccessCollege } from "../lib/college-scope.js";

const router = Router();

// GET /api/evaluation-templates
router.get(
  "/evaluation-templates",
  requireAuth,
  async (req: Request, res: Response) => {
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
        orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
      });

      res.json({ templates });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to fetch evaluation templates",
      });
    }
  },
);

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
      res.status(500).json({
        error: error.message || "Failed to create evaluation template",
      });
    }
  },
);

// Retired: defense evaluations must be bound to an assigned live session so that
// assignment checks, criterion validation, locking, and integrity hashing apply.
router.post("/evaluations", requireAuth, (_req: Request, res: Response) => {
  res.status(410).json({
    error:
      "This evaluation endpoint has been retired. Submit through the assigned live defense session.",
  });
});

// GET /api/research/:researchId/evaluations
router.get(
  "/research/:researchId/evaluations",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const researchId = req.params.researchId as string;
      const research = await prisma.researchProject.findUnique({
        where: { id: researchId },
        select: {
          collegeId: true,
          members: {
            where: { userId: req.user!.id, leftAt: null },
            select: { projectRole: true },
          },
          defenseSessions: {
            where: {
              invitations: {
                some: {
                  inviteeId: req.user!.id,
                  status: { not: "REMOVED" },
                  role: { in: ["PANELIST", "PANEL_CHAIR"] },
                },
              },
            },
            select: { id: true },
            take: 1,
          },
        },
      });
      const explicitlyInvited = Boolean(research?.defenseSessions.length);
      if (
        !research ||
        (!canAccessCollege(req.user!, research.collegeId) && !explicitlyInvited)
      ) {
        return void res
          .status(404)
          .json({ error: "Research evaluations were not found." });
      }
      const facilitator = req.user!.roles.some((role) =>
        ["RESEARCH_COORDINATOR", "RPO", "SYSTEM_ADMIN"].includes(role),
      );
      const assignedPanelist =
        req.user!.roles.includes("PANELIST") &&
        (research.members.some((member) => member.projectRole === "PANELIST") ||
          research.defenseSessions.length > 0);
      if (!facilitator && !assignedPanelist) {
        return void res
          .status(403)
          .json({ error: "You do not have access to these evaluations." });
      }

      const evaluations = await prisma.evaluation.findMany({
        where: {
          researchId,
          ...(!facilitator && { evaluatorId: req.user!.id }),
        },
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
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch evaluations" });
    }
  },
);

router.get("/research/:researchId/grades", requireAuth, async (req, res) => {
  try {
    res.json({
      grades: await getReleasedGradeReport(
        req.user!,
        String(req.params.researchId),
      ),
    });
  } catch (error: any) {
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Unable to load grades." });
  }
});

export default router;
