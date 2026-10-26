import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countActiveAdviseeGroups: vi.fn(),
  synchronizeAdviserMilestone: vi.fn(),
}));
const db = vi.hoisted(() => ({
  researchProject: { findFirst: vi.fn(), findUnique: vi.fn() },
  user: { findFirst: vi.fn(), findUnique: vi.fn() },
  document: { findFirst: vi.fn() },
  workflowStage: { findFirst: vi.fn(), findUnique: vi.fn() },
  adviserRequest: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  researchMember: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  notification: { create: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../lib/prisma.js", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  prisma: db,
}));
vi.mock("../lib/adviser-capacity.js", () => ({
  countActiveAdviseeGroups: mocks.countActiveAdviseeGroups,
}));
vi.mock("../services/adviser-milestone.service.js", () => ({
  synchronizeAdviserMilestone: mocks.synchronizeAdviserMilestone,
}));

import router from "./adviser-request.routes.js";

const leader = {
  id: "leader",
  roles: ["RESEARCHER"],
  collegeId: "college",
  programId: "program",
};
const adviserUser = {
  ...leader,
  id: "adviser",
  roles: ["ADVISER"],
};

async function request(
  path: string,
  method: "post" | "patch",
  overrides: any = {},
) {
  const handler = (router as any).stack
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
      user: leader,
      params: { id: "request" },
      body: {},
      ...overrides,
    },
    res,
  );
  return res;
}

