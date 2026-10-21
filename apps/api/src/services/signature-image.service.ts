import crypto from "node:crypto";
import { PDFDocument } from "pdf-lib";
import type { Prisma } from "@research-management/database";
import { prisma } from "../lib/prisma.js";

export class SignatureImageError extends Error {}

export type SignatureImageInput = {
  signatureImage?: unknown;
  saveSignature?: unknown;
};

export async function decodeSignatureImage(
  value: unknown,
): Promise<Uint8Array> {
  if (
    typeof value !== "string" ||
    value.length > 2_796_230 ||
    !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new SignatureImageError("Provide a valid PNG signature up to 2 MB.");
  }
  const buffer = Buffer.from(
    value.slice("data:image/png;base64,".length),
    "base64",
  );
  if (
    buffer.length < 24 ||
    buffer.length > 2 * 1024 * 1024 ||
    !buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    buffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new SignatureImageError("Provide a valid PNG signature up to 2 MB.");
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (
    !width ||
    !height ||
    width > 4096 ||
    height > 4096 ||
    width * height > 4_000_000
  ) {
    throw new SignatureImageError(
      "Signature image dimensions are too large. Use up to 4 million pixels and 4096 pixels per side.",
    );
  }
  try {
    const pdf = await PDFDocument.create();
    await pdf.embedPng(buffer);
  } catch {
    throw new SignatureImageError(
      "The signature image could not be read. Use a valid PNG.",
    );
  }
  return Uint8Array.from(buffer);
}

export async function resolveSigningImage(
  userId: string,
  input: SignatureImageInput,
) {
  if (
    input.saveSignature !== undefined &&
    typeof input.saveSignature !== "boolean"
  ) {
    throw new SignatureImageError("Save signature must be a boolean.");
  }
  if (input.signatureImage !== undefined) {
    const imageData = await decodeSignatureImage(input.signatureImage);
    return {
      imageData,
      fileHash: crypto.createHash("sha256").update(imageData).digest("hex"),
      saveForFuture: input.saveSignature === true,
    };
  }
  const saved = await prisma.userSignature.findUnique({ where: { userId } });
  if (!saved)
    throw new SignatureImageError(
      "Draw, type, or upload your signature before signing.",
    );
  return {
    imageData: saved.imageData,
    fileHash: saved.fileHash,
    saveForFuture: false,
  };
}

// Called inside the signing transaction: failed signing never replaces a saved profile.
export async function saveSigningImage(
  tx: Prisma.TransactionClient,
  userId: string,
  image: Awaited<ReturnType<typeof resolveSigningImage>>,
) {
  if (!image.saveForFuture) return;
  const data = {
    imageData: Uint8Array.from(image.imageData),
    fileHash: image.fileHash,
    mimeType: "image/png",
  };
  const profile = await tx.userSignature.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  await tx.auditLog.create({
    data: {
      userId,
      action: "UPDATE",
      entityType: "UserSignature",
      entityId: profile.id,
      newValues: { fileHash: image.fileHash },
    },
  });
}
