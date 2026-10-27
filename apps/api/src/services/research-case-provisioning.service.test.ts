import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  researchCohort: { findUnique: vi.fn() },
  researchWorkspace: { findUnique: vi.fn() },
  workflow: { findUnique: vi.fn() },
  researchProject: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  researchMember: { createMany: vi.fn() },
  workflowEnrollment: { findMany: vi.fn(), createMany: vi.fn() },
  workflowInstance: { create: vi.fn() },
  auditLog: { create: vi.fn() },
}));
const transaction = vi.hoisted(() => vi.fn());
vi.mock("../lib/prisma.js", async (original) => ({
  ...(await original<any>()),
  prisma: { $transaction: transaction },
}));
import { Prisma } from "../lib/prisma.js";
import {
  provisionResearchCase,
  ResearchCaseProvisioningError,
} from "./research-case-provisioning.service.js";

const ids = Object.fromEntries(
  [
    "cohort",
    "workspace",
    "leader",
    "member",
    "college",
    "program",
    "type",
    "year",
    "workflow",
    "stage",
    "project",
    "instance",
  ].map((key) => [key, crypto.randomUUID()]),
);
const input = {
  cohortId: ids.cohort,
  workspaceId: ids.workspace,
  actorId: ids.leader,
};
let cohort: any, workspace: any, workflow: any;
beforeEach(() => {
  vi.resetAllMocks();
  transaction.mockImplementation((fn: any) => fn(db));
  cohort = {
    id: ids.cohort,
    status: "ACTIVE",
    collegeId: ids.college,
    programId: ids.program,
    researchTypeId: ids.type,
    academicYearId: ids.year,
    workflowId: ids.workflow,
    college: { isActive: true },
    program: { isActive: true, collegeId: ids.college },
    researchType: { isActive: true, programId: ids.program },
    academicYear: { isActive: true },
    members: [{ userId: ids.leader }, { userId: ids.member }],
  };
  workspace = {
    id: ids.workspace,
    cohortId: ids.cohort,
    name: "Team Alpha",
    collegeId: ids.college,
    programId: ids.program,
    participationMode: "GROUP",
    accessMode: "PUBLIC_APPROVAL",
    members: [ids.leader, ids.member].map((userId, index) => ({
      userId,
      role: index ? "MEMBER" : "LEADER",
      user: {
        status: "ACTIVE",
        collegeId: ids.college,
        programId: ids.program,
        roles: [{ role: { name: "RESEARCHER" } }],
      },
    })),
  };
  workflow = {
    id: ids.workflow,
    status: "PUBLISHED",
    researchTypeId: ids.type,
    version: 7,
    stages: [{ id: ids.stage }],
  };
  db.researchCohort.findUnique.mockImplementation(async () => cohort);
  db.researchWorkspace.findUnique.mockImplementation(async () => workspace);
  db.workflow.findUnique.mockImplementation(async () => workflow);
  db.researchProject.findMany.mockResolvedValue([]);
  db.workflowEnrollment.findMany.mockResolvedValue(
    [ids.leader, ids.member].map((userId) => ({ userId, status: "ACTIVE" })),
  );
  db.researchProject.create.mockImplementation(async ({ data }) => ({
    id: ids.project,
    ...data,
  }));
  db.researchProject.update.mockResolvedValue({
    id: ids.project,
    workflowInstanceId: ids.instance,
  });
  db.workflowInstance.create.mockImplementation(async ({ data }) => ({
    id: ids.instance,
    ...data,
  }));
});

