import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { notifyMailRecipients } from "../services/mail-email.service.js";
import { Router, type RequestHandler } from "express";
import multer from "multer";
import { MailRecipientType, type Prisma } from "@prisma/client";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth, type AuthenticatedUser } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import {
  authorizedMailRecipientWhere,
  findAuthorizedMailRecipients,
} from "../services/mail-access.service.js";
import {
  resolveSigningImage,
  saveSigningImage,
} from "../services/signature-image.service.js";
import {
  createVisuallySignedPdf,
  loadVersionFile,
} from "../services/document-signing.service.js";

const router = Router();
const MAX_BODY_LENGTH = 50_000;
const MAX_SUBJECT_LENGTH = 255;
const MAIL_FOLDERS = new Set(["inbox", "sent", "drafts", "archive", "trash"]);
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  ".pdf",
  ".txt",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
]);
const INLINE_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const SIGNER_ROLES = new Set([
  "RESEARCH_COORDINATOR",
  "ADVISER",
  "PANELIST",
  "DEAN",
]);

const person = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
} as const;
const attachmentView = {
  id: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  sourceAttachmentId: true,
  signedById: true,
  signedAt: true,
  verificationCode: true,
} as const;
const participantInclude = { user: { select: person } } as const;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (
      ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimetype) &&
      ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)
    ) {
      callback(null, true);
      return;
    }
    callback(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        "Only PDF, Office, text, CSV, and common image files are allowed.",
      ),
    );
  },
});

const mailFiles: RequestHandler = (req, res, next) => {
  upload.array("files", 5)(req, res, (error) => {
    if (!error) return next();
    const message =
      error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "Each attachment must be 10 MB or smaller."
        : error?.message || "The attachment could not be accepted.";
    res.status(400).json({ error: message });
  });
};

type Placement = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  includeName?: boolean;
  includeDate?: boolean;
};

type RecipientGroups = {
  toIds: string[];
  ccIds: string[];
  bccIds: string[];
};

function validatePlacement(value: Placement) {
  const numbers = [value.x, value.y, value.width, value.height];
  if (!Number.isInteger(value.pageNumber) || value.pageNumber < 1)
    throw new Error("A valid PDF page number is required.");
  if (
    numbers.some((item) => !Number.isFinite(item) || item < 0 || item > 1) ||
    value.width <= 0 ||
    value.height <= 0 ||
    value.x + value.width > 1 ||
    value.y + value.height > 1
  )
    throw new Error(
      "The signature placement must fit completely inside the page.",
    );
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return value.split(",").map((item) => item.trim());
  }
}

function recipientGroups(body: Record<string, unknown>): RecipientGroups {
  const claimed = new Set<string>();
  const unique = (values: string[]) =>
    values.filter((value) => {
      const id = value.trim();
      if (!id || claimed.has(id)) return false;
      claimed.add(id);
      return true;
    });
  const legacyRecipient = String(body.recipientId || "").trim();
  return {
    toIds: unique([
      ...parseStringArray(body.toIds),
      ...(legacyRecipient ? [legacyRecipient] : []),
    ]),
    ccIds: unique(parseStringArray(body.ccIds)),
    bccIds: unique(parseStringArray(body.bccIds)),
  };
}

function allRecipientIds(groups: RecipientGroups) {
  return [...groups.toIds, ...groups.ccIds, ...groups.bccIds];
}

function participantRows(userId: string, groups: RecipientGroups) {
  return [
    { userId, recipientType: MailRecipientType.SENDER, readAt: new Date() },
    ...groups.toIds.map((recipientId) => ({
      userId: recipientId,
      recipientType: MailRecipientType.TO,
    })),
    ...groups.ccIds.map((recipientId) => ({
      userId: recipientId,
      recipientType: MailRecipientType.CC,
    })),
    ...groups.bccIds.map((recipientId) => ({
      userId: recipientId,
      recipientType: MailRecipientType.BCC,
    })),
  ];
}

async function validateRecipients(
  user: AuthenticatedUser,
  groups: RecipientGroups,
  requireTo: boolean,
) {
  const ids = allRecipientIds(groups).filter((id) => id !== user.id);
  if (requireTo && groups.toIds.filter((id) => id !== user.id).length === 0) {
    return "Add at least one authorized recipient in the To field.";
  }
  const authorized = await findAuthorizedMailRecipients(user, ids);
  if (authorized.length !== new Set(ids).size) {
    return "One or more recipients are unavailable or outside your authorized academic contacts.";
  }
  return null;
}

