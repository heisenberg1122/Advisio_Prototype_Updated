import {
  googleDriveService,
  type DriveUploadOptions,
} from "./google-drive.service.js";
import { supabaseStorageService } from "./supabase-storage.service.js";

export async function storeArtifact(
  options: DriveUploadOptions,
  researchId: string,
) {
  const provider = (
    process.env.STORAGE_PROVIDER || "GOOGLE_DRIVE"
  ).toUpperCase();
  const stored =
    provider === "SUPABASE"
      ? await supabaseStorageService.uploadFile({
          fileName: options.fileName,
          mimeType: options.mimeType,
          buffer: options.buffer,
          folder: researchId,
        })
      : provider === "GOOGLE_DRIVE"
        ? await googleDriveService.uploadFile(options)
        : null;
  if (!stored)
    throw new Error(
      `The configured storage provider (${provider}) is unavailable.`,
    );
  return {
    ...stored,
    provider,
    googleDriveFileId: provider === "GOOGLE_DRIVE" ? stored.fileId : null,
  };
}

export async function deleteArtifact(stored: {
  provider: string;
  fileId: string;
  storagePath: string;
}) {
  return stored.provider === "SUPABASE"
    ? supabaseStorageService.deleteStoredFile(stored.storagePath)
    : googleDriveService.deleteStoredFile(stored.fileId);
}
