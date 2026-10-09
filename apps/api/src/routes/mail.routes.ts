import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const router = Router();
const attachments = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 5 } });
const person = { id: true, firstName: true, middleName: true, lastName: true, email: true } as const;
const attachmentView = { id: true, fileName: true, mimeType: true, fileSize: true, sourceAttachmentId: true, signedById: true, signedAt: true, verificationCode: true } as const;
const SIGNER_ROLES = new Set(["RESEARCH_COORDINATOR", "ADVISER", "PANELIST", "RPO", "VPAA"]);

type Placement = { pageNumber: number; x: number; y: number; width: number; height: number; includeName?: boolean; includeDate?: boolean };
function validatePlacement(value: Placement) {
  const numbers = [value.x, value.y, value.width, value.height];
  if (!Number.isInteger(value.pageNumber) || value.pageNumber < 1) throw new Error("A valid PDF page number is required.");
  if (numbers.some((item) => !Number.isFinite(item) || item < 0 || item > 1) || value.width <= 0 || value.height <= 0 || value.x + value.width > 1 || value.y + value.height > 1)
    throw new Error("The signature placement must fit completely inside the page.");
}

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
      messages: { where: folder === "drafts" ? { senderId: req.user!.id, isDraft: true } : { isDraft: false, sentAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 1, include: { sender: { select: person }, attachments: { select: attachmentView } } },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ threads });
});

