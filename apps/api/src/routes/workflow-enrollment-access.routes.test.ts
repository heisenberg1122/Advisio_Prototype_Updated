import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPermissionsForRoles } from "@research-management/auth";

const db = vi.hoisted(() => ({
  workflow: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  researchType: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  workflowEnrollment: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  user: { findUnique: vi.fn() },
  workflowAccessEntry: { findUnique: vi.fn(), updateMany: vi.fn() },
  $executeRaw: vi.fn(),
  researchMember: { findFirst: vi.fn() },
  researchProject: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  workflowInstance: { findUnique: vi.fn(), count: vi.fn() },
  workflowResource: { findMany: vi.fn() },
  workflowTopic: { findMany: vi.fn(), update: vi.fn() },
  workflowStage: {
    findUniqueOrThrow: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  workflowStageAttachment: { findMany: vi.fn() },
  workflowTask: { findMany: vi.fn(), update: vi.fn() },
  notification: { create: vi.fn(), createMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("../lib/prisma.js", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  prisma: db,
}));
vi.mock("../services/document-access.service.js", () => ({
  documentAccessService: {
    forResearch: vi.fn(async () => ({
      exists: true,
      canView: true,
      canSubmitManuscript: true,
    })),
  },
}));
import router from "./workflow.routes.js";
import researchRouter from "./research.routes.js";
import documentRouter from "./document.routes.js";

const student = {
  id: "student",
  roles: ["RESEARCHER"],
  collegeId: "college",
  programId: "program",
};
const professor = {
  ...student,
  id: "professor",
  roles: ["RESEARCH_COORDINATOR"],
};
async function request(
  path: string,
  method = "get",
  overrides: any = {},
  targetRouter = router,
) {
  const handler = (targetRouter as any).stack
    .find(
      (layer: any) => layer.route?.path === path && layer.route.methods[method],
    )
    .route.stack.at(-1).handle;
  const res = {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  };
  await handler(
    {
      user: student,
      params: { id: "workflow", stageId: "stage", code: "INVITE" },
      query: {},
      body: {},
      get: () => undefined,
      ...overrides,
    },
    res,
  );
  return res;
}

describe("workflow deletion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.workflow.findUnique.mockResolvedValue({
      id: "workflow",
      name: "Private workflow",
      status: "PUBLISHED",
      researchTypeId: "type",
    });
    db.researchType.findUnique.mockResolvedValue({
      program: { id: "program", collegeId: "college" },
    });
    db.workflowInstance.count.mockResolvedValue(0);
    db.$transaction.mockImplementation((callback) => callback(db));
  });

  const remove = (confirmation: unknown, user: any = professor) =>
    request("/:id", "delete", { user, body: { confirmation } });

  it.each([
    undefined,
    "Private workflow",
    "sudo delete Private workflow",
    'sudo delete "private workflow"',
    'sudo delete "Private workflow" ',
  ])(
    "rejects non-exact confirmation %s without deleting",
    async (confirmation) => {
      expect((await remove(confirmation)).statusCode).toBe(400);
      expect(db.workflow.delete).not.toHaveBeenCalled();
      expect(db.auditLog.create).not.toHaveBeenCalled();
    },
  );

  it("deletes an unused workflow and records the action", async () => {
    const res = await remove('sudo delete "Private workflow"');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect(db.workflow.delete).toHaveBeenCalledWith({
      where: { id: "workflow" },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: professor.id,
          action: "DELETE",
          entityId: "workflow",
        }),
      }),
    );
  });

  it("preserves workflows used by research projects", async () => {
    db.workflowInstance.count.mockResolvedValue(1);
    expect((await remove('sudo delete "Private workflow"')).statusCode).toBe(
      409,
    );
    expect(db.workflow.delete).not.toHaveBeenCalled();
  });

  it.each([
    student,
    { ...professor, collegeId: "other-college" },
    { ...professor, programId: "other-program" },
    { ...professor, collegeId: null },
  ])("rejects users who cannot manage the workflow: %s", async (user) => {
    expect(
      (await remove('sudo delete "Private workflow"', user)).statusCode,
    ).toBe(404);
    expect(db.workflow.delete).not.toHaveBeenCalled();
  });

  it("returns not found for an already deleted workflow", async () => {
    db.workflow.findUnique.mockResolvedValue(null);
    expect((await remove('sudo delete "Private workflow"')).statusCode).toBe(
      404,
    );
    expect(db.workflow.delete).not.toHaveBeenCalled();
  });

  it("rejects stale confirmation when the workflow name changes", async () => {
    db.workflow.findUnique.mockResolvedValueOnce({
      id: "workflow",
      name: "Private workflow",
      researchTypeId: "type",
    });
    db.workflow.findUnique.mockResolvedValueOnce({
      id: "workflow",
      name: "Renamed workflow",
      researchTypeId: "type",
    });
    expect((await remove('sudo delete "Private workflow"')).statusCode).toBe(
      400,
    );
    expect(db.workflow.delete).not.toHaveBeenCalled();
  });

  it("returns a conflict if a concurrent project reference prevents deletion", async () => {
    db.workflow.delete.mockRejectedValue({ code: "P2003" });
    expect((await remove('sudo delete "Private workflow"')).statusCode).toBe(
      409,
    );
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("workflow publication", () => {
  // Exercise the actual route's permission gate as well as its scoped handler.
  async function publish(user: any = professor) {
    const permissionGate = (router as any).stack.find(
      (layer: any) =>
        layer.route?.path === "/:id/publish" && layer.route.methods.post,
    ).route.stack[1].handle;
    const next = vi.fn();
    const res = {
      statusCode: 200,
      body: null as any,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: any) {
        this.body = body;
        return this;
      },
    };
    const authenticatedUser = {
      ...user,
      permissions: getPermissionsForRoles(user.roles),
    };
    permissionGate({ user: authenticatedUser }, res, next);
    if (!next.mock.calls.length) return res;
    return request("/:id/publish", "post", { user: authenticatedUser });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation((callback) => callback(db));
    db.researchType.findUnique.mockResolvedValue({
      program: { id: "program", collegeId: "college" },
    });
    db.workflowEnrollment.findMany.mockResolvedValue([]);
    db.researchProject.findMany.mockResolvedValue([]);
    db.notification.createMany.mockResolvedValue({ count: 0 });
    db.workflowTopic.findMany.mockResolvedValue([{ id: "topic" }]);
    db.workflowStage.findMany.mockResolvedValue([
      { id: "stage", topicId: "topic" },
    ]);
    db.workflowStage.findFirst.mockResolvedValue({ id: "stage" });
  });

  it("publishes a complete draft and makes it the research type workflow", async () => {
    const draft = {
      id: "workflow",
      name: "Capstone workflow",
      researchTypeId: "type",
      createdBy: professor.id,
      status: "DRAFT",
      version: 2,
    };
    const complete = {
      ...draft,
      topics: [{ id: "topic", sequence: 1 }],
      stages: [
        {
          id: "stage",
          name: "Proposal",
          topicId: "topic",
          category: "Milestone",
          requiresDocument: true,
          tasks: [{ id: "task", isRequired: true }],
        },
      ],
    };
    db.workflow.findUnique
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(complete);
    db.workflow.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...complete, ...data }),
    );

    const res = await publish();

    expect(res.statusCode).toBe(200);
    expect(db.workflow.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "workflow" },
        data: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
    expect(db.researchType.update).toHaveBeenCalledWith({
      where: { id: "type" },
      data: { workflowId: "workflow" },
    });
    expect(db.auditLog.create).toHaveBeenCalled();
  });

  it("keeps an incomplete draft private", async () => {
    const draft = {
      id: "workflow",
      name: "Incomplete workflow",
      researchTypeId: "type",
      createdBy: professor.id,
      status: "DRAFT",
      version: 1,
    };
    db.workflow.findUnique
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce({ ...draft, topics: [], stages: [] });

    const res = await publish();

    expect(res.statusCode).toBe(409);
    expect(res.body.issues).toEqual([
      "Add at least one workflow topic.",
      "Add at least one milestone.",
    ]);
    expect(db.workflow.update).not.toHaveBeenCalled();
  });

  it.each(["RESEARCHER", "ADVISER", "PANELIST"])(
    "rejects publication by %s before touching the workflow",
    async (role) => {
      const res = await publish({ ...student, roles: [role] });
      expect(res.statusCode).toBe(403);
      expect(res.body.requiredPermission).toBe("workflow.publish");
      expect(db.workflow.findUnique).not.toHaveBeenCalled();
      expect(db.workflow.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    { collegeId: "other-college" },
    { programId: "other-program" },
    { collegeId: null },
  ])("rejects publication outside the coordinator's scope: %s", async (scope) => {
    db.workflow.findUnique.mockResolvedValue({
      id: "workflow",
      researchTypeId: "type",
      status: "DRAFT",
    });
    const res = await publish({ ...professor, ...scope });
    expect(res.statusCode).toBe(404);
    expect(db.workflow.update).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("removed workflow participant API access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.workflow.findUnique.mockResolvedValue({
      id: "workflow",
      name: "Private workflow",
      inviteCode: "INVITE",
      creator: { firstName: "Professor", lastName: "Test" },
      researchTypeId: "type",
      status: "PUBLISHED",
      inviteExpiresAt: new Date(Date.now() + 60000),
    });
    db.researchType.findUnique.mockResolvedValue({
      programId: "program",
      program: { id: "program", collegeId: "college" },
    });
    db.researchType.findMany.mockResolvedValue([{ id: "type" }]);
    db.workflowEnrollment.findFirst.mockResolvedValue(null);
    db.researchMember.findFirst.mockResolvedValue({
      id: "still-a-project-member",
    });
    db.workflowResource.findMany.mockResolvedValue([]);
    db.workflowStage.findUnique.mockResolvedValue({
      id: "stage",
      workflowId: "workflow",
    });
    db.$transaction.mockImplementation((actions) =>
      typeof actions === "function" ? actions(db) : Promise.all(actions),
    );
    db.user.findUnique.mockResolvedValue({
      status: "ACTIVE",
      collegeId: "college",
      programId: "program",
      roles: [{ role: { name: "RESEARCHER" } }],
    });
  });

  it("denies resource access despite remaining project membership", async () => {
    expect((await request("/:id/resources")).statusCode).toBe(404);
    expect(db.workflowResource.findMany).not.toHaveBeenCalled();
    expect(db.researchMember.findFirst).not.toHaveBeenCalled();
  });

  it("denies milestone attachments through a direct URL", async () => {
    expect((await request("/stages/:stageId/attachments")).statusCode).toBe(
      404,
    );
    expect(db.workflowStageAttachment.findMany).not.toHaveBeenCalled();
  });

  it("withholds workflow details from both project list and project detail responses", async () => {
    const project = {
      id: "project",
      title: "Preserved project",
      members: [{ userId: "student" }],
      workflowInstance: {
        workflowId: "workflow",
        workflow: { stages: [{ name: "Private milestone" }] },
      },
      taskSubmissions: [{ task: { title: "Private task" } }],
    };
    db.workflowEnrollment.findMany.mockResolvedValue([]);
    db.researchProject.findMany.mockResolvedValue([project]);
    db.researchProject.findFirst.mockResolvedValue(project);
    const list = await request("/", "get", {}, researchRouter);
    const detail = await request(
      "/:id",
      "get",
      { params: { id: "project" } },
      researchRouter,
    );
    expect(list.statusCode).toBe(200);
    expect(detail.statusCode).toBe(200);
    for (const visible of [list.body.projects[0], detail.body.project]) {
      expect(visible).toMatchObject({
        id: "project",
        title: "Preserved project",
        workflowInstance: null,
        taskSubmissions: [],
        workflowAccessRemoved: true,
      });
    }
  });

  it("denies workflow progress even when project document access remains", async () => {
    db.workflowInstance.findUnique.mockResolvedValue({
      workflowId: "workflow",
    });
    const res = await request(
      "/research/:researchId/manuscript-workflow",
      "get",
      { params: { researchId: "project" } },
      documentRouter,
    );
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe(
      "Your access to this workflow was removed by the professor.",
    );
  });

  it("keeps resource access for an enrolled teammate and the professor", async () => {
    db.workflowEnrollment.findFirst.mockResolvedValue({ id: "active" });
    expect((await request("/:id/resources")).statusCode).toBe(200);
    db.workflowEnrollment.findFirst.mockResolvedValue(null);
    expect(
      (await request("/:id/resources", "get", { user: professor })).statusCode,
    ).toBe(200);
  });

  it("denies starting a milestone after removal, before creating a shared task", async () => {
    db.researchProject.findFirst.mockResolvedValue({
      workflowInstance: { workflowId: "workflow" },
    });
    expect(
      (
        await request("/stages/:stageId/start", "post", {
          body: { researchId: "project" },
        })
      ).statusCode,
    ).toBe(403);
    expect(db.workflowStage.findFirst).not.toHaveBeenCalled();
  });

  it("denies submission options for a removed student who still has project document access", async () => {
    db.researchProject.findUnique.mockResolvedValue({
      id: "project",
      members: [{ userId: "student", projectRole: "MEMBER" }],
      workflowInstance: { workflowId: "workflow" },
    });
    const res = await request("/tasks/:taskId/submission-options", "get", {
      params: { taskId: "task" },
      query: { researchId: "project" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("WORKFLOW_ENROLLMENT_REQUIRED");
  });

  it.each(["/tasks/:taskId/submissions", "/tasks/:taskId/submissions/upload"])(
    "blocks submissions through %s after removal",
    async (path) => {
      db.researchProject.findUnique.mockResolvedValue({
        id: "project",
        members: [{ userId: "student", projectRole: "MEMBER" }],
        workflowInstance: { workflowId: "workflow" },
      });
      const res = await request(path, "post", {
        params: { taskId: "task" },
        body: {
          researchId: "project",
          documentId: "document",
          title: "Submission",
          idempotencyKey: "attempt",
        },
        file: {
          originalname: "submission.pdf",
          mimetype: "application/pdf",
          buffer: Buffer.from("%PDF-test"),
        },
      });
      expect(res.statusCode).toBe(403);
    },
  );

  it("retains a revoked enrollment and audit record without removing the project", async () => {
    db.workflowEnrollment.findFirst.mockResolvedValue({
      id: "enrollment",
      workflowId: "workflow",
      userId: "student",
      status: "ACTIVE",
      joinedAt: new Date(),
      workflow: { name: "Private workflow" },
      user: { id: "student", firstName: "Student" },
    });
    const res = await request("/enrollments/:id", "delete", {
      user: professor,
      body: { reason: "Invited by mistake" },
    });
    expect(res.statusCode).toBe(200);
    expect(db.workflowEnrollment.update).toHaveBeenCalledWith({
      where: { id: "enrollment" },
      data: { status: "REVOKED" },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          newValues: { status: "REVOKED", removalReason: "Invited by mistake" },
        }),
      }),
    );
  });

  it("does not let an old invitation reactivate a removed participant", async () => {
    db.workflowEnrollment.findUnique.mockResolvedValue({ status: "REVOKED" });
    expect((await request("/join/:code", "post")).statusCode).toBe(403);
    expect(db.workflowEnrollment.upsert).not.toHaveBeenCalled();
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });

  it("does not expose milestone previews through a removed participant's invitation", async () => {
    db.workflowEnrollment.findUnique.mockResolvedValue({ status: "REVOKED" });
    const res = await request("/invitation/:code");
    expect(res.statusCode).toBe(403);
    expect(res.body.invitation).toBeUndefined();
  });

  it("filters workflow listings to active student enrollments", async () => {
    db.workflow.findMany.mockResolvedValue([]);
    expect((await request("/")).statusCode).toBe(200);
    expect(db.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              status: "PUBLISHED",
              enrollments: {
                some: { userId: "student", status: "ACTIVE" },
              },
            },
          ]),
        }),
      }),
    );
  });
});


