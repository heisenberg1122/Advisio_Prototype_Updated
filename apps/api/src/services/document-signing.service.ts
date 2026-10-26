import { resolveSigningImage, saveSigningImage, type SignatureImageInput } from "./signature-image.service.js";
import { documentService } from "./document.service.js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { prisma } from "../lib/prisma.js";
import { googleDriveService } from "./google-drive.service.js";
import { storageHierarchyService } from "./storage-hierarchy.service.js";

export type SignaturePlacement = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  includeName?: boolean;
  includeDate?: boolean;
};

export type LegacyDocumentSignatureAccessContext = {
  researchCollegeId: string;
  projectRoles: Array<{ userId: string; projectRole: string }>;
  workflowOwnerId: string | null;
  hasAcceptedPanelAssignment: boolean;
  hasLockedPanelEvaluation: boolean;
  documentType: string;
  deanRecipientId: string | null;
};

/** Authorization for the pre-official-copy visual-signing workflow. This is
 * intentionally project/assignment scoped; a broad platform role alone is
 * never sufficient for an academic signature. */
export function legacyDocumentSignatureAccessPolicy(
  signer: {
    id: string;
    roles: string[];
    collegeId: string | null;
  },
  context: LegacyDocumentSignatureAccessContext,
) {
  const roles = new Set(signer.roles);
  const assignedRoles = new Set(
    context.projectRoles
      .filter((member) => member.userId === signer.id)
      .map((member) => member.projectRole),
  );
  const isAssignedAdviser =
    roles.has("ADVISER") && assignedRoles.has("ADVISER");
  const isAssignedPanelist =
    roles.has("PANELIST") &&
    (assignedRoles.has("PANELIST") || context.hasAcceptedPanelAssignment);
  const isWorkflowCoordinator =
    roles.has("RESEARCH_COORDINATOR") && context.workflowOwnerId === signer.id;
  const isScopedDean =
    roles.has("DEAN") &&
    Boolean(signer.collegeId) &&
    signer.collegeId === context.researchCollegeId;
  const isDeanDocument = context.documentType === "DEAN_DEFENSE_APPROVAL";
  const isAssignedDean =
    (isScopedDean) &&
    (!context.deanRecipientId || context.deanRecipientId === signer.id);

  const canSign = isDeanDocument
    ? isAssignedDean
    : isAssignedAdviser ||
      isAssignedPanelist ||
      isWorkflowCoordinator ||
      isScopedDean;

  return {
    canSign,
    isAssignedPanelist,
    signerRole: isAssignedAdviser
      ? "ADVISER"
      : isAssignedPanelist
        ? "PANELIST"
        : isWorkflowCoordinator
          ? "COORDINATOR"
          : isScopedDean
            ? "DEAN"
              : "NONE",
  };
}

const sha256 = (value: Uint8Array) =>
  crypto.createHash("sha256").update(value).digest("hex");

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function loadVersionFile(version: {
  googleDriveFileId: string | null; storagePath: string; fileSize?: bigint | number;
}): Promise<Buffer> {
  const { buffer } = await documentService.readStoredVersionFile({
    storageProvider: version.googleDriveFileId ? "GOOGLE_DRIVE" : "SUPABASE",
    storagePath: version.storagePath, googleDriveFileId: version.googleDriveFileId, expectedSize: version.fileSize,
  });
  return buffer;
}

export function validateSignaturePlacement(value: SignaturePlacement) {
  const numbers = [value.x, value.y, value.width, value.height];
  if (!Number.isInteger(value.pageNumber) || value.pageNumber < 1)
    throw new Error("A valid PDF page number is required.");
  if (numbers.some((item) => !Number.isFinite(item) || item < 0 || item > 1))
    throw new Error(
      "Signature coordinates must be normalized between 0 and 1.",
    );
  if (
    value.width <= 0 ||
    value.height <= 0 ||
    value.x + value.width > 1 ||
    value.y + value.height > 1
  )
    throw new Error(
      "The signature must fit completely inside the selected page.",
    );
}

