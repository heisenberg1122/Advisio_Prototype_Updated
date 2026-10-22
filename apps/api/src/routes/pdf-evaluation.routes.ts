import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { Prisma, type PdfEvaluation } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessCollege } from "../lib/college-scope.js";
import { hasDefenseFacilitatorAccess } from "../services/defense-manuscript.service.js";
import { documentService } from "../services/document.service.js";
import {
  resolveSigningImage,
  saveSigningImage,
  SignatureImageError,
} from "../services/signature-image.service.js";
import {
  annotationsSchema,
  boxSchema,
  evaluationRevisionHash,
  pdfHash,
  renderAnnotatedPdf,
  PdfAnnotationError,
} from "../services/pdf-annotation.service.js";

const router = Router();
class Conflict extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
const key = (sessionId: string, panelistId: string) => ({
  defenseSessionId_panelistId: { defenseSessionId: sessionId, panelistId },
});
const metadata = (item: PdfEvaluation | null) =>
  item
    ? {
        id: item.id,
        status: item.status,
        revision: item.revision,
        annotations: item.annotations,
        sourceVersionId: item.sourceVersionId,
        signedAt: item.signedAt,
        signaturePlacement: item.signaturePlacement,
        lockedAt: item.lockedAt,
        updatedAt: item.updatedAt,
        integrityHash: item.integrityHash,
      }
    : null;
const run =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (error: any) {
      res
        .status(
          error instanceof Conflict
            ? error.status
            : error instanceof z.ZodError ||
                error instanceof SignatureImageError ||
                error instanceof PdfAnnotationError
              ? 400
              : 500,
        )
        .json({
          error:
            error instanceof z.ZodError
              ? error.issues[0]?.message
              : error instanceof Conflict ||
                  error instanceof SignatureImageError ||
                  error instanceof PdfAnnotationError
                ? error.message
                : "Unable to process the PDF evaluation. Please retry or contact the professor.",
        });
    }
  };

async function access(req: Request, facilitator = false) {
  const id = z.string().uuid().parse(req.params.id);
  const session = await prisma.defenseSession.findUnique({
    where: { id },
    include: {
      packet: true,
      research: { select: { collegeId: true, title: true } },
      invitations: true,
    },
  });
  if (!session) throw new Conflict("Defense not found.", 404);
  const user = req.user!;
  const isFacilitator =
    hasDefenseFacilitatorAccess(user) &&
    canAccessCollege(user, session.research.collegeId);
  const accepted =
    user.roles.includes("PANELIST") &&
    session.invitations.some(
      (i) =>
        i.inviteeId === user.id &&
        i.status === "ACCEPTED" &&
        ["PANELIST", "PANEL_CHAIR"].includes(i.role),
    );
  if (facilitator ? !isFacilitator : !accepted)
    throw new Conflict(
      "This evaluation is not available to this account.",
      403,
    );
  return session;
}
function pdfMode(session: any) {
  if (
    session.packet?.status !== "PUBLISHED" ||
    session.packet.evaluationMode !== "PDF" ||
    !session.packet.evaluationTemplateVersionId
  )
    throw new Conflict(
      "The professor has not published a PDF evaluation for this session.",
    );
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
    throw new Conflict("PDF evaluations support files up to 20 MB.", 400);
  const pdf = await PDFDocument.load(buffer);
  if (pdf.getPageCount() > 500)
    throw new Conflict("PDF evaluations support up to 500 pages.", 400);
  return { version, buffer };
}
async function lockSession(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM defense_sessions WHERE id = ${id}::uuid FOR UPDATE`;
}
async function mutable(
  tx: Prisma.TransactionClient,
  id: string,
  userId: string,
  revision: number,
) {
  await lockSession(tx, id);
  const session = await tx.defenseSession.findUniqueOrThrow({
    where: { id },
    include: { packet: true, invitations: true },
  });
  pdfMode(session);
  if (session.status !== "LIVE")
    throw new Conflict("Editing is available only during the live defense.");
  if (
    !session.invitations.some(
      (i) =>
        i.inviteeId === userId &&
        i.status === "ACCEPTED" &&
        ["PANELIST", "PANEL_CHAIR"].includes(i.role),
    )
  )
    throw new Conflict(
      "Your panel assignment has changed. Refresh the page.",
      403,
    );
  const item = await tx.pdfEvaluation.findUnique({ where: key(id, userId) });
  if (item?.status === "LOCKED")
    throw new Conflict("Your submitted PDF evaluation is locked.");
  if ((item?.revision || 0) !== revision)
    throw new Conflict(
      "This draft changed in another tab. Reload before editing.",
    );
  if (
    item &&
    item.sourceVersionId !== session.packet!.evaluationTemplateVersionId
  )
    throw new Conflict(
      "The evaluation template changed. Contact the professor.",
    );
  return { session, item };
}
function pdfResponse(res: Response, bytes: Uint8Array, download = false) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="defense-evaluation.pdf"`,
  );
  res.type("application/pdf").send(Buffer.from(bytes));
}