describe("milestone file type settings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.workflow.findUnique.mockResolvedValue({ id: "workflow", status: "DRAFT", researchTypeId: "type" });
    db.researchType.findUnique.mockResolvedValue({ program: { id: "program", collegeId: "college" } });
    db.workflowStage.findUnique.mockResolvedValue({ id: "stage", workflowId: "workflow", milestoneType: "STANDARD", requiresDocument: true, deadlineDays: null });
    db.workflowStage.findUniqueOrThrow.mockResolvedValue({ id: "stage", name: "Manuscript" });
    db.workflowStage.findMany.mockResolvedValue([]);
    db.workflowTask.findMany.mockResolvedValue([{ id: "task" }]);
    db.$transaction.mockImplementation((callback) => callback(db));
  });

  it.each(["PDF", "ALL"])("persists %s on the milestone's requirement", async (allowedFileTypes) => {
    const result = await request("/stages/:stageId", "patch", { user: professor, body: { taskFileTypes: { task: allowedFileTypes } } });
    expect(result.statusCode).toBe(200);
    expect(db.workflowTask.update).toHaveBeenCalledWith({ where: { id: "task" }, data: { allowedFileTypes } });
  });

  it("rejects another milestone's requirement before updating", async () => {
    db.workflowTask.findMany.mockResolvedValue([]);
    const result = await request("/stages/:stageId", "patch", { user: professor, body: { taskFileTypes: { foreign: "ALL" } } });
    expect(result.statusCode).toBe(400);
    expect(db.workflowTask.update).not.toHaveBeenCalled();
    expect(db.workflowStage.update).not.toHaveBeenCalled();
  });

  it("rejects invalid formats", async () => {
    const result = await request("/stages/:stageId", "patch", { user: professor, body: { taskFileTypes: { task: "EXE" } } });
    expect(result.statusCode).toBe(400);
    expect(db.workflowTask.update).not.toHaveBeenCalled();
  });

  it("preserves workflow management permissions", async () => {
    const result = await request("/stages/:stageId", "patch", { user: { ...professor, collegeId: "other" }, body: { taskFileTypes: { task: "ALL" } } });
    expect(result.statusCode).toBe(404);
    expect(db.workflowTask.update).not.toHaveBeenCalled();
  });
});