/**
 * Applies an account-authorized visual signature to a PDF. This is deliberately
 * not described as a cryptographic digital signature: signer authentication and
 * artifact hashes are recorded separately by the calling workflow.
 */
export async function createVisuallySignedPdf(options: {
  original: Buffer;
  signatureImage: Uint8Array;
  signerName: string;
  placements: SignaturePlacement[];
  signedAt: Date;
}) {
  options.placements.forEach(validateSignaturePlacement);
  const pdf = await PDFDocument.load(options.original, {
    updateMetadata: false,
  });
  const signatureImage = await pdf.embedPng(options.signatureImage);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const signedDate = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(options.signedAt);

  for (const placement of options.placements) {
    const page = pdf.getPages()[placement.pageNumber - 1];
    if (!page)
      throw new Error(`PDF page ${placement.pageNumber} does not exist.`);
    const crop = page.getCropBox();
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;
    const pageWidth = rotation === 90 || rotation === 270 ? crop.height : crop.width;
    const pageHeight = rotation === 90 || rotation === 270 ? crop.width : crop.height;
    // Match PDF.js's displayed crop box, including rotated/scanned PDFs.
    const toPage = (x: number, y: number) => {
      if (rotation === 90) return { x: crop.x + crop.width - y, y: crop.y + x };
      if (rotation === 180) return { x: crop.x + crop.width - x, y: crop.y + crop.height - y };
      if (rotation === 270) return { x: crop.x + y, y: crop.y + crop.height - x };
      return { x: crop.x + x, y: crop.y + y };
    };
    const width = placement.width * pageWidth;
    const height = placement.height * pageHeight;
    const x = placement.x * pageWidth;
    const y = pageHeight - placement.y * pageHeight - height;
    const scale = Math.min(width / signatureImage.width, height / signatureImage.height);
    const fittedWidth = signatureImage.width * scale;
    const fittedHeight = signatureImage.height * scale;
    page.drawImage(signatureImage, {
      ...toPage(x + (width - fittedWidth) / 2, y + (height - fittedHeight) / 2),
      width: fittedWidth, height: fittedHeight, rotate: degrees(rotation),
    });

    const detailLines = [
      placement.includeName === false ? null : options.signerName,
      placement.includeDate === false ? null : `Signed ${signedDate}`,
    ].filter(Boolean) as string[];
    detailLines.forEach((line, index) => {
      page.drawText(line, {
        ...toPage(x, Math.max(4, y - 10 - index * 9)),
        rotate: degrees(rotation),
        size: 7,
        font,
        color: rgb(0.12, 0.18, 0.25),
        maxWidth: Math.max(width, 120),
      });
    });
  }

  pdf.setProducer("Advisio Research Management System");
  pdf.setModificationDate(options.signedAt);
  return Buffer.from(await pdf.save());
}

