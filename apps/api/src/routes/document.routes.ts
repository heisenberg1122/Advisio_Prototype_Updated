import { Router, Request, Response } from "express";
import multer from "multer";
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

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// GET /api/research/:researchId/documents
router.get("/research/:researchId/documents", requireAuth, async (req: Request, res: Response) => {
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
        webViewLink: v.googleDriveFileId ? `https://drive.google.com/file/d/${v.googleDriveFileId}/view` : undefined,
      })),
    }));

    res.json({ documents: mappedDocs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch documents" });
  }
});

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
        const textContent = content || `<h1>${title}</h1><p>Initial draft manuscript submitted via Advisio.</p>`;
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
      res.status(500).json({ error: error.message || "Failed to upload document" });
    }
  }
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
        const textContent = content || "<p>Revised manuscript version content.</p>";
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
      res.status(500).json({ error: error.message || "Failed to create document version" });
    }
  }
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
      res.status(500).json({ error: error.message || "Failed to submit review" });
    }
  }
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
        res.status(400).json({ error: "Comment text and documentVersionId are required" });
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
      res.status(500).json({ error: error.message || "Failed to add review comment" });
    }
  }
);

export default router;