describe("canonical cohort-driven research case provisioning", () => {
  it("derives academic identity from cohort and copies server-owned roles, stage and version", async () => {
    expect(await provisionResearchCase(input)).toMatchObject({
      created: true,
      project: { id: ids.project },
      workflowInstance: {
        researchId: ids.project,
        workflowId: ids.workflow,
        workflowVersion: 7,
        currentStageId: ids.stage,
      },
    });
    expect(db.researchProject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        collegeId: ids.college,
        programId: ids.program,
        researchTypeId: ids.type,
        academicYearId: ids.year,
        cohortId: ids.cohort,
        workspaceId: ids.workspace,
        createdBy: ids.leader,
        title: "Team Alpha Research Study",
        isTitleProvisional: true,
        workflowDraft: true,
        registeredAt: null,
        status: "DRAFT",
        accessMode: "PUBLIC_APPROVAL",
      }),
    });
    expect(db.researchMember.createMany).toHaveBeenCalledWith({
      data: [
        { researchId: ids.project, userId: ids.leader, projectRole: "LEADER" },
        { researchId: ids.project, userId: ids.member, projectRole: "MEMBER" },
      ],
    });
    expect(db.researchProject.update).toHaveBeenCalledWith({
      where: { id: ids.project },
      data: { workflowInstanceId: ids.instance },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        newValues: {
          operation: "RESEARCH_CASE_PROVISIONED",
          researchId: ids.project,
          ...input,
          workflowId: ids.workflow,
        },
      }),
    });
    expect(db.workflowEnrollment.createMany).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable" }),
    );
  });
  it("creates only missing compatibility enrollment without updating active rows", async () => {
    db.workflowEnrollment.findMany.mockResolvedValueOnce([
      { userId: ids.leader, status: "ACTIVE" },
    ]);
    await provisionResearchCase(input);
    expect(db.workflowEnrollment.createMany).toHaveBeenCalledWith({
      data: [
        { workflowId: ids.workflow, userId: ids.member, status: "ACTIVE" },
      ],
      skipDuplicates: true,
    });
  });
  it("detects an inactive conflicting enrollment after a concurrent insert rather than restoring it", async () => {
    db.workflowEnrollment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { userId: ids.leader, status: "ACTIVE" },
        { userId: ids.member, status: "REVOKED" },
      ]);
    await expect(provisionResearchCase(input)).rejects.toMatchObject({
      code: "WORKFLOW_ACCESS_REVOKED",
    });
    expect(db.workflowInstance.create).not.toHaveBeenCalled();
  });
  it("returns the existing pinned case without writes even if the current template version changes", async () => {
    const prior = {
      id: ids.project,
      collegeId: ids.college,
      programId: ids.program,
      researchTypeId: ids.type,
      academicYearId: ids.year,
      workflowInstanceId: ids.instance,
      workflowInstance: {
        id: ids.instance,
        researchId: ids.project,
        workflowId: ids.workflow,
        workflowVersion: 2,
      },
    };
    db.researchProject.findMany.mockResolvedValue([prior]);
    expect(await provisionResearchCase(input)).toEqual({
      project: { ...prior, workflowInstance: undefined },
      workflowInstance: prior.workflowInstance,
      created: false,
    });
    expect(db.researchProject.create).not.toHaveBeenCalled();
    expect(db.researchProject.update).not.toHaveBeenCalled();
    expect(db.researchMember.createMany).not.toHaveBeenCalled();
    expect(db.workflowEnrollment.createMany).not.toHaveBeenCalled();
    expect(db.workflowInstance.create).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it("does not repair incomplete historical cases or create replacements", async () => {
    db.researchProject.findMany.mockResolvedValue([
      { id: ids.project, workflowInstance: null },
    ]);
    await expect(provisionResearchCase(input)).rejects.toMatchObject({
      code: "EXISTING_CASE_INCONSISTENT",
    });
    expect(db.researchProject.create).not.toHaveBeenCalled();
  });
  it("refuses ambiguous pre-existing cases rather than selecting one silently", async () => {
    db.researchProject.findMany.mockResolvedValue([
      { id: "one" },
      { id: "two" },
    ]);
    await expect(provisionResearchCase(input)).rejects.toMatchObject({
      code: "MULTIPLE_RESEARCH_CASES",
    });
  });
  it("uses the fallback title without requiring a caller title", async () => {
    workspace.name = "   ";
    await provisionResearchCase(input);
    expect(db.researchProject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: "Untitled Research Study" }),
    });
  });
  it.each([
    "collegeId",
    "programId",
    "researchTypeId",
    "academicYearId",
    "workflowId",
    "title",
    "projectRole",
  ])("rejects caller override %s", async (key) => {
    await expect(
      provisionResearchCase({ ...input, [key]: "override" }),
    ).rejects.toMatchObject({ code: "INVALID_PROVISIONING_INPUT" });
    expect(transaction).not.toHaveBeenCalled();
  });
  it("rejects invalid identifiers before opening a transaction", async () => {
    await expect(
      provisionResearchCase({ ...input, actorId: "invalid" }),
    ).rejects.toBeInstanceOf(ResearchCaseProvisioningError);
    expect(transaction).not.toHaveBeenCalled();
  });
  it.each([
    [
      "missing cohort",
      "COHORT_NOT_FOUND",
      () => {
        cohort = null;
      },
    ],
    ...["DRAFT", "CLOSED", "ARCHIVED"].map((status) => [
      status,
      "COHORT_NOT_ACTIVE",
      () => {
        cohort.status = status;
      },
    ]),
    [
      "no process",
      "COHORT_PROCESS_NOT_ASSIGNED",
      () => {
        cohort.workflowId = null;
      },
    ],
    [
      "missing process",
      "COHORT_PROCESS_NOT_FOUND",
      () => {
        workflow = null;
      },
    ],
    [
      "draft process",
      "COHORT_PROCESS_NOT_PUBLISHED",
      () => {
        workflow.status = "DRAFT";
      },
    ],
    [
      "archived process",
      "COHORT_PROCESS_NOT_PUBLISHED",
      () => {
        workflow.status = "ARCHIVED";
      },
    ],
    [
      "mismatched process",
      "INVALID_ACADEMIC_SCOPE",
      () => {
        workflow.researchTypeId = "other";
      },
    ],
    [
      "missing workspace",
      "WORKSPACE_NOT_FOUND",
      () => {
        workspace = null;
      },
    ],
    [
      "unlinked workspace",
      "WORKSPACE_COHORT_MISMATCH",
      () => {
        workspace.cohortId = null;
      },
    ],
    [
      "wrong cohort",
      "WORKSPACE_COHORT_MISMATCH",
      () => {
        workspace.cohortId = "other";
      },
    ],
    [
      "wrong program",
      "INVALID_ACADEMIC_SCOPE",
      () => {
        workspace.programId = "other";
      },
    ],
    [
      "wrong college",
      "INVALID_ACADEMIC_SCOPE",
      () => {
        cohort.program.collegeId = "other";
      },
    ],
    [
      "wrong research track",
      "INVALID_ACADEMIC_SCOPE",
      () => {
        cohort.researchType.programId = "other";
      },
    ],
    [
      "inactive year",
      "INVALID_ACADEMIC_SCOPE",
      () => {
        cohort.academicYear.isActive = false;
      },
    ],
    [
      "inactive program",
      "INVALID_ACADEMIC_SCOPE",
      () => {
        cohort.program.isActive = false;
      },
    ],
    [
      "inactive type",
      "INVALID_ACADEMIC_SCOPE",
      () => {
        cohort.researchType.isActive = false;
      },
    ],
    [
      "inactive college",
      "INVALID_ACADEMIC_SCOPE",
      () => {
        cohort.college.isActive = false;
      },
    ],
    [
      "actor outside cohort",
      "ACTOR_NOT_COHORT_MEMBER",
      () => {
        cohort.members.shift();
      },
    ],
    [
      "actor outside workspace",
      "ACTOR_NOT_WORKSPACE_MEMBER",
      () => {
        workspace.members.shift();
      },
    ],
    [
      "actor is member",
      "ACTOR_NOT_WORKSPACE_LEADER",
      () => {
        workspace.members[0].role = "MEMBER";
      },
    ],
    [
      "two leaders",
      "INVALID_TEAM_LEADERSHIP",
      () => {
        workspace.members[1].role = "LEADER";
      },
    ],
    [
      "solo with team",
      "INVALID_TEAM_LEADERSHIP",
      () => {
        workspace.participationMode = "SOLO";
      },
    ],
    [
      "outsider participant",
      "TEAM_MEMBER_NOT_IN_COHORT",
      () => {
        cohort.members.pop();
      },
    ],
    [
      "inactive participant",
      "TEAM_MEMBER_NOT_ELIGIBLE",
      () => {
        workspace.members[1].user.status = "INACTIVE";
      },
    ],
    [
      "non-researcher participant",
      "TEAM_MEMBER_NOT_ELIGIBLE",
      () => {
        workspace.members[1].user.roles = [];
      },
    ],
    [
      "wrong participant scope",
      "TEAM_MEMBER_NOT_ELIGIBLE",
      () => {
        workspace.members[1].user.programId = "other";
      },
    ],
    [
      "no active stage",
      "NO_ACTIVE_WORKFLOW_STAGE",
      () => {
        workflow.stages = [];
      },
    ],
  ] as Array<[string, string, () => void]>)(
    "rejects %s without provisioning",
    async (_label, code, change) => {
      change();
      await expect(provisionResearchCase(input)).rejects.toMatchObject({
        code,
      });
      expect(db.researchProject.create).not.toHaveBeenCalled();
      expect(db.workflowEnrollment.createMany).not.toHaveBeenCalled();
      expect(db.auditLog.create).not.toHaveBeenCalled();
    },
  );
  it.each(["REVOKED", "REMOVED", "INACTIVE", "UNKNOWN"])(
    "preserves %s enrollment as an authoritative denial",
    async (status) => {
      db.workflowEnrollment.findMany.mockResolvedValue([
        { userId: ids.member, status },
      ]);
      await expect(provisionResearchCase(input)).rejects.toMatchObject({
        code: "WORKFLOW_ACCESS_REVOKED",
      });
      expect(db.researchProject.create).not.toHaveBeenCalled();
      expect(db.workflowEnrollment.createMany).not.toHaveBeenCalled();
    },
  );
  it("retries a serialization conflict by opening a new complete transaction", async () => {
    transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("serialization", {
        code: "P2034",
        clientVersion: "test",
      }),
    );
    expect((await provisionResearchCase(input)).created).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(2);
  });
  it("bounds retries and propagates persistent serialization conflicts", async () => {
    transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("serialization", {
        code: "P2034",
        clientVersion: "test",
      }),
    );
    await expect(provisionResearchCase(input)).rejects.toMatchObject({
      code: "P2034",
    });
    expect(transaction).toHaveBeenCalledTimes(5);
  });
  it("does not retry domain validation errors", async () => {
    cohort.status = "CLOSED";
    await expect(provisionResearchCase(input)).rejects.toMatchObject({
      code: "COHORT_NOT_ACTIVE",
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
