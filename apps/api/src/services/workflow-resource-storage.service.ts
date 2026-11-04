import { googleDriveService } from "./google-drive.service.js";
import { localStorageService } from "./local-storage.service.js";

export async function storeWorkflowResourceFile(
  workflow: { id: string; name: string },
  file: { originalname: string; mimetype: string; buffer: Buffer },
  title: string,
) {
  if (process.env.STORAGE_PROVIDER === "LOCAL") {
    const stored = await localStorageService.uploadFile({ folder: `workflow-${workflow.id}`, fileName: file.originalname, mimeType: file.mimetype, buffer: file.buffer });
    return { ...stored, googleDriveFileId: null };
  }
  const folderId = await googleDriveService.ensureFolderPath([
    { name: "02_WORKFLOW_RESOURCES", key: "workflow-resources" },
    { name: workflow.name, key: `workflow:${workflow.id}`, entityType: "WORKFLOW", entityId: workflow.id },
  ]);
  const stored = await googleDriveService.uploadFile({ folderId, fileName: file.originalname, mimeType: file.mimetype, buffer: file.buffer, description: `${title} — ${workflow.name}`, appProperties: { entityType: "WORKFLOW_RESOURCE", workflowId: workflow.id } });
  return { ...stored, googleDriveFileId: stored.fileId };
}
