import { Router, Request, Response } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
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

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
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

      const elevatedRoles = ["SYSTEM_ADMIN", "RPO", "REB", "VPAA"];
      const isElevated = req.user!.roles.some((role) =>
        elevatedRoles.includes(role),
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

      const documents = await prisma.document.findMany({
        where: { researchId },
        include: {
          versions: {
            include: {
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

      if (!title || !documentType) {
        res.status(400).json({ error: "Title and documentType are required" });
        return;
      }

      let fileBuffer: Buffer;
      let fileName: string;
      let mimeType: string;

      if (req.file) {
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

      let fileBuffer: Buffer;
      let fileName: string;
      let mimeType: string;

      if (req.file) {
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

      const version = await prisma.documentVersion.findUnique({
        where: { id: versionId },
      });

      if (!version) {
        res.status(404).json({ error: "Document version not found" });
        return;
      }

      const review = await prisma.review.create({
        data: {
          documentVersionId: versionId,
          documentId: version.documentId,
          reviewerId: req.user.id,
          reviewType: (reviewType as ReviewType) || ReviewType.ADVISER,
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
