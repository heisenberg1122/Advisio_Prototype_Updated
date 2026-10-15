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
  ManuscriptLifecycleStatus,
} from "../lib/prisma.js";
import { Permissions } from "@research-management/auth";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { documentService } from "../services/document.service.js";
import { googleDriveService } from "../services/google-drive.service.js";
import { storageHierarchyService } from "../services/storage-hierarchy.service.js";
import { documentSigningService } from "../services/document-signing.service.js";
import { documentAccessService } from "../services/document-access.service.js";
import {
  ManuscriptWorkflowError,
  manuscriptLifecycleService,
} from "../services/manuscript-lifecycle.service.js";
import {
  ReviewerAssignmentError,
  reviewerAssignmentService,
} from "../services/reviewer-assignment.service.js";
import {
  getManuscriptActivity,
  getMilestoneProgress,
} from "../services/research-workflow-integration.service.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});
const signatureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const ALLOWED_WORKING_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const documentSignerRoles = new Set([
  "ADVISER",
  "PANELIST",
  "RESEARCH_COORDINATOR",
  "RPO",
  "VPAA",
]);

const canManageSignature = (user: NonNullable<Request["user"]>) =>
  user.roles.some((role) => documentSignerRoles.has(role));

const canUseDeanInbox = (user: NonNullable<Request["user"]>) =>
  user.roles.includes("VPAA") ||
  (user.roles.includes("RPO") && Boolean(user.collegeId));

const canViewResearchDocuments = async (
  user: NonNullable<Request["user"]>,
  researchId: string,
) => (await documentAccessService.forResearch(user, researchId)).canView;

const canManageResearchDocuments = async (
  user: NonNullable<Request["user"]>,
  researchId: string,
) =>
  (await documentAccessService.forResearch(user, researchId))
    .canManageWorkingDocuments;

function normalizeLiveDocumentUrl(rawValue: unknown) {
  if (typeof rawValue !== "string" || !rawValue.trim())
    throw new Error("A Google Docs or Google Drive link is required.");
  let url: URL;
  try {
    url = new URL(rawValue.trim());
  } catch {
    throw new Error("Enter a valid Google Docs or Google Drive link.");
  }
  if (url.protocol !== "https:")
    throw new Error("Google document links must use HTTPS.");
  const host = url.hostname.toLowerCase();
  const pathParts = url.pathname.split("/").filter(Boolean);
  const isGoogleFileId = (value?: string) =>
    Boolean(value && /^[a-zA-Z0-9_-]{10,255}$/.test(value));
  if (
    host === "docs.google.com" &&
    pathParts[0] === "document" &&
    pathParts[1] === "d" &&
    isGoogleFileId(pathParts[2])
  ) {
    const fileId = pathParts[2];
    return {
      fileId,
      documentType: "GOOGLE_DOC",
      url: `https://docs.google.com/document/d/${fileId}/edit`,
    };
  }
  if (
    host === "drive.google.com" &&
    pathParts[0] === "file" &&
    pathParts[1] === "d" &&
    isGoogleFileId(pathParts[2])
  ) {
    const fileId = pathParts[2];
    return {
      fileId,
      documentType: "GOOGLE_DRIVE_FILE",
      url: `https://drive.google.com/file/d/${fileId}/view`,
    };
  }
  throw new Error(
    "Only Google Docs document links and Google Drive file links are supported.",
  );
}

async function validProjectMilestone(
  researchId: string,
  milestoneId?: string | null,
) {
  if (!milestoneId) return null;
  const research = await prisma.researchProject.findUnique({
    where: { id: researchId },
    select: { workflowInstance: { select: { workflowId: true } } },
  });
  if (!research?.workflowInstance)
    throw new Error(
      "This research project does not have an assigned workflow.",
    );
  const milestone = await prisma.workflowStage.findFirst({
    where: {
      id: milestoneId,
      workflowId: research.workflowInstance.workflowId,
      category: { not: "Archived" },
    },
    select: { id: true, name: true, sequence: true },
  });
  if (!milestone)
    throw new Error(
      "The selected milestone does not belong to this research project.",
    );
  return milestone;
}

const isPng = (buffer: Buffer) =>
  buffer.length >= 8 &&
  buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

