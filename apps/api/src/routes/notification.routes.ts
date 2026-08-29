import { Router, Request, Response } from "express";
import { prisma, NotificationType } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth";

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

    const notification = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json({ notification });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to mark notification as read" });
  }
});

// POST /api/notifications
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { recipientId, title, message, type } = req.body;

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
      },
    });

    res.status(201).json({ notification });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create notification" });
  }
});

export default router;
