import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { Permissions } from "@research-management/auth";
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  submission: vi.fn(),
  grade: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  event: vi.fn(),
  events: vi.fn(),
  reviews: vi.fn(),
  comments: vi.fn(),
  task: vi.fn(),
  count: vi.fn(),
  taskUpdate: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("./submission-comment.service.js", async (original) => ({
  ...(await original<any>()),
  assertSubmissionCommentAccess: mocks.access,
}));
vi.mock("../lib/prisma.js", async (original) => ({
  ...(await original<any>()),
  prisma: {
    taskSubmission: {
      findUnique: mocks.submission,
      findUniqueOrThrow: mocks.submission,
    },
    taskSubmissionGrade: {
      findUnique: mocks.grade,
      update: mocks.update,
      create: mocks.create,
      count: mocks.count,
    },
    taskSubmissionGradeEvent: { create: mocks.event, findMany: mocks.events },
    review: { findMany: mocks.reviews },
    taskSubmissionComment: { findMany: mocks.comments },
    workflowTask: { findUnique: mocks.task, update: mocks.taskUpdate },
    auditLog: { create: mocks.audit },
    $transaction: mocks.transaction,
  },
}));
import { prisma } from "../lib/prisma.js";
import {
  getSubmissionGrade,
  saveSubmissionGrade,
  setRequirementPoints,
  submissionHistory,
  gradeActionSchema,
} from "./submission-grading.service.js";
import { SubmissionCommentError } from "./submission-comment.service.js";

