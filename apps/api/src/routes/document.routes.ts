import { Router, Request, Response } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import {
  prisma,
  ReviewType,
  ReviewRecommendation,
  ReviewStatus,
  CommentStatus,
  DocumentStatus,
} from "../lib/prisma.js";
import { Permissions } from "@research-management/auth";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { documentService } from "../services/document.service.js";
import { googleDriveService } from "../services/google-drive.service.js";
import { documentSigningService } from "../services/document-signing.service.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});
const signatureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const elevatedDocumentRoles = ["SYSTEM_ADMIN", "RPO", "REB", "VPAA"];
const documentSignerRoles = new Set(["ADVISER", "PANELIST", "RESEARCH_COORDINATOR", "RPO", "VPAA"]);

const canManageSignature = (user: NonNullable<Request["user"]>) =>
  user.roles.some((role) => documentSignerRoles.has(role));

const canUseDeanInbox = (user: NonNullable<Request["user"]>) =>
  user.roles.some((role) => ["RPO", "VPAA"].includes(role));

const deanInboxScope = (user: NonNullable<Request["user"]>) =>
  user.roles.includes("VPAA") || !user.collegeId
    ? {}
    : { document: { research: { collegeId: user.collegeId } } };

async function canAccessResearch(user: NonNullable<Request["user"]>, researchId: string) {
  if (user.roles.some((role) => elevatedDocumentRoles.includes(role))) return true;
  const research = await prisma.researchProject.findUnique({
    where: { id: researchId },
    select: {
      collegeId: true,
      createdBy: true,
      members: { where: { userId: user.id, leftAt: null }, select: { id: true } },
    },
  });
  if (!research) return false;
  return research.createdBy === user.id || research.members.length > 0 ||
    (user.roles.includes("RESEARCH_COORDINATOR") && user.collegeId === research.collegeId);
}

const isPng = (buffer: Buffer) =>
  buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

router.get(["/users/me/signature", "/users/me/adviser-signature"], requireAuth, async (req, res) => {
  if (!req.user || !canManageSignature(req.user)) return void res.status(403).json({ error: "Your role cannot manage a document signature." });
  const signature = await prisma.userSignature.findUnique({
    where: { userId: req.user.id },
    select: { id: true, mimeType: true, fileHash: true, createdAt: true, updatedAt: true },
  });
  res.json({ signature: signature ? { ...signature, imageUrl: "/api/users/me/signature/image" } : null });
});

router.get(["/users/me/signature/image", "/users/me/adviser-signature/image"], requireAuth, async (req, res) => {
  if (!req.user || !canManageSignature(req.user)) return void res.status(403).json({ error: "Your role cannot access a signature." });
  const signature = await prisma.userSignature.findUnique({ where: { userId: req.user.id } });
  if (!signature) return void res.status(404).json({ error: "Signature not found." });
  res.setHeader("Cache-Control", "private, no-store");
  res.type(signature.mimeType).send(Buffer.from(signature.imageData));
});

router.put(
  ["/users/me/signature", "/users/me/adviser-signature"],
  requireAuth,
  signatureUpload.single("signature"),
  async (req, res) => {
    if (!req.user || !canManageSignature(req.user)) return void res.status(403).json({ error: "Your role cannot manage a document signature." });
    if (!req.file || req.file.mimetype !== "image/png" || !isPng(req.file.buffer))
      return void res.status(400).json({ error: "Upload a valid PNG signature image up to 2 MB." });
    const fileHash = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
    const imageData = Uint8Array.from(req.file.buffer);
    const signature = await prisma.userSignature.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, mimeType: "image/png", imageData, fileHash },
      update: { mimeType: "image/png", imageData, fileHash },
      select: { id: true, mimeType: true, fileHash: true, createdAt: true, updatedAt: true },
    });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: "UPDATE", entityType: "UserSignature", entityId: signature.id, newValues: { fileHash }, ipAddress: req.ip, userAgent: req.get("user-agent") },
    });
    res.json({ signature: { ...signature, imageUrl: "/api/users/me/signature/image" } });
  },
);

