import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const attachments = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 5 } });
const person = { id: true, firstName: true, middleName: true, lastName: true, email: true } as const;

router.get("/contacts", requireAuth, async (req, res) => {
  const users = await prisma.user.findMany({
    where: { id: { not: req.user!.id }, status: "ACTIVE" },
    select: { ...person, roles: { select: { role: { select: { name: true } } } }, college: { select: { name: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 250,
  });
  res.json({ contacts: users.map((user) => ({ ...user, roles: user.roles.map((item) => item.role.name) })) });
});

router.get("/threads", requireAuth, async (req, res) => {
  const folder = String(req.query.folder || "inbox");
  const where: any = folder === "drafts"
    ? { messages: { some: { senderId: req.user!.id, isDraft: true } } }
    : folder === "sent"
      ? { participants: { some: { userId: req.user!.id } }, messages: { some: { senderId: req.user!.id, isDraft: false, sentAt: { not: null } } } }
      : { participants: { some: { userId: req.user!.id } }, messages: { some: { senderId: { not: req.user!.id }, isDraft: false, sentAt: { not: null } } } };
  const threads = await prisma.mailThread.findMany({
    where,
    include: {
      participants: { include: { user: { select: person } } },
      messages: { where: folder === "drafts" ? { senderId: req.user!.id, isDraft: true } : { isDraft: false, sentAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 1, include: { sender: { select: person }, attachments: { select: { id: true, fileName: true, mimeType: true, fileSize: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ threads });
});

router.get("/threads/:id", requireAuth, async (req, res) => {
  const thread = await prisma.mailThread.findFirst({
    where: { id: req.params.id as string, OR: [{ participants: { some: { userId: req.user!.id } } }, { messages: { some: { senderId: req.user!.id, isDraft: true } } }] },
    include: { participants: { include: { user: { select: person } } }, messages: { where: { isDraft: false, sentAt: { not: null } }, orderBy: { createdAt: "asc" }, include: { sender: { select: person }, attachments: { select: { id: true, fileName: true, mimeType: true, fileSize: true } } } } },
  });
  if (!thread) return void res.status(404).json({ error: "Message thread not found." });
  await prisma.mailParticipant.updateMany({ where: { threadId: thread.id, userId: req.user!.id }, data: { readAt: new Date() } });
  res.json({ thread });
});

router.post("/messages", requireAuth, attachments.array("files", 5), async (req, res) => {
  const recipientId = String(req.body?.recipientId || "");
  const subject = String(req.body?.subject || "").trim();
  const body = String(req.body?.body || "").trim();
  const isDraft = String(req.body?.action || "send") === "draft";
  if (!recipientId || !subject || !body) return void res.status(400).json({ error: "Recipient, subject, and message are required." });
  const recipient = await prisma.user.findFirst({ where: { id: recipientId, status: "ACTIVE" }, select: { id: true } });
  if (!recipient || recipient.id === req.user!.id) return void res.status(400).json({ error: "Choose a valid recipient." });
  const files = (req.files as Express.Multer.File[]) || [];
  const result = await prisma.$transaction(async (tx) => {
    const thread = await tx.mailThread.create({ data: { subject, createdById: req.user!.id, participants: { create: [{ userId: req.user!.id, readAt: new Date() }, { userId: recipient.id }] } } });
    const message = await tx.mailMessage.create({ data: { threadId: thread.id, senderId: req.user!.id, body, isDraft, sentAt: isDraft ? null : new Date(), attachments: { create: files.map((file) => ({ fileName: file.originalname, mimeType: file.mimetype || "application/octet-stream", fileSize: file.size, fileData: Uint8Array.from(file.buffer) })) } } });
    if (!isDraft) await tx.notification.create({ data: { recipientId: recipient.id, type: "SYSTEM_ANNOUNCEMENT", title: `New message: ${subject}`, message: body.slice(0, 180), entityType: "MailThread", entityId: thread.id } });
    return { thread, message };
  });
  res.status(201).json(result);
});

router.post("/threads/:id/reply", requireAuth, attachments.array("files", 5), async (req, res) => {
  const body = String(req.body?.body || "").trim();
  if (!body) return void res.status(400).json({ error: "Write a reply before sending." });
  const thread = await prisma.mailThread.findFirst({ where: { id: req.params.id as string, participants: { some: { userId: req.user!.id } } }, include: { participants: true } });
  if (!thread) return void res.status(404).json({ error: "Message thread not found." });
  const files = (req.files as Express.Multer.File[]) || [];
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.mailMessage.create({ data: { threadId: thread.id, senderId: req.user!.id, body, sentAt: new Date(), attachments: { create: files.map((file) => ({ fileName: file.originalname, mimeType: file.mimetype || "application/octet-stream", fileSize: file.size, fileData: Uint8Array.from(file.buffer) })) } }, include: { sender: { select: person }, attachments: { select: { id: true, fileName: true, mimeType: true, fileSize: true } } } });
    await tx.mailThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
    const others = thread.participants.filter((item) => item.userId !== req.user!.id);
    if (others.length) await tx.notification.createMany({ data: others.map((item) => ({ recipientId: item.userId, type: "SYSTEM_ANNOUNCEMENT" as const, title: `Reply: ${thread.subject}`, message: body.slice(0, 180), entityType: "MailThread", entityId: thread.id })) });
    return created;
  });
  res.status(201).json({ message });
});

router.post("/drafts/:messageId/send", requireAuth, async (req, res) => {
  const draft = await prisma.mailMessage.findFirst({ where: { id: req.params.messageId as string, senderId: req.user!.id, isDraft: true }, include: { thread: { include: { participants: true } } } });
  if (!draft) return void res.status(404).json({ error: "Draft not found." });
  const sent = await prisma.$transaction(async (tx) => {
    const message = await tx.mailMessage.update({ where: { id: draft.id }, data: { isDraft: false, sentAt: new Date() } });
    await tx.mailThread.update({ where: { id: draft.threadId }, data: { updatedAt: new Date() } });
    const recipients = draft.thread.participants.filter((item) => item.userId !== req.user!.id);
    if (recipients.length) await tx.notification.createMany({ data: recipients.map((item) => ({ recipientId: item.userId, type: "SYSTEM_ANNOUNCEMENT" as const, title: `New message: ${draft.thread.subject}`, message: draft.body.slice(0, 180), entityType: "MailThread", entityId: draft.threadId })) });
    return message;
  });
  res.json({ message: sent });
});

router.delete("/drafts/:messageId", requireAuth, async (req, res) => {
  const draft = await prisma.mailMessage.findFirst({ where: { id: req.params.messageId as string, senderId: req.user!.id, isDraft: true }, select: { id: true, threadId: true } });
  if (!draft) return void res.status(404).json({ error: "Draft not found." });
  await prisma.mailThread.delete({ where: { id: draft.threadId } });
  res.status(204).send();
});

router.get("/attachments/:id", requireAuth, async (req, res) => {
  const attachment = await prisma.mailAttachment.findFirst({
    where: {
      id: req.params.id as string,
      message: {
        OR: [
          { senderId: req.user!.id },
          {
            isDraft: false,
            sentAt: { not: null },
            thread: { participants: { some: { userId: req.user!.id } } },
          },
        ],
      },
    },
  });
  if (!attachment) return void res.status(404).json({ error: "Attachment not found." });
  res.type(attachment.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${attachment.fileName.replace(/"/g, "")}"`);
  res.send(Buffer.from(attachment.fileData));
});

export default router;
