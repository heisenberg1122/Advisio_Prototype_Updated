import { Router, Request, Response } from "express";
import { prisma, UserStatus, CertificateType, CertificateStatus } from "../lib/prisma.js";
import { Permissions } from "@research-management/auth";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

const router = Router();

// GET /api/admin/metrics
router.get("/admin/metrics", requireAuth, async (_req: Request, res: Response) => {
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

// PATCH /api/users/:id/status
router.patch(
  "/users/:id/status",
  requireAuth,
  requirePermission(Permissions.USER_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { status } = req.body;

      if (!status || !Object.values(UserStatus).includes(status)) {
        res.status(400).json({ error: "Valid status is required" });
        return;
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { status: status as UserStatus },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      });

      res.json({ user: updatedUser });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update user status" });
    }
  }
);

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

      const { researchId, certificateType } = req.body;

      if (!researchId) {
        res.status(400).json({ error: "researchId is required" });
        return;
      }

      const certificateNumber = `ADV-CERT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const verificationCode = `VRF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      const certificate = await prisma.certificate.create({
        data: {
          researchId,
          issuedBy: req.user.id,
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

      res.status(201).json({ certificate });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate certificate" });
    }
  }
);

export default router;
