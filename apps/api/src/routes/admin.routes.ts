import { randomBytes } from "node:crypto";
import { canAccessCollege } from "../lib/college-scope.js";
import { Router, Request, Response } from "express";
import { prisma, UserStatus, CertificateType, CertificateStatus } from "../lib/prisma.js";
import { Permissions } from "@research-management/auth";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import adminOverviewRoutes from "./admin-overview.routes.js";

const router = Router();
router.use(adminOverviewRoutes);

// GET /api/admin/metrics
router.get("/admin/metrics", requireAuth, requirePermission(Permissions.USER_MANAGE), async (_req: Request, res: Response) => {
  try {
    const [totalUsers, pendingUsers, totalProjects, activeWorkflows] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: UserStatus.PENDING } }),
      prisma.researchProject.count(),
      prisma.workflowInstance.count({ where: { completedAt: null } }),
    ]);

    res.json({
      metrics: {
        totalUsers,
        pendingUsers,
        totalProjects,
        activeWorkflows,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch admin metrics" });
  }
});

// POST /api/certificates
router.post(
  "/certificates",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { researchId } = req.body;
      const certificateType = req.body.certificateType || CertificateType.COMPLETION;
      if (!researchId || !Object.values(CertificateType).includes(certificateType)) {
        return void res.status(400).json({ error: "A project and valid certificate type are required." });
      }
      const research = await prisma.researchProject.findUnique({ where: { id: researchId }, select: {
        collegeId: true, status: true,
        workflowInstance: { select: { workflow: { select: { createdBy: true } } } },
        members: { where: { userId: req.user!.id, leftAt: null }, select: { projectRole: true } },
      } });
      if (!research || !canAccessCollege(req.user, research.collegeId)) return void res.status(404).json({ error: "Research project not found." });
      const roles = req.user.roles;
      const institutionalIssuer = roles.includes("DEAN");
      const coordinator = roles.includes("RESEARCH_COORDINATOR") && research.workflowInstance?.workflow.createdBy === req.user!.id;
      const isResearcher = research.members.some(({ projectRole }) => ["LEADER", "MEMBER"].includes(projectRole));
      const allowed = !isResearcher && (certificateType === "REB_APPROVAL"
        ? false
        : certificateType === "PANEL_RECOMMENDATION"
          ? roles.includes("PANELIST")
          : institutionalIssuer || coordinator);
      if (!allowed) return void res.status(403).json({ error: "You are not authorized to issue this certificate." });
      if (certificateType === "COMPLETION" && research.status !== "COMPLETED") return void res.status(409).json({ error: "The project must be completed before issuing a completion certificate." });
      if (["DEFENSE_PASSED", "PANEL_RECOMMENDATION"].includes(certificateType)) {
        const session = await prisma.defenseSession.findFirst({ where: {
          researchId, status: "COMPLETED", releasedAt: { not: null },
          decision: { in: ["APPROVED", "APPROVED_WITH_MINOR_REVISIONS"] },
          ...(certificateType === "PANEL_RECOMMENDATION" ? { evaluations: { some: { evaluatorId: req.user!.id, status: "LOCKED", recommendation: { in: ["APPROVE", "MINOR_REVISION"] } } } } : {}),
        }, select: { id: true } });
        if (!session) return void res.status(409).json({ error: "An eligible released defense decision is required." });
      }
      if (certificateType === "REB_APPROVAL") {
        const approval = await prisma.review.findFirst({ where: {
          document: { researchId }, reviewType: "REB", status: "SUBMITTED", recommendation: "APPROVE",
        }, select: { id: true } });
        if (!approval) return void res.status(409).json({ error: "A submitted ethics approval is required." });
      }
      const certificateNumber = `ADV-CERT-${randomBytes(12).toString("hex").toUpperCase()}`;
      const verificationCode = `VRF-${randomBytes(20).toString("hex").toUpperCase()}`;

      const certificate = await prisma.$transaction(async (tx) => {
      const issued = await tx.certificate.create({
        data: {
          researchId,
          issuedBy: req.user!.id,
          certificateType: (certificateType as CertificateType) || CertificateType.COMPLETION,
          certificateNumber,
          verificationCode,
          status: CertificateStatus.ISSUED,
          issuedAt: new Date(),
        },
        include: {
          research: {
            select: { title: true },
          },
          issuer: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      await tx.auditLog.create({ data: { userId: req.user!.id, action: "CREATE", entityType: "Certificate", entityId: issued.id,
        newValues: { researchId, certificateType, verificationCode }, ipAddress: req.ip, userAgent: req.get("user-agent") } });
      return issued;
      });
      res.status(201).json({ certificate });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate certificate" });
    }
  }
);

export default router;
