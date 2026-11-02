import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: undefined as any,
  data: undefined as any,
  get: vi.fn(),
  post: vi.fn(),
  setQueryData: vi.fn(),
  mutations: [] as any[],
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (query: any) => {
    mocks.query = query;
    return { data: mocks.data };
  },
  useQueryClient: () => ({ setQueryData: mocks.setQueryData }),
  useMutation: (options: any) => {
    mocks.mutations.push(options);
    return { mutate: vi.fn(), isPending: false };
  },
}));
vi.mock("@/lib/api-client", () => ({
  apiClient: { get: mocks.get, post: mocks.post },
}));
vi.mock("@/components/ui/Skeleton", () => ({ Skeleton: () => null }));
import { GoogleDriveIntegration } from "./GoogleDriveIntegration";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutations = [];
  mocks.data = {
    connected: true,
    oauthConfigured: true,
    encryptionConfigured: true,
    status: "HEALTHY",
    account: { email: "admin@example.edu" },
    rootFolder: { name: "Advisio" },
    managedStorage: { bytes: 1024, fileCount: 2 },
    lastCheckedAt: null,
    lastHealthyAt: null,
    quota: {
      limit: "1000",
      usage: "600",
      usageInDrive: "500",
      checkedAt: "2026-01-01T00:00:00Z",
      attemptedAt: "2026-01-01T00:00:00Z",
      error: null,
    },
  };
  mocks.get.mockImplementation(async () => mocks.data);
});

describe("Google Drive storage integration", () => {
  it.each([true, false])(
    "shows separate storage metrics in compact=%s",
    (compact) => {
      const html = renderToStaticMarkup(
        <GoogleDriveIntegration compact={compact} />,
      );
      for (const label of [
        "600 B / 1000 B",
        "Remaining storage",
        "Advisio-managed usage",
        "Storage last checked:",
      ])
        expect(html).toContain(label);
    },
  );
  it("automatically refreshes an old snapshot", async () => {
    renderToStaticMarkup(<GoogleDriveIntegration compact />);
    mocks.post.mockResolvedValue({
      ...mocks.data,
      quota: { ...mocks.data.quota, usage: "700" },
    });
    expect((await mocks.query.queryFn()).quota.usage).toBe("700");
    expect(mocks.post).toHaveBeenCalledWith(
      "/api/integrations/google-drive/storage-refresh",
      { force: false },
    );
  });
  it("uses a recent snapshot without another Google refresh", async () => {
    mocks.data.quota.attemptedAt = new Date().toISOString();
    renderToStaticMarkup(<GoogleDriveIntegration compact />);
    expect((await mocks.query.queryFn()).quota.usage).toBe("600");
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it("preserves existing figures if automatic refresh fails", async () => {
    renderToStaticMarkup(<GoogleDriveIntegration compact />);
    mocks.post.mockRejectedValue(new Error("Network unavailable"));
    const result = await mocks.query.queryFn();
    expect(result.quota.usage).toBe("600");
    expect(result.quota.error).toContain("refresh failed");
  });
  it("does not request quota for a disconnected integration", async () => {
    mocks.data.connected = false;
    renderToStaticMarkup(<GoogleDriveIntegration compact />);
    await mocks.query.queryFn();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