router.get(
  ["/users/me/signature", "/users/me/adviser-signature"],
  requireAuth,
  async (req, res) => {
    if (!req.user || !canManageSignature(req.user))
      return void res
        .status(403)
        .json({ error: "Your role cannot manage a document signature." });
    const signature = await prisma.userSignature.findUnique({
      where: { userId: req.user.id },
      select: {
        id: true,
        mimeType: true,
        fileHash: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({
      signature: signature
        ? { ...signature, imageUrl: "/api/users/me/signature/image" }
        : null,
    });
  },
);

router.get(
  ["/users/me/signature/image", "/users/me/adviser-signature/image"],
  requireAuth,
  async (req, res) => {
    if (!req.user || !canManageSignature(req.user))
      return void res
        .status(403)
        .json({ error: "Your role cannot access a signature." });
    const signature = await prisma.userSignature.findUnique({
      where: { userId: req.user.id },
    });
    if (!signature)
      return void res.status(404).json({ error: "Signature not found." });
    res.setHeader("Cache-Control", "private, no-store");
    res.type(signature.mimeType).send(Buffer.from(signature.imageData));
  },
);

router.put(
  ["/users/me/signature", "/users/me/adviser-signature"],
  requireAuth,
  signatureUpload.single("signature"),
  async (req, res) => {
    if (!req.user || !canManageSignature(req.user))
      return void res
        .status(403)
        .json({ error: "Your role cannot manage a document signature." });
    if (
      !req.file ||
      req.file.mimetype !== "image/png" ||
      !isPng(req.file.buffer)
    )
      return void res
        .status(400)
        .json({ error: "Upload a valid PNG signature image up to 2 MB." });
    const fileHash = crypto
      .createHash("sha256")
      .update(req.file.buffer)
      .digest("hex");
    const imageData = Uint8Array.from(req.file.buffer);
    const signature = await prisma.userSignature.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        mimeType: "image/png",
        imageData,
        fileHash,
      },
      update: { mimeType: "image/png", imageData, fileHash },
      select: {
        id: true,
        mimeType: true,
        fileHash: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "UPDATE",
        entityType: "UserSignature",
        entityId: signature.id,
        newValues: { fileHash },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      },
    });
    res.json({
      signature: { ...signature, imageUrl: "/api/users/me/signature/image" },
    });
  },
);

router.delete(
  ["/users/me/signature", "/users/me/adviser-signature"],
  requireAuth,
  async (req, res) => {
    if (!req.user || !canManageSignature(req.user))
      return void res
        .status(403)
        .json({ error: "Your role cannot manage a document signature." });
    const existing = await prisma.userSignature.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (existing) {
      await prisma.$transaction([
        prisma.userSignature.delete({ where: { userId: req.user.id } }),
        prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: "DELETE",
            entityType: "UserSignature",
            entityId: existing.id,
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          },
        }),
      ]);
    }
    res.status(204).send();
  },
);

