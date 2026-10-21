import { beforeEach, describe, expect, it, vi } from "vitest";
import { deflateSync } from "node:zlib";
import {
  PDFDocument,
  PDFArray,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
  degrees,
} from "pdf-lib";
import {
  decodeSignatureImage,
  resolveSigningImage,
  saveSigningImage,
} from "./signature-image.service.js";
import { createVisuallySignedPdf } from "./document-signing.service.js";
import { prisma } from "../lib/prisma.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: { userSignature: { findUnique: vi.fn() } },
}));

// A tiny RGBA PNG fixture with real checksums and compressed pixels.
function png(width = 40, height = 10) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let i = 0; i < 8; i++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length);
    body.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = Buffer.alloc((width * 4 + 1) * height, 255);
  for (let row = 0; row < height; row++) pixels[row * (width * 4 + 1)] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const dataUrl = (buffer: Buffer) =>
  `data:image/png;base64,${buffer.toString("base64")}`;

beforeEach(() => vi.clearAllMocks());

describe("signature image input", () => {
  it("accepts a valid PNG without requiring a saved profile", async () => {
    const image = await resolveSigningImage("signer", {
      signatureImage: dataUrl(png()),
    });
    expect(image.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(image.saveForFuture).toBe(false);
    expect(prisma.userSignature.findUnique).not.toHaveBeenCalled();
  });

  it("rejects malformed, non-PNG, oversized, and excessive-dimension images", async () => {
    for (const value of [
      null,
      "",
      "data:image/jpeg;base64,aGVsbG8=",
      dataUrl(Buffer.from("not a png")),
      dataUrl(Buffer.alloc(2 * 1024 * 1024 + 1)),
      dataUrl(png(4097, 1)),
    ]) {
      await expect(decodeSignatureImage(value)).rejects.toThrow();
    }
    await expect(
      resolveSigningImage("signer", {
        signatureImage: dataUrl(png()),
        saveSignature: "true",
      }),
    ).rejects.toThrow("boolean");
  });

  it("falls back to the saved signature and reports a missing profile", async () => {
    vi.mocked(prisma.userSignature.findUnique).mockResolvedValueOnce(null);
    await expect(resolveSigningImage("signer", {})).rejects.toThrow(
      "Draw, type, or upload",
    );
    const saved = { imageData: Uint8Array.from(png()), fileHash: "saved-hash" };
    vi.mocked(prisma.userSignature.findUnique).mockResolvedValueOnce(
      saved as never,
    );
    expect(await resolveSigningImage("signer", {})).toEqual({
      ...saved,
      saveForFuture: false,
    });
  });

  it("only updates the profile when saving is explicitly requested", async () => {
    const tx = {
      userSignature: { upsert: vi.fn().mockResolvedValue({ id: "profile" }) },
      auditLog: { create: vi.fn() },
    };
    const image = await resolveSigningImage("signer", {
      signatureImage: dataUrl(png()),
    });
    await saveSigningImage(tx as never, "signer", image);
    expect(tx.userSignature.upsert).not.toHaveBeenCalled();
    await saveSigningImage(tx as never, "signer", {
      ...image,
      saveForFuture: true,
    });
    expect(tx.userSignature.upsert).toHaveBeenCalledOnce();
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });
});

describe("PDF signature placement", () => {
  it("preserves image proportions and maps top-left coordinates onto the selected PDF page", async () => {
    const original = await PDFDocument.create();
    original.addPage([600, 800]);
    original.addPage([600, 800]);
    const signed = await createVisuallySignedPdf({
      original: Buffer.from(await original.save()),
      signatureImage: png(),
      signerName: "Test Signer",
      signedAt: new Date("2026-10-21T00:00:00Z"),
      placements: [
        {
          pageNumber: 2,
          x: 0.2,
          y: 0.3,
          width: 0.4,
          height: 0.1,
          includeName: false,
          includeDate: false,
        },
      ],
    });
    const loaded = await PDFDocument.load(signed);
    expect(loaded.getPageCount()).toBe(2);
    expect(
      loaded.getPage(0).node.Resources()?.lookup(PDFName.of("XObject")),
    ).toBeUndefined();
    const streams = loaded.getPage(1).node.Contents()!;
    if (!(streams instanceof PDFArray))
      throw new Error("Expected PDF content streams");
    const content = Array.from({ length: streams.size() }, (_, index) =>
      Buffer.from(
        decodePDFRawStream(streams.lookup(index, PDFRawStream)).decode(),
      ).toString(),
    ).join("\n");
    // A 4:1 image fits in a 240x80 box as 240x60, centered vertically.
    expect(content).toContain("1 0 0 1 120 490 cm");
    expect(content).toContain("240 0 0 60 0 0 cm");
  });

  it.each([
    [90, "250 220"],
    [180, "490 330"],
    [270, "370 620"],
  ])(
    "maps a cropped page rotated %i degrees to the displayed location",
    async (angle, anchor) => {
      const original = await PDFDocument.create();
      const page = original.addPage([640, 850]);
      page.setCropBox(10, 20, 600, 800);
      page.setRotation(degrees(angle as number));
      const signed = await createVisuallySignedPdf({
        original: Buffer.from(await original.save()),
        signatureImage: png(),
        signerName: "Signer",
        signedAt: new Date(),
        placements: [
          {
            pageNumber: 1,
            x: 0.2,
            y: 0.3,
            width: 0.4,
            height: 0.1,
            includeName: false,
            includeDate: false,
          },
        ],
      });
      const loaded = await PDFDocument.load(signed);
      const streams = loaded.getPage(0).node.Contents()!;
      if (!(streams instanceof PDFArray))
        throw new Error("Expected PDF content streams");
      const content = Array.from({ length: streams.size() }, (_, index) =>
        Buffer.from(
          decodePDFRawStream(streams.lookup(index, PDFRawStream)).decode(),
        ).toString(),
      ).join("\n");
      expect(content).toContain(`1 0 0 1 ${anchor} cm`);
      expect(loaded.getPage(0).getRotation().angle).toBe(angle);
    },
  );

  it("rejects placements outside the PDF or on missing pages", async () => {
    const original = await PDFDocument.create();
    original.addPage();
    const options = {
      original: Buffer.from(await original.save()),
      signatureImage: png(),
      signerName: "Signer",
      signedAt: new Date(),
    };
    await expect(
      createVisuallySignedPdf({
        ...options,
        placements: [{ pageNumber: 1, x: 0.9, y: 0, width: 0.2, height: 0.1 }],
      }),
    ).rejects.toThrow("fit completely");
    await expect(
      createVisuallySignedPdf({
        ...options,
        placements: [{ pageNumber: 2, x: 0, y: 0, width: 0.2, height: 0.1 }],
      }),
    ).rejects.toThrow("does not exist");
  });
});
