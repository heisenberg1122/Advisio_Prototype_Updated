import { Router, Request, Response } from "express";
import { prisma, NotificationType, UserStatus, AuditAction } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { Permissions } from "@research-management/auth";

const router = Router();

// GET /api/notifications
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const notifications = await prisma.notification.findMany({
      where: { recipientId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { recipientId: req.user.id, isRead: false },
    });

    res.json({ notifications, unreadCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch notifications" });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const id = req.params.id as string;

    const result = await prisma.notification.updateMany({
      where: { id, recipientId: req.user.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (result.count === 0) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to mark notification as read" });
  }
});

// PATCH /api/notifications/read-all
router.patch("/read-all", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await prisma.notification.updateMany({
      where: { recipientId: req.user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ updatedCount: result.count });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to mark notifications as read" });
  }
});

// GET /api/notifications/admin/announcements
router.get(
  "/admin/announcements",
  requireAuth,
  requirePermission(Permissions.SYSTEM_CONFIGURE),
  async (_req: Request, res: Response) => {
    try {
      const announcements = await prisma.systemAnnouncement.findMany({
        include: {
          creator: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { publishedAt: "desc" },
        take: 50,
      });
      res.json({ announcements });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch announcements" });
    }
  }
);

// POST /api/notifications/admin/announcements
router.post(
  "/admin/announcements",
  requireAuth,
  requirePermission(Permissions.SYSTEM_CONFIGURE),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const title = String(req.body.title || "").trim();
      const message = String(req.body.message || "").trim();
      const category = String(req.body.category || "GENERAL").toUpperCase();
      const severity = String(req.body.severity || "INFO").toUpperCase();
      const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
      const validCategories = ["GENERAL", "UPDATE", "MAINTENANCE"];
      const validSeverities = ["INFO", "WARNING", "CRITICAL"];

      if (title.length < 3 || title.length > 200 || message.length < 10 || message.length > 5000) {
        res.status(400).json({ error: "Title must be 3-200 characters and message must be 10-5000 characters" });
        return;
      }
      if (!validCategories.includes(category) || !validSeverities.includes(severity)) {
        res.status(400).json({ error: "Invalid announcement category or severity" });
        return;
      }
      if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())) {
        res.status(400).json({ error: "Expiration must be a valid future date" });
        return;
      }

      const result = await prisma.$transaction(async (tx) => {
        const announcement = await tx.systemAnnouncement.create({
          data: { title, message, category, severity, expiresAt, createdBy: req.user!.id },
        });
        const recipients = await tx.user.findMany({
          where: { status: UserStatus.ACTIVE },
          select: { id: true },
        });
        const delivery = await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            recipientId: recipient.id,
            type: NotificationType.SYSTEM_ANNOUNCEMENT,
            title,
            message,
            entityType: "SYSTEM_ANNOUNCEMENT",
            entityId: announcement.id,
          })),
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: AuditAction.PUBLISH,
            entityType: "SYSTEM_ANNOUNCEMENT",
            entityId: announcement.id,
            newValues: { title, category, severity, expiresAt, recipientCount: delivery.count },
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
        return { announcement, recipientCount: delivery.count };
      });

      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to publish announcement" });
    }
  }
);

// POST /api/notifications
router.post("/", requireAuth, requirePermission(Permissions.SYSTEM_CONFIGURE), async (req: Request, res: Response) => {
  try {
    const { recipientId, title, message, type, entityType, entityId } = req.body;

    if (!recipientId || !title || !message) {
      res.status(400).json({ error: "Missing required notification fields" });
      return;
    }

    const notification = await prisma.notification.create({
      data: {
        recipientId,
        title,
        message,
        type: (type as NotificationType) || NotificationType.WORKFLOW_CHANGED,
        entityType: entityType || null,
        entityId: entityId || null,
      },
    });

    res.status(201).json({ notification });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create notification" });
  }
});

export default router;
