import { Router, type Request, type Response } from "express";
import { PDFDocument } from "pdf-lib";
import { Prisma, type PacketDocumentReview } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessCollege } from "../lib/college-scope.js";
import { hasDefenseFacilitatorAccess } from "../services/defense-manuscript.service.js";
import { documentService } from "../services/document.service.js";
import {
  annotationsSchema,
  evaluationRevisionHash,
  pdfHash,
  renderAnnotatedPdf,
  PdfAnnotationError,
} from "../services/pdf-annotation.service.js";

const router = Router();
class ReviewError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
const run =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (error: any) {
      res
        .status(
          error instanceof ReviewError
            ? error.status
            : error instanceof z.ZodError || error instanceof PdfAnnotationError
              ? 400
              : 500,
        )
        .json({
          error:
            error instanceof z.ZodError
              ? error.issues[0]?.message
              : error instanceof ReviewError ||
                  error instanceof PdfAnnotationError
                ? error.message
                : "Unable to open manuscript feedback. Please retry.",
        });
    }
  };
const reviewKey = (
  sessionId: string,
  panelistId: string,
  versionId: string,
) => ({
  defenseSessionId_panelistId_sourceVersionId: {
    defenseSessionId: sessionId,
    panelistId,
    sourceVersionId: versionId,
  },
});
const metadata = (item: PacketDocumentReview | null) =>
  item
    ? {
        id: item.id,
        revision: item.revision,
        annotations: item.annotations,
        sourceVersionId: item.sourceVersionId,
        updatedAt: item.updatedAt,
        status: "DRAFT",
      }
    : null;
const versionSelect = {
  id: true,
  fileName: true,
  versionNumber: true,
  document: { select: { title: true } },
} as const;

async function access(
  req: Request,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const id = z.string().uuid().parse(req.params.id);
  const session = await tx.defenseSession.findUnique({
    where: { id },
    include: {
      packet: true,
      invitations: true,
      research: {
        select: {
          title: true,
          collegeId: true,
          members: {
            where: { leftAt: null },
            select: { userId: true, projectRole: true },
          },
        },
      },
    },
  });
  if (!session) throw new ReviewError("Defense packet not found.", 404);
  const user = req.user!;
  const author =
    user.roles.includes("PANELIST") &&
    session.invitations.some(
      (i) =>
        i.inviteeId === user.id &&
        i.status === "ACCEPTED" &&
        ["PANELIST", "PANEL_CHAIR"].includes(i.role),
    );
  const facilitator =
    hasDefenseFacilitatorAccess(user) &&
    canAccessCollege(user, session.research.collegeId);
  const researcher = session.research.members.some(
    (m) => m.userId === user.id && ["LEADER", "MEMBER"].includes(m.projectRole),
  );
  if (!author && !facilitator && !researcher)
    throw new ReviewError(
      "Manuscript feedback is not available to this account.",
      403,
    );
  return { session, author, recipient: facilitator || researcher };
}
async function own(
  req: Request,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const allowed = await access(req, tx);
  if (!allowed.author)
    throw new ReviewError("Panelist annotation drafts are private.", 403);
  if (allowed.session.packet?.status !== "PUBLISHED")
    throw new ReviewError(
      "The professor must publish the defense manuscript first.",
    );
  const versionId = z.string().uuid().parse(req.params.versionId);
  const item = await tx.packetDocumentReview.findUnique({
    where: reviewKey(allowed.session.id, req.user!.id, versionId),
  });
  const current = allowed.session.packet.manuscriptVersionId === versionId;
  if (!current && !item)
    throw new ReviewError(
      "This manuscript version is not in your review history.",
      404,
    );
  return { ...allowed, item, current, versionId };
}
async function source(versionId: string) {
  const version = await prisma.documentVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: { document: true },
  });
  const { buffer } = await documentService.readStoredVersionFile({
    storageProvider: version.document.storageProvider,
    storagePath: version.storagePath,
    googleDriveFileId: version.googleDriveFileId,
    expectedSize: version.fileSize,
  });
  if (buffer.length > 20 * 1024 * 1024)
    throw new ReviewError(
      "Annotation workspaces support PDFs up to 20 MB.",
      400,
    );
  if ((await PDFDocument.load(buffer)).getPageCount() > 500)
    throw new ReviewError(
      "Annotation workspaces support up to 500 pages.",
      400,
    );
  return buffer;
}
async function lockedSession(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM defense_sessions WHERE id = ${id}::uuid FOR UPDATE`;
}
async function writable(
  req: Request,
  tx: Prisma.TransactionClient,
  revision: number,
) {
  await lockedSession(tx, String(req.params.id));
  const allowed = await own(req, tx);
  if (!allowed.current)
    throw new ReviewError(
      "A newer manuscript is published. The earlier review is retained as read-only history.",
    );
  if (allowed.session.status === "CANCELLED")
    throw new ReviewError(
      "This defense was cancelled. Your existing reviews remain available.",
    );
  if ((allowed.item?.revision || 0) !== revision)
    throw new ReviewError(
      "This draft changed in another tab. Reload before editing.",
    );
  return allowed;
}
function pdfResponse(res: Response, bytes: Uint8Array, download: boolean) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="annotated-manuscript.pdf"`,
  );
  res.type("application/pdf").send(Buffer.from(bytes));
}

