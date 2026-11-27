// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./store", () => ({
  OFFLINE_ENABLED: "advisio_offline_enabled",
  loadOfflineSession: vi.fn(),
  readOffline: vi.fn(),
  writeOffline: vi.fn(),
  listOffline: vi.fn().mockResolvedValue([]),
  removeOffline: vi.fn(),
}));
import {
  listOffline,
  loadOfflineSession,
  readOffline,
  removeOffline,
  writeOffline,
  type OfflineSession,
} from "./store";
import {
  cachedFile,
  currentOfflineSession,
  evictResponse,
  offlineResponsePath,
  saveResponse,
} from "./cache";
const session = {
  scope: "university:user:college",
  token: "own-token",
  tokenHash: "own-hash",
} as OfflineSession;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.history.replaceState(null, "", "/student/tasks");
  vi.mocked(listOffline).mockResolvedValue([]);
  vi.mocked(readOffline).mockResolvedValue(undefined);
});

describe("researcher response cache boundaries", () => {
  it("allows only known researcher reads and canonicalizes query parameters", () => {
    expect(
      offlineResponsePath(
        "/api/research/project-1/documents",
        "https://api.example.test",
      ),
    ).toBe("/api/research/project-1/documents");
    expect(
      offlineResponsePath(
        "/api/notifications?z=1&inbox=researcher",
        "https://api.example.test",
      ),
    ).toBe("/api/notifications?inbox=researcher&z=1");
    for (const path of [
      "/api/auth/me",
      "/api/users",
      "/api/mail/threads",
      "/api/documents/sign",
      "https://other.example.test/api/research",
    ]) {
      expect(offlineResponsePath(path, "https://api.example.test")).toBeNull();
    }
  });

  it("never uses a saved researcher session from a faculty portal or without opt-in", async () => {
    localStorage.setItem("advisio_token", "own-token");
    expect(await currentOfflineSession()).toBeNull();
    localStorage.setItem("advisio_offline_enabled", "1");
    window.history.replaceState(null, "", "/professor/dashboard");
    expect(await currentOfflineSession()).toBeNull();
    expect(loadOfflineSession).not.toHaveBeenCalled();
    window.history.replaceState(null, "", "/student/documents");
    vi.mocked(loadOfflineSession).mockResolvedValue(session);
    expect(await currentOfflineSession()).toBe(session);
    expect(loadOfflineSession).toHaveBeenCalledWith("own-token");
  });

  it("binds task eligibility reads to an authorized project before caching them", async () => {
    vi.mocked(readOffline).mockResolvedValue({
      value: { data: { projects: [{ id: "project-1" }] } },
    } as any);
    await saveResponse(
      session,
      "/api/workflows/tasks/task-1/submission-options?researchId=other-project",
      { availability: { canSubmit: true } },
    );
    expect(writeOffline).not.toHaveBeenCalled();
    await saveResponse(
      session,
      "/api/workflows/tasks/task-1/submission-options?researchId=project-1",
      { availability: { canSubmit: true } },
    );
    expect(writeOffline).toHaveBeenCalledWith(
      session,
      expect.any(String),
      expect.objectContaining({ projectId: "project-1" }),
    );
  });

  it("removes revoked project reads and files while preserving other projects and local drafts", async () => {
    vi.mocked(listOffline).mockImplementation(async (_session, prefix) =>
      prefix === "response:"
        ? [
            {
              key: "response:/api/research/project-1/documents",
              value: { projectId: "project-1" },
            },
            {
              key: "response:/api/research/project-2/documents",
              value: { projectId: "project-2" },
            },
          ]
        : ([
            { key: "file:document:v1", value: { projectId: "project-1" } },
          ] as any),
    );
    await saveResponse(session, "/api/research", {
      projects: [{ id: "project-2" }],
    });
    expect(removeOffline).toHaveBeenCalledWith(
      session,
      "response:/api/research/project-1/documents",
    );
    expect(removeOffline).toHaveBeenCalledWith(session, "file:document:v1");
    expect(removeOffline).not.toHaveBeenCalledWith(
      session,
      "response:/api/research/project-2/documents",
    );
    expect(
      vi
        .mocked(removeOffline)
        .mock.calls.every(([, key]) => !key.startsWith("draft:")),
    ).toBe(true);
  });

  it("evicts a denied project response instead of retaining a stale success", async () => {
    vi.mocked(listOffline).mockImplementation(async (_session, prefix) =>
      prefix === "response:"
        ? [
            {
              key: "response:/api/research/project-1/manuscript-workflow",
              value: { projectId: "project-1" },
            },
          ]
        : ([
            { key: "file:document:v1", value: { projectId: "project-1" } },
          ] as any),
    );
    await evictResponse(session, "/api/research/project-1/documents");
    expect(removeOffline).toHaveBeenCalledWith(
      session,
      "response:/api/research/project-1/documents",
    );
    expect(removeOffline).toHaveBeenCalledWith(
      session,
      "response:/api/research/project-1/manuscript-workflow",
    );
    expect(removeOffline).toHaveBeenCalledWith(session, "file:document:v1");
  });

  it("never labels a replaced guide as the current saved version", async () => {
    vi.mocked(listOffline).mockResolvedValue([
      { key: "file:resource:guide-1:1", value: { workflowId: "workflow-1" } },
    ] as any);
    await saveResponse(session, "/api/workflows/workflow-1/resources", {
      resources: [{ id: "guide-1", version: 2 }],
    });
    expect(removeOffline).toHaveBeenCalledWith(
      session,
      "file:resource:guide-1:1",
    );
  });

  it("reads only the selected document version from the scoped file store", async () => {
    const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    vi.mocked(listOffline).mockResolvedValue([
      { key: "file:document:v1", value: { blob } },
    ] as any);
    expect(
      await cachedFile(
        session,
        "/api/documents/versions/v1/content?download=1",
        "https://api.example.test",
      ),
    ).toBe(blob);
    expect(
      await cachedFile(
        session,
        "/api/documents/versions/v2/content",
        "https://api.example.test",
      ),
    ).toBeNull();
    expect(
      await cachedFile(
        session,
        "https://other.example.test/api/documents/versions/v1/content",
        "https://api.example.test",
      ),
    ).toBeNull();
  });
});
