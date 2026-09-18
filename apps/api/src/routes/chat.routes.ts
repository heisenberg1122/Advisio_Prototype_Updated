import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { optionalAuth } from "../middleware/auth";
import { sseManager } from "../realtime/sse";

const router = Router();

export interface GroupChat {
  id: string;
  title: string;
  description: string;
  createdByAdviserId: string;
  adviserName: string;
  relatedResearchGroupId?: string;
  createdAt: string;
}

export interface GroupChatInvitation {
  id: string;
  groupChatId: string;
  studentId: string;
  studentName: string;
  invitedByAdviserId: string;
  status: "pending" | "accepted" | "declined";
  invitedAt: string;
  respondedAt?: string;
}

export interface GroupChatMessage {
  id: string;
  groupChatId: string;
  senderId: string;
  senderName: string;
  senderRole: "student" | "adviser";
  message: string;
  createdAt: string;
}

// GET /api/chats - return all chats & invitations from database
router.get("/", optionalAuth, async (_req: Request, res: Response) => {
  try {
    const [dbChats, dbInvitations, dbMessages] = await Promise.all([
      prisma.chatGroup.findMany({
        orderBy: { createdAt: "desc" },
      }),
      prisma.chatInvitation.findMany({
        orderBy: { invitedAt: "desc" },
      }),
      prisma.chatMessage.findMany({
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const chats: GroupChat[] = dbChats.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description || "",
      createdByAdviserId: c.createdByAdviserId,
      adviserName: c.adviserName,
      relatedResearchGroupId: c.relatedResearchGroupId || undefined,
      createdAt: c.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    }));

    const invitations: GroupChatInvitation[] = dbInvitations.map((i) => ({
      id: i.id,
      groupChatId: i.chatGroupId,
      studentId: i.studentId,
      studentName: i.studentName,
      invitedByAdviserId: i.invitedByAdviserId,
      status: i.status as "pending" | "accepted" | "declined",
      invitedAt: i.invitedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      respondedAt: i.respondedAt ? i.respondedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : undefined,
    }));

    const messages: GroupChatMessage[] = dbMessages.map((m) => ({
      id: m.id,
      groupChatId: m.chatGroupId,
      senderId: m.senderId,
      senderName: m.senderName,
      senderRole: m.senderRole as "student" | "adviser",
      message: m.message,
      createdAt: m.createdAt.toISOString(),
    }));

    res.json({ chats, invitations, messages });
  } catch (error: any) {
    console.error("[ChatRoutes] Failed to fetch chats:", error);
    res.status(500).json({ error: "Failed to fetch chats", details: error.message });
  }
});

// POST /api/chats - create a new chat group in database
router.post("/", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { title, description, adviserName, relatedResearchGroupId } = req.body;
    const createdByAdviserId = req.user?.email || "adviser@advisio.edu.ph";
    const adviser = adviserName || `${req.user?.firstName || "Adviser"} ${req.user?.lastName || "User"}`;

    const created = await prisma.chatGroup.create({
      data: {
        title: title || "New Research Discussion",
        description: description || "",
        createdByAdviserId,
        adviserName: adviser,
        relatedResearchGroupId: relatedResearchGroupId || null,
      },
    });

    const newChat: GroupChat = {
      id: created.id,
      title: created.title,
      description: created.description || "",
      createdByAdviserId: created.createdByAdviserId,
      adviserName: created.adviserName,
      relatedResearchGroupId: created.relatedResearchGroupId || undefined,
      createdAt: created.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    };

    sseManager.broadcastEvent("chat:created", newChat);
    res.status(201).json({ chat: newChat });
  } catch (error: any) {
    console.error("[ChatRoutes] Failed to create chat group:", error);
    res.status(500).json({ error: "Failed to create chat group", details: error.message });
  }
});

