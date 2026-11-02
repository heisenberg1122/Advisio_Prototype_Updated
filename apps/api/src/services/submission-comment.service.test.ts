import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../middleware/auth.js";

const db = vi.hoisted(() => ({
  find: vi.fn(),
  assignment: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  enrollment: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    taskSubmission: { findUnique: db.find },
    reviewerAssignment: { findFirst: db.assignment },
    taskSubmissionComment: { findMany: db.list, create: db.create },
  },
}));
vi.mock("./workflow-enrollment-access.service.js", () => ({
  hasActiveWorkflowEnrollment: db.enrollment,
}));
import {
  listSubmissionComments,
  postSubmissionComment,
  submissionCommentSchema,
} from "./submission-comment.service.js";

const versionId = "00000000-0000-4000-8000-000000000001";
const oldVersionId = "00000000-0000-4000-8000-000000000002";
const input = {
  documentVersionId: versionId,
  body: "Please clarify the research objectives.",
  pageNumber: 3,
};
const textAnchor = {
  pageNumber: 3,
  selectedText: "research objectives",
  rects: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.03 }],
};
const user = (
  id: string,
  roles: AuthenticatedUser["roles"] = ["RESEARCHER"],
  extra = {},
) =>
  ({
    id,
    roles,
    permissions: [],
    email: "user@example.test",
    universityId: id,
    ...extra,
  }) as AuthenticatedUser;
let submission: any;
beforeEach(() => {
  vi.resetAllMocks();
  submission = {
    submittedBy: "student",
    documentVersionId: versionId,
    attempts: [{ documentVersionId: oldVersionId }],
    task: {
      stage: {
        workflowId: "workflow",
        workflow: { createdBy: "professor" },
        responsible: { name: "RESEARCH_COORDINATOR" },
      },
    },
    research: {
      collegeId: "college-a",
      members: [{ userId: "student", projectRole: "LEADER" }],
    },
  };
  db.find.mockResolvedValue(submission);
  db.list.mockResolvedValue([]);
  db.enrollment.mockResolvedValue(true);
  db.assignment.mockResolvedValue(null);
  db.create.mockResolvedValue({ id: "comment" });
});

