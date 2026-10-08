import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessCollege } from "../lib/college-scope.js";
import { defensePacketService } from "../services/defense-packet.service.js";
import { googleDriveService } from "../services/google-drive.service.js";
import { storageHierarchyService } from "../services/storage-hierarchy.service.js";
import multer from "multer";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});
const FACILITATORS = new Set(["RESEARCH_COORDINATOR", "RPO", "SYSTEM_ADMIN"]);
const versionSelect = {
  id: true,
  versionNumber: true,
  fileName: true,
  mimeType: true,
  googleDriveFileId: true,
  uploadedAt: true,
  document: {
    select: {
      id: true,
      title: true,
      documentType: true,
      researchId: true,
      versions: {
        select: {
          id: true,
          versionNumber: true,
          fileName: true,
          mimeType: true,
          googleDriveFileId: true,
          uploadedAt: true,
        },
        orderBy: { versionNumber: "desc" as const },
      },
    },
  },
} as const;
const recommendationSelect = {
  id: true,
  defenseSessionId: true,
  panelistId: true,
  responses: true,
  status: true,
  integrityHash: true,
  previewSourceHash: true,
  previewLayoutReport: true,
  previewGeneratedAt: true,
  generationMetadata: true,
  submittedAt: true,
  updatedAt: true,
  generatedVersion: { select: versionSelect },
} as const;

async function access(sessionId: string, user: NonNullable<Request["user"]>) {
  const session = await prisma.defenseSession.findUnique({
    where: { id: sessionId },
    include: { research: true, invitations: true },
  });
  if (!session || !canAccessCollege(user, session.research.collegeId))
    return null;
  const facilitator = user.roles.some((role) => FACILITATORS.has(role));
  const invitation = session.invitations.find(
    (item) => item.inviteeId === user.id && item.status !== "REMOVED",
  );
  if (!facilitator && !invitation) return null;
  return { session, facilitator, invitation };
}

router.get("/defense-review-packets", requireAuth, async (req, res) => {
  try {
    if (!req.user!.roles.includes("PANELIST"))
      return void res
        .status(403)
        .json({ error: "Panelist access is required." });
    const sessions = await prisma.defenseSession.findMany({
      where: {
        invitations: {
          some: {
            inviteeId: req.user!.id,
            status: "ACCEPTED",
            role: { in: ["PANELIST", "PANEL_CHAIR"] },
          },
        },
        packet: { is: { status: "PUBLISHED" } },
      },
      include: {
        research: {
          select: {
            id: true,
            title: true,
            groupName: true,
            researchType: { select: { name: true } },
          },
        },
        packet: {
          include: {
            manuscriptVersion: { select: versionSelect },
            similarityReport: { select: versionSelect },
            recommendationTemplate: { select: versionSelect },
            evaluationTemplate: { select: versionSelect },
          },
        },
        manuscriptReviews: { where: { panelistId: req.user!.id } },
        recommendations: {
          where: { panelistId: req.user!.id },
          select: recommendationSelect,
        },
        evaluations: {
          where: { evaluatorId: req.user!.id },
          include: {
            template: {
              include: { criteria: { orderBy: { sequence: "asc" } } },
            },
          },
        },
      },
      orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
    });
    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || "Failed to load defense review packets.",
    });
  }
});

