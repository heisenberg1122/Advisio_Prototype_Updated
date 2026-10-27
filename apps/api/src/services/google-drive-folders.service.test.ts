import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  mappings: new Map<string, { externalFolderId: string; parent: string }>(),
  query: vi.fn(),
  execute: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: { $queryRaw: state.query, $executeRaw: state.execute },
}));
import { googleDriveService } from "./google-drive.service.js";

const segment = {
  key: "stage:new",
  name: "03-Chapter-1",
  entityType: "WORKFLOW_STAGE",
  entityId: "new",
};
beforeEach(() => {
  vi.clearAllMocks();
  state.mappings.clear();
  state.query.mockImplementation(async (_sql, _provider, key) => {
    const row = state.mappings.get(key);
    return row ? [{ externalFolderId: row.externalFolderId }] : [];
  });
  state.execute.mockImplementation(async (sql, _provider, key, id, parent) => {
    const conflict =
      state.mappings.has(key) ||
      [...state.mappings.values()].some((row) => row.externalFolderId === id);
    if (conflict) {
      if (!sql.join("").includes("ON CONFLICT DO NOTHING"))
        throw new Error("23505 duplicate folder mapping");
      return 0;
    }
    state.mappings.set(key, { externalFolderId: id, parent });
    return 1;
  });
  state.list.mockResolvedValue({ data: { files: [] } });
  state.create.mockResolvedValue({
    data: { id: "fresh-folder", name: segment.name },
  });
  vi.spyOn(googleDriveService as any, "connectedClient").mockResolvedValue({
    integration: { rootFolderId: "root" },
    drive: { files: { list: state.list, create: state.create } },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Google Drive folder identity reservation", () => {
  it("uses the authoritative mapping without another Drive request", async () => {
    state.mappings.set(segment.key, {
      externalFolderId: "existing",
      parent: "root",
    });
    expect(await googleDriveService.ensureFolderPath([segment])).toBe(
      "existing",
    );
    expect(state.list).not.toHaveBeenCalled();
    expect(state.execute).not.toHaveBeenCalled();
  });

  it("does not rebind a same-name folder belonging to a retired milestone", async () => {
    state.mappings.set("stage:old", {
      externalFolderId: "old-folder",
      parent: "root",
    });
    state.list.mockResolvedValue({
      data: { files: [{ id: "old-folder", name: segment.name }] },
    });
    expect(await googleDriveService.ensureFolderPath([segment])).toBe(
      "fresh-folder",
    );
    expect(state.mappings.get("stage:old")?.externalFolderId).toBe(
      "old-folder",
    );
    expect(state.mappings.get(segment.key)?.externalFolderId).toBe(
      "fresh-folder",
    );
    expect(state.create).toHaveBeenCalledOnce();
  });

  it("checks Drive entity metadata even when a stale folder has no database mapping", async () => {
    state.list.mockResolvedValue({
      data: {
        files: [
          {
            id: "old-folder",
            appProperties: {
              advisioEntityId: "old",
              advisioEntityType: "WORKFLOW_STAGE",
            },
          },
        ],
      },
    });
    expect(await googleDriveService.ensureFolderPath([segment])).toBe(
      "fresh-folder",
    );
    expect(state.execute).not.toHaveBeenCalledWith(
      expect.anything(),
      "GOOGLE_DRIVE",
      segment.key,
      "old-folder",
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("reuses a second eligible same-name folder instead of creating another", async () => {
    state.mappings.set("stage:old", {
      externalFolderId: "old-folder",
      parent: "root",
    });
    state.list.mockResolvedValue({
      data: { files: [{ id: "old-folder" }, { id: "available-folder" }] },
    });
    expect(await googleDriveService.ensureFolderPath([segment])).toBe(
      "available-folder",
    );
    expect(state.create).not.toHaveBeenCalled();
  });

  it("uses a concurrent path winner as the parent of subsequent folders", async () => {
    state.list
      .mockImplementationOnce(async () => {
        state.mappings.set(segment.key, {
          externalFolderId: "winner",
          parent: "root",
        });
        return { data: { files: [{ id: "candidate" }] } };
      })
      .mockResolvedValue({ data: { files: [{ id: "child" }] } });
    expect(
      await googleDriveService.ensureFolderPath([
        segment,
        { name: "02-Submissions", key: "bucket:submissions:0" },
      ]),
    ).toBe("child");
    expect(state.mappings.get("stage:new/bucket:submissions:0")?.parent).toBe(
      "winner",
    );
    expect(state.mappings.get(segment.key)?.externalFolderId).toBe("winner");
  });

  it("keeps explicit local fallback mappings deterministic and idempotent", async () => {
    vi.stubEnv("ALLOW_LOCAL_STORAGE_FALLBACK", "true");
    (googleDriveService as any).connectedClient.mockResolvedValue(null);
    const folder = await googleDriveService.ensureFolderPath([segment]);
    expect(folder).toMatch(/^local-folder-[a-f0-9]{32}$/);
    expect(await googleDriveService.ensureFolderPath([segment])).toBe(folder);
    expect(state.execute).toHaveBeenCalledOnce();
  });
});