describe("submission discussion access and persistence", () => {
  it("saves the quoted passage and normalized highlight with the exact version", async () => {
    await postSubmissionComment(
      "submission",
      {
        documentVersionId: versionId,
        body: "Clarify this passage",
        textAnchor,
      },
      user("professor", ["RESEARCH_COORDINATOR"]),
    );
    expect(db.create.mock.calls[0][0].data).toMatchObject({
      documentVersionId: versionId,
      textAnchor,
      pageNumber: 3,
    });
  });
  it.each([
    { ...textAnchor, selectedText: " " },
    { ...textAnchor, selectedText: "x".repeat(5001) },
    { ...textAnchor, rects: [] },
    { ...textAnchor, rects: [{ x: 0.8, y: 0.2, width: 0.4, height: 0.1 }] },
    { ...textAnchor, rects: [{ x: 0, y: 0, width: Infinity, height: 0.1 }] },
    { ...textAnchor, rects: [{ x: 0, y: -0.1, width: 0.1, height: 0.1 }] },
    { ...textAnchor, rects: Array(101).fill(textAnchor.rects[0]) },
    { ...textAnchor, pageNumber: 0 },
  ])(
    "rejects malformed passage anchors before any write: %j",
    async (invalid) => {
      await expect(
        postSubmissionComment(
          "submission",
          { ...input, textAnchor: invalid },
          user("student"),
        ),
      ).rejects.toBeDefined();
      expect(db.create).not.toHaveBeenCalled();
    },
  );
  it("does not accept a quote on one page and a comment on another", async () => {
    await expect(
      postSubmissionComment(
        "submission",
        { ...input, pageNumber: 4, textAnchor },
        user("student"),
      ),
    ).rejects.toBeDefined();
    expect(db.create).not.toHaveBeenCalled();
  });
  it("lets the workflow's checker post independently of a decision", async () => {
    await postSubmissionComment(
      "submission",
      input,
      user("professor", ["RESEARCH_COORDINATOR"]),
    );
    expect(db.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          taskSubmissionId: "submission",
          authorId: "professor",
          ...input,
        },
      }),
    );
  });
  it("allows an enrolled active group member to read and reply", async () => {
    expect(
      await listSubmissionComments("submission", versionId, user("student")),
    ).toMatchObject({ canComment: true });
    await postSubmissionComment("submission", input, user("student"));
    expect(db.enrollment).toHaveBeenCalledWith("student", "workflow");
    expect(db.create).toHaveBeenCalledOnce();
  });
  it("retains conversation for a previous submitted attempt", async () => {
    await postSubmissionComment(
      "submission",
      { ...input, documentVersionId: oldVersionId },
      user("student"),
    );
    expect(db.create.mock.calls[0][0].data.documentVersionId).toBe(
      oldVersionId,
    );
  });
  it("does not allow comments against a working upload or another version", async () => {
    await expect(
      postSubmissionComment(
        "submission",
        { ...input, documentVersionId: "00000000-0000-4000-8000-000000000099" },
        user("student"),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.create).not.toHaveBeenCalled();
  });
  it.each([
    ["outsider", ["RESEARCHER"]],
    ["other-professor", ["RESEARCH_COORDINATOR"]],
    ["admin", ["SYSTEM_ADMIN"]],
    ["unassigned", ["ADVISER"]],
  ] as const)("denies unassigned account %s", async (id, roles) => {
    await expect(
      postSubmissionComment("submission", input, user(id, [...roles])),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.create).not.toHaveBeenCalled();
    await expect(
      listSubmissionComments("submission", versionId, user(id, [...roles])),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.list).not.toHaveBeenCalled();
  });
  it("revokes access when workflow enrollment is removed", async () => {
    db.enrollment.mockResolvedValue(false);
    await expect(
      listSubmissionComments("submission", versionId, user("student")),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it("does not treat a former submitter as an active member", async () => {
    submission.research.members = [];
    await expect(
      listSubmissionComments("submission", versionId, user("student")),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it("allows a version-assigned checker and rechecks assignment on every post", async () => {
    db.assignment.mockResolvedValueOnce({ id: "assignment", status: "ACTIVE" });
    await postSubmissionComment(
      "submission",
      input,
      user("adviser", ["ADVISER"]),
    );
    expect(db.assignment.mock.calls[0][0].where).toEqual({
      documentVersionId: versionId,
      reviewerId: "adviser",
      status: { in: ["ACTIVE"] },
    });
    await expect(
      postSubmissionComment("submission", input, user("adviser", ["ADVISER"])),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.create).toHaveBeenCalledOnce();
  });
  it("makes completed reviewer access read-only", async () => {
    db.assignment.mockImplementation(({ where }) =>
      where.status.in.includes("COMPLETED")
        ? { id: "assignment", status: "COMPLETED" }
        : null,
    );
    expect(
      await listSubmissionComments(
        "submission",
        versionId,
        user("adviser", ["ADVISER"]),
      ),
    ).toMatchObject({ canComment: false });
    await expect(
      postSubmissionComment("submission", input, user("adviser", ["ADVISER"])),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it("does not borrow faculty privileges in the researcher portal", async () => {
    await expect(
      listSubmissionComments(
        "submission",
        versionId,
        user("professor", ["RESEARCH_COORDINATOR"], { researcherPanel: true }),
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.assignment).not.toHaveBeenCalled();
  });
  it("paginates only the selected submission and version, without author contact details", async () => {
    db.list.mockResolvedValue(
      Array.from({ length: 51 }, (_, n) => ({ id: `comment-${n}` })),
    );
    const result = await listSubmissionComments(
      "submission",
      versionId,
      user("student"),
      "cursor",
    );
    expect(result.comments).toHaveLength(50);
    expect(result.nextCursor).toBe("comment-49");
    const options = db.list.mock.calls[0][0];
    expect(options.where).toEqual({
      taskSubmissionId: "submission",
      documentVersionId: versionId,
    });
    expect(options).toMatchObject({
      cursor: { id: "cursor" },
      skip: 1,
      take: 51,
    });
    expect(options.select.author.select).toEqual({
      id: true,
      firstName: true,
      lastName: true,
    });
  });
  it("rejects a missing submission", async () => {
    db.find.mockResolvedValue(null);
    await expect(
      listSubmissionComments("missing", versionId, user("student")),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it.each([
    { body: " " },
    { body: "x".repeat(2001) },
    { pageNumber: 0 },
    { pageNumber: 1.2 },
    { pageNumber: "3" },
    { documentVersionId: "bad" },
  ])("validates comments before writing: %j", async (invalid) => {
    expect(
      submissionCommentSchema.safeParse({ ...input, ...invalid }).success,
    ).toBe(false);
    await expect(
      postSubmissionComment(
        "submission",
        { ...input, ...invalid } as any,
        user("student"),
      ),
    ).rejects.toBeDefined();
    expect(db.create).not.toHaveBeenCalled();
  });
});
