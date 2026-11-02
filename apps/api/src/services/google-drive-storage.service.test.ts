import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { google } from "googleapis";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  aggregate: vi.fn(),
  about: vi.fn(),
  folder: vi.fn(),
  audit: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    storageIntegration: {
      findUnique: mocks.findUnique,
      updateMany: mocks.updateMany,
      update: mocks.update,
      upsert: mocks.upsert,
    },
    documentVersion: { aggregate: mocks.aggregate },
    auditLog: { create: mocks.audit },
  },
}));
import { googleDriveService } from "./google-drive.service.js";
import { emptyQuota } from "./drive-storage.js";

let row: any;
beforeEach(() => {
  vi.clearAllMocks();
  row = {
    ...emptyQuota,
    id: "integration",
    encryptedRefreshToken: "token-1",
    rootFolderId: "root",
    status: "HEALTHY",
  };
  mocks.findUnique.mockImplementation(async () => ({ ...row }));
  mocks.aggregate.mockResolvedValue({
    _count: { _all: 3 },
    _sum: { fileSize: 2048n },
  });
  mocks.updateMany.mockImplementation(async ({ where, data }) => {
    if (where.encryptedRefreshToken !== row.encryptedRefreshToken)
      return { count: 0 };
    if (
      where.OR &&
      row.quotaAttemptedAt &&
      row.quotaAttemptedAt >= where.OR[1].quotaAttemptedAt.lt
    )
      return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  });
  mocks.update.mockImplementation(async ({ data }) => Object.assign(row, data));
  mocks.upsert.mockImplementation(async ({ update }) =>
    Object.assign(row, update),
  );
  mocks.about.mockResolvedValue({
    data: {
      storageQuota: { limit: "1000", usage: "600", usageInDrive: "500" },
    },
  });
  vi.spyOn(googleDriveService as any, "connectedClient").mockImplementation(
    async () => ({
      integration: { ...row },
      drive: { about: { get: mocks.about }, files: { get: mocks.folder } },
    }),
  );
});
afterEach(() => vi.restoreAllMocks());

describe("saved Drive storage", () => {
  it("persists quota and returns the same figures on subsequent status reads", async () => {
    const result = await googleDriveService.refreshStorage();
    expect(result.quota).toMatchObject({
      limit: "1000",
      usage: "600",
      error: null,
    });
    expect(result.quota?.checkedAt).toBeInstanceOf(Date);
    expect((await googleDriveService.getStatus()).quota).toEqual(result.quota);
    expect(result.managedStorage).toEqual({ fileCount: 3, bytes: 2048 });
    expect(() => JSON.stringify(result)).not.toThrow();
  });
  it("throttles automatic and manual refreshes independently", async () => {
    await googleDriveService.refreshStorage();
    await googleDriveService.refreshStorage(true);
    expect(mocks.about).toHaveBeenCalledTimes(1);
    row.quotaAttemptedAt = new Date(Date.now() - 61_000);
    await googleDriveService.refreshStorage();
    expect(mocks.about).toHaveBeenCalledTimes(1);
    await googleDriveService.refreshStorage(true);
    expect(mocks.about).toHaveBeenCalledTimes(2);
  });
  it("keeps the last snapshot and timestamp when Google fails", async () => {
    await googleDriveService.refreshStorage();
    const checkedAt = row.quotaCheckedAt;
    row.quotaAttemptedAt = new Date(0);
    mocks.about.mockRejectedValue(new Error("secret provider details"));
    const result = await googleDriveService.refreshStorage(true);
    expect(result.quota).toMatchObject({ usage: "600", checkedAt });
    expect(result.quota?.error).toContain("refresh failed");
    expect(result.quota?.error).not.toContain("secret");
  });
  it("retains a successful quota read when the folder check fails", async () => {
    mocks.folder.mockRejectedValue(
      Object.assign(new Error("Folder unavailable"), { code: 404 }),
    );
    const result = await googleDriveService.healthCheck();
    expect(result.quota).toMatchObject({ usage: "600", error: null });
    expect(result.status).not.toBe("HEALTHY");
  });
  it("keeps the snapshot but marks it outdated when the health quota request fails", async () => {
    await googleDriveService.refreshStorage();
    const checkedAt = row.quotaCheckedAt;
    mocks.about.mockRejectedValue(new Error("Unavailable"));
    const result = await googleDriveService.healthCheck();
    expect(result.quota).toMatchObject({ usage: "600", checkedAt });
    expect(result.quota?.error).toContain("refresh failed");
  });
  it("stores unknown capacity without discarding valid usage", async () => {
    mocks.about.mockResolvedValue({ data: { storageQuota: { usage: "0" } } });
    expect((await googleDriveService.refreshStorage()).quota).toMatchObject({
      usage: "0",
      limit: null,
      error: null,
    });
  });
  it("keeps previous figures when Google omits usage", async () => {
    await googleDriveService.refreshStorage();
    row.quotaAttemptedAt = new Date(0);
    mocks.about.mockResolvedValue({ data: {} });
    const result = await googleDriveService.refreshStorage(true);
    expect(result.quota?.usage).toBe("600");
    expect(result.quota?.error).toContain("did not report");
  });
  it("replaces the previous account snapshot on authorization", async () => {
    await googleDriveService.refreshStorage();
    vi.spyOn(
      googleDriveService as any,
      "verifyAuthorizationState",
    ).mockReturnValue({ userId: "admin" });
    vi.spyOn(googleDriveService as any, "oauthClient").mockReturnValue({
      getToken: async () => ({
        tokens: { refresh_token: "new-refresh-token" },
      }),
      setCredentials: vi.fn(),
    });
    vi.spyOn(googleDriveService as any, "ensureRootFolder").mockResolvedValue({
      id: "root-2",
    });
    vi.spyOn(google, "drive").mockReturnValue({
      about: { get: mocks.about },
    } as any);
    mocks.about.mockResolvedValue({
      data: {
        storageQuota: { usage: "25" },
        user: { emailAddress: "new@example.edu" },
      },
    });
    await googleDriveService.completeAuthorization("code", "state");
    const result = await googleDriveService.getStatus();
    expect(result.quota).toMatchObject({
      usage: "25",
      limit: null,
      error: null,
    });
    expect(result.account?.email).toBe("new@example.edu");
    expect(mocks.upsert.mock.calls[0][0].update).toMatchObject(emptyQuota);
  });
  it("does not save an in-flight result onto a different account", async () => {
    mocks.about.mockImplementation(async () => {
      row.encryptedRefreshToken = "token-2";
      Object.assign(row, emptyQuota);
      return { data: { storageQuota: { usage: "999" } } };
    });
    const result = await googleDriveService.refreshStorage();
    expect(result.quota?.usage).toBeNull();
  });
  it("clears quota on disconnect and refuses refresh without an admin connection", async () => {
    await googleDriveService.refreshStorage();
    const disconnected = await googleDriveService.disconnect("admin");
    expect(disconnected.quota).toBeNull();
    expect(row.quotaCheckedAt).toBeNull();
    vi.mocked((googleDriveService as any).connectedClient).mockResolvedValue(
      null,
    );
    await expect(googleDriveService.refreshStorage()).rejects.toThrow(
      "not connected",
    );
  });
});