const versionId = "00000000-0000-4000-8000-000000000001";
const oldVersionId = "00000000-0000-4000-8000-000000000002";
const owner: AuthenticatedUser = {
  id: "professor",
  email: "professor@example.test",
  universityId: "test-professor",
  roles: ["RESEARCH_COORDINATOR"],
  permissions: [Permissions.WORKFLOW_EDIT],
  collegeId: "college",
};
const student: AuthenticatedUser = {
  id: "student",
  email: "student@example.test",
  universityId: "test-student",
  roles: ["RESEARCHER"],
  permissions: [],
  collegeId: "college",
  researcherPanel: true,
};
let submission: any;
let grade: any;
beforeEach(() => {
  vi.resetAllMocks();
  submission = {
    id: "submission",
    submittedBy: "student",
    submittedAt: new Date("2026-11-02T08:00:00Z"),
    submittedByUser: {
      id: "student",
      firstName: "Sample",
      lastName: "Student",
    },
    documentVersionId: versionId,
    task: {
      id: "task",
      maxPoints: 100,
      stage: {
        requiresDocument: true,
        milestoneType: "STANDARD",
        workflowId: "workflow",
        workflow: { createdBy: "professor" },
      },
    },
    research: {
      collegeId: "college",
      workflowInstance: { workflowId: "workflow" },
    },
    attempts: [],
  };
  grade = {
    id: "grade",
    draftScore: 85,
    releasedScore: null,
    maxPoints: 100,
    revision: 1,
    updatedAt: new Date(),
    releasedAt: null,
  };
  mocks.access.mockResolvedValue(true);
  mocks.submission.mockResolvedValue(submission);
  mocks.grade.mockResolvedValue(null);
  mocks.transaction.mockImplementation((callback) => callback(prisma));
  mocks.create.mockImplementation(({ data }) =>
    Promise.resolve({ id: "grade", ...data }),
  );
  mocks.update.mockImplementation(({ data }) =>
    Promise.resolve({ ...grade, ...data }),
  );
  mocks.count.mockResolvedValue(0);
  mocks.task.mockImplementation(() => Promise.resolve(submission.task));
  mocks.taskUpdate.mockImplementation(({ data }) =>
    Promise.resolve({ ...submission.task, ...data }),
  );
  mocks.events.mockResolvedValue([]);
  mocks.reviews.mockResolvedValue([]);
  mocks.comments.mockResolvedValue([]);
});
describe("requirement grading", () => {
  it("retains the actual draft save time and author after a later release", async () => {
    const draftTime = new Date("2026-11-02T08:30:00Z");
    mocks.grade.mockResolvedValue({ ...grade, updatedAt: new Date("2026-11-02T09:00:00Z"), events: [{ createdAt: draftTime, actor: { id: "original-professor", firstName: "Original", lastName: "Professor" } }] });
    const result = await getSubmissionGrade("submission", versionId, owner);
    expect(result.grade).toMatchObject({ draftSavedAt: draftTime, draftSavedBy: { id: "original-professor" } });
  });
  it("keeps a private draft indistinguishable from no grade for researchers", async () => {
    mocks.grade.mockResolvedValue(grade);
    const result = await getSubmissionGrade("submission", versionId, student);
    expect(result.grade).toBeNull();
    expect(result.canGrade).toBe(false);
    expect(JSON.stringify(result)).not.toContain("draftScore");
  });
  it("shows the released score while a changed draft stays private", async () => {
    mocks.grade.mockResolvedValue({
      ...grade,
      draftScore: 92,
      releasedScore: 85,
      releasedAt: new Date(),
    });
    const result = await getSubmissionGrade("submission", versionId, student);
    expect(result.grade).toEqual({
      maxPoints: 100,
      releasedScore: 85,
      releasedAt: expect.any(Date),
      releasedBy: null,
    });
  });
  it("lets the owner see their private grade and revision", async () => {
    mocks.grade.mockResolvedValue(grade);
    expect(
      await getSubmissionGrade("submission", versionId, owner),
    ).toMatchObject({ canGrade: true, grade: { draftScore: 85, revision: 1 } });
  });
  it("saves a draft and an audit event without changing submission status", async () => {
    const result = await saveSubmissionGrade(
      "submission",
      {
        action: "SAVE_DRAFT",
        documentVersionId: versionId,
        expectedRevision: 0,
        score: 0,
      },
      owner,
    );
    expect(result?.draftScore).toBe(0);
    expect(mocks.event).toHaveBeenCalledWith({
      data: {
        gradeId: "grade",
        actorId: "professor",
        action: "DRAFT_SAVED",
        score: 0,
        maxPoints: 100,
      },
    });
    expect(mocks.create.mock.calls[0][0].data).not.toHaveProperty("status");
    expect(mocks.transaction.mock.calls[0][1]).toEqual({
      isolationLevel: "Serializable",
    });
  });
  it("releases only a saved draft and records who released it", async () => {
    mocks.grade.mockResolvedValue(grade);
    const result = await saveSubmissionGrade(
      "submission",
      { action: "RELEASE", documentVersionId: versionId, expectedRevision: 1 },
      owner,
    );
    expect(result?.releasedScore).toBe(85);
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({
      revision: 2,
      releasedById: "professor",
      releasedAt: expect.any(Date),
    });
    expect(mocks.event.mock.calls[0][0].data.action).toBe("GRADE_RELEASED");
  });
  it("does not create repeated events for an unchanged released grade", async () => {
    mocks.grade.mockResolvedValue({
      ...grade,
      releasedScore: 85,
      releasedAt: new Date(),
    });
    await saveSubmissionGrade(
      "submission",
      { action: "RELEASE", documentVersionId: versionId, expectedRevision: 1 },
      owner,
    );
    expect(mocks.event).not.toHaveBeenCalled();
  });
  it.each([
    { ...owner, id: "other-professor" },
    student,
    { ...owner, researcherPanel: true },
    { ...owner, permissions: [] },
    { ...owner, collegeId: "other-college" },
  ])(
    "denies grading outside the owning professor's authority: %j",
    async (user) => {
      await expect(
        saveSubmissionGrade(
          "submission",
          {
            action: "SAVE_DRAFT",
            documentVersionId: versionId,
            expectedRevision: 0,
            score: 80,
          },
          user as AuthenticatedUser,
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
  it("rejects stale grade edits and old submitted versions", async () => {
    mocks.grade.mockResolvedValue(grade);
    await expect(
      saveSubmissionGrade(
        "submission",
        {
          action: "SAVE_DRAFT",
          documentVersionId: versionId,
          expectedRevision: 0,
          score: 80,
        },
        owner,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      saveSubmissionGrade(
        "submission",
        {
          action: "SAVE_DRAFT",
          documentVersionId: oldVersionId,
          expectedRevision: 1,
          score: 80,
        },
        owner,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not grade ungraded requirements or scores beyond their points", async () => {
    await expect(
      saveSubmissionGrade(
        "submission",
        {
          action: "SAVE_DRAFT",
          documentVersionId: versionId,
          expectedRevision: 0,
          score: 101,
        },
        owner,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    submission.task.maxPoints = null;
    await expect(
      saveSubmissionGrade(
        "submission",
        {
          action: "SAVE_DRAFT",
          documentVersionId: versionId,
          expectedRevision: 0,
          score: 80,
        },
        owner,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it("requires a draft before release", async () => {
    mocks.grade.mockResolvedValue({ ...grade, draftScore: null });
    await expect(
      saveSubmissionGrade(
        "submission",
        {
          action: "RELEASE",
          documentVersionId: versionId,
          expectedRevision: 1,
        },
        owner,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it.each([-1, NaN, Infinity, 80.123, 10001])(
    "rejects invalid score %s",
    (score) => {
      expect(
        gradeActionSchema.safeParse({
          action: "SAVE_DRAFT",
          documentVersionId: versionId,
          expectedRevision: 0,
          score,
        }).success,
      ).toBe(false);
    },
  );
  it("locks requirement points after any grade has been recorded", async () => {
    mocks.count.mockResolvedValue(1);
    await expect(setRequirementPoints("task", 50, owner)).rejects.toMatchObject(
      { statusCode: 409 },
    );
    expect(mocks.taskUpdate).not.toHaveBeenCalled();
  });
  it("does not enable grading on non-document milestone gates", async () => {
    submission.task.stage.requiresDocument = false;
    await expect(
      setRequirementPoints("task", 100, owner),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it("retains private draft history only for the owner, and hides peer reviews", async () => {
    await submissionHistory("submission", versionId, student);
    expect(mocks.events.mock.calls[0][0].where.action).toBe("GRADE_RELEASED");
    expect(mocks.reviews.mock.calls[0][0].where.reviewerId).toBe("student");
    await submissionHistory("submission", versionId, owner);
    expect(mocks.events.mock.calls[1][0].where).not.toHaveProperty("action");
  });
  it("does not include history from versions the reviewer cannot access", async () => {
    submission.attempts = [
      {
        id: "old",
        documentVersionId: oldVersionId,
        submittedAt: new Date(),
        attemptNumber: 1,
        documentVersion: { versionNumber: 1 },
      },
    ];
    mocks.access.mockImplementation((_id, version) =>
      version === oldVersionId
        ? Promise.reject(new SubmissionCommentError("Revoked", 403))
        : Promise.resolve(true),
    );
    await submissionHistory("submission", versionId, owner);
    expect(
      mocks.events.mock.calls[0][0].where.grade.documentVersionId.in,
    ).toEqual([versionId]);
  });
  it("preserves recorded dates and actors when ordering history", async () => {
    mocks.events.mockResolvedValue([
      {
        id: "released",
        action: "GRADE_RELEASED",
        score: 85,
        maxPoints: 100,
        createdAt: new Date("2026-11-02T09:00:00Z"),
        actor: { id: "professor", firstName: "Test", lastName: "Reviewer" },
        grade: { documentVersionId: versionId },
      },
    ]);
    const result = await submissionHistory("submission", versionId, student);
    expect(result.events[0]).toMatchObject({
      action: "Grade released",
      detail: "85/100",
      actor: { id: "professor" },
      at: new Date("2026-11-02T09:00:00Z"),
    });
  });
});