// GET /api/chats/:id/messages - get messages for a specific chat
router.get("/:id/messages", optionalAuth, async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const dbMessages = await prisma.chatMessage.findMany({
      where: { chatGroupId: id },
      orderBy: { createdAt: "asc" },
    });

    const messages: GroupChatMessage[] = dbMessages.map((m) => ({
      id: m.id,
      groupChatId: m.chatGroupId,
      senderId: m.senderId,
      senderName: m.senderName,
      senderRole: m.senderRole as "student" | "adviser",
      message: m.message,
      createdAt: m.createdAt.toISOString(),
    }));

    res.json({ messages });
  } catch (error: any) {
    console.error("[ChatRoutes] Failed to fetch messages:", error);
    res.status(500).json({ error: "Failed to fetch messages", details: error.message });
  }
});

// POST /api/chats/:id/messages - send and persist message in database
router.post("/:id/messages", optionalAuth, async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const { message, senderName, senderRole } = req.body;

    if (!message || !message.trim()) {
      res.status(400).json({ error: "Message content cannot be empty" });
      return;
    }

    const sender = senderName || (req.user ? `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() : "User");
    const role = senderRole || (req.user?.roles?.includes("ADVISER" as any) ? "adviser" : "student");
    const senderId = req.user?.email || "user@advisio.edu.ph";

    const created = await prisma.chatMessage.create({
      data: {
        chatGroupId: id,
        senderId,
        senderName: sender,
        senderRole: role,
        message: message.trim(),
      },
    });

    const newMessage: GroupChatMessage = {
      id: created.id,
      groupChatId: created.chatGroupId,
      senderId: created.senderId,
      senderName: created.senderName,
      senderRole: created.senderRole as "student" | "adviser",
      message: created.message,
      createdAt: created.createdAt.toISOString(),
    };

    sseManager.broadcastEvent("chat:message", newMessage);
    res.status(201).json({ message: newMessage });
  } catch (error: any) {
    console.error("[ChatRoutes] Failed to send message:", error);
    res.status(500).json({ error: "Failed to send message", details: error.message });
  }
});

// POST /api/chats/:id/invitations - send invitation and persist in database
router.post("/:id/invitations", optionalAuth, async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const { studentId, studentName } = req.body;

    const created = await prisma.chatInvitation.create({
      data: {
        chatGroupId: id,
        studentId: studentId || "student@advisio.edu.ph",
        studentName: studentName || "Student Member",
        invitedByAdviserId: req.user?.email || "adviser@advisio.edu.ph",
        status: "pending",
      },
    });

    const newInvitation: GroupChatInvitation = {
      id: created.id,
      groupChatId: created.chatGroupId,
      studentId: created.studentId,
      studentName: created.studentName,
      invitedByAdviserId: created.invitedByAdviserId,
      status: "pending",
      invitedAt: created.invitedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    };

    sseManager.broadcastEvent("chat:invitation", newInvitation);
    res.status(201).json({ invitation: newInvitation });
  } catch (error: any) {
    console.error("[ChatRoutes] Failed to send invitation:", error);
    res.status(500).json({ error: "Failed to send invitation", details: error.message });
  }
});

// PATCH /api/chats/invitations/:invId - accept or decline invitation in database
router.patch("/invitations/:invId", optionalAuth, async (req: Request<{ invId: string }>, res: Response) => {
  try {
    const { invId } = req.params;
    const { status } = req.body;

    const updated = await prisma.chatInvitation.update({
      where: { id: invId },
      data: {
        status: status === "accepted" ? "accepted" : "declined",
        respondedAt: new Date(),
      },
    });

    const inv: GroupChatInvitation = {
      id: updated.id,
      groupChatId: updated.chatGroupId,
      studentId: updated.studentId,
      studentName: updated.studentName,
      invitedByAdviserId: updated.invitedByAdviserId,
      status: updated.status as "pending" | "accepted" | "declined",
      invitedAt: updated.invitedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      respondedAt: updated.respondedAt ? updated.respondedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : undefined,
    };

    sseManager.broadcastEvent("chat:invitation_update", inv);
    res.json({ invitation: inv });
  } catch (error: any) {
    console.error("[ChatRoutes] Failed to update invitation:", error);
    res.status(500).json({ error: "Failed to update invitation", details: error.message });
  }
});

export default router;
