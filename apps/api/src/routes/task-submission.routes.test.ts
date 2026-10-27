import express from "express";
import http from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadTaskSubmission: vi.fn(),
  submitStoredTaskVersion: vi.fn(),
  findUser: vi.fn(),
  findSubmission: vi.fn(),
  transaction: vi.fn(),
  decide: vi.fn(),
}));

vi.mock("../lib/prisma.js", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  prisma: {
    user: { findUnique: mocks.findUser },
    taskSubmission: { findUnique: mocks.findSubmission },
    $transaction: mocks.transaction,
  },
}));
vi.mock("../services/reviewer-assignment.service.js", () => ({
  reviewerAssignmentService: { decide: mocks.decide },
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

  function prepareReview(assignments = [
    { id: "assignment-a", reviewerId: "professor-a", status: "ACTIVE" },
  ]) {
    mocks.findUser.mockResolvedValue({
      id: "professor-a",
      status: "ACTIVE",
      sessionVersion: 0,
      roles: [{ role: { name: "RESEARCH_COORDINATOR", permissions: [] } }],
    });
    mocks.findSubmission.mockResolvedValue({
      id: "submission-a",
      submittedBy: "student-a",
      researchId: "research-a",
      task: { stage: { id: "stage-a", responsible: { name: "RESEARCH_COORDINATOR" }, workflow: { createdBy: "professor-a" } } },
      research: { collegeId: "college-a", members: [] },
      documentVersion: { id: "version-a", reviewerAssignments: assignments },
    });
    mocks.decide.mockResolvedValue({
      review: { id: "review-a" },
      lifecycleStatus: "APPROVED",
      milestoneProgression: { advanced: true, completed: false, nextStageName: "Defense eligibility" },
    });
  }

  function review(status: string, reviewNote = "Please clarify the methodology.") {
    return fetch(new URL("/api/workflows/tasks/submissions/submission-a/review", baseUrl), {
      method: "PATCH",
      headers: { authorization: `Bearer ${generateToken("professor-a")}`, "content-type": "application/json" },
      body: JSON.stringify({ status, reviewNote }),
    });
  }

  it.each([
    ["APPROVED", "APPROVE"],
    ["REVISION_REQUIRED", "MINOR_REVISION"],
    ["REJECTED", "REJECT"],
  ])("records %s through the exact-version review service", async (status, recommendation) => {
    prepareReview();
    const response = await review(status);
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(mocks.decide).toHaveBeenCalledWith(expect.objectContaining({
      assignmentId: "assignment-a", recommendation,
      overallComment: "Please clarify the methodology.",
      user: expect.objectContaining({ id: "professor-a" }),
    }));
    expect(body.progression.nextStageName).toBe("Defense eligibility");
    expect(body.lifecycleStatus).toBe("APPROVED");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each(["COMPLETED", "SUPERSEDED", "REVOKED"])("does not use a %s assignment", async (status) => {
    prepareReview([{ id: "assignment-a", reviewerId: "professor-a", status }]);
    expect((await review("APPROVED")).status).toBe(403);
    expect(mocks.decide).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not use another reviewer's assignment even for the workflow owner", async () => {
    prepareReview([{ id: "assignment-a", reviewerId: "adviser-a", status: "ACTIVE" }]);
    expect((await review("REVISION_REQUIRED")).status).toBe(403);
    expect(mocks.decide).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("selects the caller's active assignment among other reviewers and historical assignments", async () => {
    prepareReview([
      { id: "assignment-old", reviewerId: "professor-a", status: "COMPLETED" },
      { id: "assignment-other", reviewerId: "adviser-a", status: "ACTIVE" },
      { id: "assignment-current", reviewerId: "professor-a", status: "ACTIVE" },
    ]);
    expect((await review("APPROVED")).status).toBe(200);
    expect(mocks.decide).toHaveBeenCalledWith(expect.objectContaining({ assignmentId: "assignment-current" }));
  });

  it("requires assignment selection when the caller holds multiple active reviews", async () => {
    prepareReview([
      { id: "assignment-a", reviewerId: "professor-a", status: "ACTIVE" },
      { id: "assignment-b", reviewerId: "professor-a", status: "ACTIVE" },
    ]);
    expect((await review("APPROVED")).status).toBe(409);
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it.each([
    [400, "REVISION_FEEDBACK_REQUIRED"],
    [409, "VERSION_SUPERSEDED"],
    [409, "ASSIGNMENT_ALREADY_RESOLVED"],
  ])("preserves formal review errors (%s, %s)", async (statusCode, code) => {
    prepareReview();
    mocks.decide.mockRejectedValue(Object.assign(new Error("Review cannot be submitted."), { statusCode, code }));
    const response = await review("REVISION_REQUIRED");
    expect(response.status).toBe(statusCode);
    expect(await response.json()).toEqual({ error: "Review cannot be submitted.", code });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("keeps the ordinary task review path for submissions without formal assignments", async () => {
    prepareReview([]);
    mocks.transaction.mockImplementation(async (callback) => callback({
      taskSubmission: { update: vi.fn().mockResolvedValue({ id: "submission-a", status: "REVISION_REQUIRED" }) },
    }));
    const response = await review("REVISION_REQUIRED");
    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.decide).not.toHaveBeenCalled();
  });
});