describe("adviser milestone request authorization and synchronization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation((callback) => callback(db));
    db.researchProject.findFirst.mockResolvedValue({
      id: "project",
      title: "Capstone",
      programId: "program",
      members: [],
      workflowInstance: { workflowId: "workflow" },
    });
    db.user.findFirst.mockResolvedValue({
      id: "adviser",
      programId: "program",
      isAcceptingAdvisees: true,
      maxAdviseeGroups: 5,
    });
    db.workflowStage.findFirst.mockResolvedValue({ id: "adviser-stage" });
    db.workflowStage.findUnique.mockResolvedValue({ requiredMilestoneId: null });
    mocks.countActiveAdviseeGroups.mockResolvedValue(0);
    db.adviserRequest.findFirst.mockResolvedValue(null);
    db.adviserRequest.upsert.mockResolvedValue({ id: "request" });
    db.notification.create.mockResolvedValue({ id: "notification" });
  });

  it("rejects adviser requests from anyone except the active group leader", async () => {
    db.researchProject.findFirst.mockResolvedValue(null);
    const response = await request("/", "post", {
      body: { researchId: "project", adviserId: "adviser" },
    });

    expect(response.statusCode).toBe(403);
    expect(db.adviserRequest.upsert).not.toHaveBeenCalled();
  });

  it("associates a leader request with the workflow's adviser milestone", async () => {
    const response = await request("/", "post", {
      body: {
        researchId: "project",
        adviserId: "adviser",
        workflowStageId: "adviser-stage",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(db.workflowStage.findUnique).toHaveBeenCalledWith({
      where: { id: "adviser-stage" },
      select: { requiredMilestoneId: true },
    });
    expect(db.adviserRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ workflowStageId: "adviser-stage" }),
        update: expect.objectContaining({ workflowStageId: "adviser-stage" }),
      }),
    );
  });

  it.each([false, true])(
    "enforces required milestone approval before requesting an adviser (approved: %s)",
    async (approved) => {
      db.workflowStage.findUnique.mockResolvedValue({
        requiredMilestoneId: "required-stage",
      });
      db.researchProject.findUnique.mockResolvedValue({
        members: [],
        adviserRequests: [],
        workflowInstance: {
          currentStageId: "adviser-stage",
          workflow: {
            stages: [
              {
                id: "required-stage",
                name: "Title Defense",
                sequence: 1,
                milestoneType: "STANDARD",
                requiresDocument: true,
                requiredMilestoneId: null,
                tasks: [],
                submittedVersions: approved ? [{ id: "approved-version" }] : [],
              },
              {
                id: "adviser-stage",
                name: "Adviser Selection",
                sequence: 2,
                milestoneType: "ADVISER_SELECTION",
                requiresDocument: false,
                requiredMilestoneId: "required-stage",
                tasks: [],
                submittedVersions: [],
              },
            ],
          },
        },
      });

      const response = await request("/", "post", {
        body: {
          researchId: "project",
          adviserId: "adviser",
          workflowStageId: "adviser-stage",
        },
      });

      expect(response.statusCode).toBe(approved ? 201 : 409);
      if (approved) {
        expect(db.adviserRequest.upsert).toHaveBeenCalledOnce();
        expect(db.notification.create).toHaveBeenCalledOnce();
      } else {
        expect(response.body.error).toContain("Title Defense");
        expect(db.adviserRequest.upsert).not.toHaveBeenCalled();
        expect(db.notification.create).not.toHaveBeenCalled();
      }
    },
  );

  it("rejects a milestone that is not part of the project's workflow", async () => {
    const response = await request("/", "post", {
      body: {
        researchId: "project",
        adviserId: "adviser",
        workflowStageId: "different-stage",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(db.adviserRequest.upsert).not.toHaveBeenCalled();
  });

  it("synchronizes acceptance in the same transaction and not on decline", async () => {
    const existing = {
      id: "request",
      adviserId: "adviser",
      researchId: "project",
      workflowStageId: "adviser-stage",
      status: "PENDING",
    };
    db.adviserRequest.findUnique.mockResolvedValue(existing);
    db.researchMember.findFirst.mockResolvedValue(null);
    db.user.findUnique.mockResolvedValue({
      maxAdviseeGroups: 5,
      isAcceptingAdvisees: true,
    });
    db.researchMember.findUnique.mockResolvedValue(null);
    db.researchMember.upsert.mockResolvedValue({ id: "membership" });
    db.adviserRequest.updateMany.mockResolvedValue({ count: 0 });
    db.adviserRequest.update.mockResolvedValue({
      ...existing,
      status: "ACCEPTED",
    });
    db.researchMember.findMany.mockResolvedValue([{ userId: "leader" }]);
    db.notification.createMany.mockResolvedValue({ count: 1 });
    mocks.synchronizeAdviserMilestone.mockResolvedValue({
      synchronized: true,
      progression: { advanced: true },
    });

    const accepted = await request("/:id/respond", "patch", {
      user: adviserUser,
      body: { decision: "accept" },
    });
    expect(accepted.statusCode).toBe(200);
    expect(mocks.synchronizeAdviserMilestone).toHaveBeenCalledWith(db, {
      researchId: "project",
      actorId: "adviser",
      workflowStageId: "adviser-stage",
    });

    vi.clearAllMocks();
    db.$transaction.mockImplementation((callback) => callback(db));
    db.adviserRequest.findUnique.mockResolvedValue(existing);
    db.adviserRequest.update.mockResolvedValue({
      ...existing,
      status: "REJECTED",
    });
    db.researchMember.findMany.mockResolvedValue([{ userId: "leader" }]);
    db.notification.createMany.mockResolvedValue({ count: 1 });
    const declined = await request("/:id/respond", "patch", {
      user: adviserUser,
      body: { decision: "reject" },
    });
    expect(declined.statusCode).toBe(200);
    expect(mocks.synchronizeAdviserMilestone).not.toHaveBeenCalled();
  });

  it("allows a group leader to withdraw a pending adviser request with an optional note", async () => {
    const existing = {
      id: "req-1",
      adviserId: "adviser-1",
      researchId: "project-1",
      status: "PENDING",
      research: { title: "Research Project Alpha" },
    };
    db.adviserRequest.findFirst.mockResolvedValue(existing);
    db.adviserRequest.update.mockResolvedValue({
      ...existing,
      status: "CANCELLED",
      responseNote: "Selecting another faculty adviser.",
    });
    db.notification.create.mockResolvedValue({ id: "notif-1" });

    const response = await request("/:id/cancel", "patch", {
      user: leader,
      params: { id: "req-1" },
      body: { reason: "Selecting another faculty adviser." },
    });

    expect(response.statusCode).toBe(200);
    expect(db.adviserRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "req-1" },
        data: expect.objectContaining({
          status: "CANCELLED",
          responseNote: "Selecting another faculty adviser.",
        }),
      }),
    );
    expect(db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientId: "adviser-1",
          type: "ADVISER_REQUEST_DECIDED",
        }),
      }),
    );
  });

  it("rejects request withdrawal when caller is not the active project leader", async () => {
    db.adviserRequest.findFirst.mockResolvedValue(null);

    const nonLeader = { ...leader, id: "member-only" };
    const response = await request("/:id/cancel", "patch", {
      user: nonLeader,
      params: { id: "req-1" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.body.error).toContain("not found for a project you lead");
    expect(db.adviserRequest.update).not.toHaveBeenCalled();
  });

  it("reconciles existing accepted adviser for project members", async () => {
    db.researchMember.findFirst.mockResolvedValue({
      id: "member-1",
      researchId: "project-1",
      userId: leader.id,
    });
    mocks.synchronizeAdviserMilestone.mockResolvedValue({
      synchronized: true,
      stageId: "adviser-stage",
      progression: { advanced: true },
    });

    const response = await request("/reconcile", "post", {
      user: leader,
      body: { researchId: "project-1" },
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.synchronizeAdviserMilestone).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        researchId: "project-1",
        actorId: leader.id,
      }),
    );
  });

  it("rejects reconciliation when user has no access to the project", async () => {
    db.researchMember.findFirst.mockResolvedValue(null);

    const unauthorized = { ...leader, id: "stranger", roles: ["RESEARCHER"] };
    const response = await request("/reconcile", "post", {
      user: unauthorized,
      body: { researchId: "project-1" },
    });

    expect(response.statusCode).toBe(403);
    expect(mocks.synchronizeAdviserMilestone).not.toHaveBeenCalled();
  });
});
