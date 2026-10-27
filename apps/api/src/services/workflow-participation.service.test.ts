import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  workflowEnrollment: { findFirst: vi.fn(), findMany: vi.fn() },
  workflow: { findUnique: vi.fn() },
  researchCohort: { findMany: vi.fn() },
  researchType: { findUnique: vi.fn() },
  researchWorkspace: { findFirst: vi.fn(), findMany: vi.fn() },
  researchProject: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  researchMember: { createMany: vi.fn(), upsert: vi.fn() },
  workflowInstance: { create: vi.fn() },
  academicYear: { findFirst: vi.fn() },
  auditLog: { create: vi.fn() },
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: { $transaction: (fn: any) => fn(db) },
}));
import { startWorkflowParticipation } from "./workflow-participation.service.js";
const user = {
  id: "researcher",
  email: "researcher@test.edu",
  universityId: "123",
  roles: ["RESEARCHER"],
  permissions: [],
  collegeId: "college",
  programId: "program",
} as any;
const firstStage = {
  id: "adviser",
  sequence: 1,
  milestoneType: "ADVISER_SELECTION",
};
const workflow = {
  id: "workflow",
  researchTypeId: "type",
  version: 1,
  status: "PUBLISHED",
  stages: [firstStage],
};
const student = {
  status: "ACTIVE",
  collegeId: "college",
  programId: "program",
};
const workspace = {
  id: "workspace",
  name: "Team",
  participationMode: "GROUP",
  accessMode: "INVITE_ONLY",
  members: [
    { userId: "leader", role: "LEADER", user: student },
    { userId: user.id, role: "MEMBER", user: student },
    { userId: "not-enrolled", role: "MEMBER", user: student },
  ],
};
const start = (changes = {}) =>
  startWorkflowParticipation({ user, workflowId: workflow.id, ...changes });
