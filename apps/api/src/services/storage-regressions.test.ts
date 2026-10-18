import { afterEach, describe, expect, it, vi } from "vitest";
import { supabaseStorageService } from "./supabase-storage.service.js";
import { googleDriveService } from "./google-drive.service.js";
import { documentService } from "./document.service.js";
import { loadVersionFile } from "./document-signing.service.js";
import { storeArtifact, deleteArtifact } from "./artifact-storage.service.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("provider-neutral confidential storage", () => {
  it("refuses to put new confidential uploads in a public bucket", async () => {
    const previous = (supabaseStorageService as any).client;
    const upload = vi.fn();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    (supabaseStorageService as any).client = {
      getBucket: vi
        .fn()
        .mockResolvedValue({ data: { public: true }, error: null }),
      from: () => ({ upload }),
    };
    try {
      expect(
        await supabaseStorageService.uploadFile({
          fileName: "private.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-private"),
        }),
      ).toBeNull();
      expect(upload).not.toHaveBeenCalled();
    } finally {
      (supabaseStorageService as any).client = previous;
      log.mockRestore();
    }
  });
  it("stores private object keys without exposing a public object URL", async () => {
    const previous = (supabaseStorageService as any).client;
    const getPublicUrl = vi.fn();
    (supabaseStorageService as any).client = {
      getBucket: vi
        .fn()
        .mockResolvedValue({ data: { public: false }, error: null }),
      from: () => ({
        upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
        getPublicUrl,
      }),
    };
    try {
      const stored = await supabaseStorageService.uploadFile({
        fileName: "private.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-private"),
        folder: "project",
      });
      expect(stored?.storagePath).toMatch(/^supabase:\/\//);
      expect(stored?.webViewLink).toBe("");
      expect(getPublicUrl).not.toHaveBeenCalled();
    } finally {
      (supabaseStorageService as any).client = previous;
    }
  });
  it("reads a Supabase version for signing without requesting a Drive file", async () => {
    const bytes = Buffer.from("%PDF-private");
    const download = vi
      .spyOn(supabaseStorageService, "downloadStoredFile")
      .mockResolvedValue(bytes);
    const drive = vi.spyOn(googleDriveService, "getFileStream");
    expect(
      await loadVersionFile({
        googleDriveFileId: null,
        storagePath: "supabase://manuscripts/project/file",
        fileSize: BigInt(bytes.length),
      }),
    ).toEqual(bytes);
    expect(download).toHaveBeenCalled();
    expect(drive).not.toHaveBeenCalled();
  });
  it("rejects a stored object whose bytes do not match the recorded size", async () => {
    vi.spyOn(supabaseStorageService, "downloadStoredFile").mockResolvedValue(
      Buffer.from("changed"),
    );
    await expect(
      documentService.readStoredVersionFile({
        storageProvider: "SUPABASE",
        storagePath: "supabase://manuscripts/file",
        expectedSize: 100,
      }),
    ).rejects.toThrow("changed size");
  });
  it("uses the configured provider for official archives and compensating cleanup", async () => {
    vi.stubEnv("STORAGE_PROVIDER", "SUPABASE");
    vi.spyOn(supabaseStorageService, "uploadFile").mockResolvedValue({
      fileId: "object",
      fileName: "official.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4,
      storagePath: "supabase://manuscripts/file",
      webViewLink: "",
      webContentLink: "",
    });
    const cleanup = vi
      .spyOn(supabaseStorageService, "deleteStoredFile")
      .mockResolvedValue(true);
    const stored = await storeArtifact(
      {
        fileName: "official.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("file"),
      },
      "project",
    );
    expect(stored.provider).toBe("SUPABASE");
    expect(stored.googleDriveFileId).toBeNull();
    await deleteArtifact(stored);
    expect(cleanup).toHaveBeenCalledWith("supabase://manuscripts/file");
  });
});