router.get(
  "/defense-sessions/:id/review-packet",
  requireAuth,
  async (req, res) => {
    try {
      const allowed = await access(req.params.id as string, req.user!);
      if (!allowed)
        return void res
          .status(404)
          .json({ error: "Defense review packet was not found." });
      const packet = await prisma.defensePacket.findUnique({
        where: { defenseSessionId: allowed.session.id },
        include: {
          manuscriptVersion: { select: versionSelect },
          similarityReport: { select: versionSelect },
          recommendationTemplate: { select: versionSelect },
          evaluationTemplate: { select: versionSelect },
        },
      });
      if (!packet || (!allowed.facilitator && packet.status !== "PUBLISHED"))
        return void res
          .status(404)
          .json({ error: "Defense review packet was not found." });
      const review = allowed.facilitator
        ? null
        : await prisma.panelistManuscriptReview.findUnique({
            where: {
              defenseSessionId_panelistId: {
                defenseSessionId: allowed.session.id,
                panelistId: req.user!.id,
              },
            },
          });
      const recommendation = allowed.facilitator
        ? null
        : await prisma.panelistRecommendation.findUnique({
            where: {
              defenseSessionId_panelistId: {
                defenseSessionId: allowed.session.id,
                panelistId: req.user!.id,
              },
            },
            select: recommendationSelect,
          });
      const downloads = await prisma.auditLog.findMany({
        where: {
          userId: req.user!.id,
          action: "DOWNLOAD",
          entityType: "DocumentVersion",
          entityId: packet.manuscriptVersionId,
        },
        select: { id: true, createdAt: true, ipAddress: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      res.json({ packet, review, recommendation, downloads });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to load the review packet." });
    }
  },
);

router.put(
  "/defense-sessions/:id/review-packet",
  requireAuth,
  async (req, res) => {
    try {
      const allowed = await access(req.params.id as string, req.user!);
      if (!allowed?.facilitator)
        return void res
          .status(403)
          .json({ error: "Defense facilitator access is required." });
      const manuscriptVersionId = String(req.body.manuscriptVersionId || "");
      if (!manuscriptVersionId)
        return void res
          .status(400)
          .json({ error: "Select the eligible manuscript version." });
      const ids = [
        manuscriptVersionId,
        req.body.similarityReportVersionId,
        req.body.recommendationTemplateVersionId,
        req.body.evaluationTemplateVersionId,
      ]
        .filter(Boolean)
        .map(String);
      const versions = await prisma.documentVersion.findMany({
        where: {
          id: { in: ids },
          document: { researchId: allowed.session.researchId },
        },
        select: {
          id: true,
          mimeType: true,
          googleDriveFileId: true,
          storagePath: true,
        },
      });
      if (versions.length !== new Set(ids).size)
        return void res.status(400).json({
          error: "Every selected file must belong to this research project.",
        });
      if (versions.some((item) => item.mimeType !== "application/pdf"))
        return void res
          .status(400)
          .json({ error: "Defense packet files must be PDFs." });
      const recommendationFieldMappings =
        defensePacketService.normalizeMappings(
          req.body.recommendationFieldMappings,
        );
      const evaluationFieldMappings = defensePacketService.normalizeMappings(
        req.body.evaluationFieldMappings,
      );
      const publish = req.body.publish === true;
      if (
        publish &&
        req.body.recommendationTemplateVersionId &&
        !recommendationFieldMappings.length
      )
        return void res.status(400).json({
          error: "Map at least one recommendation field before publishing.",
        });
      if (
        publish &&
        req.body.evaluationTemplateVersionId &&
        !evaluationFieldMappings.length
      )
        return void res.status(400).json({
          error: "Map at least one evaluation field before publishing.",
        });
      const recommendationTemplate = versions.find(
        (item) => item.id === req.body.recommendationTemplateVersionId,
      );
      const evaluationTemplate = versions.find(
        (item) => item.id === req.body.evaluationTemplateVersionId,
      );
      const recommendationPreflight = recommendationTemplate
        ? await defensePacketService.preflight(
            recommendationTemplate,
            recommendationFieldMappings,
          )
        : null;
      const evaluationPreflight = evaluationTemplate
        ? await defensePacketService.preflight(
            evaluationTemplate,
            evaluationFieldMappings,
          )
        : null;
      const preflightReport = {
        recommendation: recommendationPreflight,
        evaluation: evaluationPreflight,
        checkedAt: new Date().toISOString(),
      };
      const preflightErrors = [
        recommendationPreflight,
        evaluationPreflight,
      ].flatMap((report) => report?.errors || []);
      if (publish && preflightErrors.length)
        return void res.status(400).json({
          error: "The PDF template preflight failed.",
          details: preflightErrors,
          preflightReport,
        });
      const packet = await prisma.defensePacket.upsert({
        where: { defenseSessionId: allowed.session.id },
        create: {
          defenseSessionId: allowed.session.id,
          manuscriptVersionId,
          similarityReportVersionId: req.body.similarityReportVersionId || null,
          recommendationTemplateVersionId:
            req.body.recommendationTemplateVersionId || null,
          evaluationTemplateVersionId:
            req.body.evaluationTemplateVersionId || null,
          recommendationFieldMappings: recommendationFieldMappings as any,
          evaluationFieldMappings: evaluationFieldMappings as any,
          reviewDeadline: req.body.reviewDeadline
            ? new Date(req.body.reviewDeadline)
            : null,
          publishedById: req.user!.id,
          preflightReport: preflightReport as any,
          engineVersion: "2.0",
          status: publish ? "PUBLISHED" : "DRAFT",
          publishedAt: publish ? new Date() : null,
        },
        update: {
          manuscriptVersionId,
          similarityReportVersionId: req.body.similarityReportVersionId || null,
          recommendationTemplateVersionId:
            req.body.recommendationTemplateVersionId || null,
          evaluationTemplateVersionId:
            req.body.evaluationTemplateVersionId || null,
          recommendationFieldMappings: recommendationFieldMappings as any,
          evaluationFieldMappings: evaluationFieldMappings as any,
          reviewDeadline: req.body.reviewDeadline
            ? new Date(req.body.reviewDeadline)
            : null,
          publishedById: req.user!.id,
          preflightReport: preflightReport as any,
          engineVersion: "2.0",
          mappingVersion: { increment: 1 },
          status: publish ? "PUBLISHED" : "DRAFT",
          publishedAt: publish ? new Date() : null,
        },
      });
      if (publish) {
        const invitees = allowed.session.invitations.filter(
          (item) =>
            item.status === "ACCEPTED" &&
            ["PANELIST", "PANEL_CHAIR"].includes(item.role),
        );
        if (invitees.length)
          await prisma.notification.createMany({
            data: invitees.map((item) => ({
              recipientId: item.inviteeId,
              type: "DOCUMENT_UPLOADED" as const,
              title: "Defense manuscript ready for review",
              message: `${allowed.session.research.title} is ready for pre-defense manuscript review.`,
              entityType: "DefenseSession",
              entityId: allowed.session.id,
            })),
          });
      }
      res.json({ packet, preflightReport });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || "Failed to save the defense review packet.",
      });
    }
  },
);

router.post(
  "/defense-sessions/:id/review-packet/files",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const allowed = await access(req.params.id as string, req.user!);
      if (!allowed?.facilitator)
        return void res
          .status(403)
          .json({ error: "Defense facilitator access is required." });
      if (
        !req.file ||
        req.file.mimetype !== "application/pdf" ||
        !req.file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))
      )
        return void res
          .status(400)
          .json({ error: "Upload a valid PDF up to 20 MB." });
      const kind = String(req.body.kind || "").toUpperCase();
      if (
        ![
          "RECOMMENDATION_TEMPLATE",
          "EVALUATION_TEMPLATE",
          "SIMILARITY_REPORT",
        ].includes(kind)
      )
        return void res
          .status(400)
          .json({ error: "Select a valid packet file type." });
      const title =
        kind === "RECOMMENDATION_TEMPLATE"
          ? "Panel Recommendation Template"
          : kind === "EVALUATION_TEMPLATE"
            ? "Panel Evaluation Template"
            : "Similarity Report";
      const folderId = await storageHierarchyService.resolveFolder({
        researchId: allowed.session.researchId,
        bucket: "SUBMISSIONS",
      });
      const stored = await googleDriveService.uploadFile({
        fileName: req.file.originalname,
        mimeType: "application/pdf",
        buffer: req.file.buffer,
        folderId,
        description: `${title} for ${allowed.session.research.title}`,
        appProperties: {
          advisioManaged: "true",
          advisioResearchId: allowed.session.researchId,
          advisioDefenseSessionId: allowed.session.id,
          advisioLifecycle: kind,
        },
      });
      const document = await prisma.document.create({
        data: {
          researchId: allowed.session.researchId,
          documentType: kind,
          title,
          createdBy: req.user!.id,
        },
      });
      const version = await prisma.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
          fileName: stored.fileName,
          mimeType: "application/pdf",
          fileSize: BigInt(stored.sizeBytes),
          storagePath: stored.webViewLink || stored.storagePath,
          googleDriveFileId: stored.fileId,
          uploadedBy: req.user!.id,
        },
        select: versionSelect,
      });
      res.status(201).json({ version });
    } catch (error: any) {
      res
        .status(400)
        .json({ error: error.message || "Failed to upload the packet file." });
    }
  },
);

