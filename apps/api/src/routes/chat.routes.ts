import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth";
import { sseManager } from "../realtime/sse";

const router = Router();

const FACULTY_ROLES = ["ADVISER", "RESEARCH_COORDINATOR", "PANELIST", "RPO", "REB", "VPAA"] as const;
const FACULTY_ROLE_SET = new Set<string>(FACULTY_ROLES);

const personSelect = {
  id: true,
  email: true,
  firstName: true,
  middleName: true,
  lastName: true,
  roles: { select: { role: { select: { name: true } } } },
} as const;

function fullName(user: { firstName: string; middleName?: string | null; lastName: string }) {
  return [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ");
}

function primaryRole(roles: string[]) {
  const role = roles.find((item) => FACULTY_ROLE_SET.has(item)) || roles[0] || "RESEARCHER";
  return role === "RESEARCH_COORDINATOR"
    ? "Professor"
    : role === "RESEARCHER"
      ? "Student"
      : role === "RPO"
        ? "Research Office"
        : role === "REB"
          ? "Ethics Board"
          : role === "VPAA"
            ? "VPAA"
            : role.charAt(0) + role.slice(1).toLowerCase();
}

function isFaculty(roles: string[]) {
  return roles.some((role) => FACULTY_ROLE_SET.has(role));
}

async function databaseUser(req: Request) {
  if (!req.user) return null;
  if (!req.user.id.startsWith("demo-")) {
    return prisma.user.findUnique({ where: { id: req.user.id }, select: personSelect });
  }
  return prisma.user.findUnique({ where: { email: req.user.email }, select: personSelect });
}

async function assignedStudentIds(facultyUserId: string) {
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      roles: { some: { role: { name: "RESEARCHER" } } },
      memberships: {
        some: {
          leftAt: null,
          research: {
            OR: [
              { createdBy: facultyUserId },
              {
                members: {
                  some: {
                    userId: facultyUserId,
                    leftAt: null,
                    projectRole: { in: ["ADVISER", "COORDINATOR"] },
                  },
                },
              },
            ],
          },
        },
      },
    },
    select: { id: true },
  });
  return new Set(users.map((user) => user.id));
}

function mapMessage(message: any) {
  return {
    id: message.id,
    groupChatId: message.chatGroupId,
    senderId: message.senderUserId || message.senderId,
    senderName: message.senderName,
    senderRole: primaryRole([message.senderRole]),
    message: message.message,
    createdAt: message.createdAt.toISOString(),
  };
}

function mapParticipant(participant: any) {
  const roles = participant.user.roles.map((entry: any) => entry.role.name as string);
  return {
    id: participant.id,
    userId: participant.userId,
    name: fullName(participant.user),
    email: participant.user.email,
    role: primaryRole(roles.length ? roles : [participant.roleSnapshot]),
    roles,
    status: participant.status.toLowerCase(),
    isAdmin: participant.isAdmin,
    invitedAt: participant.invitedAt.toISOString(),
    respondedAt: participant.respondedAt?.toISOString(),
  };
}

async function notifyParticipants(chatGroupId: string, eventType: string, data: unknown) {
  const participants = await prisma.chatParticipant.findMany({
    where: { chatGroupId, status: { in: ["PENDING", "ACCEPTED"] } },
    select: { userId: true },
  });
  participants.forEach((participant) => sseManager.sendToUser(participant.userId, eventType, data));
}

router.use(requireAuth);

