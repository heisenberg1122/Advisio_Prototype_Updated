import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

type LocalUpload = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  folder?: string;
};

function uploadRoot() {
  return path.resolve(process.cwd(), "uploads", "local");
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "general";
}

function assertInsideUploadRoot(value: string) {
  const root = uploadRoot();
  const target = path.resolve(value);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error(
      "The local storage path is outside the Advisio upload directory.",
    );
  }
  return target;
}

class LocalStorageService {
  public async uploadFile(options: LocalUpload) {
    if (process.env.STORAGE_PROVIDER !== "LOCAL") {
      throw new Error("Local storage is not enabled for this process.");
    }
    const folder = safeSegment(options.folder || "general");
    const directory = path.join(uploadRoot(), folder);
    await fs.mkdir(directory, { recursive: true });
    const fileId = `local-${crypto.randomUUID()}`;
    const diskName = `${fileId}-${safeSegment(options.fileName)}`;
    const storagePath = assertInsideUploadRoot(path.join(directory, diskName));
    await fs.writeFile(storagePath, options.buffer, { flag: "wx" });
    return {
      fileId,
      fileName: options.fileName,
      mimeType: options.mimeType,
      sizeBytes: options.buffer.length,
      storagePath,
      webViewLink: "",
      webContentLink: "",
    };
  }

  public async readStoredFile(storagePath: string) {
    return fs.readFile(assertInsideUploadRoot(storagePath));
  }

  public async deleteStoredFile(storagePath: string) {
    const target = assertInsideUploadRoot(storagePath);
    await fs.rm(target, { force: true });
    return true;
  }
}

export const localStorageService = new LocalStorageService();