router.put(
  "/defense-sessions/:id/manuscript-review",
  requireAuth,
  async (req, res) => {
    try {
      const allowed = await access(req.params.id as string, req.user!);
      if (!allowed?.invitation || allowed.invitation.status !== "ACCEPTED")
        return void res
          .status(403)
          .json({ error: "An accepted panel invitation is required." });
      const annotations = Array.isArray(req.body.annotations)
        ? req.body.annotations.slice(0, 500)
        : [];
      const revisionChecklist = Array.isArray(req.body.revisionChecklist)
        ? req.body.revisionChecklist.slice(0, 200)
        : [];
      const review = await prisma.panelistManuscriptReview.upsert({
        where: {
          defenseSessionId_panelistId: {
            defenseSessionId: allowed.session.id,
            panelistId: req.user!.id,
          },
        },
        create: {
          defenseSessionId: allowed.session.id,
          panelistId: req.user!.id,
          privateNotes: String(req.body.privateNotes || "").trim() || null,
          annotations,
          revisionChecklist,
          reviewedAt: req.body.reviewed === true ? new Date() : null,
        },
        update: {
          privateNotes: String(req.body.privateNotes || "").trim() || null,
          annotations,
          revisionChecklist,
          ...(req.body.reviewed === true ? { reviewedAt: new Date() } : {}),
        },
      });
      res.json({ review });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || "Failed to save the manuscript review.",
      });
    }
  },
);

