import { afterEach, describe, expect, it, vi } from "vitest";
import { googleDriveService } from "./google-drive.service.js";
import { localStorageService } from "./local-storage.service.js";
import { storeWorkflowResourceFile } from "./workflow-resource-storage.service.js";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const workflow = { id: "workflow", name: "Research preparation" };
const file = { originalname: "guide.pdf", mimetype: "application/pdf", buffer: Buffer.from("%PDF-guide") };
describe("workflow reference storage", () => {
  it("stores a local guide without invoking a cloud folder or exposing a Drive identifier", async () => {
    vi.stubEnv("STORAGE_PROVIDER", "LOCAL");
    const local = vi.spyOn(localStorageService, "uploadFile").mockResolvedValue({ fileId: "local-guide", fileName: "guide.pdf", mimeType: "application/pdf", sizeBytes: 10, storagePath: "/uploads/local/guide.pdf", webViewLink: "", webContentLink: "" });
    const folder = vi.spyOn(googleDriveService, "ensureFolderPath");
    const upload = vi.spyOn(googleDriveService, "uploadFile");
    expect(await storeWorkflowResourceFile(workflow, file, "Guide")).toMatchObject({ googleDriveFileId: null, storagePath: "/uploads/local/guide.pdf" });
    expect(local).toHaveBeenCalledWith({ folder: "workflow-workflow", fileName: "guide.pdf", mimeType: "application/pdf", buffer: file.buffer });
    expect(folder).not.toHaveBeenCalled(); expect(upload).not.toHaveBeenCalled();
  });
  it("preserves the configured Google Drive folder and file reference", async () => {
    vi.stubEnv("STORAGE_PROVIDER", "GOOGLE_DRIVE");
    vi.spyOn(googleDriveService, "ensureFolderPath").mockResolvedValue("folder");
    const upload = vi.spyOn(googleDriveService, "uploadFile").mockResolvedValue({ fileId: "drive-guide", fileName: "guide.pdf", mimeType: "application/pdf", sizeBytes: 10, storagePath: "drive/path", webViewLink: "", webContentLink: "" });
    expect(await storeWorkflowResourceFile(workflow, file, "Guide")).toMatchObject({ googleDriveFileId: "drive-guide" });
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ folderId: "folder", appProperties: { entityType: "WORKFLOW_RESOURCE", workflowId: "workflow" } }));
  });
});
