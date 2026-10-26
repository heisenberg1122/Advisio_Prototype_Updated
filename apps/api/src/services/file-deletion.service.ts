import { Prisma, prisma } from "../lib/prisma.js";
import { googleDriveService } from "./google-drive.service.js";
import { localStorageService } from "./local-storage.service.js";
import { supabaseStorageService } from "./supabase-storage.service.js";
import { storedFileFields } from "./user-deletion-plan.js";

type FileDelegate = {
  count(args: { where: Record<string, unknown> }): Promise<number>;
};

// A file can be reused by another submission. Remove its bytes only after the
// last live reference has gone; the account's own database records are still deleted.
export async function hasStoredFileReference(
  fileId: string,
  storagePath?: string | null,
): Promise<boolean> {
  const nativeId =
    storagePath?.match(/(?:^|[\\/])((?:local-)?[0-9a-f-]{36})-/i)?.[1] ||
    fileId;
  const models = new Map(
    Prisma.dmmf.datamodel.models.map((model) => [model.name, model]),
  );
  for (const [name, fields] of Object.entries(storedFileFields)) {
    const model = models.get(name)!;
    const filters = fields
      .filter((field) => model.fields.some((entry) => entry.name === field))
      .map((field) => ({
        [field]:
          field === "storagePath"
            ? storagePath || { contains: fileId }
            : nativeId,
      }));
    const client = prisma as unknown as Record<string, FileDelegate>;
    if (
      await client[name[0].toLowerCase() + name.slice(1)].count({
        where: { OR: filters },
      })
    )
      return true;
  }
  return false;
}

let running = false;
export async function processFileDeletionJobs(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const jobs = await prisma.fileDeletionJob.findMany({
      where: { nextAttemptAt: { lte: new Date() } },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    for (const job of jobs) {
      // An atomic lease also prevents multiple API instances taking the same job.
      const claim = await prisma.fileDeletionJob.updateMany({
        where: { id: job.id, nextAttemptAt: { lte: new Date() } },
        data: {
          nextAttemptAt: new Date(Date.now() + 10 * 60_000),
          attempts: { increment: 1 },
        },
      });
      if (!claim.count) continue;
      try {
        if (!(await hasStoredFileReference(job.fileId, job.storagePath))) {
          const removed =
            job.provider === "LOCAL" && job.storagePath
              ? await localStorageService.deleteStoredFile(job.storagePath)
              : job.provider === "SUPABASE" && job.storagePath
                ? await supabaseStorageService.deleteStoredFile(job.storagePath)
                : await googleDriveService.deleteStoredFile(job.fileId);
          // Local files that have already gone are a completed, idempotent cleanup.
          if (!removed && !job.fileId.startsWith("gdrive-"))
            throw new Error(
              "Storage is not connected; file cleanup will retry.",
            );
        }
        await prisma.fileDeletionJob.deleteMany({ where: { id: job.id } });
      } catch (error) {
        const code =
          (error as { code?: unknown; response?: { status?: number } }).response
            ?.status || (error as { code?: unknown }).code;
        if (code === 404 || code === 410 || code === "404" || code === "410") {
          await prisma.fileDeletionJob.deleteMany({ where: { id: job.id } });
        } else {
          await prisma.fileDeletionJob.updateMany({
            where: { id: job.id },
            data: {
              lastError:
                "Managed file could not be removed. Check storage connectivity and permissions.",
              nextAttemptAt: new Date(
                Date.now() +
                  60_000 * Math.min(60, 2 ** Math.min(job.attempts, 6)),
              ),
            },
          });
          console.warn("[FileDeletion] Stored file cleanup pending", job.id);
        }
      }
    }
  } finally {
    running = false;
  }
}

export function startFileDeletionWorker() {
  const run = () => {
    void processFileDeletionJobs().catch(() =>
      console.warn("[FileDeletion] Cleanup queue unavailable; will retry."),
    );
  };
  run();
  const timer = setInterval(run, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
