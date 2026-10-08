import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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
  googleDriveFileId: string | null;
  storagePath: string;
}): Promise<Buffer> {
  const fileId = version.googleDriveFileId;
  if (!fileId) throw new Error("This document version does not have a readable stored PDF.");

  if (!fileId.startsWith("gdrive-")) {
    const response = await googleDriveService.getFileStream(fileId);
    return streamToBuffer(response.data);
  }

  const uploadDir = path.resolve(process.cwd(), "uploads");
  const diskName = fs.existsSync(uploadDir)
    ? fs.readdirSync(uploadDir).find((name) => name.startsWith(`${fileId}-`))
    : undefined;
  if (!diskName) throw new Error("The stored PDF is unavailable.");
  return fs.readFileSync(path.join(uploadDir, diskName));
}

function validatePlacement(value: SignaturePlacement) {
  const numbers = [value.x, value.y, value.width, value.height];
  if (!Number.isInteger(value.pageNumber) || value.pageNumber < 1)
    throw new Error("A valid PDF page number is required.");
  if (numbers.some((item) => !Number.isFinite(item) || item < 0 || item > 1))
    throw new Error("Signature coordinates must be normalized between 0 and 1.");
  if (value.width <= 0 || value.height <= 0 || value.x + value.width > 1 || value.y + value.height > 1)
    throw new Error("The signature must fit completely inside the selected page.");
}

export class DocumentSigningService {
  async sign(options: {
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
    options.placements.forEach(validatePlacement);

    const source = await prisma.documentVersion.findUnique({
      where: { id: options.sourceVersionId },
      include: {
        sourceSignature: true,
        signedSignature: true,
        document: {
          include: {
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
              },
            },
          },
        },
      },
    });
    if (!source) throw new Error("Document version not found.");
    if (source.mimeType !== "application/pdf") throw new Error("Only PDF documents can be signed.");
    // A signed output may be countersigned. A source version that already produced
    // a signed successor may not be reused, preserving one immutable signature chain.
    if (source.sourceSignature) throw new Error("This document version has already been signed.");
    if (source.status !== "ACTIVE" || source.versionNumber !== source.document.currentVersion)
      throw new Error("Only the current active document version can be signed.");
    const research = source.document.research;
    const isAssignedAdviser = options.signerRoles.includes("ADVISER") && research.members.some((member) => member.userId === options.signerId && member.projectRole === "ADVISER");
    const isAssignedPanelist = options.signerRoles.includes("PANELIST") && (
      research.members.some((member) => member.userId === options.signerId && member.projectRole === "PANELIST") ||
      research.defenseSessions.some((session) => session.invitations.some((invitation) => invitation.inviteeId === options.signerId && ["PANELIST", "PANEL_CHAIR"].includes(invitation.role)))
    );
    const isProfessorInScope = options.signerRoles.includes("RESEARCH_COORDINATOR") && Boolean(options.signerCollegeId) && source.document.research.collegeId === options.signerCollegeId;
    const isDean = options.signerRoles.some((role) => ["RPO", "VPAA"].includes(role));
    if (!isAssignedAdviser && !isAssignedPanelist && !isProfessorInScope && !isDean)
      throw new Error("You are not authorized to sign for this research project.");
    if (isAssignedPanelist && research.evaluations.length === 0)
      throw new Error("Panelists can sign only after submitting and locking their final evaluation.");

    const signature = await prisma.userSignature.findUnique({ where: { userId: options.signerId } });
    if (!signature) throw new Error("Create or upload your signature before signing a document.");

    const adviser = await prisma.user.findUnique({
      where: { id: options.signerId },
      select: { firstName: true, middleName: true, lastName: true },
    });
    if (!adviser) throw new Error("Signer account not found.");

