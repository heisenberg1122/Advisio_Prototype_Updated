import { prisma } from "../lib/prisma.js";
import { googleDriveService } from "./google-drive.service.js";
import { pdfHash } from "./pdf-annotation.service.js";

export class PdfEvaluationStorageError extends Error {
  constructor(cause?: unknown) {
    super("Evaluation PDF storage is temporarily unavailable. Please retry.", {
      cause,
    });
  }
}

export function pdfEvaluationDriveFolder(sessionId: string) {
  if (
    process.env.ADVISIO_LOCAL_DEMO === "1" ||
    process.env.ADVISIO_EVALUATION === "1"
  )
    return undefined;
  const folderId = process.env.PDF_EVALUATION_DRIVE_FOLDER_ID?.trim();
  if (!folderId) return undefined;

  const sessions = (process.env.PDF_EVALUATION_DRIVE_SESSION_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  const enabled = sessions.length
    ? sessions.includes(sessionId.toLowerCase())
    : process.env.PDF_EVALUATION_DRIVE_ALL_SESSIONS === "true";
  return enabled ? folderId : undefined;
}

export async function storePdfEvaluationArtifact(
  folderId: string,
  operationKey: string,
  buffer: Buffer,
) {
  try {
    const checksum = pdfHash(buffer);
    let artifact = await prisma.pdfEvaluationArtifact.findUnique({
      where: { operationKey },
    });
    if (!artifact) {
      const fileId = await googleDriveService.reserveSharedPdfId(folderId);
      // Native upsert arbitrates concurrent first saves before any bytes are uploaded.
      artifact = await prisma.pdfEvaluationArtifact.upsert({
        where: { operationKey },
        create: {
          operationKey,
          fileId,
          folderId,
          checksum,
          size: buffer.length,
        },
        update: { operationKey },
      });
    }
    if (
      artifact.folderId !== folderId ||
      artifact.checksum !== checksum ||
      artifact.size !== buffer.length
    ) {
      throw new Error(
        "Evaluation PDF reservation does not match the requested artifact",
      );
    }
    const fileId = artifact.fileId;
    if (!artifact.verifiedAt) {
      await googleDriveService.storeSharedPdf({ fileId, folderId, buffer });
    }
    await googleDriveService.verifySharedPdf({
      fileId,
      folderId,
      size: buffer.length,
      checksum,
    });
    if (!artifact.verifiedAt) {
      await prisma.pdfEvaluationArtifact.update({
        where: { operationKey },
        data: { verifiedAt: new Date() },
      });
    }
    return fileId;
  } catch (error) {
    throw new PdfEvaluationStorageError(error);
  }
}

export async function readPdfEvaluationArtifact(
  fileId: string | null,
  legacy: Uint8Array | null,
  checksum: string | null,
) {
  if (legacy) return Buffer.from(legacy);
  try {
    if (!fileId || !checksum)
      throw new Error("Evaluation PDF reference is missing");
    const artifact = await prisma.pdfEvaluationArtifact.findUnique({
      where: { fileId },
    });
    if (!artifact?.verifiedAt || artifact.checksum !== checksum) {
      throw new Error("Evaluation PDF reference failed verification");
    }
    const signal = AbortSignal.timeout(20_000);
    const { data } = await googleDriveService.getFileStream(fileId, signal);
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of data) {
      signal.throwIfAborted();
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += bytes.length;
      if (length > artifact.size)
        throw new Error("Evaluation PDF exceeded its recorded size");
      chunks.push(bytes);
    }
    const buffer = Buffer.concat(chunks, length);
    if (length !== artifact.size || pdfHash(buffer) !== checksum) {
      throw new Error("Evaluation PDF bytes failed verification");
    }
    return buffer;
  } catch (error) {
    throw new PdfEvaluationStorageError(error);
  }
}
