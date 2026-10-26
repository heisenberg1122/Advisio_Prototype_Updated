import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  fileDeletionJob: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  references: vi.fn(),
}));
vi.mock("../lib/prisma.js", async () => {
  const { Prisma } =
    await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  return {
    Prisma,
    prisma: {
      fileDeletionJob: db.fileDeletionJob,
      ...Object.fromEntries(
        Prisma.dmmf.datamodel.models
          .map((model) => [
            model.name[0].toLowerCase() + model.name.slice(1),
            { count: db.references },
          ])
          .filter(([name]) => name !== "fileDeletionJob"),
      ),
    },
  };
});
vi.mock("./google-drive.service.js", () => ({
  googleDriveService: { deleteStoredFile: vi.fn() },
}));
vi.mock("./local-storage.service.js", () => ({
  localStorageService: { deleteStoredFile: vi.fn() },
}));
vi.mock("./supabase-storage.service.js", () => ({
  supabaseStorageService: { deleteStoredFile: vi.fn() },
}));
import { processFileDeletionJobs } from "./file-deletion.service.js";
import { googleDriveService } from "./google-drive.service.js";
import { localStorageService } from "./local-storage.service.js";
import { supabaseStorageService } from "./supabase-storage.service.js";

beforeEach(() => {
  vi.resetAllMocks();
  db.references.mockResolvedValue(0);
  db.fileDeletionJob.updateMany.mockResolvedValue({ count: 1 });
  db.fileDeletionJob.deleteMany.mockResolvedValue({ count: 1 });
});
describe("Stored file deletion outbox", () => {
  it.each(["GOOGLE_DRIVE", "LOCAL", "SUPABASE"])(
    "uses the recorded %s provider",
    async (provider) => {
      const path =
        provider === "SUPABASE"
          ? "supabase://manuscripts/test/fixture.pdf"
          : "/uploads/local/fixture.pdf";
      db.fileDeletionJob.findMany.mockResolvedValue([
        {
          id: "job",
          fileId: "file",
          provider,
          storagePath: provider === "GOOGLE_DRIVE" ? null : path,
          attempts: 0,
        },
      ]);
      vi.mocked(googleDriveService.deleteStoredFile).mockResolvedValue(true);
      vi.mocked(localStorageService.deleteStoredFile).mockResolvedValue(true);
      vi.mocked(supabaseStorageService.deleteStoredFile).mockResolvedValue(
        true,
      );
      await processFileDeletionJobs();
      const service =
        provider === "LOCAL"
          ? localStorageService
          : provider === "SUPABASE"
            ? supabaseStorageService
            : googleDriveService;
      expect(service.deleteStoredFile).toHaveBeenCalledWith(
        provider === "GOOGLE_DRIVE" ? "file" : path,
      );
      expect(db.fileDeletionJob.deleteMany).toHaveBeenCalledWith({
        where: { id: "job" },
      });
    },
  );
  it("preserves a file used by a surviving record", async () => {
    db.fileDeletionJob.findMany.mockResolvedValue([
      {
        id: "job",
        fileId: "shared",
        provider: "GOOGLE_DRIVE",
        storagePath: null,
        attempts: 0,
      },
    ]);
    db.references.mockResolvedValueOnce(1);
    await processFileDeletionJobs();
    expect(googleDriveService.deleteStoredFile).not.toHaveBeenCalled();
    expect(db.fileDeletionJob.deleteMany).toHaveBeenCalled();
  });
  it("retains failed jobs for retry", async () => {
    db.fileDeletionJob.findMany.mockResolvedValue([
      {
        id: "job",
        fileId: "file",
        provider: "SUPABASE",
        storagePath: "supabase://manuscripts/fixture.pdf",
        attempts: 1,
      },
    ]);
    vi.mocked(supabaseStorageService.deleteStoredFile).mockResolvedValue(false);
    await processFileDeletionJobs();
    expect(db.fileDeletionJob.deleteMany).not.toHaveBeenCalled();
    expect(db.fileDeletionJob.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastError: expect.any(String),
          nextAttemptAt: expect.any(Date),
        }),
      }),
    );
  });
  it("does not process a job leased by another API instance", async () => {
    db.fileDeletionJob.findMany.mockResolvedValue([
      { id: "job", fileId: "file", attempts: 0 },
    ]);
    db.fileDeletionJob.updateMany.mockResolvedValue({ count: 0 });
    await processFileDeletionJobs();
    expect(googleDriveService.deleteStoredFile).not.toHaveBeenCalled();
    expect(db.fileDeletionJob.deleteMany).not.toHaveBeenCalled();
  });
});