router.get("/dean-inbox/messages", requireAuth, async (req, res) => {
  if (!req.user || !canUseDeanInbox(req.user))
    return void res
      .status(403)
      .json({ error: "Only the Dean's Office can access this inbox." });
  const messages = await prisma.deanInboxMessage.findMany({
    where: {
      document: {
        ...(req.user.roles.includes("VPAA")
          ? {}
          : { research: { collegeId: req.user.collegeId! } }),
        deanInboxMessages: {
          some: { OR: [{ recipientId: req.user.id }, { recipientId: null }] },
        },
      },
    },
    include: {
      author: {
        select: { id: true, firstName: true, middleName: true, lastName: true },
      },
      attachmentVersion: {
        select: {
          id: true,
          fileName: true,
          googleDriveFileId: true,
          versionNumber: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json({ messages });
});

router.get("/dean-inbox/threads", requireAuth, async (req, res) => {
  if (!req.user || !canUseDeanInbox(req.user))
    return void res
      .status(403)
      .json({ error: "Only the Dean's Office can access this inbox." });
  const threads = await prisma.document.findMany({
    where: {
      deanInboxMessages: { some: {} },
      AND: {
        deanInboxMessages: {
          some: { OR: [{ recipientId: req.user.id }, { recipientId: null }] },
        },
      },
      ...(req.user.roles.includes("VPAA")
        ? {}
        : { research: { collegeId: req.user.collegeId! } }),
    },
    include: {
      research: { select: { id: true, title: true, groupName: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          fileName: true,
          mimeType: true,
          googleDriveFileId: true,
          uploadedAt: true,
          sourceSignature: { select: { signedVersionId: true } },
          signedSignature: {
            select: { verificationCode: true, signedAt: true, revokedAt: true },
          },
        },
      },
      deanInboxMessages: {
        orderBy: { createdAt: "asc" },
        take: 1,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ threads });
});

router.get("/dean-inbox/recipients", requireAuth, async (req, res) => {
  if (!req.user || !req.user.roles.includes("RESEARCH_COORDINATOR"))
    return void res.status(403).json({
      error:
        "Only a research professor or coordinator can select a Dean recipient.",
    });
  const researchId = String(req.query.researchId || "");
  const research = await prisma.researchProject.findFirst({
    where: {
      id: researchId,
      ...(req.user.collegeId ? { collegeId: req.user.collegeId } : {}),
    },
    select: { id: true, collegeId: true },
  });
  if (!research || !(await canViewResearchDocuments(req.user, research.id)))
    return void res
      .status(404)
      .json({ error: "Research group not found in your assigned scope." });
  const recipients = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        {
          collegeId: research.collegeId,
          roles: { some: { role: { name: "RPO" } } },
        },
        { roles: { some: { role: { name: "VPAA" } } } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      college: { select: { name: true } },
      roles: { select: { role: { select: { name: true } } } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  res.json({
    recipients: recipients.map((recipient) => ({
      ...recipient,
      roles: recipient.roles.map((item) => item.role.name),
    })),
  });
});

router.post(
  "/dean-inbox/requests",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    if (!req.user || !req.user.roles.includes("RESEARCH_COORDINATOR"))
      return void res.status(403).json({
        error:
          "Only a research professor or coordinator can send a Dean signature request.",
      });
    const researchId =
      typeof req.body?.researchId === "string" ? req.body.researchId : "";
    const subject =
      typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
    const message =
      typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const recipientId =
      typeof req.body?.recipientId === "string" ? req.body.recipientId : "";
    if (!researchId || !recipientId || !subject || !message || !req.file)
      return void res.status(400).json({
        error:
          "Research group, Dean recipient, subject, message, and PDF request letter are required.",
      });
    if (subject.length > 255 || message.length > 5000)
      return void res
        .status(400)
        .json({ error: "The subject or message is too long." });
    if (
      req.file.mimetype !== "application/pdf" ||
      req.file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
    )
      return void res
        .status(400)
        .json({ error: "Attach a valid PDF request letter." });
    if (!(await canViewResearchDocuments(req.user, researchId)))
      return void res
        .status(403)
        .json({ error: "You cannot send a request for this research group." });

    const research = await prisma.researchProject.findUnique({
      where: { id: researchId },
      select: { title: true, collegeId: true },
    });
    const recipient = await prisma.user.findFirst({
      where: {
        id: recipientId,
        status: "ACTIVE",
        OR: [
          {
            collegeId: research?.collegeId,
            roles: { some: { role: { name: "RPO" } } },
          },
          { roles: { some: { role: { name: "VPAA" } } } },
        ],
      },
      select: { id: true, firstName: true, middleName: true, lastName: true },
    });
    if (!recipient)
      return void res.status(400).json({
        error: "The selected Dean is unavailable for this research group.",
      });
    const recipientName = [
      recipient.firstName,
      recipient.middleName,
      recipient.lastName,
    ]
      .filter(Boolean)
      .join(" ");

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
      data: {
        documentId: result.document.id,
        authorId: req.user.id,
        recipientId: recipient.id,
        message,
        attachmentVersionId: result.version.id,
      },
    });
    await prisma.notification.create({
      data: {
        recipientId: recipient.id,
        type: "DOCUMENT_UPLOADED",
        title: "New Dean signature request",
        message: `${req.user.firstName || "A professor"} ${req.user.lastName || ""} requested a signature for ${research?.title || subject}.`,
        entityType: "DeanInboxMessage",
        entityId: inboxMessage.id,
      },
    });
    res.status(201).json({
      request: inboxMessage,
      document: result.document,
      version: result.version,
      recipient: { id: recipient.id, name: recipientName },
    });
  },
);

router.post(
  "/dean-inbox/documents/:documentId/messages",
  requireAuth,
  async (req, res) => {
    if (!req.user || !canUseDeanInbox(req.user))
      return void res
        .status(403)
        .json({ error: "Only the Dean's Office can reply from this inbox." });
    const message =
      typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message)
      return void res
        .status(400)
        .json({ error: "Write a message before sending." });
    if (message.length > 5000)
      return void res
        .status(400)
        .json({ error: "Messages cannot exceed 5,000 characters." });
    const document = await prisma.document.findFirst({
      where: {
        id: req.params.documentId as string,
        ...(req.user.roles.includes("VPAA")
          ? {}
          : { research: { collegeId: req.user.collegeId! } }),
        deanInboxMessages: {
          some: { OR: [{ recipientId: req.user.id }, { recipientId: null }] },
        },
      },
      select: { id: true },
    });
    if (!document)
      return void res
        .status(404)
        .json({ error: "Inbox document not found in your assigned scope." });
    const created = await prisma.deanInboxMessage.create({
      data: {
        documentId: document.id,
        authorId: req.user.id,
        recipientId: req.user.id,
        message,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
        attachmentVersion: {
          select: {
            id: true,
            fileName: true,
            googleDriveFileId: true,
            versionNumber: true,
          },
        },
      },
    });
    res.status(201).json({ message: created });
  },
);

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
          id: true,
          storagePath: true,
          fileName: true,
          mimeType: true,
        },
      });
      if (!version)
        return void res.status(404).json({ error: "File not found" });

      if (
        !(await documentAccessService.canViewVersion(req.user!, version.id))
      ) {
        return void res
          .status(403)
          .json({ error: "You do not have access to this document" });
      }

      if (req.query.download === "1") {
        await prisma.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "DOWNLOAD",
            entityType: "DocumentVersion",
            entityId: version.id,
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          },
        });
      }

      const previewInline =
        req.query.download !== "1" && version.mimeType === "application/pdf";
      res.setHeader("X-Content-Type-Options", "nosniff");

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
          `${previewInline ? "inline" : "attachment"}; filename="${version.fileName.replace(/"/g, "")}"`,
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
        `${previewInline ? "inline" : "attachment"}; filename="${version.fileName.replace(/"/g, "")}"`,
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