export class DocumentSigningService {
  async sign(options: SignatureImageInput & {
    sourceVersionId: string;
    signerId: string;
    signerRoles: string[];
    signerCollegeId?: string | null;
    signerProgramId?: string | null;
    placements: SignaturePlacement[];
    ipAddress?: string;
    userAgent?: string;
  }) {
    if (!options.placements.length || options.placements.length > 10)
      throw new Error("Add between one and ten signature placements.");
    options.placements.forEach(validateSignaturePlacement);

    const source = await prisma.documentVersion.findUnique({
      where: { id: options.sourceVersionId },
      include: {
        sourceSignature: true,
        signedSignature: true,
        document: {
          include: {
            deanInboxMessages: {
              where: { attachmentVersionId: { not: null } },
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { authorId: true, recipientId: true },
            },
            research: {
              include: {
                members: {
                  where: { leftAt: null },
                  select: { userId: true, projectRole: true },
                },
                defenseSessions: {
                  select: {
                    invitations: {
                      where: { status: "ACCEPTED" },
                      select: { inviteeId: true, role: true },
                    },
                  },
                },
                evaluations: {
                  where: { evaluatorId: options.signerId, status: "LOCKED" },
                  select: { id: true },
                },
                workflowInstance: {
                  select: {
                    workflow: { select: { createdBy: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!source) throw new Error("Document version not found.");
    if (source.mimeType !== "application/pdf")
      throw new Error("Only PDF documents can be signed.");
    // A signed output may be countersigned. A source version that already produced
    // a signed successor may not be reused, preserving one immutable signature chain.
    if (source.sourceSignature)
      throw new Error("This document version has already been signed.");
    if (
      source.status !== "ACTIVE" ||
      source.versionNumber !== source.document.currentVersion
    )
      throw new Error(
        "Only the current active document version can be signed.",
      );
    const research = source.document.research;
    const signatureAccess = legacyDocumentSignatureAccessPolicy(
      {
        id: options.signerId,
        roles: options.signerRoles,
        collegeId: options.signerCollegeId ?? null,
      },
      {
        researchCollegeId: research.collegeId,
        projectRoles: research.members,
        workflowOwnerId: research.workflowInstance?.workflow.createdBy || null,
        hasAcceptedPanelAssignment: research.defenseSessions.some((session) =>
          session.invitations.some(
            (invitation) =>
              invitation.inviteeId === options.signerId &&
              ["PANELIST", "PANEL_CHAIR"].includes(invitation.role),
          ),
        ),
        hasLockedPanelEvaluation: research.evaluations.length > 0,
        documentType: source.document.documentType,
        deanRecipientId:
          source.document.deanInboxMessages[0]?.recipientId || null,
      },
    );
    if (!signatureAccess.canSign)
      throw new Error(
        "You are not authorized to sign for this research project.",
      );
    const isDeanDocument =
      source.document.documentType === "DEAN_DEFENSE_APPROVAL";
    if (signatureAccess.isAssignedPanelist && !research.evaluations.length)
      throw new Error(
        "Panelists can sign only after submitting and locking their final evaluation.",
      );

    const signature = await resolveSigningImage(options.signerId, options);

    const adviser = await prisma.user.findUnique({
      where: { id: options.signerId },
      select: { firstName: true, middleName: true, lastName: true },
    });
    if (!adviser) throw new Error("Signer account not found.");

    const original = await loadVersionFile(source);
    const signerName = [adviser.firstName, adviser.middleName, adviser.lastName]
      .filter(Boolean)
      .join(" ");
    const signedAt = new Date();
    const signedBuffer = await createVisuallySignedPdf({
      original,
      signatureImage: signature.imageData,
      signerName,
      placements: options.placements,
      signedAt,
    });
    const nextVersionNumber = source.document.currentVersion + 1;
    const baseName = source.fileName.replace(/\.pdf$/i, "");
    const fileName = `${baseName}-signed-v${nextVersionNumber}.pdf`;
    const { provider, storageResult: stored } = await documentService.storeDocumentFile({
      researchId: source.document.researchId, title: source.document.title,
      documentType: source.document.documentType, fileName, mimeType: "application/pdf",
      fileBuffer: signedBuffer, uploadedBy: options.signerId,
      ...(source.document.documentType === "DEAN_DEFENSE_APPROVAL" ? { deanRecipient: { id: options.signerId, name: signerName } } : {}),
    });
    const rolePrefix =
      signatureAccess.signerRole === "ADVISER"
        ? "ADV"
        : signatureAccess.signerRole === "PANELIST"
          ? "PNL"
          : signatureAccess.signerRole === "COORDINATOR"
            ? "PROF"
            : "DEAN";
    const verificationCode = `${rolePrefix}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;

    try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${source.documentId}))`;
      const current = await tx.document.findUniqueOrThrow({ where: { id: source.documentId }, select: { currentVersion: true } });
      if (current.currentVersion !== source.document.currentVersion) throw new Error("The document changed during signing. Review the current version and try again.");
      await tx.documentVersion.updateMany({
        where: { documentId: source.documentId, status: "ACTIVE" },
        data: { status: "SUPERSEDED" },
      });
      const signedVersion = await tx.documentVersion.create({
        data: {
          documentId: source.documentId,
          versionNumber: nextVersionNumber,
          fileName: stored.fileName,
          mimeType: "application/pdf",
          fileSize: BigInt(stored.sizeBytes),
          storagePath: stored.storagePath,
          googleDriveFileId: provider === "GOOGLE_DRIVE" ? stored.fileId : null,
          uploadedBy: options.signerId,
          status: "ACTIVE",
        },
      });
      await tx.document.update({
        where: { id: source.documentId },
        data: {
          currentVersion: nextVersionNumber,
          externalFileId: stored.fileId,
          storageProvider: provider,
        },
      });
      await saveSigningImage(tx, options.signerId, signature);
      const documentSignature = await tx.documentSignature.create({
        data: {
          sourceVersionId: source.id,
          signedVersionId: signedVersion.id,
          signedById: options.signerId,
          originalFileHash: sha256(original),
          signedFileHash: sha256(signedBuffer),
          placements: options.placements,
          verificationCode,
          signedAt,
        },
      });
      if (isDeanDocument) {
        await tx.deanInboxMessage.create({
          data: {
            documentId: source.documentId,
            authorId: options.signerId,
            recipientId: options.signerId,
            message: `Signed copy attached. Verification code: ${verificationCode}`,
            attachmentVersionId: signedVersion.id,
          },
        });
        const requesterId = source.document.deanInboxMessages[0]?.authorId;
        if (requesterId && requesterId !== options.signerId) {
          const mailSubject = `Signed: ${source.document.title}`.slice(0, 255);
          const mailBody = `${signerName} signed the Dean approval request for ${research.title}. Verification code: ${verificationCode}`;
          const mailThread = await tx.mailThread.create({
            data: {
              subject: mailSubject,
              createdById: options.signerId,
              participants: {
                create: [
                  { userId: options.signerId, readAt: signedAt },
                  { userId: requesterId },
                ],
              },
              messages: {
                create: {
                  senderId: options.signerId,
                  body: mailBody,
                  sentAt: signedAt,
                  attachments: {
                    create: {
                      fileName,
                      mimeType: "application/pdf",
                      fileSize: signedBuffer.length,
                      fileData: Uint8Array.from(signedBuffer),
                      signedById: options.signerId,
                      signedAt,
                      verificationCode,
                      originalFileHash: documentSignature.originalFileHash,
                      signedFileHash: documentSignature.signedFileHash,
                      signaturePlacements: options.placements,
                    },
                  },
                },
              },
            },
          });
          await tx.notification.create({
            data: {
              audience: "coordinator", recipientId: requesterId,
              type: "DOCUMENT_REVIEWED",
              title: "Dean signed your request",
              message: `${signerName} signed ${source.document.title}. The official signed PDF is available in your Inbox.`,
              entityType: "MailThread",
              entityId: mailThread.id,
            },
          });
        }
      }
      await tx.auditLog.create({
        data: {
          userId: options.signerId,
          action: "SIGN",
          entityType: "DocumentVersion",
          entityId: signedVersion.id,
          newValues: {
            sourceVersionId: source.id,
            signedVersionId: signedVersion.id,
            verificationCode,
            originalFileHash: documentSignature.originalFileHash,
            signedFileHash: documentSignature.signedFileHash,
            signatureProfileHash: signature.fileHash,
          },
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
      });
      const researcherIds = source.document.research.members
        .filter(
          (member) =>
            member.userId !== options.signerId &&
            ["LEADER", "MEMBER"].includes(member.projectRole),
        )
        .map((member) => member.userId);
      if (researcherIds.length) {
        await tx.notification.createMany({
          data: researcherIds.map((recipientId) => ({ audience: "researcher", recipientId,
            type: "DOCUMENT_REVIEWED",
            title: "Official document signed",
            message: `${signerName} signed ${source.document.title}. The official signed PDF is now available in Documents.`,
            entityType: "DocumentSignature",
            entityId: documentSignature.id,
          })),
        });
      }
      return {
        signature: documentSignature,
        version: {
          ...signedVersion,
          fileSize: Number(signedVersion.fileSize),
          webViewLink: `/api/documents/versions/${signedVersion.id}/content`,
        },
      };
    });
    } catch (error) {
      await documentService.cleanupStoredFile(provider, stored);
      throw error;
    }
  }
}

export const documentSigningService = new DocumentSigningService();