router.put(
  "/defense-sessions/:id/recommendation",
  requireAuth,
  async (req, res) => {
    try {
      const recommendation = await defensePacketService.saveRecommendationDraft(
        req.params.id as string,
        req.user!.id,
        typeof req.body.responses === "object" && req.body.responses
          ? req.body.responses
          : {},
      );
      res.json({ recommendation });
    } catch (error: any) {
      res
        .status(/not|accepted/i.test(error.message) ? 403 : 400)
        .json({ error: error.message || "Failed to save the recommendation." });
    }
  },
);

router.post(
  "/defense-sessions/:id/recommendation/preview",
  requireAuth,
  async (req, res) => {
    try {
      const preview = await defensePacketService.previewRecommendation(
        req.params.id as string,
        req.user!.id,
      );
      res.json({ preview });
    } catch (error: any) {
      res.status(400).json({
        error:
          error.message || "Failed to generate the recommendation preview.",
      });
    }
  },
);

router.get(
  "/defense-sessions/:id/recommendation/preview",
  requireAuth,
  async (req, res) => {
    try {
      const preview = await defensePacketService.getRecommendationPreview(
        req.params.id as string,
        req.user!.id,
      );
      res
        .type("application/pdf")
        .setHeader("Cache-Control", "private, no-store")
        .send(preview);
    } catch (error: any) {
      res
        .status(404)
        .json({ error: error.message || "Recommendation preview not found." });
    }
  },
);

router.post(
  "/defense-sessions/:id/recommendation/confirm",
  requireAuth,
  async (req, res) => {
    try {
      const recommendation = await defensePacketService.confirmRecommendation(
        req.params.id as string,
        req.user!.id,
      );
      res.json({ recommendation });
    } catch (error: any) {
      res
        .status(400)
        .json({ error: error.message || "Failed to lock the recommendation." });
    }
  },
);

export default router;