// GET /api/research/:researchId/manuscript-workflow
// Projects existing immutable lifecycle/reviewer history into a scoped timeline
// and derives milestone progress from configured requirements.
router.get(
  "/research/:researchId/manuscript-workflow",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const researchId = req.params.researchId as string;
      const access = await documentAccessService.forResearch(
        req.user!,
        researchId,
      );
      if (!access.exists)
        return void res
          .status(404)
          .json({ error: "Research project not found." });
      if (!access.canView)
        return void res.status(403).json({
          error: "You cannot view this project's manuscript workflow.",
        });
      const [milestones, activity] = await Promise.all([
        getMilestoneProgress(prisma, researchId),
        getManuscriptActivity(prisma, researchId, access.canReview),
      ]);
      res.json({ milestones, activity });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to load the manuscript workflow.",
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

      const access = await documentAccessService.forResearch(
        req.user!,
        researchId,
      );
      if (!access.exists) {
        return void res
          .status(404)
          .json({ error: "Research project not found." });
      }
      if (!access.canView) {
        return void res.status(403).json({
          error: "You do not have access to this research project's documents.",
        });
      }

      const documents = await prisma.document.findMany({
        where: { researchId },
        include: {
          milestone: { select: { id: true, name: true, sequence: true } },
          manuscriptStatusEvents: {
            include: {
              actor: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          versions: {
            include: {
              milestone: { select: { id: true, name: true, sequence: true } },
              submitter: {
                select: { id: true, firstName: true, lastName: true },
              },
              sourceSignature: {
                select: {
                  id: true,
                  signedAt: true,
                  verificationCode: true,
                  signedVersionId: true,
                  revokedAt: true,
                },
              },
              signedSignature: {
                select: {
                  id: true,
                  signedAt: true,
                  verificationCode: true,
                  sourceVersionId: true,
                  revokedAt: true,
                  signedBy: {
                    select: {
                      firstName: true,
                      middleName: true,
                      lastName: true,
                    },
                  },
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
              reviewerAssignments: {
                include: {
                  reviewer: {
                    select: { firstName: true, lastName: true, email: true },
                  },
                  review: {
                    include: {
                      comments: { orderBy: { createdAt: "asc" } },
                    },
                  },
                },
                orderBy: { assignedAt: "asc" },
              },
            },
            orderBy: { versionNumber: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      const redactReviewerIdentity = access.reasons.includes(
        "research-group-member",
      );
      const mappedDocs = documents.map((doc) => ({
        ...doc,
        versions: doc.versions.map((v) => ({
          ...v,
          reviews: v.reviews.map((review) => ({
            ...review,
            reviewer: redactReviewerIdentity ? null : review.reviewer,
          })),
          reviewerAssignments: v.reviewerAssignments.map((assignment) => ({
            ...assignment,
            reviewer: redactReviewerIdentity ? null : assignment.reviewer,
          })),
          fileSize: Number(v.fileSize),
          webViewLink: v.googleDriveFileId
            ? `/api/documents/files/${v.googleDriveFileId}`
            : undefined,
        })),
      }));

      res.json({
        documents: mappedDocs,
        permissions: {
          canView: access.canView,
          canManageWorkingDocuments: access.canManageWorkingDocuments,
          canSubmitManuscript: access.canSubmitManuscript,
          canReview: access.canReview,
          canApproveOfficialDocuments: access.canApproveOfficialDocuments,
        },
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch documents" });
    }
  },
);

// POST /api/research/:researchId/documents/google
// Creates a real editable Google Doc, then records it as the project's live draft.
router.post(
  "/research/:researchId/documents/google",
  requireAuth,
  requirePermission(Permissions.DOCUMENT_UPLOAD),
  async (req: Request, res: Response) => {
    let createdFileId: string | null = null;
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Unauthorized" });
      const researchId = req.params.researchId as string;
      const title =
        typeof req.body?.title === "string" ? req.body.title.trim() : "";
      if (title.length < 2 || title.length > 255) {
        return void res.status(400).json({
          error: "Document title must be between 2 and 255 characters.",
        });
      }
      if (!(await canManageResearchDocuments(req.user, researchId))) {
        return void res.status(403).json({
          error: "You cannot create documents for this research project.",
        });
      }

      let milestone;
      try {
        milestone = await validProjectMilestone(
          researchId,
          typeof req.body?.milestoneId === "string"
            ? req.body.milestoneId.trim()
            : null,
        );
      } catch (error: any) {
        return void res.status(400).json({ error: error.message });
      }
      const folderId = await storageHierarchyService.resolveFolder({
        researchId,
        bucket: "WORKING",
        stageId: milestone?.id || null,
      });
      const driveDocument = await googleDriveService.createNativeDocument({
        fileName: title,
        folderId,
        editorEmail: req.user.email,
        description: `Advisio working document: ${title}`,
        appProperties: {
          advisioManaged: "true",
          advisioResearchId: researchId,
          advisioCreatorId: req.user.id,
          advisioLifecycle: "WORKING",
          ...(milestone?.id ? { advisioMilestoneId: milestone.id } : {}),
        },
      });
      createdFileId = driveDocument.fileId;

      const document = await prisma.$transaction(async (tx) => {
        const created = await tx.document.create({
          data: {
            researchId,
            milestoneId: milestone?.id || null,
            documentType: "GOOGLE_DOC",
            title,
            currentVersion: 0,
            storageProvider: "GOOGLE_DRIVE",
            liveDocumentUrl: driveDocument.webViewLink,
            liveExternalFileId: driveDocument.fileId,
            createdBy: req.user!.id,
          },
          include: {
            milestone: { select: { id: true, name: true, sequence: true } },
            versions: true,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "CREATE",
            entityType: "Document",
            entityId: created.id,
            newValues: {
              researchId,
              title,
              milestoneId: milestone?.id || null,
              liveExternalFileId: driveDocument.fileId,
              source: "GOOGLE_DRIVE_CREATE",
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          },
        });
        return created;
      });
      res.status(201).json({ document, created: true });
    } catch (error: any) {
      if (createdFileId)
        await googleDriveService.deleteFile(createdFileId).catch(() => false);
      const unavailable = /not connected|credentials|authorization/i.test(
        String(error?.message || ""),
      );
      res.status(unavailable ? 503 : 502).json({
        error: unavailable
          ? "Google Drive is not connected. Ask a System Administrator to connect it, then try again."
          : "Google Drive could not create the document. No Advisio record was saved.",
      });
    }
  },
);

// POST /api/research/:researchId/documents/live
// Persists an editable Google document without pretending it is a submitted snapshot.
router.post(
  "/research/:researchId/documents/live",
  requireAuth,
  requirePermission(Permissions.DOCUMENT_UPLOAD),
  async (req: Request, res: Response) => {
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Unauthorized" });
      const researchId = req.params.researchId as string;
      const title =
        typeof req.body?.title === "string" ? req.body.title.trim() : "";
      if (title.length < 2 || title.length > 255) {
        return void res.status(400).json({
          error: "Document title must be between 2 and 255 characters.",
        });
      }
      if (!(await canManageResearchDocuments(req.user, researchId))) {
        return void res.status(403).json({
          error: "You cannot link documents to this research project.",
        });
      }
      const live = normalizeLiveDocumentUrl(req.body?.url);
      const milestone = await validProjectMilestone(
        researchId,
        typeof req.body?.milestoneId === "string" ? req.body.milestoneId : null,
      );
      const existing = await prisma.document.findFirst({
        where: { researchId, liveExternalFileId: live.fileId },
        include: {
          milestone: { select: { id: true, name: true, sequence: true } },
          versions: true,
        },
      });
      if (existing) {
        return void res
          .status(200)
          .json({ document: existing, created: false, duplicate: true });
      }

      const document = await prisma.$transaction(async (tx) => {
        const created = await tx.document.create({
          data: {
            researchId,
            milestoneId: milestone?.id || null,
            documentType: live.documentType,
            title,
            currentVersion: 0,
            storageProvider: "GOOGLE_DRIVE",
            liveDocumentUrl: live.url,
            liveExternalFileId: live.fileId,
            createdBy: req.user!.id,
          },
          include: {
            milestone: { select: { id: true, name: true, sequence: true } },
            versions: true,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "CREATE",
            entityType: "Document",
            entityId: created.id,
            newValues: {
              researchId,
              title,
              milestoneId: milestone?.id || null,
              liveExternalFileId: live.fileId,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          },
        });
        return created;
      });
      res.status(201).json({ document, created: true, duplicate: false });
    } catch (error: any) {
      const message =
        typeof error?.message === "string"
          ? error.message
          : "Failed to link Google document.";
      const status =
        error?.code === "P2002"
          ? 409
          : /valid|link|required|milestone|workflow|title/i.test(message)
            ? 400
            : 500;
      res.status(status).json({
        error:
          error?.code === "P2002"
            ? "This Google document is already linked to the project."
            : message,
      });
    }
  },
);

// PATCH /api/documents/:documentId/live
router.patch(
  "/documents/:documentId/live",
  requireAuth,
  requirePermission(Permissions.DOCUMENT_UPLOAD),
  async (req: Request, res: Response) => {
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Unauthorized" });
      const existing = await prisma.document.findUnique({
        where: { id: req.params.documentId as string },
        select: {
          id: true,
          researchId: true,
          title: true,
          milestoneId: true,
          liveDocumentUrl: true,
          liveExternalFileId: true,
        },
      });
      if (!existing?.liveExternalFileId)
        return void res.status(404).json({ error: "Live document not found." });
      if (!(await canManageResearchDocuments(req.user, existing.researchId))) {
        return void res
          .status(403)
          .json({ error: "You cannot update this project document." });
      }

      const data: {
        title?: string;
        milestoneId?: string | null;
        liveDocumentUrl?: string;
        liveExternalFileId?: string;
        documentType?: string;
      } = {};
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "title")) {
        const title =
          typeof req.body.title === "string" ? req.body.title.trim() : "";
        if (title.length < 2 || title.length > 255)
          return void res.status(400).json({
            error: "Document title must be between 2 and 255 characters.",
          });
        data.title = title;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "milestoneId")) {
        const milestone = await validProjectMilestone(
          existing.researchId,
          typeof req.body.milestoneId === "string"
            ? req.body.milestoneId
            : null,
        );
        data.milestoneId = milestone?.id || null;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "url")) {
        const live = normalizeLiveDocumentUrl(req.body.url);
        data.liveDocumentUrl = live.url;
        data.liveExternalFileId = live.fileId;
        data.documentType = live.documentType;
      }
      if (Object.keys(data).length === 0)
        return void res
          .status(400)
          .json({ error: "No supported document changes were provided." });

      const document = await prisma.$transaction(async (tx) => {
        const updated = await tx.document.update({
          where: { id: existing.id },
          data,
          include: {
            milestone: { select: { id: true, name: true, sequence: true } },
            versions: true,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "UPDATE",
            entityType: "Document",
            entityId: existing.id,
            oldValues: existing,
            newValues: data,
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          },
        });
        return updated;
      });
      res.json({ document });
    } catch (error: any) {
      const message =
        typeof error?.message === "string"
          ? error.message
          : "Failed to update Google document.";
      const status =
        error?.code === "P2002"
          ? 409
          : /valid|link|required|milestone|workflow|title/i.test(message)
            ? 400
            : 500;
      res.status(status).json({
        error:
          error?.code === "P2002"
            ? "This Google document is already linked to the project."
            : message,
      });
    }
  },
);

// POST /api/documents/:documentId/submissions
// Exports the real linked Google document and freezes it as an immutable PDF.
router.post(
  "/documents/:documentId/submissions",
  requireAuth,
  requirePermission(Permissions.DOCUMENT_UPLOAD),
  async (req: Request, res: Response) => {
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Unauthorized" });
      const milestoneId =
        typeof req.body?.milestoneId === "string"
          ? req.body.milestoneId.trim()
          : "";
      const idempotencyKey =
        typeof req.body?.idempotencyKey === "string"
          ? req.body.idempotencyKey.trim()
          : "";
      const taskId =
        typeof req.body?.taskId === "string" && req.body.taskId.trim()
          ? req.body.taskId.trim()
          : null;
      const note =
        typeof req.body?.note === "string" && req.body.note.trim()
          ? req.body.note.trim()
          : null;
      if (!milestoneId)
        return void res
          .status(400)
          .json({ error: "Select a manuscript milestone before submitting." });
      if (note && note.length > 2000)
        return void res
          .status(400)
          .json({ error: "Submission notes cannot exceed 2,000 characters." });

      const result = await manuscriptLifecycleService.submit({
        documentId: req.params.documentId as string,
        milestoneId,
        taskId,
        idempotencyKey,
        note,
        user: req.user,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      const version = {
        ...result.version,
        fileSize: Number(result.version.fileSize),
        webViewLink: result.version.googleDriveFileId
          ? `/api/documents/files/${result.version.googleDriveFileId}`
          : undefined,
      };
      res.status(result.duplicate ? 200 : 201).json({
        version,
        duplicate: result.duplicate,
        lifecycleStatus: result.lifecycleStatus,
      });
    } catch (error: any) {
      if (error instanceof ManuscriptWorkflowError) {
        return void res
          .status(error.statusCode)
          .json({ error: error.message, code: error.code });
      }
      const googleStatus = Number(error?.response?.status || error?.code || 0);
      if ([401, 403, 404].includes(googleStatus)) {
        return void res.status(422).json({
          error:
            googleStatus === 404
              ? "The linked Google document could not be found by the connected storage account."
              : "The connected storage account cannot access or export the linked Google document.",
          code: "GOOGLE_DOCUMENT_INACCESSIBLE",
        });
      }
      res.status(500).json({
        error:
          typeof error?.message === "string"
            ? error.message
            : "The manuscript snapshot could not be created.",
        code: "SNAPSHOT_FAILED",
      });
    }
  },
);

// PATCH /api/documents/:documentId/manuscript-status
// Phase 3 deliberately exposes only review-start and revision-request states.
router.patch(
  "/documents/:documentId/manuscript-status",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Unauthorized" });
      const targetStatus = req.body?.status as ManuscriptLifecycleStatus;
      if (!Object.values(ManuscriptLifecycleStatus).includes(targetStatus)) {
        return void res
          .status(400)
          .json({ error: "Invalid manuscript status." });
      }
      const reason =
        typeof req.body?.reason === "string" ? req.body.reason.trim() : null;
      if (reason && reason.length > 5000)
        return void res
          .status(400)
          .json({ error: "Status feedback cannot exceed 5,000 characters." });
      const event = await manuscriptLifecycleService.transition({
        documentId: req.params.documentId as string,
        targetStatus,
        reason,
        user: req.user,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      res.json({ event, lifecycleStatus: targetStatus });
    } catch (error: any) {
      if (error instanceof ManuscriptWorkflowError) {
        return void res
          .status(error.statusCode)
          .json({ error: error.message, code: error.code });
      }
      res.status(500).json({ error: "Unable to update manuscript status." });
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
      const { content } = req.body;
      const title =
        typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const documentType =
        typeof req.body?.documentType === "string"
          ? req.body.documentType.trim()
          : "";

      if (!(await canManageResearchDocuments(req.user, researchId))) {
        return void res.status(403).json({
          error: "You cannot upload documents to this research project.",
        });
      }

      if (!title || !documentType) {
        res.status(400).json({ error: "Title and documentType are required" });
        return;
      }
      if (title.length > 255 || documentType.length > 100) {
        return void res.status(400).json({
          error: "The title or document type is longer than allowed.",
        });
      }

      let milestone;
      try {
        milestone = await validProjectMilestone(
          researchId,
          typeof req.body?.milestoneId === "string"
            ? req.body.milestoneId.trim()
            : null,
        );
      } catch (error: any) {
        return void res.status(400).json({ error: error.message });
      }

      let fileBuffer: Buffer;
      let fileName: string;
      let mimeType: string;

      if (req.file) {
        if (!ALLOWED_WORKING_DOCUMENT_TYPES.has(req.file.mimetype)) {
          return void res.status(400).json({
            error: "Upload a PDF, Word document, or plain-text file.",
          });
        }
        if (
          req.file.mimetype === "application/pdf" &&
          req.file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
        ) {
          return void res
            .status(400)
            .json({ error: "The uploaded file is not a valid PDF." });
        }
        fileBuffer = req.file.buffer;
        fileName = req.file.originalname;
        mimeType = req.file.mimetype;
      } else {
        if (typeof content !== "string" || !content.trim()) {
          return void res.status(400).json({
            error: "Upload a file or provide explicit document content.",
          });
        }
        const textContent = content;
        fileBuffer = Buffer.from(textContent, "utf-8");
        fileName = `${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-v1.0.txt`;
        mimeType = "text/plain";
      }

      // Execute Google Drive upload and PostgreSQL database persistence
      const result = await documentService.createDocumentWithVersion({
        researchId,
        title,
        documentType,
        milestoneId: milestone?.id || null,
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
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { researchId: true, liveDocumentUrl: true },
      });
      if (!document)
        return void res.status(404).json({ error: "Document not found." });
      if (!(await canManageResearchDocuments(req.user, document.researchId))) {
        return void res
          .status(403)
          .json({ error: "You cannot add a version to this document." });
      }
      if (document.liveDocumentUrl) {
        return void res.status(409).json({
          error:
            "Live Google documents must be versioned through formal manuscript submission so Advisio can preserve an immutable snapshot.",
        });
      }

      let fileBuffer: Buffer;
      let fileName: string;
      let mimeType: string;

      if (req.file) {
        if (!ALLOWED_WORKING_DOCUMENT_TYPES.has(req.file.mimetype)) {
          return void res.status(400).json({
            error: "Upload a PDF, Word document, or plain-text file.",
          });
        }
        if (
          req.file.mimetype === "application/pdf" &&
          req.file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
        ) {
          return void res
            .status(400)
            .json({ error: "The uploaded file is not a valid PDF." });
        }
        fileBuffer = req.file.buffer;
        fileName = req.file.originalname;
        mimeType = req.file.mimetype;
      } else {
        if (typeof content !== "string" || !content.trim()) {
          return void res.status(400).json({
            error: "Upload a file or provide explicit revision content.",
          });
        }
        const textContent = content;
        fileBuffer = Buffer.from(textContent, "utf-8");
        fileName = customFileName || `revised-version-${Date.now()}.txt`;
        mimeType = "text/plain";
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
      const effectiveReviewType =
        (reviewType as ReviewType) || ReviewType.ADVISER;

      if (!Object.values(ReviewType).includes(effectiveReviewType)) {
        return void res.status(400).json({ error: "Invalid review type." });
      }
      if (
        recommendation &&
        !Object.values(ReviewRecommendation).includes(
          recommendation as ReviewRecommendation,
        )
      ) {
        return void res
          .status(400)
          .json({ error: "Invalid review recommendation." });
      }

      const version = await prisma.documentVersion.findUnique({
        where: { id: versionId },
        include: { document: { select: { researchId: true } } },
      });

      if (!version) {
        res.status(404).json({ error: "Document version not found" });
        return;
      }
      if (version.isImmutable) {
        const assignment = await prisma.reviewerAssignment.findFirst({
          where: {
            documentVersionId: versionId,
            reviewerId: req.user.id,
            reviewType: effectiveReviewType,
            status: "ACTIVE",
          },
          select: { id: true },
        });
        if (!assignment)
          return void res.status(403).json({
            error:
              "An active exact-version reviewer assignment is required for this manuscript decision.",
          });
        const result = await reviewerAssignmentService.decide({
          assignmentId: assignment.id,
          recommendation:
            (recommendation as ReviewRecommendation) ||
            ReviewRecommendation.APPROVE,
          overallComment,
          user: req.user,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
        return void res.status(201).json(result);
      }
      if (
        !(await documentAccessService.canSubmitReview(
          req.user,
          versionId,
          effectiveReviewType,
        ))
      ) {
        return void res
          .status(403)
          .json({ error: "You are not authorized to review this document." });
      }
      const existing = await prisma.review.findFirst({
        where: {
          documentVersionId: versionId,
          reviewerId: req.user.id,
          reviewType: effectiveReviewType,
        },
        select: { id: true, status: true },
      });
      if (existing?.status === ReviewStatus.SUBMITTED) {
        return void res
          .status(409)
          .json({ error: "You already submitted this review." });
      }
      const reviewData = {
        documentVersionId: versionId,
        documentId: version.documentId,
        reviewerId: req.user.id,
        reviewType: effectiveReviewType,
        overallComment:
          typeof overallComment === "string" && overallComment.trim()
            ? overallComment.trim()
            : null,
        recommendation: (recommendation as ReviewRecommendation) || null,
        status: ReviewStatus.SUBMITTED,
        submittedAt: new Date(),
      };
      const review = await prisma.$transaction(async (tx) => {
        const saved = existing
          ? await tx.review.update({
              where: { id: existing.id },
              data: reviewData,
              include: {
                reviewer: { select: { firstName: true, lastName: true } },
                comments: true,
              },
            })
          : await tx.review.create({
              data: reviewData,
              include: {
                reviewer: { select: { firstName: true, lastName: true } },
                comments: true,
              },
            });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: existing ? "UPDATE" : "CREATE",
            entityType: "Review",
            entityId: saved.id,
            newValues: {
              documentVersionId: versionId,
              reviewType: effectiveReviewType,
              recommendation: reviewData.recommendation,
              status: ReviewStatus.SUBMITTED,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          },
        });
        return saved;
      });

      res.status(201).json({ review });
    } catch (error: any) {
      if (error instanceof ReviewerAssignmentError)
        return void res
          .status(error.statusCode)
          .json({ error: error.message, code: error.code });
      res
        .status(500)
        .json({ error: error.message || "Failed to submit review" });
    }
  },
);

router.post(
  "/documents/versions/:versionId/sign",
  requireAuth,
  async (req, res) => {
    try {
      if (!req.user || !canManageSignature(req.user))
        return void res
          .status(403)
          .json({ error: "Your role cannot sign documents." });
      const { password, confirmation, placements } = req.body || {};
      if (confirmation !== true)
        return void res
          .status(400)
          .json({ error: "Signing confirmation is required." });
      if (!password || typeof password !== "string")
        return void res
          .status(400)
          .json({ error: "Enter your password to confirm signing." });
      const account = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { passwordHash: true },
      });
      if (
        !account?.passwordHash ||
        !(await bcrypt.compare(password, account.passwordHash))
      )
        return void res
          .status(401)
          .json({ error: "Your password could not be verified." });

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
      const message =
        typeof error?.message === "string"
          ? error.message
          : "Unable to sign the document.";
      const status = /not found/i.test(message)
        ? 404
        : /Only|authorized|assigned/i.test(message)
          ? 403
          : /already|current active/i.test(message)
            ? 409
            : 400;
      res.status(status).json({ error: message });
    }
  },
);

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

      if (
        typeof comment !== "string" ||
        !comment.trim() ||
        !documentVersionId
      ) {
        res
          .status(400)
          .json({ error: "Comment text and documentVersionId are required" });
        return;
      }

      const review = await prisma.review.findUnique({
        where: { id: reviewId },
        select: { reviewerId: true, documentVersionId: true },
      });
      if (!review)
        return void res.status(404).json({ error: "Review not found." });
      if (review.reviewerId !== req.user.id) {
        return void res.status(403).json({
          error: "Only the assigned reviewer can add comments to this review.",
        });
      }
      if (review.documentVersionId !== documentVersionId) {
        return void res.status(400).json({
          error: "The review does not belong to the supplied document version.",
        });
      }

      const reviewComment = await prisma.$transaction(async (tx) => {
        const created = await tx.reviewComment.create({
          data: {
            reviewId,
            documentVersionId,
            authorId: req.user!.id,
            comment: comment.trim(),
            locationData: locationData || undefined,
            status: CommentStatus.OPEN,
          },
          include: { author: { select: { firstName: true, lastName: true } } },
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "CREATE",
            entityType: "ReviewComment",
            entityId: created.id,
            newValues: { reviewId, documentVersionId },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          },
        });
        return created;
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
