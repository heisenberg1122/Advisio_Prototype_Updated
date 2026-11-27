import { beforeEach, describe, expect, it, vi } from "vitest";
import { offlineExpiry } from "./store";

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: vi.fn() },
  ApiError: class extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
    }
  },
}));
vi.mock("./store", async (original) => ({
  ...(await original<object>()),
  listOffline: vi.fn().mockResolvedValue([]),
  removeOffline: vi.fn(),
  writeOffline: vi.fn(),
}));

import { apiClient, ApiError } from "@/lib/api-client";
import {
  listOffline,
  removeOffline,
  writeOffline,
  type OfflineSession,
} from "./store";
import {
  refreshOfflineSnapshot,
  summarizeDocuments,
  summarizeRequirements,
  taskDraftKey,
} from "./snapshot";

const workflow = {
  id: "workflow-1",
  name: "Research",
  stages: [
    {
      id: "stage-1",
      name: "Chapter One",
      sequence: 1,
      targetCompletionDate: "2026-12-01",
      tasks: [
        {
          id: "task-1",
          title: "Introduction",
          instructions: "Explain the problem",
          allowedFileTypes: "PDF",
        },
      ],
    },
  ],
};
const project = {
  id: "project-1",
  title: "Study",
  workflowInstance: { workflowId: workflow.id, workflow },
  taskSubmissions: [
    {
      taskId: "task-1",
      status: "REVISION_REQUIRED",
      reviewNote: "Clarify objectives",
    },
  ],
};
const session = { scope: "university:user:college" } as OfflineSession;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listOffline).mockResolvedValue([]);
});

describe("saved researcher information", () => {
  it("preserves the actual deadline, instructions, and released faculty feedback", () => {
    const [task] = summarizeRequirements(project, workflow);
    expect(task).toMatchObject({
      title: "Introduction",
      instructions: "Explain the problem",
      fileTypes: "PDF",
      status: "REVISION_REQUIRED",
      feedback: ["Clarify objectives"],
    });
    expect(task.deadline).toContain("Dec 1, 2026");
    expect(task.id).toBe(taskDraftKey(project.id, workflow.id, "task-1"));
  });

  it("does not keep requirements from a revoked project workflow", () => {
    expect(
      summarizeRequirements(
        { ...project, workflowAccessRemoved: true },
        workflow,
      ),
    ).toEqual([]);
  });

  it("keeps file versions distinct and excludes unpublished review drafts", () => {
    const files = summarizeDocuments(
      [
        {
          title: "Manuscript",
          versions: [
            {
              id: "v1",
              versionNumber: 1,
              fileName: "one.pdf",
              webViewLink: "/api/documents/versions/v1/content",
              reviews: [
                { status: "DRAFT", overallComment: "Private draft" },
                { status: "SUBMITTED", overallComment: "Released feedback" },
              ],
            },
            { id: "v2", versionNumber: 2, fileName: "two.pdf", reviews: [] },
          ],
        },
      ],
      "Study",
    );
    expect(files.map((file) => file.id)).toEqual([
      "document:v1",
      "document:v2",
    ]);
    expect(files[0].feedback).toEqual(["Released feedback"]);
  });

  it("prunes downloaded files when project access is removed", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === "/api/research") return { projects: [] };
      if (url === "/api/workflows/enrollments/me") return { enrollments: [] };
      throw new Error(`Unexpected ${url}`);
    });
    vi.mocked(listOffline).mockResolvedValue([
      { key: "file:document:v1", value: {} },
    ]);
    expect(await refreshOfflineSnapshot(session)).toMatchObject({
      requirements: [],
      files: [],
    });
    expect(removeOffline).toHaveBeenCalledWith(session, "file:document:v1");
    expect(writeOffline).toHaveBeenCalledWith(
      session,
      "snapshot",
      expect.any(Object),
    );
  });

  it("does not turn failed authentication into stale success", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(
      new ApiError("Session revoked", 401),
    );
    await expect(refreshOfflineSnapshot(session)).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(writeOffline).not.toHaveBeenCalled();
  });
});

describe("offline identity expiry", () => {
  const token = (exp: number) =>
    `header.${btoa(JSON.stringify({ exp }))}.signature`;
  it("never extends access past token expiry or seven days", () => {
    const now = Date.now();
    expect(
      offlineExpiry(token(Math.floor(now / 1000) + 60), now),
    ).toBeLessThanOrEqual(now + 60_000);
    expect(offlineExpiry(token(Math.floor(now / 1000) + 30 * 86400), now)).toBe(
      now + 7 * 86400_000,
    );
  });
  it.each(["__evaluation__", "malformed", "header.e30.signature"])(
    "does not enable offline identity for %s",
    (value) => {
      expect(offlineExpiry(value)).toBe(0);
    },
  );
});