router.delete(["/users/me/signature", "/users/me/adviser-signature"], requireAuth, async (req, res) => {
  if (!req.user || !canManageSignature(req.user)) return void res.status(403).json({ error: "Your role cannot manage a document signature." });
  const existing = await prisma.userSignature.findUnique({ where: { userId: req.user.id }, select: { id: true } });
  if (existing) {
    await prisma.$transaction([
      prisma.userSignature.delete({ where: { userId: req.user.id } }),
      prisma.auditLog.create({ data: { userId: req.user.id, action: "DELETE", entityType: "UserSignature", entityId: existing.id, ipAddress: req.ip, userAgent: req.get("user-agent") } }),
    ]);
  }
  res.status(204).send();
});

router.get("/dean-inbox/messages", requireAuth, async (req, res) => {
  if (!req.user || !canUseDeanInbox(req.user)) return void res.status(403).json({ error: "Only the Dean's Office can access this inbox." });
  const messages = await prisma.deanInboxMessage.findMany({
    where: {
      ...deanInboxScope(req.user),
      document: {
        ...(req.user.roles.includes("VPAA") || !req.user.collegeId ? {} : { research: { collegeId: req.user.collegeId } }),
        deanInboxMessages: { some: { OR: [{ recipientId: req.user.id }, { recipientId: null }] } },
      },
    },
    include: {
      author: { select: { id: true, firstName: true, middleName: true, lastName: true } },
      attachmentVersion: { select: { id: true, fileName: true, googleDriveFileId: true, versionNumber: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json({ messages });
});

router.get("/dean-inbox/threads", requireAuth, async (req, res) => {
  if (!req.user || !canUseDeanInbox(req.user)) return void res.status(403).json({ error: "Only the Dean's Office can access this inbox." });
  const threads = await prisma.document.findMany({
    where: {
      deanInboxMessages: { some: {} },
      AND: { deanInboxMessages: { some: { OR: [{ recipientId: req.user.id }, { recipientId: null }] } } },
      ...(req.user.roles.includes("VPAA") || !req.user.collegeId ? {} : { research: { collegeId: req.user.collegeId } }),
    },
    include: {
      research: { select: { id: true, title: true, groupName: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        select: { id: true, versionNumber: true, fileName: true, mimeType: true, googleDriveFileId: true, uploadedAt: true, sourceSignature: { select: { signedVersionId: true } }, signedSignature: { select: { verificationCode: true, signedAt: true } } },
      },
      deanInboxMessages: {
        orderBy: { createdAt: "asc" },
        take: 1,
        include: { author: { select: { id: true, firstName: true, middleName: true, lastName: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ threads });
});

router.get("/dean-inbox/recipients", requireAuth, async (req, res) => {
  if (!req.user || !req.user.roles.includes("RESEARCH_COORDINATOR")) return void res.status(403).json({ error: "Only a research professor or coordinator can select a Dean recipient." });
  const researchId = String(req.query.researchId || "");
  const research = await prisma.researchProject.findFirst({
    where: { id: researchId, ...(req.user.collegeId ? { collegeId: req.user.collegeId } : {}) },
    select: { id: true, collegeId: true },
  });
  if (!research || !(await canAccessResearch(req.user, research.id))) return void res.status(404).json({ error: "Research group not found in your assigned scope." });
  const recipients = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { collegeId: research.collegeId, roles: { some: { role: { name: "RPO" } } } },
        { roles: { some: { role: { name: "VPAA" } } } },
      ],
    },
    select: { id: true, firstName: true, middleName: true, lastName: true, email: true, college: { select: { name: true } }, roles: { select: { role: { select: { name: true } } } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  res.json({ recipients: recipients.map((recipient) => ({ ...recipient, roles: recipient.roles.map((item) => item.role.name) })) });
});

router.post("/dean-inbox/requests", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.user || !req.user.roles.includes("RESEARCH_COORDINATOR")) return void res.status(403).json({ error: "Only a research professor or coordinator can send a Dean signature request." });
  const researchId = typeof req.body?.researchId === "string" ? req.body.researchId : "";
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const recipientId = typeof req.body?.recipientId === "string" ? req.body.recipientId : "";
  if (!researchId || !recipientId || !subject || !message || !req.file) return void res.status(400).json({ error: "Research group, Dean recipient, subject, message, and PDF request letter are required." });
  if (subject.length > 255 || message.length > 5000) return void res.status(400).json({ error: "The subject or message is too long." });
  if (req.file.mimetype !== "application/pdf" || req.file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") return void res.status(400).json({ error: "Attach a valid PDF request letter." });
  if (!(await canAccessResearch(req.user, researchId))) return void res.status(403).json({ error: "You cannot send a request for this research group." });

  const research = await prisma.researchProject.findUnique({ where: { id: researchId }, select: { title: true, collegeId: true } });
  const recipient = await prisma.user.findFirst({
    where: {
      id: recipientId,
      status: "ACTIVE",
      OR: [
        { collegeId: research?.collegeId, roles: { some: { role: { name: "RPO" } } } },
        { roles: { some: { role: { name: "VPAA" } } } },
      ],
    },
    select: { id: true, firstName: true, middleName: true, lastName: true },
  });
  if (!recipient) return void res.status(400).json({ error: "The selected Dean is unavailable for this research group." });
  const recipientName = [recipient.firstName, recipient.middleName, recipient.lastName].filter(Boolean).join(" ");

  const result = await documentService.createDocumentWithVersion({
    researchId,
    title: subject,
    documentType: "DEAN_DEFENSE_APPROVAL",
    fileBuffer: req.file.buffer,
    fileName: req.file.originalname,
    mimeType: "application/pdf",
    uploadedBy: req.user.id,
    deanRecipient: { id: recipient.id, name: recipientName },
  });
  const inboxMessage = await prisma.deanInboxMessage.create({
    data: { documentId: result.document.id, authorId: req.user.id, recipientId: recipient.id, message, attachmentVersionId: result.version.id },
  });
  await prisma.notification.create({ data: { recipientId: recipient.id, type: "DOCUMENT_UPLOADED", title: "New Dean signature request", message: `${req.user.firstName || "A professor"} ${req.user.lastName || ""} requested a signature for ${research?.title || subject}.`, entityType: "DeanInboxMessage", entityId: inboxMessage.id } });
  res.status(201).json({ request: inboxMessage, document: result.document, version: result.version, recipient: { id: recipient.id, name: recipientName } });
});

router.post("/dean-inbox/documents/:documentId/messages", requireAuth, async (req, res) => {
  if (!req.user || !canUseDeanInbox(req.user)) return void res.status(403).json({ error: "Only the Dean's Office can reply from this inbox." });
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return void res.status(400).json({ error: "Write a message before sending." });
  if (message.length > 5000) return void res.status(400).json({ error: "Messages cannot exceed 5,000 characters." });
  const document = await prisma.document.findFirst({
    where: {
      id: req.params.documentId as string,
      ...(req.user.roles.includes("VPAA") || !req.user.collegeId ? {} : { research: { collegeId: req.user.collegeId } }),
      deanInboxMessages: { some: { OR: [{ recipientId: req.user.id }, { recipientId: null }] } },
    },
    select: { id: true },
  });
  if (!document) return void res.status(404).json({ error: "Inbox document not found in your assigned scope." });
  const created = await prisma.deanInboxMessage.create({
    data: { documentId: document.id, authorId: req.user.id, recipientId: req.user.id, message },
    include: {
      author: { select: { id: true, firstName: true, middleName: true, lastName: true } },
      attachmentVersion: { select: { id: true, fileName: true, googleDriveFileId: true, versionNumber: true } },
    },
  });
  res.status(201).json({ message: created });
});

// GET /api/documents/files/:fileId — authenticated preview/download for Drive or local fallback files.
router.get(
  "/documents/files/:fileId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const fileId = req.params.fileId as string;
      const version = await prisma.documentVersion.findFirst({
        where: { googleDriveFileId: fileId },
        select: {
          storagePath: true,
          fileName: true,
          mimeType: true,
          uploadedBy: true,
          document: {
            select: {
              createdBy: true,
              taskSubmissions: {
                select: {
                  task: {
                    select: {
                      stage: {
                        select: {
                          workflow: { select: { createdBy: true } },
                        },
                      },
                    },
                  },
                },
              },
              research: {
                select: {
                  collegeId: true,
                  members: {
                    where: { leftAt: null },
                    select: { userId: true },
                  },
                },
              },
            },
          },
        },
      });
      if (!version)
        return void res.status(404).json({ error: "File not found" });

      const isElevated = req.user!.roles.some((role) =>
        elevatedDocumentRoles.includes(role),
      );
      const isCollegeCoordinator =
        req.user!.roles.includes("RESEARCH_COORDINATOR") &&
        req.user!.collegeId === version.document.research.collegeId;
      const isParticipant = version.document.research.members.some(
        (member) => member.userId === req.user!.id,
      );
      const isOwner =
        version.uploadedBy === req.user!.id ||
        version.document.createdBy === req.user!.id;
      const isWorkflowProfessor = version.document.taskSubmissions.some(
        (submission) =>
          submission.task.stage.workflow.createdBy === req.user!.id,
      );
      if (
        !isElevated &&
        !isCollegeCoordinator &&
        !isParticipant &&
        !isOwner &&
        !isWorkflowProfessor
      ) {
        return void res
          .status(403)
          .json({ error: "You do not have access to this document" });
      }

      if (!fileId.startsWith("gdrive-")) {
        try {
          const metadata = await googleDriveService.getFileMetadata(fileId);
          if (!metadata)
            return void res.status(503).json({
              error: "Google Drive is not currently connected.",
              code: "DRIVE_DISCONNECTED",
            });
        } catch (driveError: any) {
          const driveStatus = Number(
            driveError?.response?.status || driveError?.code || 0,
          );
          if (driveStatus === 404) {
            return void res.status(404).json({
              error:
                "The stored file is no longer accessible from the connected Google Drive account. It may have been deleted, moved to trash, or belong to a previously connected account.",
              code: "DRIVE_FILE_UNAVAILABLE",
            });
          }
          throw driveError;
        }
        const driveResponse = await googleDriveService.getFileStream(fileId);
        res.type(version.mimeType);
        res.setHeader(
          "Content-Disposition",
          `${req.query.download === "1" ? "attachment" : "inline"}; filename="${version.fileName.replace(/"/g, "")}"`,
        );
        driveResponse.data.pipe(res);
        return;
      }

      const uploadDir = path.resolve(process.cwd(), "uploads");
      const diskName = fs.existsSync(uploadDir)
        ? fs
            .readdirSync(uploadDir)
            .find((name) => name.startsWith(`${fileId}-`))
        : undefined;
      if (!diskName)
        return void res
          .status(404)
          .json({ error: "Stored file is unavailable" });
      res.type(version.mimeType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${version.fileName.replace(/"/g, "")}"`,
      );
      res.sendFile(path.resolve(uploadDir, diskName));
    } catch (error: any) {
      const driveStatus = Number(error?.response?.status || error?.code || 0);
      if (driveStatus === 404) {
        return void res.status(404).json({
          error:
            "The stored file is no longer accessible from the connected Google Drive account.",
          code: "DRIVE_FILE_UNAVAILABLE",
        });
      }
      res.status(500).json({
        error:
          typeof error?.message === "string"
            ? error.message
            : "Failed to open file",
      });
    }
  },
);

// GET /api/research/:researchId/documents
router.get(
  "/research/:researchId/documents",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const researchId = req.params.researchId as string;

      if (!(await canAccessResearch(req.user!, researchId))) {
        return void res.status(403).json({ error: "You do not have access to this research project's documents." });
      }

      const documents = await prisma.document.findMany({
        where: { researchId },
        include: {
          versions: {
            include: {
              sourceSignature: { select: { id: true, signedAt: true, verificationCode: true, signedVersionId: true, revokedAt: true } },
              signedSignature: {
                select: {
                  id: true,
                  signedAt: true,
                  verificationCode: true,
                  sourceVersionId: true,
                  revokedAt: true,
                  signedBy: { select: { firstName: true, middleName: true, lastName: true } },
                },
              },
              reviews: {
                include: {
                  reviewer: {
                    select: { firstName: true, lastName: true, email: true },
                  },
                  comments: {
                    include: {
                      author: {
                        select: { firstName: true, lastName: true },
                      },
                    },
                    orderBy: { createdAt: "asc" },
                  },
                },
              },
            },
            orderBy: { versionNumber: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      const mappedDocs = documents.map((doc) => ({
        ...doc,
        versions: doc.versions.map((v) => ({
          ...v,
          fileSize: Number(v.fileSize),
          webViewLink: v.googleDriveFileId
            ? `/api/documents/files/${v.googleDriveFileId}`
            : undefined,
        })),
      }));

      res.json({ documents: mappedDocs });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch documents" });
    }
  },
);

// POST /api/research/:researchId/documents (Supports both multipart file upload and JSON content)
router.post(
  "/research/:researchId/documents",
  requireAuth,
  requirePermission(Permissions.DOCUMENT_UPLOAD),
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const researchId = req.params.researchId as string;
      const { title, documentType, content } = req.body;

      if (!(await canAccessResearch(req.user, researchId))) {
        return void res.status(403).json({ error: "You cannot upload documents to this research project." });
      }

      if (!title || !documentType) {
        res.status(400).json({ error: "Title and documentType are required" });
        return;
      }

      let fileBuffer: Buffer;
      let fileName: string;
      let mimeType: string;

      if (req.file) {
        if (req.file.mimetype === "application/pdf" && req.file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
          return void res.status(400).json({ error: "The uploaded file is not a valid PDF." });
        }
        fileBuffer = req.file.buffer;
        fileName = req.file.originalname;
        mimeType = req.file.mimetype;
      } else {
        const textContent =
          content ||
          `<h1>${title}</h1><p>Initial draft manuscript submitted via Advisio.</p>`;
        fileBuffer = Buffer.from(textContent, "utf-8");
        fileName = `${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-v1.0.html`;
        mimeType = "text/html";
      }

      // Execute Google Drive upload and PostgreSQL database persistence
      const result = await documentService.createDocumentWithVersion({
        researchId,
        title,
        documentType,
        fileBuffer,
        fileName,
        mimeType,
        uploadedBy: req.user.id,
      });

      res.status(201).json({
        document: result.document,
        version: result.version,
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to upload document" });
    }
  },
);

// POST /api/documents/:documentId/versions (Upload subsequent revisions to Google Drive + DB)
router.post(
  "/documents/:documentId/versions",
  requireAuth,
  requirePermission(Permissions.DOCUMENT_UPLOAD),
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const documentId = req.params.documentId as string;
      const { content, fileName: customFileName } = req.body;
      const document = await prisma.document.findUnique({ where: { id: documentId }, select: { researchId: true } });
      if (!document) return void res.status(404).json({ error: "Document not found." });
      if (!(await canAccessResearch(req.user, document.researchId))) {
        return void res.status(403).json({ error: "You cannot add a version to this document." });
      }

      let fileBuffer: Buffer;
      let fileName: string;
      let mimeType: string;

      if (req.file) {
        if (req.file.mimetype === "application/pdf" && req.file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
          return void res.status(400).json({ error: "The uploaded file is not a valid PDF." });
        }
        fileBuffer = req.file.buffer;
        fileName = req.file.originalname;
        mimeType = req.file.mimetype;
      } else {
        const textContent =
          content || "<p>Revised manuscript version content.</p>";
        fileBuffer = Buffer.from(textContent, "utf-8");
        fileName = customFileName || `revised-version-${Date.now()}.html`;
        mimeType = "text/html";
      }

      const newVersion = await documentService.addDocumentVersion({
        documentId,
        fileBuffer,
        fileName,
        mimeType,
        uploadedBy: req.user.id,
      });

      res.status(201).json({ version: newVersion });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to create document version" });
    }
  },
);

// POST /api/documents/versions/:versionId/reviews
router.post(
  "/documents/versions/:versionId/reviews",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const versionId = req.params.versionId as string;
      const { reviewType, overallComment, recommendation } = req.body;
      const effectiveReviewType = (reviewType as ReviewType) || ReviewType.ADVISER;

      const version = await prisma.documentVersion.findUnique({
        where: { id: versionId },
        include: { document: { select: { researchId: true } } },
      });

      if (!version) {
        res.status(404).json({ error: "Document version not found" });
        return;
      }
      if (!(await canAccessResearch(req.user, version.document.researchId))) {
        return void res.status(403).json({ error: "You are not authorized to review this document." });
      }
      if (effectiveReviewType === ReviewType.ADVISER) {
        const assigned = await prisma.researchMember.findFirst({
          where: { researchId: version.document.researchId, userId: req.user.id, projectRole: "ADVISER", leftAt: null },
        });
        if (!assigned) return void res.status(403).json({ error: "Only the assigned adviser can submit an adviser review." });
      }

      const review = await prisma.review.create({
        data: {
          documentVersionId: versionId,
          documentId: version.documentId,
          reviewerId: req.user.id,
          reviewType: effectiveReviewType,
          overallComment: overallComment || null,
          recommendation: (recommendation as ReviewRecommendation) || null,
          status: ReviewStatus.SUBMITTED,
          submittedAt: new Date(),
        },
        include: {
          reviewer: {
            select: { firstName: true, lastName: true },
          },
          comments: true,
        },
      });

      res.status(201).json({ review });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to submit review" });
    }
  },
);

router.post("/documents/versions/:versionId/sign", requireAuth, async (req, res) => {
  try {
    if (!req.user || !canManageSignature(req.user)) return void res.status(403).json({ error: "Your role cannot sign documents." });
    const { password, confirmation, placements } = req.body || {};
    if (confirmation !== true) return void res.status(400).json({ error: "Signing confirmation is required." });
    if (!password || typeof password !== "string") return void res.status(400).json({ error: "Enter your password to confirm signing." });
    const account = await prisma.user.findUnique({ where: { id: req.user.id }, select: { passwordHash: true } });
    if (!account?.passwordHash || !(await bcrypt.compare(password, account.passwordHash)))
      return void res.status(401).json({ error: "Your password could not be verified." });

    const result = await documentSigningService.sign({
      sourceVersionId: req.params.versionId as string,
      signerId: req.user.id,
      signerRoles: req.user.roles,
      signerCollegeId: req.user.collegeId,
      signerProgramId: req.user.programId,
      placements: Array.isArray(placements) ? placements : [],
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
    res.status(201).json(result);
  } catch (error: any) {
    const message = typeof error?.message === "string" ? error.message : "Unable to sign the document.";
    const status = /not found/i.test(message) ? 404 : /Only|authorized|assigned/i.test(message) ? 403 : /already|current active/i.test(message) ? 409 : 400;
    res.status(status).json({ error: message });
  }
});

// POST /api/reviews/:reviewId/comments
router.post(
  "/reviews/:reviewId/comments",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const reviewId = req.params.reviewId as string;
      const { documentVersionId, comment, locationData } = req.body;

      if (!comment || !documentVersionId) {
        res
          .status(400)
          .json({ error: "Comment text and documentVersionId are required" });
        return;
      }

      const reviewComment = await prisma.reviewComment.create({
        data: {
          reviewId,
          documentVersionId,
          authorId: req.user.id,
          comment,
          locationData: locationData || undefined,
          status: CommentStatus.OPEN,
        },
        include: {
          author: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      res.status(201).json({ comment: reviewComment });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to add review comment" });
    }
  },
);

export default router;