// Configuration does not replace the published manuscript or fabricate approvals.
router.put(
  "/defense-sessions/:id/pdf-evaluation/settings",
  requireAuth,
  run(async (req, res) => {
    const session = await access(req, true);
    const input = z
      .object({
        sourceVersionId: z.string().uuid(),
        signatureRequired: z.boolean(),
        expectedMappingVersion: z.number().int().positive(),
      })
      .parse(req.body);
    const version = await prisma.documentVersion.findUnique({
      where: { id: input.sourceVersionId },
      include: { document: true },
    });
    if (
      !version ||
      version.document.researchId !== session.researchId ||
      version.mimeType !== "application/pdf" ||
      version.document.documentType !== "EVALUATION_TEMPLATE"
    )
      throw new Conflict(
        "Choose an evaluation PDF uploaded for this research group.",
        400,
      );
    await source(version.id); // Verify readable bytes before publishing.
    const packet = await prisma.$transaction(async (tx) => {
      await lockSession(tx, session.id);
      const current = await tx.defenseSession.findUniqueOrThrow({
        where: { id: session.id },
        include: { packet: true },
      });
      if (
        !current.packet ||
        ["COMPLETED", "CANCELLED", "DELIBERATION"].includes(current.status)
      )
        throw new Conflict("This session cannot change evaluation settings.");
      if (current.packet.mappingVersion !== input.expectedMappingVersion)
        throw new Conflict("The packet changed. Reopen its settings.");
      const used =
        (await tx.pdfEvaluation.count({
          where: { defenseSessionId: session.id },
        })) +
        (await tx.evaluation.count({
          where: { defenseSessionId: session.id },
        }));
      if (used)
        throw new Conflict(
          "Evaluation settings are fixed after a panelist starts a draft.",
        );
      const result = await tx.defensePacket.update({
        where: { id: current.packet.id },
        data: {
          evaluationMode: "PDF",
          evaluationSignatureRequired: input.signatureRequired,
          evaluationTemplateVersionId: version.id,
          mappingVersion: { increment: 1 },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "UPDATE",
          entityType: "PdfEvaluationSettings",
          entityId: result.id,
          newValues: {
            sourceVersionId: version.id,
            signatureRequired: input.signatureRequired,
            mappingVersion: result.mappingVersion,
          },
        },
      });
      return result;
    });
    res.json({ packet });
  }),
);