function normalizedSubject(value: unknown) {
  return String(value || "").trim().slice(0, MAX_SUBJECT_LENGTH);
}

function normalizedBody(value: unknown) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, MAX_BODY_LENGTH);
}

function safeFileName(value: string) {
  return path.basename(value).replace(/[\u0000-\u001f\u007f"]/g, "_").slice(0, 255);
}

function uploadedAttachments(files: Express.Multer.File[]) {
  return files.map((file) => ({
    fileName: safeFileName(file.originalname),
    mimeType: file.mimetype || "application/octet-stream",
    fileSize: file.size,
    fileData: Uint8Array.from(file.buffer),
  }));
}

async function accessibleSourceAttachments(
  userId: string,
  sourceIds: string[],
) {
  const ids = [...new Set(sourceIds)];
  if (!ids.length) return [];
  return prisma.mailAttachment.findMany({
    where: {
      id: { in: ids },
      message: {
        OR: [
          { senderId: userId },
          {
            isDraft: false,
            sentAt: { not: null },
            thread: { participants: { some: { userId } } },
          },
        ],
      },
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      fileData: true,
    },
  });
}

function copiedAttachments(
  attachmentsToCopy: Awaited<ReturnType<typeof accessibleSourceAttachments>>,
) {
  return attachmentsToCopy.map((attachment) => ({
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    fileSize: attachment.fileSize,
    fileData: attachment.fileData,
  }));
}

function visibleParticipants(thread: any, viewerId: string) {
  const viewerIsCreator = thread.createdById === viewerId;
  return thread.participants.filter(
    (participant: any) =>
      participant.recipientType !== MailRecipientType.BCC ||
      viewerIsCreator ||
      participant.userId === viewerId,
  );
}

function serializeThread(thread: any, viewerId: string) {
  const participant = thread.participants.find(
    (item: any) => item.userId === viewerId,
  );
  const latest = thread.messages?.[0];
  const unread = Boolean(
    latest &&
      latest.senderId !== viewerId &&
      (!participant?.readAt || latest.createdAt > participant.readAt),
  );
  return {
    ...thread,
    participants: visibleParticipants(thread, viewerId),
    unread,
  };
}

function activeParticipant(userId: string) {
  return {
    some: { userId, archivedAt: null, trashedAt: null },
  };
}

function folderWhere(folder: string, userId: string): Prisma.MailThreadWhereInput {
  if (folder === "drafts") {
    return {
      createdById: userId,
      messages: { some: { senderId: userId, isDraft: true } },
    };
  }
  if (folder === "archive") {
    return {
      participants: {
        some: { userId, archivedAt: { not: null }, trashedAt: null },
      },
      messages: { some: { isDraft: false, sentAt: { not: null } } },
    };
  }
  if (folder === "trash") {
    return {
      participants: { some: { userId, trashedAt: { not: null } } },
      messages: { some: { isDraft: false, sentAt: { not: null } } },
    };
  }
  if (folder === "sent") {
    return {
      participants: activeParticipant(userId),
      messages: {
        some: {
          senderId: userId,
          isDraft: false,
          sentAt: { not: null },
        },
      },
    };
  }
  return {
    participants: activeParticipant(userId),
    messages: {
      some: {
        senderId: { not: userId },
        isDraft: false,
        sentAt: { not: null },
      },
    },
  };
}

async function mailboxCounts(userId: string) {
  const [inbox, unread, sent, drafts, archive, trash] = await Promise.all([
    prisma.mailThread.count({ where: folderWhere("inbox", userId) }),
    prisma.mailThread.count({
      where: {
        AND: [
          folderWhere("inbox", userId),
          { participants: { some: { userId, readAt: null } } },
        ],
      },
    }),
    prisma.mailThread.count({ where: folderWhere("sent", userId) }),
    prisma.mailThread.count({ where: folderWhere("drafts", userId) }),
    prisma.mailThread.count({ where: folderWhere("archive", userId) }),
    prisma.mailThread.count({ where: folderWhere("trash", userId) }),
  ]);
  return { inbox, unread, sent, drafts, archive, trash };
}

router.post("/sync-dean-approvals", requireAuth, async (req, res) => {
  if (!req.user!.roles.includes("RESEARCH_COORDINATOR")) {
    return void res.status(403).json({
      error:
        "Only a research professor or coordinator can synchronize Dean approvals.",
    });
  }
  const signatures = await prisma.documentSignature.findMany({
    where: {
      revokedAt: null,
      sourceVersion: {
        document: {
          documentType: "DEAN_DEFENSE_APPROVAL",
          deanInboxMessages: {
            some: {
              authorId: req.user!.id,
              attachmentVersionId: { not: null },
            },
          },
        },
      },
    },
    include: {
      signedVersion: true,
      signedBy: { select: person },
      sourceVersion: {
        include: {
          document: {
            include: { research: { select: { title: true } } },
          },
        },
      },
    },
    orderBy: { signedAt: "asc" },
  });
  let delivered = 0;
  for (const signature of signatures) {
    const existing = await prisma.mailAttachment.findUnique({
      where: { verificationCode: signature.verificationCode },
      select: { id: true },
    });
    if (existing) continue;
    const signedBuffer = await loadVersionFile(signature.signedVersion);
    const signerName = [
      signature.signedBy.firstName,
      signature.signedBy.middleName,
      signature.signedBy.lastName,
    ]
      .filter(Boolean)
      .join(" ");
    const document = signature.sourceVersion.document;
    try {
      await prisma.$transaction(async (tx) => {
        const thread = await tx.mailThread.create({
          data: {
            subject: `Signed: ${document.title}`.slice(0, 255),
            createdById: signature.signedById,
            participants: {
              create: [
                {
                  userId: signature.signedById,
                  recipientType: MailRecipientType.SENDER,
                  readAt: signature.signedAt,
                },
                {
                  userId: req.user!.id,
                  recipientType: MailRecipientType.TO,
                },
              ],
            },
            messages: {
              create: {
                senderId: signature.signedById,
                sentAt: signature.signedAt,
                body: `${signerName} signed the Dean approval request for ${document.research.title}. Verification code: ${signature.verificationCode}`,
                attachments: {
                  create: {
                    fileName: signature.signedVersion.fileName,
                    mimeType: signature.signedVersion.mimeType,
                    fileSize: signedBuffer.length,
                    fileData: Uint8Array.from(signedBuffer),
                    signedById: signature.signedById,
                    signedAt: signature.signedAt,
                    verificationCode: signature.verificationCode,
                    originalFileHash: signature.originalFileHash,
                    signedFileHash: signature.signedFileHash,
                    signaturePlacements: signature.placements as any,
                  },
                },
              },
            },
          },
        });
        await tx.notification.create({
          data: {
            audience: "coordinator", recipientId: req.user!.id,
            type: "DOCUMENT_REVIEWED",
            title: "Dean signed your request",
            message: `${signerName} signed ${document.title}. The official signed PDF is available in your Inbox.`,
            entityType: "MailThread",
            entityId: thread.id,
          },
        });
      });
      delivered += 1;
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;
    }
  }
  res.json({ delivered });
});

router.get("/contacts", requireAuth, async (req, res) => {
  const query = String(req.query.query || "").trim().slice(0, 100);
  const authorizedWhere = await authorizedMailRecipientWhere(req.user!);
  const searchWhere: Prisma.UserWhereInput = query
    ? {
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { middleName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};
  const users = await prisma.user.findMany({
    where: { AND: [authorizedWhere, searchWhere] },
    select: {
      ...person,
      roles: { select: { role: { select: { name: true } } } },
      college: { select: { name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 100,
  });
  res.json({
    contacts: users.map((user) => ({
      ...user,
      roles: user.roles.map((item) => item.role.name),
    })),
  });
});

router.get("/threads", requireAuth, async (req, res) => {
  const requestedFolder = String(req.query.folder || "inbox");
  const folder = MAIL_FOLDERS.has(requestedFolder) ? requestedFolder : "inbox";
  const query = String(req.query.query || "").trim().slice(0, 100);
  const filter = String(req.query.filter || "all");
  const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(10, Number.parseInt(String(req.query.pageSize || "30"), 10) || 30),
  );
  const where: Prisma.MailThreadWhereInput = {
    AND: [
      folderWhere(folder, req.user!.id),
      ...(query
        ? [
            {
              OR: [
                { subject: { contains: query, mode: "insensitive" as const } },
                {
                  messages: {
                    some: { body: { contains: query, mode: "insensitive" as const } },
                  },
                },
                {
                  participants: {
                    some: {
                      OR: [
                        { recipientType: { not: MailRecipientType.BCC } },
                        { userId: req.user!.id },
                      ],
                      user: {
                        OR: [
                          { firstName: { contains: query, mode: "insensitive" as const } },
                          { lastName: { contains: query, mode: "insensitive" as const } },
                          { email: { contains: query, mode: "insensitive" as const } },
                        ],
                      },
                    },
                  },
                },
                {
                  AND: [
                    { createdById: req.user!.id },
                    {
                      participants: {
                        some: {
                          user: {
                            OR: [
                              { firstName: { contains: query, mode: "insensitive" as const } },
                              { lastName: { contains: query, mode: "insensitive" as const } },
                              { email: { contains: query, mode: "insensitive" as const } },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              ],
            },
          ]
        : []),
      ...(filter === "unread"
        ? [{ participants: { some: { userId: req.user!.id, readAt: null } } }]
        : []),
      ...(filter === "attachments"
        ? [{ messages: { some: { attachments: { some: {} } } } }]
        : []),
    ],
  };
  const messageWhere =
    folder === "drafts"
      ? { senderId: req.user!.id, isDraft: true }
      : { isDraft: false, sentAt: { not: null } };
  const [threads, total, counts] = await Promise.all([
    prisma.mailThread.findMany({
      where,
      include: {
        participants: { include: participantInclude },
        messages: {
          where: messageWhere,
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: { select: person },
            attachments: { select: attachmentView },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.mailThread.count({ where }),
    mailboxCounts(req.user!.id),
  ]);
  res.json({
    threads: threads.map((thread) => serializeThread(thread, req.user!.id)),
    counts,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});

router.get("/threads/:id", requireAuth, async (req, res) => {
  const thread = await prisma.mailThread.findFirst({
    where: {
      id: req.params.id as string,
      OR: [
        {
          createdById: req.user!.id,
          messages: {
            some: { senderId: req.user!.id, isDraft: true },
          },
        },
        {
          participants: { some: { userId: req.user!.id } },
          messages: { some: { isDraft: false, sentAt: { not: null } } },
        },
      ],
    },
    include: {
      participants: { include: participantInclude },
      messages: {
        where: { isDraft: false, sentAt: { not: null } },
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: person },
          attachments: { select: attachmentView },
        },
      },
    },
  });
  if (!thread)
    return void res.status(404).json({ error: "Message thread not found." });
  const readAt = new Date();
  await prisma.mailParticipant.updateMany({
    where: { threadId: thread.id, userId: req.user!.id },
    data: { readAt },
  });
  const mine = thread.participants.find(
    (participant) => participant.userId === req.user!.id,
  );
  if (mine) mine.readAt = readAt;
  const workflowInvitation = await prisma.workflowAccessEntry.findUnique({ where: { mailThreadId: thread.id }, select: { id: true, userId: true, status: true, workflow: { select: { name: true } } } });
  res.json({ thread: { ...serializeThread(thread, req.user!.id), workflowInvitation } });
});

router.post("/messages", requireAuth, mailFiles, async (req, res) => {
  const groups = recipientGroups(req.body || {});
  groups.toIds = groups.toIds.filter((id) => id !== req.user!.id);
  groups.ccIds = groups.ccIds.filter((id) => id !== req.user!.id);
  groups.bccIds = groups.bccIds.filter((id) => id !== req.user!.id);
  const subject = normalizedSubject(req.body?.subject);
  const body = normalizedBody(req.body?.body);
  const isDraft = String(req.body?.action || "send") === "draft";
  const files = (req.files as Express.Multer.File[]) || [];
  const sourceIds = parseStringArray(req.body?.sourceAttachmentIds);
  if (!isDraft && (!subject || !body)) {
    return void res
      .status(400)
      .json({ error: "Subject and message are required before sending." });
  }
  if (isDraft && !subject && !body && !files.length && !sourceIds.length) {
    return void res.status(400).json({ error: "The draft is empty." });
  }
  const recipientError = await validateRecipients(req.user!, groups, !isDraft);
  if (recipientError) return void res.status(403).json({ error: recipientError });
  const sources = await accessibleSourceAttachments(req.user!.id, sourceIds);
  if (sources.length !== new Set(sourceIds).size) {
    return void res.status(403).json({ error: "A forwarded attachment is unavailable." });
  }
  const recipients = allRecipientIds(groups);
  const result = await prisma.$transaction(async (tx) => {
    const thread = await tx.mailThread.create({
      data: {
        subject,
        createdById: req.user!.id,
        participants: { create: participantRows(req.user!.id, groups) },
      },
    });
    const message = await tx.mailMessage.create({
      data: {
        threadId: thread.id,
        senderId: req.user!.id,
        body,
        isDraft,
        sentAt: isDraft ? null : new Date(),
        attachments: {
          create: [
            ...uploadedAttachments(files),
            ...copiedAttachments(sources),
          ],
        },
      },
    });
    if (!isDraft && recipients.length) {
      await tx.notification.createMany({
        data: recipients.map((recipientId) => ({ audience: "account", recipientId,
          type: "SYSTEM_ANNOUNCEMENT" as const,
          title: `New message: ${subject}`,
          message: body.slice(0, 180),
          entityType: "MailThread",
          entityId: thread.id,
        })),
      });
    }
    return { thread, message };
  });
  if (!isDraft) await notifyMailRecipients(recipients);
  res.status(201).json(result);
});

router.put("/drafts/:messageId", requireAuth, mailFiles, async (req, res) => {
  const draft = await prisma.mailMessage.findFirst({
    where: {
      id: req.params.messageId as string,
      senderId: req.user!.id,
      isDraft: true,
    },
    include: {
      attachments: { select: { id: true } },
      thread: { include: { participants: true } },
    },
  });
  if (!draft) return void res.status(404).json({ error: "Draft not found." });
  const groups = recipientGroups(req.body || {});
  groups.toIds = groups.toIds.filter((id) => id !== req.user!.id);
  groups.ccIds = groups.ccIds.filter((id) => id !== req.user!.id);
  groups.bccIds = groups.bccIds.filter((id) => id !== req.user!.id);
  const recipientError = await validateRecipients(req.user!, groups, false);
  if (recipientError) return void res.status(403).json({ error: recipientError });
  const subject = normalizedSubject(req.body?.subject);
  const body = normalizedBody(req.body?.body);
  const files = (req.files as Express.Multer.File[]) || [];
  const keepAttachmentIds = Object.prototype.hasOwnProperty.call(
    req.body,
    "keepAttachmentIds",
  )
    ? parseStringArray(req.body.keepAttachmentIds)
    : draft.attachments.map((attachment) => attachment.id);
  const ownedAttachmentIds = new Set(
    draft.attachments.map((attachment) => attachment.id),
  );
  if (keepAttachmentIds.some((id) => !ownedAttachmentIds.has(id))) {
    return void res.status(403).json({ error: "A draft attachment is unavailable." });
  }
  const sourceIds = parseStringArray(req.body?.sourceAttachmentIds);
  const sources = await accessibleSourceAttachments(req.user!.id, sourceIds);
  if (sources.length !== new Set(sourceIds).size) {
    return void res.status(403).json({ error: "A forwarded attachment is unavailable." });
  }
  const result = await prisma.$transaction(async (tx) => {
    await tx.mailParticipant.deleteMany({
      where: { threadId: draft.threadId, userId: { not: req.user!.id } },
    });
    const recipientRows = participantRows(req.user!.id, groups).slice(1);
    if (recipientRows.length) {
      await tx.mailParticipant.createMany({
        data: recipientRows.map((row) => ({ ...row, threadId: draft.threadId })),
      });
    }
    await tx.mailAttachment.deleteMany({
      where: {
        messageId: draft.id,
        id: { notIn: keepAttachmentIds },
      },
    });
    const message = await tx.mailMessage.update({
      where: { id: draft.id },
      data: {
        body,
        attachments: {
          create: [
            ...uploadedAttachments(files),
            ...copiedAttachments(sources),
          ],
        },
      },
      include: { attachments: { select: attachmentView } },
    });
    const thread = await tx.mailThread.update({
      where: { id: draft.threadId },
      data: { subject, updatedAt: new Date() },
      include: { participants: { include: participantInclude } },
    });
    return { message, thread };
  });
  res.json(result);
});

router.post("/threads/:id/reply", requireAuth, mailFiles, async (req, res) => {
  const body = normalizedBody(req.body?.body);
  if (!body)
    return void res.status(400).json({ error: "Write a reply before sending." });
  const thread = await prisma.mailThread.findFirst({
    where: {
      id: req.params.id as string,
      participants: { some: { userId: req.user!.id } },
      messages: { some: { isDraft: false, sentAt: { not: null } } },
    },
    include: { participants: true },
  });
  if (!thread)
    return void res.status(404).json({ error: "Message thread not found." });
  const files = (req.files as Express.Multer.File[]) || [];
  const sentAt = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.mailMessage.create({
      data: {
        threadId: thread.id,
        senderId: req.user!.id,
        body,
        sentAt,
        attachments: { create: uploadedAttachments(files) },
      },
      include: {
        sender: { select: person },
        attachments: { select: attachmentView },
      },
    });
    await Promise.all([
      tx.mailThread.update({
        where: { id: thread.id },
        data: { updatedAt: sentAt },
      }),
      tx.mailParticipant.updateMany({
        where: { threadId: thread.id, userId: req.user!.id },
        data: { readAt: sentAt },
      }),
      tx.mailParticipant.updateMany({
        where: { threadId: thread.id, userId: { not: req.user!.id } },
        data: { readAt: null },
      }),
    ]);
    const others = thread.participants.filter(
      (item) => item.userId !== req.user!.id,
    );
    if (others.length) {
      await tx.notification.createMany({
        data: others.map((item) => ({
          audience: "account", recipientId: item.userId,
          type: "SYSTEM_ANNOUNCEMENT" as const,
          title: `Reply: ${thread.subject}`,
          message: body.slice(0, 180),
          entityType: "MailThread",
          entityId: thread.id,
        })),
      });
    }
    return created;
  });
  await notifyMailRecipients(thread.participants.filter((item) => item.userId !== req.user!.id).map((item) => item.userId));
  res.status(201).json({ message });
});

router.post("/drafts/:messageId/send", requireAuth, async (req, res) => {
  const draft = await prisma.mailMessage.findFirst({
    where: {
      id: req.params.messageId as string,
      senderId: req.user!.id,
      isDraft: true,
    },
    include: { thread: { include: { participants: true } } },
  });
  if (!draft) return void res.status(404).json({ error: "Draft not found." });
  const groups: RecipientGroups = {
    toIds: draft.thread.participants
      .filter((item) => item.recipientType === MailRecipientType.TO)
      .map((item) => item.userId),
    ccIds: draft.thread.participants
      .filter((item) => item.recipientType === MailRecipientType.CC)
      .map((item) => item.userId),
    bccIds: draft.thread.participants
      .filter((item) => item.recipientType === MailRecipientType.BCC)
      .map((item) => item.userId),
  };
  const recipientError = await validateRecipients(req.user!, groups, true);
  if (recipientError) return void res.status(403).json({ error: recipientError });
  if (!draft.thread.subject.trim() || !draft.body.trim()) {
    return void res.status(400).json({
      error: "Add a subject and message before sending this draft.",
    });
  }
  const recipients = allRecipientIds(groups);
  const sentAt = new Date();
  const sent = await prisma.$transaction(async (tx) => {
    const message = await tx.mailMessage.update({
      where: { id: draft.id },
      data: { isDraft: false, sentAt },
    });
    await Promise.all([
      tx.mailThread.update({
        where: { id: draft.threadId },
        data: { updatedAt: sentAt },
      }),
      tx.mailParticipant.updateMany({
        where: { threadId: draft.threadId, userId: req.user!.id },
        data: { readAt: sentAt, archivedAt: null, trashedAt: null },
      }),
      tx.mailParticipant.updateMany({
        where: { threadId: draft.threadId, userId: { not: req.user!.id } },
        data: { readAt: null, archivedAt: null, trashedAt: null },
      }),
    ]);
    await tx.notification.createMany({
      data: recipients.map((recipientId) => ({ audience: "account", recipientId,
        type: "SYSTEM_ANNOUNCEMENT" as const,
        title: `New message: ${draft.thread.subject}`,
        message: draft.body.slice(0, 180),
        entityType: "MailThread",
        entityId: draft.threadId,
      })),
    });
    return message;
  });
  await notifyMailRecipients(recipients);
  res.json({ message: sent });
});

router.delete("/drafts/:messageId", requireAuth, async (req, res) => {
  const draft = await prisma.mailMessage.findFirst({
    where: {
      id: req.params.messageId as string,
      senderId: req.user!.id,
      isDraft: true,
    },
    select: { id: true, threadId: true },
  });
  if (!draft) return void res.status(404).json({ error: "Draft not found." });
  await prisma.mailThread.delete({ where: { id: draft.threadId } });
  res.status(204).send();
});

router.patch("/threads/:id/state", requireAuth, async (req, res) => {
  const action = String(req.body?.action || "");
  const allowed = new Set([
    "archive",
    "trash",
    "restore",
    "mark-read",
    "mark-unread",
  ]);
  if (!allowed.has(action)) {
    return void res.status(400).json({ error: "Choose a valid mail action." });
  }
  const participant = await prisma.mailParticipant.findFirst({
    where: {
      threadId: req.params.id as string,
      userId: req.user!.id,
      thread: {
        OR: [
          { messages: { some: { isDraft: false, sentAt: { not: null } } } },
          {
            createdById: req.user!.id,
            messages: {
              some: { senderId: req.user!.id, isDraft: true },
            },
          },
        ],
      },
    },
    select: { threadId: true },
  });
  if (!participant)
    return void res.status(404).json({ error: "Message thread not found." });
  const now = new Date();
  const data: Prisma.MailParticipantUpdateInput =
    action === "archive"
      ? { archivedAt: now, trashedAt: null }
      : action === "trash"
        ? { trashedAt: now }
        : action === "restore"
          ? { archivedAt: null, trashedAt: null }
          : action === "mark-read"
            ? { readAt: now }
            : { readAt: null };
  await prisma.mailParticipant.update({
    where: {
      threadId_userId: {
        threadId: participant.threadId,
        userId: req.user!.id,
      },
    },
    data,
  });
  res.json({ action });
});

router.post("/attachments/:id/sign", requireAuth, async (req, res) => {
  try {
    if (!req.user!.roles.some((role) => SIGNER_ROLES.has(role)))
      return void res
        .status(403)
        .json({ error: "Your role cannot sign message attachments." });
    const { password, confirmation, placements, signatureImage, saveSignature } =
      req.body || {};
    if (confirmation !== true)
      return void res
        .status(400)
        .json({ error: "Signing confirmation is required." });
    if (!password || typeof password !== "string")
      return void res
        .status(400)
        .json({ error: "Enter your password to confirm signing." });
    const normalizedPlacements = Array.isArray(placements)
      ? (placements as Placement[])
      : [];
    if (!normalizedPlacements.length || normalizedPlacements.length > 10)
      return void res.status(400).json({
        error: "Add between one and ten signature placements.",
      });
    normalizedPlacements.forEach(validatePlacement);

    const [attachment, account, signer] = await Promise.all([
      prisma.mailAttachment.findFirst({
        where: {
          id: req.params.id as string,
          message: {
            isDraft: false,
            sentAt: { not: null },
            thread: { participants: { some: { userId: req.user!.id } } },
          },
        },
        include: {
          message: {
            include: { thread: { include: { participants: true } } },
          },
          signedCopies: {
            where: { signedById: req.user!.id },
            select: { id: true },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { passwordHash: true },
      }),
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: person,
      }),
    ]);
    if (!attachment)
      return void res
        .status(404)
        .json({ error: "Message attachment not found." });
    if (attachment.mimeType !== "application/pdf")
      return void res.status(400).json({
        error: "Only PDF message attachments can be signed.",
      });
    if (attachment.sourceAttachmentId || attachment.signedById)
      return void res.status(409).json({
        error: "A signed copy cannot be signed again from the message context.",
      });
    if (attachment.signedCopies.length)
      return void res.status(409).json({
        error: "You have already signed this exact attachment.",
      });
    if (
      !account?.passwordHash ||
      !(await bcrypt.compare(password, account.passwordHash))
    )
      return void res
        .status(401)
        .json({ error: "Your password could not be verified." });
    const signature = await resolveSigningImage(req.user!.id, {
      signatureImage,
      saveSignature,
    });
    if (!signer)
      return void res.status(404).json({ error: "Signer account not found." });

    const original = Buffer.from(attachment.fileData);
    const signerName = [signer.firstName, signer.middleName, signer.lastName]
      .filter(Boolean)
      .join(" ");
    const signedAt = new Date();
    const signedBuffer = await createVisuallySignedPdf({
      original,
      signatureImage: signature.imageData,
      signerName,
      signedAt,
      placements: normalizedPlacements,
    });
    const originalFileHash = crypto
      .createHash("sha256")
      .update(original)
      .digest("hex");
    const signedFileHash = crypto
      .createHash("sha256")
      .update(signedBuffer)
      .digest("hex");
    const verificationCode = `MAIL-PROF-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const signedName = `${attachment.fileName.replace(/\.pdf$/i, "")}-signed.pdf`;

    const created = await prisma.$transaction(async (tx) => {
      await saveSigningImage(tx, req.user!.id, signature);
      const message = await tx.mailMessage.create({
        data: {
          threadId: attachment.message.threadId,
          senderId: req.user!.id,
          body: `${signerName} signed “${attachment.fileName}”. Verification code: ${verificationCode}`,
          sentAt: signedAt,
          attachments: {
            create: {
              fileName: signedName,
              mimeType: "application/pdf",
              fileSize: signedBuffer.length,
              fileData: Uint8Array.from(signedBuffer),
              sourceAttachmentId: attachment.id,
              signedById: req.user!.id,
              signedAt,
              verificationCode,
              originalFileHash,
              signedFileHash,
              signaturePlacements: normalizedPlacements as any,
            },
          },
        },
        include: { attachments: { select: attachmentView } },
      });
      await tx.mailThread.update({
        where: { id: attachment.message.threadId },
        data: { updatedAt: signedAt },
      });
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "SIGN",
          entityType: "MailAttachment",
          entityId: message.attachments[0].id,
          oldValues: { sourceAttachmentId: attachment.id, originalFileHash },
          newValues: {
            signedAttachmentId: message.attachments[0].id,
            signedFileHash,
            verificationCode,
            signatureProfileHash: signature.fileHash,
          },
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });
      const recipients = attachment.message.thread.participants.filter(
        (item) => item.userId !== req.user!.id,
      );
      if (recipients.length)
        await tx.notification.createMany({
          data: recipients.map((item) => ({
            audience: "account", recipientId: item.userId,
            type: "DOCUMENT_REVIEWED" as const,
            title: "Message attachment signed",
            message: `${signerName} signed ${attachment.fileName}. The signed copy is available in your conversation.`,
            entityType: "MailThread",
            entityId: attachment.message.threadId,
          })),
        });
      return message.attachments[0];
    });
    res.status(201).json({
      signature: { verificationCode },
      version: { id: created.id, fileName: created.fileName },
      attachment: created,
    });
  } catch (error: any) {
    const message = error?.message || "Unable to sign the message attachment.";
    const status = /not found/i.test(message)
      ? 404
      : /already|cannot be signed again/i.test(message)
        ? 409
        : /role cannot/i.test(message)
          ? 403
          : 400;
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
  if (!attachment)
    return void res.status(404).json({ error: "Attachment not found." });
  res.type(attachment.mimeType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  const inlineRequested = req.query.inline === "1";
  const disposition =
    inlineRequested && INLINE_MIME_TYPES.has(attachment.mimeType)
      ? "inline"
      : "attachment";
  const fileName = safeFileName(attachment.fileName);
  res.setHeader(
    "Content-Disposition",
    `${disposition}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  );
  res.send(Buffer.from(attachment.fileData));
});

for (const layer of router.stack) {
  if (!layer.route) continue;
  for (const entry of layer.route.stack) entry.handle = asyncHandler(entry.handle);
}

export default router;
