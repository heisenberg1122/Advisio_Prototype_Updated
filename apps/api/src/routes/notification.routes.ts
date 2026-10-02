import { Router, Request, Response } from "express";
import {
  prisma,
  NotificationType,
  UserStatus,
  AuditAction,
} from "../lib/prisma.js";
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
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch notifications" });
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
    res
      .status(500)
      .json({ error: error.message || "Failed to mark notification as read" });
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
    res
      .status(500)
      .json({ error: error.message || "Failed to mark notifications as read" });
  }
});

// GET /api/notifications/announcements — global notices plus the signed-in user's college feed.
router.get(
  "/announcements",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { collegeId: true },
      });
      const announcements = await prisma.systemAnnouncement.findMany({
        where: {
          AND: [
            { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
            {
              OR: [
                { audienceCollegeId: null },
                ...(user?.collegeId
                  ? [{ audienceCollegeId: user.collegeId }]
                  : []),
              ],
            },
          ],
        },
        include: {
          audienceCollege: { select: { id: true, code: true, name: true } },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              roles: { select: { role: { select: { name: true } } } },
            },
          },
        },
        orderBy: { publishedAt: "desc" },
        take: 50,
      });
      res.json({
        announcements: announcements.map((announcement) => ({
          ...announcement,
          creator: {
            ...announcement.creator,
            roles: announcement.creator.roles.map((item) => item.role.name),
          },
          source: announcement.creator.roles.some(
            (item) => item.role.name === "SYSTEM_ADMIN",
          )
            ? "SYSTEM_ADMIN"
            : announcement.creator.roles.some((item) =>
                  ["RPO", "VPAA"].includes(item.role.name),
                )
              ? "DEAN"
              : "PROFESSOR",
        })),
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch announcements" });
    }
  },
);

// POST /api/notifications/announcements — professors publish only within their assigned college.
router.post(
  "/announcements",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (
        !req.user!.roles.some((role) =>
          ["RESEARCH_COORDINATOR", "PROFESSOR"].includes(role),
        )
      ) {
        return void res
          .status(403)
          .json({
            error:
              "Professor access is required to publish a college announcement.",
          });
      }
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { collegeId: true, college: { select: { name: true } } },
      });
      if (!user?.collegeId)
        return void res
          .status(409)
          .json({
            error:
              "Your account must be assigned to a college before publishing.",
          });
      const title = String(req.body.title || "").trim();
      const message = String(req.body.message || "").trim();
      const category = String(req.body.category || "GENERAL").toUpperCase();
      const severity = String(req.body.severity || "INFO").toUpperCase();
      const expiresAt = req.body.expiresAt
        ? new Date(req.body.expiresAt)
        : null;
      if (
        title.length < 3 ||
        title.length > 200 ||
        message.length < 10 ||
        message.length > 5000
      )
        return void res
          .status(400)
          .json({
            error:
              "Title must be 3-200 characters and message must be 10-5000 characters.",
          });
      if (
        !["GENERAL", "UPDATE", "DEADLINE"].includes(category) ||
        !["INFO", "WARNING", "CRITICAL"].includes(severity)
      )
        return void res
          .status(400)
          .json({ error: "Invalid announcement category or priority." });
      if (
        expiresAt &&
        (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())
      )
        return void res
          .status(400)
          .json({ error: "Expiration must be a future date." });

      const result = await prisma.$transaction(async (tx) => {
        const announcement = await tx.systemAnnouncement.create({
          data: {
            title,
            message,
            category,
            severity,
            expiresAt,
            createdBy: req.user!.id,
            audienceCollegeId: user.collegeId,
          },
        });
        const recipients = await tx.user.findMany({
          where: {
            status: UserStatus.ACTIVE,
            collegeId: user.collegeId,
            id: { not: req.user!.id },
          },
          select: { id: true },
        });
        const delivery = recipients.length
          ? await tx.notification.createMany({
              data: recipients.map(({ id }) => ({
                recipientId: id,
                type: NotificationType.SYSTEM_ANNOUNCEMENT,
                title,
                message,
                entityType: "COLLEGE_ANNOUNCEMENT",
                entityId: announcement.id,
              })),
            })
          : { count: 0 };
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: AuditAction.PUBLISH,
            entityType: "COLLEGE_ANNOUNCEMENT",
            entityId: announcement.id,
            newValues: {
              title,
              category,
              severity,
              collegeId: user.collegeId,
              recipientCount: delivery.count,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
        return {
          announcement,
          recipientCount: delivery.count,
          collegeName: user.college?.name,
        };
      });
      res.status(201).json(result);
    } catch (error: any) {
      res
        .status(500)
        .json({
          error: error.message || "Failed to publish college announcement",
        });
    }
  },
);

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
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch announcements" });
    }
  },
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
      const expiresAt = req.body.expiresAt
        ? new Date(req.body.expiresAt)
        : null;
      const validCategories = ["GENERAL", "UPDATE", "MAINTENANCE"];
      const validSeverities = ["INFO", "WARNING", "CRITICAL"];

      if (
        title.length < 3 ||
        title.length > 200 ||
        message.length < 10 ||
        message.length > 5000
      ) {
        res
          .status(400)
          .json({
            error:
              "Title must be 3-200 characters and message must be 10-5000 characters",
          });
        return;
      }
      if (
        !validCategories.includes(category) ||
        !validSeverities.includes(severity)
      ) {
        res
          .status(400)
          .json({ error: "Invalid announcement category or severity" });
        return;
      }
      if (
        expiresAt &&
        (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())
      ) {
        res
          .status(400)
          .json({ error: "Expiration must be a valid future date" });
        return;
      }

      const result = await prisma.$transaction(async (tx) => {
        const announcement = await tx.systemAnnouncement.create({
          data: {
            title,
            message,
            category,
            severity,
            expiresAt,
            createdBy: req.user!.id,
          },
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
            newValues: {
              title,
              category,
              severity,
              expiresAt,
              recipientCount: delivery.count,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
        return { announcement, recipientCount: delivery.count };
      });

      res.status(201).json(result);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to publish announcement" });
    }
  },
);

// POST /api/notifications
router.post(
  "/",
  requireAuth,
  requirePermission(Permissions.SYSTEM_CONFIGURE),
  async (req: Request, res: Response) => {
    try {
      const { recipientId, title, message, type, entityType, entityId } =
        req.body;

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
      res
        .status(500)
        .json({ error: error.message || "Failed to create notification" });
    }
  },
);

export default router;