router.get(
  "/defense-sessions/:id/pdf-evaluation",
  requireAuth,
  run(async (req, res) => {
    const session = await access(req);
    pdfMode(session);
    const item = await prisma.pdfEvaluation.findUnique({
      where: key(session.id, req.user!.id),
    });
    const version = await prisma.documentVersion.findUniqueOrThrow({
      where: {
        id:
          item?.sourceVersionId || session.packet!.evaluationTemplateVersionId!,
      },
      select: { id: true, fileName: true },
    });
    res.json({
      evaluation: metadata(item),
      template: version,
      signatureRequired: session.packet!.evaluationSignatureRequired,
      editable: session.status === "LIVE" && item?.status !== "LOCKED",
      researchTitle: session.research.title,
    });
  }),
);
router.get(
  "/defense-sessions/:id/pdf-evaluation/source",
  requireAuth,
  run(async (req, res) => {
    const session = await access(req);
    pdfMode(session);
    const item = await prisma.pdfEvaluation.findUnique({
      where: key(session.id, req.user!.id),
    });
    const bytes =
      item?.sourceData ||
      (await source(session.packet!.evaluationTemplateVersionId!)).buffer;
    pdfResponse(res, bytes);
  }),
);
router.put(
  "/defense-sessions/:id/pdf-evaluation",
  requireAuth,
  run(async (req, res) => {
    const session = await access(req);
    pdfMode(session);
    const input = z
      .object({
        revision: z.number().int().nonnegative(),
        sourceVersionId: z.string().uuid(),
        annotations: annotationsSchema,
      })
      .parse(req.body);
    if (input.sourceVersionId !== session.packet!.evaluationTemplateVersionId)
      throw new Conflict("The template changed. Reload this page.");
    const snapshot = await prisma.pdfEvaluation.findUnique({
      where: key(session.id, req.user!.id),
    });
    const stored = snapshot
      ? {
          version: { id: snapshot.sourceVersionId },
          buffer: Buffer.from(snapshot.sourceData),
        }
      : await source(input.sourceVersionId);
    // Validate page references, supported text, and text-box fit before saving.
    await renderAnnotatedPdf(stored.buffer, input.annotations);
    const result = await prisma.$transaction(async (tx) => {
      const { item, session: current } = await mutable(
        tx,
        session.id,
        req.user!.id,
        input.revision,
      );
      if (current.packet!.evaluationTemplateVersionId !== input.sourceVersionId)
        throw new Conflict("The template changed. Reload this page.");
      const data = {
        annotations: input.annotations as Prisma.InputJsonValue,
        revision: input.revision + 1,
        signatureData: null,
        signaturePlacement: Prisma.DbNull,
        signedAt: null,
        previewHash: null,
      };
      if (item)
        return tx.pdfEvaluation.update({ where: { id: item.id }, data });
      return tx.pdfEvaluation.create({
        data: {
          ...data,
          defenseSessionId: session.id,
          panelistId: req.user!.id,
          sourceVersionId: stored.version.id,
          sourceData: Uint8Array.from(stored.buffer),
          sourceChecksum: pdfHash(stored.buffer),
        },
      });
    });
    res.json({ evaluation: metadata(result) });
  }),
);