beforeEach(() => {
  vi.resetAllMocks();
  db.workflowEnrollment.findFirst.mockResolvedValue({ id: "enrollment" });
  db.workflowEnrollment.findMany.mockResolvedValue([
    { userId: "leader" },
    { userId: user.id },
  ]);
  db.workflow.findUnique.mockResolvedValue(workflow);
  db.researchType.findUnique.mockResolvedValue({
    isActive: true,
    program: {
      id: "program",
      collegeId: "college",
      isActive: true,
      college: { isActive: true },
    },
  });
  db.researchWorkspace.findFirst.mockResolvedValue(workspace);
  db.researchWorkspace.findMany.mockResolvedValue([]);
  db.researchProject.findFirst.mockResolvedValue(null);
  db.researchProject.create.mockResolvedValue({ id: "participation" });
  db.researchProject.update.mockResolvedValue({
    id: "participation",
    workflowDraft: true,
    title: "",
  });
  db.workflowInstance.create.mockResolvedValue({ id: "instance" });
  db.academicYear.findFirst.mockResolvedValue({ id: "year" });
  db.researchCohort.findMany.mockResolvedValue([
    {
      id: "cohort",
      workflowId: "workflow",
      researchTypeId: "type",
      programId: "program",
      collegeId: "college",
      program: { collegeId: "college" },
      researchType: { programId: "program" },
      workflow: { researchTypeId: "type" },
      members: [{ userId: "leader" }, { userId: user.id }],
    },
  ]);
});
describe("workflow work without a registered research project", () => {
  it("does not activate a published workflow from legacy enrollment alone", async () => {
    db.researchCohort.findMany.mockResolvedValue([]);
    await expect(start()).rejects.toMatchObject({ statusCode: 403 });
    expect(db.researchProject.create).not.toHaveBeenCalled();
    expect(db.workflowInstance.create).not.toHaveBeenCalled();
  });
  it("preserves already-pinned legacy participation without requiring reassignment", async () => {
    db.researchCohort.findMany.mockResolvedValue([]);
    db.researchProject.findFirst.mockResolvedValue({
      id: "legacy",
      workspaceId: null,
    });
    await expect(start()).resolves.toMatchObject({ id: "legacy" });
    expect(db.researchCohort.findMany).not.toHaveBeenCalled();
  });
  it.each(["ADVISER_SELECTION", "TITLE_PROPOSAL", "STANDARD"])(
    "starts %s first without requiring a title",
    async (milestoneType) => {
      db.workflow.findUnique.mockResolvedValue({
        ...workflow,
        stages: [{ ...firstStage, milestoneType }],
      });
      await expect(start()).resolves.toMatchObject({
        workflowDraft: true,
        title: "",
      });
      expect(db.researchProject.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: "",
          workflowDraft: true,
          registeredAt: null,
          status: "DRAFT",
        }),
      });
      expect(db.workflowInstance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          currentStageId: firstStage.id,
          workflowId: "workflow",
        }),
      });
    },
  );
  it("uses an existing workspace for callers starting without a project ID", async () => {
    db.researchWorkspace.findMany.mockResolvedValue([{ id: "workspace" }]);
    await start();
    expect(db.researchProject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace",
        createdBy: "leader",
      }),
    });
  });
  it("requires a workspace choice when several groups are available", async () => {
    db.researchWorkspace.findMany.mockResolvedValue([
      { id: "one" },
      { id: "two" },
    ]);
    await expect(start()).rejects.toMatchObject({ statusCode: 400 });
    expect(db.researchProject.create).not.toHaveBeenCalled();
  });
  it("reuses participation and preserves all attached records on retries", async () => {
    const existing = { id: "original", workspaceId: null, workflowDraft: true };
    db.researchProject.findFirst.mockResolvedValue(existing);
    await expect(start()).resolves.toBe(existing);
    expect(db.researchProject.create).not.toHaveBeenCalled();
    expect(db.workflowInstance.create).not.toHaveBeenCalled();
  });
  it("keeps different workflow contexts isolated", async () => {
    await start();
    expect(db.researchProject.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workflowInstance: { is: { workflowId: "workflow" } },
        members: expect.any(Object),
      }),
    });
  });
  it("allows a group member to begin with the actual group leader and enrolled members", async () => {
    await start({ workspaceId: "workspace" });
    expect(db.researchMember.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "leader",
          projectRole: "LEADER",
          researchId: "participation",
        },
        { userId: user.id, projectRole: "MEMBER", researchId: "participation" },
      ],
    });
    expect(db.researchProject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdBy: "leader",
        workspaceId: "workspace",
      }),
    });
  });
  it("joins the group's existing workflow record rather than creating another", async () => {
    db.researchProject.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "group-record", academicYearId: "year" });
    await expect(start({ workspaceId: "workspace" })).resolves.toMatchObject({
      id: "group-record",
    });
    expect(db.researchMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          researchId: "group-record",
          userId: user.id,
          projectRole: "MEMBER",
        },
      }),
    );
    expect(db.researchProject.create).not.toHaveBeenCalled();
  });
  it("requires a cohort assignment before a new member joins an existing group process", async () => {
    db.researchProject.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "legacy-group", academicYearId: "year" });
    db.researchCohort.findMany.mockResolvedValue([]);
    await expect(start({ workspaceId: "workspace" })).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(db.researchMember.upsert).not.toHaveBeenCalled();
  });
  it("requires active enrollment without automatically restoring removed access", async () => {
    db.workflowEnrollment.findFirst.mockResolvedValue(null);
    await expect(start()).rejects.toMatchObject({ statusCode: 403 });
    expect(db.researchProject.create).not.toHaveBeenCalled();
  });
  it("denies another department's workflow", async () => {
    await expect(
      start({ user: { ...user, programId: "other" } }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.researchProject.create).not.toHaveBeenCalled();
  });
  it("denies a workspace outside the researcher's active memberships", async () => {
    db.researchWorkspace.findFirst.mockResolvedValue(null);
    await expect(start({ workspaceId: "other" })).rejects.toMatchObject({
      statusCode: 403,
    });
  });
  it("requires the existing group leader to be enrolled", async () => {
    db.workflowEnrollment.findMany.mockResolvedValue([{ userId: user.id }]);
    await expect(start({ workspaceId: "workspace" })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(db.researchProject.create).not.toHaveBeenCalled();
  });
  it("does not move an existing participation to another group", async () => {
    db.researchProject.findFirst.mockResolvedValue({
      id: "existing",
      workspaceId: "another",
    });
    await expect(start({ workspaceId: "workspace" })).rejects.toMatchObject({
      statusCode: 409,
    });
  });
  it("does not start unpublished or empty workflows", async () => {
    db.workflow.findUnique.mockResolvedValue({ ...workflow, status: "DRAFT" });
    await expect(start()).rejects.toMatchObject({ statusCode: 404 });
    db.workflow.findUnique.mockResolvedValue({ ...workflow, stages: [] });
    await expect(start()).rejects.toMatchObject({ statusCode: 409 });
  });
  it("requires a researcher role", async () => {
    await expect(
      start({ user: { ...user, roles: ["ADVISER"] } }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
