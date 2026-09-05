import { Router, Request, Response } from "express";
import crypto from "crypto";
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

// In-memory synchronized store for group chat messages & invitations
const chatsStore: GroupChat[] = [
  {
    id: "chat-1",
    title: "Group AI-CCS-01 Thread",
    description: "Discussion for AI Crop Yield Prediction System",
    createdByAdviserId: "rachel.lim@university.edu.ph",
    adviserName: "Dr. Rachel Lim",
    relatedResearchGroupId: "Group AI-CCS-01",
    createdAt: "June 28, 2026",
  },
];

const invitationsStore: GroupChatInvitation[] = [
  {
    id: "inv-1",
    groupChatId: "chat-1",
    studentId: "juan.reyes@university.edu.ph",
    studentName: "Juan Reyes",
    invitedByAdviserId: "rachel.lim@university.edu.ph",
    status: "accepted",
    invitedAt: "June 28, 2026",
    respondedAt: "June 28, 2026",
  },
  {
    id: "inv-2",
    groupChatId: "chat-1",
    studentId: "marc.santos@university.edu.ph",
    studentName: "Marc Santos",
    invitedByAdviserId: "rachel.lim@university.edu.ph",
    status: "pending",
    invitedAt: "June 28, 2026",
  },
];

const messagesStore: GroupChatMessage[] = [
  {
    id: "msg-1",
    groupChatId: "chat-1",
    senderId: "rachel.lim@university.edu.ph",
    senderName: "Dr. Rachel Lim",
    senderRole: "adviser",
    message: "Hello everyone, please post your updates for Chapter 1-3 draft in this thread.",
    createdAt: "2026-06-28T10:00:00Z",
  },
  {
    id: "msg-2",
    groupChatId: "chat-1",
    senderId: "juan.reyes@university.edu.ph",
    senderName: "Juan Reyes",
    senderRole: "student",
    message: "Hi Dr. Lim! We have updated the dataset split and will upload the v2 draft shortly.",
    createdAt: "2026-06-28T10:15:00Z",
  },
];

// GET /api/chats - return all chats & invitations
router.get("/", optionalAuth, (_req: Request, res: Response) => {
  res.json({
    chats: chatsStore,
    invitations: invitationsStore,
    messages: messagesStore,
  });
});

// POST /api/chats - create a new chat group
router.post("/", optionalAuth, (req: Request, res: Response) => {
  const { title, description, adviserName, relatedResearchGroupId } = req.body;
  const newChat: GroupChat = {
    id: `chat-${crypto.randomUUID()}`,
    title: title || "New Research Discussion",
    description: description || "",
    createdByAdviserId: req.user?.email || "adviser@advisio.edu.ph",
    adviserName: adviserName || `${req.user?.firstName || "Adviser"} ${req.user?.lastName || "User"}`,
    relatedResearchGroupId: relatedResearchGroupId || "Group-01",
    createdAt: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  };

  chatsStore.push(newChat);
  sseManager.broadcastEvent("chat:created", newChat);
  res.status(201).json({ chat: newChat });
});

// GET /api/chats/:id/messages - get messages for a specific chat
router.get("/:id/messages", optionalAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const messages = messagesStore.filter((m) => m.groupChatId === id);
  res.json({ messages });
});

// POST /api/chats/:id/messages - send message
router.post("/:id/messages", optionalAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const { message, senderName, senderRole } = req.body;

  if (!message || !message.trim()) {
    res.status(400).json({ error: "Message content cannot be empty" });
    return;
  }

  const newMessage: GroupChatMessage = {
    id: `msg-${crypto.randomUUID()}`,
    groupChatId: String(id),
    senderId: req.user?.email || "user@advisio.edu.ph",
    senderName: senderName || (req.user ? `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() : "User"),
    senderRole: senderRole || (req.user?.roles?.includes("ADVISER" as any) ? "adviser" : "student"),
    message: message.trim(),
    createdAt: new Date().toISOString(),
  };

  messagesStore.push(newMessage);
  sseManager.broadcastEvent("chat:message", newMessage);
  res.status(201).json({ message: newMessage });
});

// POST /api/chats/:id/invitations - send invitation
router.post("/:id/invitations", optionalAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const { studentId, studentName } = req.body;

  const newInvitation: GroupChatInvitation = {
    id: `inv-${crypto.randomUUID()}`,
    groupChatId: String(id),
    studentId: studentId || "student@advisio.edu.ph",
    studentName: studentName || "Student Member",
    invitedByAdviserId: req.user?.email || "adviser@advisio.edu.ph",
    status: "pending",
    invitedAt: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  };

  invitationsStore.push(newInvitation);
  sseManager.broadcastEvent("chat:invitation", newInvitation);
  res.status(201).json({ invitation: newInvitation });
});

// PATCH /api/chats/invitations/:invId - accept or decline
router.patch("/invitations/:invId", optionalAuth, (req: Request, res: Response) => {
  const { invId } = req.params;
  const { status } = req.body;

  const inv = invitationsStore.find((i) => i.id === invId);
  if (!inv) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  inv.status = status === "accepted" ? "accepted" : "declined";
  inv.respondedAt = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  sseManager.broadcastEvent("chat:invitation_update", inv);
  res.json({ invitation: inv });
});

export default router;
