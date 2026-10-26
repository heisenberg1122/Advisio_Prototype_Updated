import express from "express";
import http from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadTaskSubmission: vi.fn(),
  submitStoredTaskVersion: vi.fn(),
  findUser: vi.fn(),
}));

vi.mock("../lib/prisma.js", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  prisma: { user: { findUnique: mocks.findUser } },
}));
vi.mock("../services/task-submission-upload.service.js", () => ({
  uploadTaskSubmission: mocks.uploadTaskSubmission,
  submitStoredTaskVersion: mocks.submitStoredTaskVersion,
}));

import { generateToken } from "../middleware/auth.js";
import router from "./workflow.routes.js";

describe("task submission JSON responses", () => {
  let server: http.Server;
  let baseUrl: string;
  let token: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/workflows", router);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${port}/api/workflows/tasks/task-a/submissions`;
    token = generateToken("student-a");
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findUser.mockResolvedValue({
      id: "student-a",
      status: "ACTIVE",
      sessionVersion: 0,
      roles: [{ role: { name: "RESEARCHER", permissions: [] } }],
    });
  });

  // Prisma returns BigInt file sizes on both the version and nested documents.
  function savedSubmission(duplicate: boolean) {
    const version = {
      id: "version-a",
      fileName: "manuscript.pdf",
      fileSize: 1024n,
      createdAt: new Date("2026-10-26T00:00:00.000Z"),
    };
    const document = { id: "document-a", versions: [version] };
    return {
      document,
      version,
      submission: {
        id: "submission-a",
        documentVersionId: version.id,
        document,
        attempts: [{ id: "attempt-a", documentVersionId: version.id }],
      },
      duplicate,
    };
  }

  it.each([false, true])(
    "returns the saved upload successfully (duplicate: %s)",
    async (duplicate) => {
      mocks.uploadTaskSubmission.mockResolvedValue(savedSubmission(duplicate));
      const body = new FormData();
      body.append(
        "file",
        new Blob(["%PDF-1.4\n"], { type: "application/pdf" }),
        "manuscript.pdf",
      );
      body.append("researchId", "research-a");
      body.append("idempotencyKey", "request-a");
      body.append("title", "Manuscript");

      const response = await fetch(`${baseUrl}/upload`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body,
      });
      const result = (await response.json()) as any;

      expect(response.status).toBe(duplicate ? 200 : 201);
      expect(result.duplicate).toBe(duplicate);
      expect(result.version.fileSize).toBe(1024);
      expect(result.version.createdAt).toBe("2026-10-26T00:00:00.000Z");
      expect(result.document.versions[0].fileSize).toBe(1024);
      expect(result.submission.document.versions[0].fileSize).toBe(1024);
      expect(result.submission.attempts).toHaveLength(1);
      expect(mocks.uploadTaskSubmission).toHaveBeenCalledOnce();
    },
  );

  it.each([false, true])(
    "returns the saved document submission successfully (duplicate: %s)",
    async (duplicate) => {
      const saved = savedSubmission(duplicate);
      mocks.submitStoredTaskVersion.mockResolvedValue({
        ...saved,
        project: { title: "Research", members: [], workflowInstance: null },
        task: { id: "task-a", title: "Manuscript", stageId: "stage-a" },
        snapshotVersionId: saved.version.id,
      });

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          researchId: "research-a",
          documentId: saved.document.id,
          documentVersionId: saved.version.id,
        }),
      });
      const result = (await response.json()) as any;

      expect(response.status).toBe(duplicate ? 200 : 201);
      expect(result.submission.id).toBe("submission-a");
      expect(result.submission.document.versions[0].fileSize).toBe(1024);
      expect(result.submission.attempts).toHaveLength(1);
      expect(mocks.submitStoredTaskVersion).toHaveBeenCalledOnce();
    },
  );
});