    const original = await loadVersionFile(source);
    const pdf = await PDFDocument.load(original, { updateMetadata: false });
    const signatureImage = await pdf.embedPng(signature.imageData);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const signerName = [adviser.firstName, adviser.middleName, adviser.lastName].filter(Boolean).join(" ");
    const signedAt = new Date();
    const signedDate = new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Manila",
    }).format(signedAt);

    for (const placement of options.placements) {
      const page = pdf.getPages()[placement.pageNumber - 1];
      if (!page) throw new Error(`PDF page ${placement.pageNumber} does not exist.`);
      const { width: pageWidth, height: pageHeight } = page.getSize();
      const width = placement.width * pageWidth;
      const height = placement.height * pageHeight;
      const x = placement.x * pageWidth;
      const y = pageHeight - placement.y * pageHeight - height;
      page.drawImage(signatureImage, { x, y, width, height });

      const detailLines = [
        placement.includeName === false ? null : signerName,
        placement.includeDate === false ? null : `Signed ${signedDate}`,
      ].filter(Boolean) as string[];
      detailLines.forEach((line, index) => {
        page.drawText(line, {
          x,
          y: Math.max(4, y - 10 - index * 9),
          size: 7,
          font,
          color: rgb(0.12, 0.18, 0.25),
          maxWidth: Math.max(width, 120),
        });
      });
    }

    pdf.setProducer("Advisio Research Management System");
    pdf.setModificationDate(signedAt);
    const signedBytes = await pdf.save();
    const signedBuffer = Buffer.from(signedBytes);
    const nextVersionNumber = source.document.currentVersion + 1;
    const baseName = source.fileName.replace(/\.pdf$/i, "");
    const fileName = `${baseName}-signed-v${nextVersionNumber}.pdf`;
    const destinationFolderId = source.document.documentType === "DEAN_DEFENSE_APPROVAL"
      ? await storageHierarchyService.resolveDeanApprovalsFolder(source.document.researchId, { id: options.signerId, name: signerName })
      : await storageHierarchyService.resolveFolder({
          researchId: source.document.researchId,
          bucket: "SUBMISSIONS",
        });
    const stored = await googleDriveService.uploadFile({
      fileName,
      mimeType: "application/pdf",
      buffer: signedBuffer,
      folderId: destinationFolderId,
      description: `Advisio signed document: ${source.document.title}`,
      appProperties: {
        advisioManaged: "true",
        advisioResearchId: source.document.researchId,
        advisioDocumentId: source.document.id,
        advisioSignerId: options.signerId,
        advisioLifecycle: "SIGNED",
        advisioChecksum: sha256(signedBuffer),
      },
    });
    const rolePrefix = isAssignedAdviser ? "ADV" : isAssignedPanelist ? "PNL" : isProfessorInScope ? "PROF" : "DEAN";
    const verificationCode = `${rolePrefix}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;

    return prisma.$transaction(async (tx) => {
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
          storagePath: stored.webViewLink || stored.storagePath,
          googleDriveFileId: stored.fileId,
          uploadedBy: options.signerId,
          status: "ACTIVE",
        },
      });
      await tx.document.update({
        where: { id: source.documentId },
        data: { currentVersion: nextVersionNumber, externalFileId: stored.fileId },
      });
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
      if (isDean) {
        await tx.deanInboxMessage.create({
          data: {
            documentId: source.documentId,
            authorId: options.signerId,
            recipientId: options.signerId,
            message: `Signed copy attached. Verification code: ${verificationCode}`,
            attachmentVersionId: signedVersion.id,
          },
        });
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
          },
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
      });
      const researcherIds = source.document.research.members
        .filter((member) => member.userId !== options.signerId && ["LEADER", "MEMBER"].includes(member.projectRole))
        .map((member) => member.userId);
      if (researcherIds.length) {
        await tx.notification.createMany({
          data: researcherIds.map((recipientId) => ({
            recipientId,
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
        version: { ...signedVersion, fileSize: Number(signedVersion.fileSize), webViewLink: stored.webViewLink },
      };
    });
  }
}

export const documentSigningService = new DocumentSigningService();
