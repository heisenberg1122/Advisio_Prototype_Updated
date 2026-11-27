import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ token: "token-a" }));
vi.mock("./offline/cache", () => ({
  currentOfflineSession: vi.fn(),
  cachedResponse: vi.fn(),
  cachedFile: vi.fn(),
  saveResponse: vi.fn(),
  evictResponse: vi.fn(),
  offlineResponsePath: (url: string) =>
    new URL(url, "https://api.example.test").pathname,
  OFFLINE_SAVE_ERROR: "save-error",
  SESSION_REJECTED: "session-rejected",
}));
vi.mock("./offline/store", () => ({
  clearOfflineStorage: vi.fn(),
  listOffline: vi.fn(),
  removeOffline: vi.fn(),
}));

beforeEach(() => {
  identity.token = "token-a";
  vi.stubEnv("VITE_API_URL", "https://api.example.test");
  vi.stubGlobal("window", {
    location: {
      pathname: "/student/tasks",
      origin: "https://app.example.test",
    },
    dispatchEvent: vi.fn(),
  });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (key === "advisio_token" ? identity.token : null),
  });
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function setup() {
  const cache = await import("./offline/cache");
  vi.mocked(cache.currentOfflineSession).mockResolvedValue({
    token: "token-a",
    scope: "account-a",
  } as any);
  vi.mocked(cache.cachedResponse).mockResolvedValue({
    projects: [{ id: "saved-project" }],
  });
  vi.mocked(cache.saveResponse).mockClear();
  vi.mocked(cache.evictResponse).mockClear();
  vi.mocked(cache.cachedResponse).mockClear();
  const client = (await import("./api-client")).apiClient;
  return { cache, client };
}

describe("offline API reads", () => {
  it("serves a saved GET without sending a network request while offline", async () => {
    const { client } = await setup();
    vi.stubGlobal("navigator", { onLine: false });
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    expect(await client.get("/api/research")).toEqual({
      projects: [{ id: "saved-project" }],
    });
    expect(network).not.toHaveBeenCalled();
  });

  it("does not use a cache identity that changed during request setup", async () => {
    const { cache, client } = await setup();
    vi.mocked(cache.currentOfflineSession).mockResolvedValue({
      token: "token-b",
      scope: "account-b",
    } as any);
    vi.stubGlobal("navigator", { onLine: false });
    await expect(client.get("/api/research")).rejects.toMatchObject({
      statusCode: 0,
    });
    expect(cache.cachedResponse).not.toHaveBeenCalled();
  });

  it("falls back to saved information only for a transport failure", async () => {
    const { client } = await setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    expect(await client.get("/api/research")).toEqual({
      projects: [{ id: "saved-project" }],
    });
  });

  it("never converts an authoritative access denial into a cached success", async () => {
    const { cache, client } = await setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: "Project access removed" }, { status: 403 }),
        ),
    );
    await expect(client.get("/api/research")).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(cache.evictResponse).toHaveBeenCalled();
    expect(cache.cachedResponse).not.toHaveBeenCalled();
  });

  it("does not treat an aborted request as an offline read", async () => {
    const { cache, client } = await setup();
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Aborted request")),
    );
    await expect(
      client.get("/api/research", { signal: controller.signal }),
    ).rejects.toThrow("Aborted request");
    expect(cache.cachedResponse).not.toHaveBeenCalled();
  });

  it("does not persist a prior account response after the sign-in token changes", async () => {
    const { cache, client } = await setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        identity.token = "token-b";
        return Response.json({ projects: [{ id: "account-a-project" }] });
      }),
    );
    await client.get("/api/research");
    expect(cache.saveResponse).not.toHaveBeenCalled();
  });
});
