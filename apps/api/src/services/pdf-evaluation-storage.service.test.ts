import { Readable } from "node:stream";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

const { db, drive } = vi.hoisted(() => ({
  db: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  drive: {
    reserveSharedPdfId: vi.fn(),
    storeSharedPdf: vi.fn(),
    verifySharedPdf: vi.fn(),
    getFileStream: vi.fn(),
  },
}));
vi.mock("../lib/prisma.js", () => ({ prisma: { pdfEvaluationArtifact: db } }));
vi.mock("./google-drive.service.js", () => ({ googleDriveService: drive }));

import { pdfHash, renderAnnotatedPdf } from "./pdf-annotation.service.js";
import {
  PdfEvaluationStorageError,
  pdfEvaluationDriveFolder,
  readPdfEvaluationArtifact,
  storePdfEvaluationArtifact,
} from "./pdf-evaluation-storage.service.js";

const pdf = Buffer.from("sample PDF bytes");
const checksum = pdfHash(pdf);
const record = {
  fileId: "reserved",
  folderId: "restricted",
  checksum,
  size: pdf.length,
};

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllEnvs());

it("uses the winning reservation when reviewers start against the same source", async () => {
  db.findUnique.mockResolvedValue(null);
  drive.reserveSharedPdfId.mockResolvedValue("losing-id");
  db.upsert.mockResolvedValue({ ...record, verifiedAt: new Date() });
  expect(
    await storePdfEvaluationArtifact("restricted", "source:version:hash", pdf),
  ).toBe("reserved");
  expect(db.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { operationKey: "source:version:hash" },
      create: expect.objectContaining({ fileId: "losing-id" }),
    }),
  );
  expect(drive.storeSharedPdf).not.toHaveBeenCalled();
  expect(drive.verifySharedPdf).toHaveBeenCalledWith(record);
});

it("reuses the reserved ID after an indeterminate upload and marks it verified only on success", async () => {
  db.findUnique.mockResolvedValue(record);
  drive.storeSharedPdf.mockRejectedValueOnce(new Error("timeout"));
  await expect(
    storePdfEvaluationArtifact("restricted", "final:eval:preview", pdf),
  ).rejects.toBeInstanceOf(PdfEvaluationStorageError);
  expect(db.update).not.toHaveBeenCalled();

  await expect(
    storePdfEvaluationArtifact("restricted", "final:eval:preview", pdf),
  ).resolves.toBe("reserved");
  expect(drive.storeSharedPdf.mock.calls).toEqual([
    [{ fileId: "reserved", folderId: "restricted", buffer: pdf }],
    [{ fileId: "reserved", folderId: "restricted", buffer: pdf }],
  ]);
  expect(db.update).toHaveBeenCalledOnce();
});

it("rejects corrupt Drive bytes and reads legacy bytes without a Drive request", async () => {
  await expect(readPdfEvaluationArtifact(null, pdf, checksum)).resolves.toEqual(
    pdf,
  );
  expect(drive.getFileStream).not.toHaveBeenCalled();
  db.findUnique.mockResolvedValue({ ...record, verifiedAt: new Date() });
  drive.getFileStream.mockResolvedValueOnce({ data: Readable.from([pdf]) });
  await expect(
    readPdfEvaluationArtifact("reserved", null, checksum),
  ).resolves.toEqual(pdf);
  const corrupt = Buffer.from(pdf);
  corrupt[0] ^= 1;
  drive.getFileStream.mockResolvedValueOnce({ data: Readable.from([corrupt]) });
  await expect(
    readPdfEvaluationArtifact("reserved", null, checksum),
  ).rejects.toBeInstanceOf(PdfEvaluationStorageError);
});

it("keeps the QR evaluation and local demo environments isolated from Drive", () => {
  vi.stubEnv("PDF_EVALUATION_DRIVE_FOLDER_ID", "restricted");
  vi.stubEnv("PDF_EVALUATION_DRIVE_SESSION_IDS", "session");
  vi.stubEnv("ADVISIO_EVALUATION", "1");
  expect(pdfEvaluationDriveFolder("session")).toBeUndefined();
  vi.stubEnv("ADVISIO_EVALUATION", "0");
  vi.stubEnv("ADVISIO_LOCAL_DEMO", "1");
  expect(pdfEvaluationDriveFolder("session")).toBeUndefined();
});

it("requires explicit rollout activation and gives the allowlist precedence", () => {
  vi.stubEnv("ADVISIO_EVALUATION", "0");
  vi.stubEnv("ADVISIO_LOCAL_DEMO", "0");
  vi.stubEnv("PDF_EVALUATION_DRIVE_FOLDER_ID", "restricted");
  vi.stubEnv("PDF_EVALUATION_DRIVE_SESSION_IDS", "");
  vi.stubEnv("PDF_EVALUATION_DRIVE_ALL_SESSIONS", "false");
  expect(pdfEvaluationDriveFolder("session")).toBeUndefined();

  vi.stubEnv("PDF_EVALUATION_DRIVE_ALL_SESSIONS", "true");
  expect(pdfEvaluationDriveFolder("session")).toBe("restricted");
  vi.stubEnv("PDF_EVALUATION_DRIVE_SESSION_IDS", " first, second ");
  expect(pdfEvaluationDriveFolder("session")).toBeUndefined();
  expect(pdfEvaluationDriveFolder("SECOND")).toBe("restricted");
});

it("renders the same final bytes across retries at different times", async () => {
  const document = await PDFDocument.create();
  document.addPage();
  const source = await document.save();
  const marks = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      type: "check" as const,
      page: 1,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.1,
    },
  ];
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-11-08T01:00:00Z"));
    const first = await renderAnnotatedPdf(source, marks, null, {
      preserveMetadata: true,
    });
    vi.setSystemTime(new Date("2026-11-08T02:00:00Z"));
    const second = await renderAnnotatedPdf(source, marks, null, {
      preserveMetadata: true,
    });
    expect(pdfHash(second)).toBe(pdfHash(first));
  } finally {
    vi.useRealTimers();
  }
});