router.post(
  "/defense-sessions/:id/pdf-evaluation/sign",
  requireAuth,
  run(async (req, res) => {
    const session = await access(req);
    pdfMode(session);
    const input = z
      .object({
        revision: z.number().int().positive(),
        password: z.string().min(1).max(256),
        placement: boxSchema,
        signatureImage: z.string().optional(),
        saveSignature: z.boolean().optional(),
      })
      .parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { passwordHash: true },
    });
    if (
      !user.passwordHash ||
      !(await bcrypt.compare(input.password, user.passwordHash))
    )
      throw new Conflict("Password confirmation failed.", 403);
    const image = await resolveSigningImage(req.user!.id, input);
    const result = await prisma.$transaction(async (tx) => {
      const { item } = await mutable(
        tx,
        session.id,
        req.user!.id,
        input.revision,
      );
      if (!item) throw new Conflict("Save a draft before signing.");
      await renderAnnotatedPdf(
        item.sourceData,
        annotationsSchema.parse(item.annotations),
        { data: image.imageData, placement: input.placement },
      );
      const saved = await tx.pdfEvaluation.update({
        where: { id: item.id },
        data: {
          signatureData: Uint8Array.from(image.imageData),
          signaturePlacement: input.placement,
          signedAt: new Date(),
          revision: { increment: 1 },
          previewHash: null,
        },
      });
      await saveSigningImage(tx, req.user!.id, image);
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "UPDATE",
          entityType: "PdfEvaluationSignature",
          entityId: item.id,
          newValues: {
            revision: saved.revision,
            signatureHash: image.fileHash,
          },
        },
      });
      return saved;
    });
    res.json({ evaluation: metadata(result) });
  }),
);
router.get(
  "/defense-sessions/:id/pdf-evaluation/signature",
  requireAuth,
  run(async (req, res) => {
    const session = await access(req);
    pdfMode(session);
    const item = await prisma.pdfEvaluation.findUnique({
      where: key(session.id, req.user!.id),
    });
    if (!item?.signatureData)
      throw new Conflict("No signature on this draft.", 404);
    res.setHeader("Cache-Control", "private, no-store");
    res.type("image/png").send(Buffer.from(item.signatureData));
  }),
);
router.post(
  "/defense-sessions/:id/pdf-evaluation/preview",
  requireAuth,
  run(async (req, res) => {
    const session = await access(req);
    pdfMode(session);
    const revision = z.number().int().positive().parse(req.body.revision);
    const result = await prisma.$transaction(async (tx) => {
      const { item } = await mutable(tx, session.id, req.user!.id, revision);
      if (!item) throw new Conflict("Save a draft before previewing.");
      const hash = evaluationRevisionHash(item);
      const bytes = await renderAnnotatedPdf(
        item.sourceData,
        annotationsSchema.parse(item.annotations),
        item.signatureData
          ? {
              data: item.signatureData,
              placement: boxSchema.parse(item.signaturePlacement),
            }
          : null,
      );
      await tx.pdfEvaluation.update({
        where: { id: item.id },
        data: { previewHash: hash },
      });
      return { hash, bytes };
    });
    res.json({
      previewHash: result.hash,
      pdfBase64: result.bytes.toString("base64"),
    });
  }),
);
router.post(
  "/defense-sessions/:id/pdf-evaluation/submit",
  requireAuth,
  run(async (req, res) => {
    const session = await access(req);
    pdfMode(session);
    const input = z
      .object({
        revision: z.number().int().positive(),
        previewHash: z.string().length(64),
        confirmed: z.literal(true),
      })
      .parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const { item, session: current } = await mutable(
        tx,
        session.id,
        req.user!.id,
        input.revision,
      );
      if (!item || !annotationsSchema.parse(item.annotations).length)
        throw new Conflict("Add evaluation marks before submitting.");
      if (current.packet!.evaluationSignatureRequired && !item.signedAt)
        throw new Conflict("This evaluation requires your signature.");
      if (
        item.previewHash !== input.previewHash ||
        evaluationRevisionHash(item) !== input.previewHash
      )
        throw new Conflict("Preview the current revision before submitting.");
      const finalData = await renderAnnotatedPdf(
        item.sourceData,
        annotationsSchema.parse(item.annotations),
        item.signatureData
          ? {
              data: item.signatureData,
              placement: boxSchema.parse(item.signaturePlacement),
            }
          : null,
      );
      const saved = await tx.pdfEvaluation.update({
        where: { id: item.id },
        data: {
          status: "LOCKED",
          lockedAt: new Date(),
          finalData: Uint8Array.from(finalData),
          integrityHash: pdfHash(finalData),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "CREATE",
          entityType: "PdfEvaluationSubmission",
          entityId: item.id,
          newValues: {
            revision: saved.revision,
            integrityHash: saved.integrityHash,
            sourceChecksum: saved.sourceChecksum,
            signed: Boolean(saved.signedAt),
          },
        },
      });
      return saved;
    });
    res.json({ evaluation: metadata(result) });
  }),
);
router.get(
  "/defense-sessions/:id/pdf-evaluations",
  requireAuth,
  run(async (req, res) => {
    const session = await access(req, true);
    const items = await prisma.pdfEvaluation.findMany({
      where: { defenseSessionId: session.id, status: "LOCKED" },
      select: {
        id: true,
        lockedAt: true,
        integrityHash: true,
        panelist: { select: { firstName: true, lastName: true } },
      },
    });
    res.json({ evaluations: items });
  }),
);
router.get(
  "/defense-sessions/:id/pdf-evaluations/:evaluationId/content",
  requireAuth,
  run(async (req, res) => {
    const id = z.string().uuid().parse(req.params.evaluationId);
    const item = await prisma.pdfEvaluation.findUnique({ where: { id } });
    if (
      !item ||
      item.defenseSessionId !== req.params.id ||
      item.status !== "LOCKED" ||
      !item.finalData
    )
      throw new Conflict("Submitted PDF not found.", 404);
    if (item.panelistId === req.user!.id) await access(req);
    else await access(req, true);
    pdfResponse(res, item.finalData, req.query.download === "1");
  }),
);
export default router;