// Faculty receive a role-aware directory. Students can never call this endpoint successfully.
router.get("/recipients", async (req: Request, res: Response) => {
  try {
    const current = await databaseUser(req);
    if (!current || !isFaculty(req.user!.roles)) {
      res.status(403).json({ error: "Faculty messaging access is required" });
      return;
    }

    const category = String(req.query.category || "eligible");
    const search = String(req.query.query || "").trim();
    const includeFaculty = category !== "assigned_students";
    const includeStudents = category === "assigned_students" || category === "eligible";
    const filters: any[] = [];

    if (includeFaculty) {
      const requestedRole = category === "advisers"
        ? "ADVISER"
        : category === "professors"
          ? "RESEARCH_COORDINATOR"
          : category === "panelists"
            ? "PANELIST"
            : null;
      filters.push({
        id: { not: current.id },
        roles: { some: { role: { name: requestedRole || { in: [...FACULTY_ROLES] } } } },
      });
    }

    const assignedIds = includeStudents ? await assignedStudentIds(current.id) : new Set<string>();
    if (assignedIds.size > 0) filters.push({ id: { in: [...assignedIds] } });
    if (filters.length === 0) {
      res.json({ recipients: [] });
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        OR: filters,
        ...(search ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { middleName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        } : {}),
      },
      select: personSelect,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 200,
    });

    res.json({
      recipients: users.map((user) => {
        const roles = user.roles.map((entry) => entry.role.name as string);
        return {
          id: user.id,
          name: fullName(user),
          email: user.email,
          roles,
          role: primaryRole(roles),
          isAssignedStudent: assignedIds.has(user.id),
        };
      }),
    });
  } catch (error: any) {
    console.error("[ChatRoutes] Failed to fetch eligible recipients:", error);
    res.status(500).json({ error: "Failed to fetch eligible recipients" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const current = await databaseUser(req);
    if (!current) {
      res.status(403).json({ error: "A persisted user account is required" });
      return;
    }

    const groups = await prisma.chatGroup.findMany({
      where: { participants: { some: { userId: current.id, status: { in: ["PENDING", "ACCEPTED"] } } } },
      include: {
        participants: { include: { user: { select: personSelect } }, orderBy: { invitedAt: "asc" } },
        messages: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const chats: any[] = [];
    const invitations: any[] = [];
    const messages: any[] = [];
    for (const group of groups) {
      const mine = group.participants.find((participant) => participant.userId === current.id);
      if (!mine) continue;
      const accepted = mine.status === "ACCEPTED";
      const unreadCount = accepted
        ? group.messages.filter((message) => message.senderUserId !== current.id && (!mine.lastReadAt || message.createdAt > mine.lastReadAt)).length
        : 0;
      chats.push({
        id: group.id,
        title: group.title,
        description: group.description || "",
        createdByAdviserId: group.createdByAdviserId,
        adviserName: group.adviserName,
        createdByUserId: group.createdByUserId,
        relatedResearchGroupId: group.relatedResearchGroupId || undefined,
        isFacultyOnly: group.isFacultyOnly,
        isAdmin: mine.isAdmin,
        membershipStatus: mine.status.toLowerCase(),
        unreadCount,
        lastMessageAt: group.messages.at(-1)?.createdAt.toISOString(),
        createdAt: group.createdAt.toISOString(),
        participants: group.participants.filter((participant) => participant.status !== "REMOVED").map(mapParticipant),
      });
      if (mine.status === "PENDING") {
        invitations.push({
          id: mine.id,
          groupChatId: group.id,
          studentId: current.email,
          studentName: fullName(current),
          invitedByAdviserId: group.createdByAdviserId,
          role: primaryRole(req.user!.roles),
          status: "pending",
          invitedAt: mine.invitedAt.toISOString(),
        });
      }
      if (accepted) messages.push(...group.messages.map(mapMessage));
    }

    res.json({ chats, invitations, messages, notifications: [] });
  } catch (error: any) {
    console.error("[ChatRoutes] Failed to fetch chats:", error);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const current = await databaseUser(req);
    if (!current || !isFaculty(req.user!.roles)) {
      res.status(403).json({ error: "Only authorized faculty can create group conversations" });
      return;
    }

    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const rawParticipantIds: unknown[] = Array.isArray(req.body.participantIds) ? req.body.participantIds : [];
    const participantIds = [...new Set(rawParticipantIds.map((value) => String(value)))].filter(
      (id) => id !== current.id,
    );
    if (!title || participantIds.length === 0) {
      res.status(400).json({ error: "A title and at least one recipient are required" });
      return;
    }

    const candidates = await prisma.user.findMany({
      where: { id: { in: participantIds }, status: "ACTIVE" },
      select: personSelect,
    });
    if (candidates.length !== participantIds.length) {
      res.status(400).json({ error: "One or more recipients are unavailable" });
      return;
    }

    const assignedIds = await assignedStudentIds(current.id);
    let includesStudents = false;
    for (const candidate of candidates) {
      const roles = candidate.roles.map((entry) => entry.role.name as string);
      if (isFaculty(roles)) continue;
      if (roles.includes("RESEARCHER") && req.body.includeStudents === true && assignedIds.has(candidate.id)) {
        includesStudents = true;
        continue;
      }
      res.status(403).json({ error: `You are not allowed to invite ${fullName(candidate)}` });
      return;
    }

    const creatorRoles = current.roles.map((entry) => entry.role.name as string);
    const created = await prisma.$transaction(async (tx) => {
      const group = await tx.chatGroup.create({
        data: {
          title: title.slice(0, 200),
          description,
          createdByAdviserId: current.email,
          adviserName: fullName(current),
          createdByUserId: current.id,
          isFacultyOnly: !includesStudents,
          participants: {
            create: [
              {
                userId: current.id,
                roleSnapshot: creatorRoles[0] || "ADVISER",
                status: "ACCEPTED",
                isAdmin: true,
                respondedAt: new Date(),
                lastReadAt: new Date(),
              },
              ...candidates.map((candidate) => ({
                userId: candidate.id,
                roleSnapshot: candidate.roles[0]?.role.name || "RESEARCHER",
                status: "PENDING" as const,
                invitedByUserId: current.id,
              })),
            ],
          },
        },
      });
      return group;
    });

    const event = { chatId: created.id };
    sseManager.sendToUser(current.id, "chat:updated", event);
    candidates.forEach((candidate) => sseManager.sendToUser(candidate.id, "chat:invitation", event));
    res.status(201).json({ chat: created });
  } catch (error: any) {
    console.error("[ChatRoutes] Failed to create chat group:", error);
    res.status(500).json({ error: "Failed to create chat group" });
  }
});

router.patch("/invitations/:invId", async (req: Request<{ invId: string }>, res: Response) => {
  try {
    const current = await databaseUser(req);
    const status = req.body.status === "accepted" ? "ACCEPTED" : req.body.status === "declined" ? "DECLINED" : null;
    if (!current || !status) {
      res.status(400).json({ error: "A valid invitation response is required" });
      return;
    }
    const invitation = await prisma.chatParticipant.findFirst({
      where: { id: req.params.invId, userId: current.id, status: "PENDING" },
    });
    if (!invitation) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }
    const updated = await prisma.chatParticipant.update({
      where: { id: invitation.id },
      data: { status, respondedAt: new Date(), lastReadAt: status === "ACCEPTED" ? new Date() : null },
    });
    await notifyParticipants(invitation.chatGroupId, "chat:updated", { chatId: invitation.chatGroupId });
    res.json({ invitation: { id: updated.id, status: updated.status.toLowerCase() } });
  } catch (error: any) {
    console.error("[ChatRoutes] Failed to update invitation:", error);
    res.status(500).json({ error: "Failed to update invitation" });
  }
});

router.get("/:id/messages", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const current = await databaseUser(req);
    const membership = current && await prisma.chatParticipant.findUnique({
      where: { chatGroupId_userId: { chatGroupId: req.params.id, userId: current.id } },
    });
    if (!membership || membership.status !== "ACCEPTED") {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const dbMessages = await prisma.chatMessage.findMany({ where: { chatGroupId: req.params.id }, orderBy: { createdAt: "asc" } });
    await prisma.chatParticipant.update({ where: { id: membership.id }, data: { lastReadAt: new Date() } });
    res.json({ messages: dbMessages.map(mapMessage) });
  } catch (error: any) {
    console.error("[ChatRoutes] Failed to fetch messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/:id/messages", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const current = await databaseUser(req);
    const message = String(req.body.message || "").trim();
    if (!message) {
      res.status(400).json({ error: "Message content cannot be empty" });
      return;
    }
    const membership = current && await prisma.chatParticipant.findUnique({
      where: { chatGroupId_userId: { chatGroupId: req.params.id, userId: current.id } },
    });
    if (!current || !membership || membership.status !== "ACCEPTED") {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const roles = current.roles.map((entry) => entry.role.name as string);
    const created = await prisma.chatMessage.create({
      data: {
        chatGroupId: req.params.id,
        senderId: current.email,
        senderUserId: current.id,
        senderName: fullName(current),
        senderRole: roles[0] || "RESEARCHER",
        message,
      },
    });
    await prisma.chatParticipant.update({ where: { id: membership.id }, data: { lastReadAt: new Date() } });
    const mapped = mapMessage(created);
    await notifyParticipants(req.params.id, "chat:message", mapped);
    res.status(201).json({ message: mapped });
  } catch (error: any) {
    console.error("[ChatRoutes] Failed to send message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.post("/:id/read", async (req: Request<{ id: string }>, res: Response) => {
  const current = await databaseUser(req);
  if (!current) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const result = await prisma.chatParticipant.updateMany({
    where: { chatGroupId: req.params.id, userId: current.id, status: "ACCEPTED" },
    data: { lastReadAt: new Date() },
  });
  if (!result.count) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.json({ ok: true });
});

router.delete("/:id/participants/:participantId", async (req: Request<{ id: string; participantId: string }>, res: Response) => {
  try {
    const current = await databaseUser(req);
    const admin = current && await prisma.chatParticipant.findUnique({
      where: { chatGroupId_userId: { chatGroupId: req.params.id, userId: current.id } },
    });
    const target = await prisma.chatParticipant.findFirst({
      where: { id: req.params.participantId, chatGroupId: req.params.id },
    });
    if (!current || !admin?.isAdmin || admin.status !== "ACCEPTED") {
      res.status(403).json({ error: "Group administrator access is required" });
      return;
    }
    if (!target || target.userId === current.id) {
      res.status(400).json({ error: "This member cannot be removed" });
      return;
    }
    await prisma.chatParticipant.update({ where: { id: target.id }, data: { status: "REMOVED", respondedAt: new Date() } });
    sseManager.sendToUser(target.userId, "chat:updated", { chatId: req.params.id });
    await notifyParticipants(req.params.id, "chat:updated", { chatId: req.params.id });
    res.json({ ok: true });
  } catch (error: any) {
    console.error("[ChatRoutes] Failed to remove participant:", error);
    res.status(500).json({ error: "Failed to remove participant" });
  }
});

export default router;