router.get("/threads/:id", requireAuth, async (req, res) => {
  const thread = await prisma.mailThread.findFirst({
    where: { id: req.params.id as string, OR: [{ participants: { some: { userId: req.user!.id } } }, { messages: { some: { senderId: req.user!.id, isDraft: true } } }] },
    include: { participants: { include: { user: { select: person } } }, messages: { where: { isDraft: false, sentAt: { not: null } }, orderBy: { createdAt: "asc" }, include: { sender: { select: person }, attachments: { select: attachmentView } } } },
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
    const created = await tx.mailMessage.create({ data: { threadId: thread.id, senderId: req.user!.id, body, sentAt: new Date(), attachments: { create: files.map((file) => ({ fileName: file.originalname, mimeType: file.mimetype || "application/octet-stream", fileSize: file.size, fileData: Uint8Array.from(file.buffer) })) } }, include: { sender: { select: person }, attachments: { select: attachmentView } } });
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

router.post("/attachments/:id/sign", requireAuth, async (req, res) => {
  try {
    if (!req.user!.roles.some((role) => SIGNER_ROLES.has(role))) return void res.status(403).json({ error: "Your role cannot sign message attachments." });
    const { password, confirmation, placements } = req.body || {};
    if (confirmation !== true) return void res.status(400).json({ error: "Signing confirmation is required." });
    if (!password || typeof password !== "string") return void res.status(400).json({ error: "Enter your password to confirm signing." });
    const normalizedPlacements = Array.isArray(placements) ? placements as Placement[] : [];
    if (!normalizedPlacements.length || normalizedPlacements.length > 10) return void res.status(400).json({ error: "Add between one and ten signature placements." });
    normalizedPlacements.forEach(validatePlacement);

    const [attachment, account, signature, signer] = await Promise.all([
      prisma.mailAttachment.findFirst({
        where: { id: req.params.id as string, message: { isDraft: false, sentAt: { not: null }, thread: { participants: { some: { userId: req.user!.id } } } } },
        include: { message: { include: { thread: { include: { participants: true } } } }, signedCopies: { where: { signedById: req.user!.id }, select: { id: true } } },
      }),
      prisma.user.findUnique({ where: { id: req.user!.id }, select: { passwordHash: true } }),
      prisma.userSignature.findUnique({ where: { userId: req.user!.id } }),
      prisma.user.findUnique({ where: { id: req.user!.id }, select: person }),
    ]);
    if (!attachment) return void res.status(404).json({ error: "Message attachment not found." });
    if (attachment.mimeType !== "application/pdf") return void res.status(400).json({ error: "Only PDF message attachments can be signed." });
    if (attachment.sourceAttachmentId || attachment.signedById) return void res.status(409).json({ error: "A signed copy cannot be signed again from the message context." });
    if (attachment.signedCopies.length) return void res.status(409).json({ error: "You have already signed this exact attachment." });
    if (!account?.passwordHash || !(await bcrypt.compare(password, account.passwordHash))) return void res.status(401).json({ error: "Your password could not be verified." });
    if (!signature) return void res.status(400).json({ error: "Create or upload your signature before signing a document." });
    if (!signer) return void res.status(404).json({ error: "Signer account not found." });

    const original = Buffer.from(attachment.fileData);
    const pdf = await PDFDocument.load(original, { updateMetadata: false });
    const signatureImage = await pdf.embedPng(signature.imageData);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const signerName = [signer.firstName, signer.middleName, signer.lastName].filter(Boolean).join(" ");
    const signedAt = new Date();
    const signedDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(signedAt);
    for (const placement of normalizedPlacements) {
      const page = pdf.getPages()[placement.pageNumber - 1];
      if (!page) return void res.status(400).json({ error: `PDF page ${placement.pageNumber} does not exist.` });
      const pageSize = page.getSize();
      const width = placement.width * pageSize.width;
      const height = placement.height * pageSize.height;
      const x = placement.x * pageSize.width;
      const y = pageSize.height - placement.y * pageSize.height - height;
      page.drawImage(signatureImage, { x, y, width, height });
      const details = [placement.includeName === false ? null : signerName, placement.includeDate === false ? null : `Signed ${signedDate}`].filter(Boolean) as string[];
      details.forEach((line, index) => page.drawText(line, { x, y: Math.max(4, y - 10 - index * 9), size: 7, font, color: rgb(0.12, 0.18, 0.25), maxWidth: Math.max(width, 120) }));
    }
    pdf.setProducer("Advisio Research Management System");
    pdf.setModificationDate(signedAt);
    const signedBuffer = Buffer.from(await pdf.save());
    const originalFileHash = crypto.createHash("sha256").update(original).digest("hex");
    const signedFileHash = crypto.createHash("sha256").update(signedBuffer).digest("hex");
    const verificationCode = `MAIL-PROF-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const signedName = `${attachment.fileName.replace(/\.pdf$/i, "")}-signed.pdf`;

    const created = await prisma.$transaction(async (tx) => {
      const message = await tx.mailMessage.create({
        data: {
          threadId: attachment.message.threadId,
          senderId: req.user!.id,
          body: `${signerName} signed “${attachment.fileName}”. Verification code: ${verificationCode}`,
          sentAt: signedAt,
          attachments: { create: { fileName: signedName, mimeType: "application/pdf", fileSize: signedBuffer.length, fileData: Uint8Array.from(signedBuffer), sourceAttachmentId: attachment.id, signedById: req.user!.id, signedAt, verificationCode, originalFileHash, signedFileHash, signaturePlacements: normalizedPlacements as any } },
        },
        include: { attachments: { select: attachmentView } },
      });
      await tx.mailThread.update({ where: { id: attachment.message.threadId }, data: { updatedAt: signedAt } });
      await tx.auditLog.create({ data: { userId: req.user!.id, action: "SIGN", entityType: "MailAttachment", entityId: message.attachments[0].id, oldValues: { sourceAttachmentId: attachment.id, originalFileHash }, newValues: { signedAttachmentId: message.attachments[0].id, signedFileHash, verificationCode }, ipAddress: req.ip, userAgent: req.get("user-agent") || null } });
      const recipients = attachment.message.thread.participants.filter((item) => item.userId !== req.user!.id);
      if (recipients.length) await tx.notification.createMany({ data: recipients.map((item) => ({ recipientId: item.userId, type: "DOCUMENT_REVIEWED" as const, title: "Message attachment signed", message: `${signerName} signed ${attachment.fileName}. The signed copy is available in your conversation.`, entityType: "MailThread", entityId: attachment.message.threadId })) });
      return message.attachments[0];
    });
    res.status(201).json({ signature: { verificationCode }, version: { id: created.id, fileName: created.fileName }, attachment: created });
  } catch (error: any) {
    const message = error?.message || "Unable to sign the message attachment.";
    const status = /not found/i.test(message) ? 404 : /already|cannot be signed again/i.test(message) ? 409 : /role cannot/i.test(message) ? 403 : 400;
    res.status(status).json({ error: message });
  }
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
  const disposition = req.query.inline === "1" ? "inline" : "attachment";
  res.setHeader("Content-Disposition", `${disposition}; filename="${attachment.fileName.replace(/"/g, "")}"`);
  res.send(Buffer.from(attachment.fileData));
});

export default router;