router.get(
  "/defense-sessions/:id/manuscript-annotations",
  requireAuth,
  run(async (req, res) => {
    const { session, author } = await access(req);
    if (!author)
      throw new ReviewError("Panelist annotation drafts are private.", 403);
    if (session.packet?.status !== "PUBLISHED")
      throw new ReviewError("The manuscript has not been published.");
    const currentVersion = await prisma.documentVersion.findUniqueOrThrow({
      where: { id: session.packet.manuscriptVersionId },
      select: versionSelect,
    });
    const reviews = await prisma.packetDocumentReview.findMany({
      where: { defenseSessionId: session.id, panelistId: req.user!.id },
      select: { sourceVersion: { select: versionSelect }, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    res.json({
      currentVersion,
      reviewedVersions: reviews.map((r) => r.sourceVersion),
    });
  }),
);
router.get(
  "/defense-sessions/:id/manuscript-annotations/:versionId",
  requireAuth,
  run(async (req, res) => {
    const { session, item, current, versionId } = await own(req);
    const template = await prisma.documentVersion.findUniqueOrThrow({
      where: { id: versionId },
      select: versionSelect,
    });
    res.json({
      review: metadata(item),
      template,
      editable: current && session.status !== "CANCELLED",
      researchTitle: session.research.title,
      currentVersion: current,
      lastSharedRevision: item
        ? (
            await prisma.packetReviewPublication.findFirst({
              where: { reviewId: item.id },
              orderBy: { revision: "desc" },
              select: { revision: true },
            })
          )?.revision || null
        : null,
    });
  }),
);
router.get(
  "/defense-sessions/:id/manuscript-annotations/:versionId/source",
  requireAuth,
  run(async (req, res) => {
    const { item, versionId } = await own(req);
    pdfResponse(res, item?.sourceData || (await source(versionId)), false);
  }),
);
router.put(
  "/defense-sessions/:id/manuscript-annotations/:versionId",
  requireAuth,
  run(async (req, res) => {
    const allowed = await own(req);
    const input = z
      .object({
        revision: z.number().int().nonnegative(),
        sourceVersionId: z.string().uuid(),
        annotations: annotationsSchema,
      })
      .parse(req.body);
    if (input.sourceVersionId !== allowed.versionId)
      throw new ReviewError(
        "The selected document changed. Reload this review.",
      );
    const bytes = allowed.item?.sourceData || (await source(allowed.versionId));
    await renderAnnotatedPdf(bytes, input.annotations);
    const saved = await prisma.$transaction(async (tx) => {
      const { item, session, versionId } = await writable(
        req,
        tx,
        input.revision,
      );
      const data = {
        annotations: input.annotations as Prisma.InputJsonValue,
        revision: input.revision + 1,
        previewHash: null,
      };
      return item
        ? tx.packetDocumentReview.update({ where: { id: item.id }, data })
        : tx.packetDocumentReview.create({
            data: {
              ...data,
              defenseSessionId: session.id,
              panelistId: req.user!.id,
              sourceVersionId: versionId,
              sourceData: Uint8Array.from(bytes),
              sourceChecksum: pdfHash(bytes),
            },
          });
    });
    res.json({ review: metadata(saved) });
  }),
);
router.post(
  "/defense-sessions/:id/manuscript-annotations/:versionId/preview",
  requireAuth,
  run(async (req, res) => {
    const revision = z.number().int().positive().parse(req.body.revision);
    const result = await prisma.$transaction(async (tx) => {
      await lockedSession(tx, String(req.params.id));
      const { item } = await own(req, tx);
      if (!item || item.revision !== revision)
        throw new ReviewError("Save the current draft before previewing.");
      const previewHash = evaluationRevisionHash(item);
      const bytes = await renderAnnotatedPdf(
        item.sourceData,
        annotationsSchema.parse(item.annotations),
      );
      await tx.packetDocumentReview.update({
        where: { id: item.id },
        data: { previewHash },
      });
      return { previewHash, pdfBase64: bytes.toString("base64") };
    });
    res.json(result);
  }),
);
router.post(
  "/defense-sessions/:id/manuscript-annotations/:versionId/share",
  requireAuth,
  run(async (req, res) => {
    const input = z
      .object({
        revision: z.number().int().positive(),
        previewHash: z.string().length(64),
        confirmed: z.literal(true),
      })
      .parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const { item, session } = await writable(req, tx, input.revision);
      if (!item || !annotationsSchema.parse(item.annotations).length)
        throw new ReviewError(
          "Add review annotations before sharing feedback.",
        );
      if (
        item.previewHash !== input.previewHash ||
        evaluationRevisionHash(item) !== input.previewHash
      )
        throw new ReviewError("Preview the latest draft before sharing.");
      const bytes = await renderAnnotatedPdf(
        item.sourceData,
        annotationsSchema.parse(item.annotations),
      );
      const publication =
        (await tx.packetReviewPublication.findUnique({
          where: {
            reviewId_revision: { reviewId: item.id, revision: item.revision },
          },
        })) ||
        (await tx.packetReviewPublication.create({
          data: {
            reviewId: item.id,
            revision: item.revision,
            pdfData: Uint8Array.from(bytes),
            integrityHash: pdfHash(bytes),
          },
        }));
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "PUBLISH",
          entityType: "ManuscriptFeedback",
          entityId: publication.id,
          newValues: {
            defenseSessionId: session.id,
            sourceVersionId: item.sourceVersionId,
            revision: item.revision,
            integrityHash: publication.integrityHash,
            audience: "Professor and active research group members",
          },
        },
      });
      return {
        review: metadata(item),
        publication: {
          id: publication.id,
          revision: publication.revision,
          publishedAt: publication.publishedAt,
        },
      };
    });
    res.json(result);
  }),
);
router.get(
  "/defense-sessions/:id/manuscript-feedback",
  requireAuth,
  run(async (req, res) => {
    const { session, recipient } = await access(req);
    const publications = await prisma.packetReviewPublication.findMany({
      where: {
        review: {
          defenseSessionId: session.id,
          ...(!recipient ? { panelistId: req.user!.id } : {}),
        },
      },
      select: {
        id: true,
        revision: true,
        publishedAt: true,
        integrityHash: true,
        review: {
          select: {
            sourceVersion: { select: versionSelect },
            panelist: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { publishedAt: "desc" },
    });
    res.json({
      publications: publications.map((p) => ({
        ...p,
        currentVersion:
          p.review.sourceVersion.id === session.packet?.manuscriptVersionId,
      })),
    });
  }),
);
router.get(
  "/defense-sessions/:id/manuscript-feedback/:publicationId/content",
  requireAuth,
  run(async (req, res) => {
    const { session, recipient } = await access(req);
    const id = z.string().uuid().parse(req.params.publicationId);
    const publication = await prisma.packetReviewPublication.findFirst({
      where: {
        id,
        review: {
          defenseSessionId: session.id,
          ...(!recipient ? { panelistId: req.user!.id } : {}),
        },
      },
      select: { pdfData: true },
    });
    if (!publication) throw new ReviewError("Shared feedback not found.", 404);
    pdfResponse(res, publication.pdfData, req.query.download === "1");
  }),
);
export default router;
