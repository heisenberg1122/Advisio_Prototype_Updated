import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  transaction: vi.fn(),
  lock: vi.fn(),
  folder: vi.fn(),
  stage: vi.fn(),
  saveName: vi.fn(),
  rename: vi.fn(),
  create: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: { $transaction: state.transaction },
}));
import { googleDriveService } from "./google-drive.service.js";

const mapping = () => ({
  id: "mapping",
  provider: "GOOGLE_DRIVE",
  externalFolderId: "drive-folder",
  parentFolderId: "project-folder",
  entityType: "WORKFLOW_STAGE",
  entityId: "stage",
  pathKey: "research:project/stage:stage",
  name: "02-Topic-Proposal",
});
beforeEach(() => {
  vi.resetAllMocks();
  state.lock.mockResolvedValue([]);
  state.folder.mockResolvedValue(mapping());
  state.stage.mockResolvedValue({ name: "Topic Proposal" });
  state.saveName.mockResolvedValue({});
  state.rename.mockResolvedValue({ data: { id: "drive-folder" } });
  state.transaction.mockImplementation(async (operation) =>
    operation({
      $executeRaw: state.lock,
      storageFolder: { findFirst: state.folder, update: state.saveName },
      workflowStage: { findUnique: state.stage },
    }),
  );
  vi.spyOn(googleDriveService as any, "connectedClient").mockResolvedValue({
    drive: { files: { update: state.rename, create: state.create } },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("milestone folder label synchronization", () => {
  it("renames the mapped folder in place without moving files or changing IDs", async () => {
    expect(
      await googleDriveService.synchronizeMilestoneFolderName(
        "drive-folder",
        "stage",
      ),
    ).toBe(true);
    expect(state.folder).toHaveBeenCalledWith({
      where: {
        provider: "GOOGLE_DRIVE",
        externalFolderId: "drive-folder",
        entityType: "WORKFLOW_STAGE",
        entityId: "stage",
      },
    });
    expect(state.rename).toHaveBeenCalledWith(
      {
        fileId: "drive-folder",
        requestBody: { name: "Topic-Proposal" },
        supportsAllDrives: true,
        fields: "id",
      },
      { timeout: 20_000 },
    );
    expect(state.saveName).toHaveBeenCalledWith({
      where: { id: "mapping" },
      data: { name: "Topic-Proposal" },
    });
    expect(state.create).not.toHaveBeenCalled();
  });

  it("uses the latest committed milestone name after acquiring the folder lock", async () => {
    state.stage.mockResolvedValue({ name: "Final / Oral Defense" });
    await googleDriveService.synchronizeMilestoneFolderName(
      "drive-folder",
      "stage",
    );
    expect(state.lock.mock.invocationCallOrder[0]).toBeLessThan(
      state.stage.mock.invocationCallOrder[0],
    );
    expect(state.rename.mock.calls[0][0].requestBody).toEqual({
      name: "Final-Oral-Defense",
    });
  });

  it("does not contact Drive when the folder label already matches", async () => {
    state.folder.mockResolvedValue({ ...mapping(), name: "Topic-Proposal" });
    expect(
      await googleDriveService.synchronizeMilestoneFolderName(
        "drive-folder",
        "stage",
      ),
    ).toBe(true);
    expect(state.rename).not.toHaveBeenCalled();
    expect((googleDriveService as any).connectedClient).not.toHaveBeenCalled();
    expect(state.saveName).not.toHaveBeenCalled();
  });

  it("leaves failed renames pending so the same folder can be retried", async () => {
    state.rename.mockRejectedValueOnce(new Error("Drive unavailable"));
    await expect(
      googleDriveService.synchronizeMilestoneFolderName(
        "drive-folder",
        "stage",
      ),
    ).rejects.toThrow("Drive unavailable");
    expect(state.saveName).not.toHaveBeenCalled();
    expect(
      await googleDriveService.synchronizeMilestoneFolderName(
        "drive-folder",
        "stage",
      ),
    ).toBe(true);
    expect(state.rename).toHaveBeenCalledTimes(2);
    expect(state.saveName).toHaveBeenCalledOnce();
  });

  it("refuses unmapped folders and folders not belonging to the milestone", async () => {
    state.folder.mockResolvedValue(null);
    expect(
      await googleDriveService.synchronizeMilestoneFolderName(
        "unrelated-folder",
        "stage",
      ),
    ).toBe(false);
    expect(state.rename).not.toHaveBeenCalled();
    expect(state.saveName).not.toHaveBeenCalled();
  });

  it("updates explicit local fallback metadata without making a Drive request", async () => {
    vi.stubEnv("ALLOW_LOCAL_STORAGE_FALLBACK", "true");
    state.folder.mockResolvedValue({
      ...mapping(),
      externalFolderId: "local-folder-example",
    });
    expect(
      await googleDriveService.synchronizeMilestoneFolderName(
        "local-folder-example",
        "stage",
      ),
    ).toBe(true);
    expect((googleDriveService as any).connectedClient).not.toHaveBeenCalled();
    expect(state.saveName).toHaveBeenCalledOnce();
  });

  it("never sends a local fallback ID to a connected Drive account", async () => {
    vi.stubEnv("ALLOW_LOCAL_STORAGE_FALLBACK", "false");
    state.folder.mockResolvedValue({
      ...mapping(),
      externalFolderId: "local-folder-example",
    });
    expect(
      await googleDriveService.synchronizeMilestoneFolderName(
        "local-folder-example",
        "stage",
      ),
    ).toBe(false);
    expect(state.rename).not.toHaveBeenCalled();
    expect(state.saveName).not.toHaveBeenCalled();
  });
});
