import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  workflow: { findUnique: vi.fn(), findMany: vi.fn() },
  researchType: { findUnique: vi.fn(), findMany: vi.fn() },
  workflowEnrollment: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  researchMember: { findFirst: vi.fn() },
  researchProject: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  workflowInstance: { findUnique: vi.fn() },
  workflowResource: { findMany: vi.fn() },
  workflowStage: { findUnique: vi.fn(), findFirst: vi.fn() },
  workflowStageAttachment: { findMany: vi.fn() },
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

describe("removed workflow participant API access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.workflow.findUnique.mockResolvedValue({
      id: "workflow",
      name: "Private workflow",
      researchTypeId: "type",
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
    db.$transaction.mockImplementation((actions) => Promise.all(actions));
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
    db.workflowEnrollment.upsert.mockResolvedValue({ status: "REVOKED" });
    expect((await request("/join/:code", "post")).statusCode).toBe(403);
    expect(db.workflowEnrollment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });

  it("does not expose milestone previews through a removed participant's invitation", async () => {
    db.workflow.findUnique.mockResolvedValue({
      id: "workflow",
      inviteExpiresAt: new Date(Date.now() + 60000),
      enrollments: [{ id: "enrollment", status: "REVOKED" }],
      stages: [{ name: "Private milestone" }],
    });
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
            { enrollments: { some: { userId: "student", status: "ACTIVE" } } },
          ]),
        }),
      }),
    );
  });
});
