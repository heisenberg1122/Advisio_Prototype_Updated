import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../middleware/auth.js";

const db = vi.hoisted(() => ({
  researchCohort: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  researchCohortMember: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  researchType: { findFirst: vi.fn(), update: vi.fn() },
  academicYear: { findFirst: vi.fn() },
  workflow: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  researchProject: { create: vi.fn() },
  researchWorkspace: { create: vi.fn() },
  workflowEnrollment: { upsert: vi.fn() },
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: db,
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
}));
import {
  addCohortMembers,
  assignCohortWorkflow,
  cohortScopeWhere,
  createCohort,
  getCohort,
  listCohortMembers,
  listCohorts,
  removeCohortMember,
  updateCohort,
} from "./cohort.service.js";

const user = (
  roles: AuthenticatedUser["roles"] = ["RESEARCH_COORDINATOR"],
  extra = {},
): AuthenticatedUser => ({
  id: "coordinator",
  email: "coordinator@example.test",
  universityId: "coordinator",
  roles,
  permissions: [],
  collegeId: "college",
  programId: "program",
  ...extra,
});
const cohort = {
  id: "cohort",
  name: "Cohort",
  description: null,
  collegeId: "college",
  programId: "program",
  researchTypeId: "type",
  academicYearId: "year",
  workflowId: null,
  status: "DRAFT",
  _count: { workspaces: 0, researchProjects: 0, members: 0 },
};
const creation = {
  name: "Cohort",
  collegeId: "college",
  programId: "program",
  researchTypeId: "type",
  academicYearId: "year",
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((action) => action(db));
  db.researchCohort.findFirst.mockResolvedValue(cohort);
  db.researchCohort.create.mockResolvedValue(cohort);
  db.researchCohort.update.mockImplementation(({ data }) => ({
    ...cohort,
    ...data,
  }));
  db.researchType.findFirst.mockResolvedValue({ id: "type" });
  db.academicYear.findFirst.mockResolvedValue({ id: "year" });
  db.workflow.findUnique.mockResolvedValue({
    id: "workflow",
    researchTypeId: "type",
    status: "PUBLISHED",
  });
  db.user.findMany.mockImplementation(({ where }) =>
    where.id.in.map((id: string) => ({ id })),
  );
  db.researchCohortMember.findMany.mockResolvedValue([]);
  db.researchCohortMember.upsert.mockImplementation(({ create, update }) => ({
    id: "member",
    ...create,
    ...update,
  }));
});

afterEach(() => {
  expect(db.researchProject.create).not.toHaveBeenCalled();
  expect(db.researchWorkspace.create).not.toHaveBeenCalled();
  expect(db.workflowEnrollment.upsert).not.toHaveBeenCalled();
  expect(db.researchType.update).not.toHaveBeenCalled();
});

describe("cohort authorization", () => {
  it("uses program scope for assigned coordinators and college scope for deans", () => {
    expect(cohortScopeWhere(user())).toEqual({
      collegeId: "college",
      programId: "program",
    });
    expect(
      cohortScopeWhere(user(["RESEARCH_COORDINATOR"], { programId: null })),
    ).toEqual({ collegeId: "college" });
    expect(cohortScopeWhere(user(["DEAN"]))).toEqual({ collegeId: "college" });
    expect(
      cohortScopeWhere(user(["SYSTEM_ADMIN"], { collegeId: null })),
    ).toEqual({});
  });
  it("requires active membership for researchers and denies unassigned or unrelated roles", () => {
    expect(cohortScopeWhere(user(["RESEARCHER"]))).toMatchObject({
      collegeId: "college",
      programId: "program",
      members: { some: { userId: "coordinator", status: "ACTIVE" } },
    });
    expect(() =>
      cohortScopeWhere(user(["DEAN"], { collegeId: null })),
    ).toThrow();
    expect(() => cohortScopeWhere(user(["ADVISER"]))).toThrow();
  });
  it("intersects user filters with scope instead of allowing a scope override", async () => {
    db.researchCohort.findMany.mockResolvedValue([]);
    db.researchCohort.count.mockResolvedValue(0);
    await listCohorts(user(), { page: 2, limit: 10, collegeId: "outside" });
    expect(db.researchCohort.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { collegeId: "college", programId: "program" },
            { collegeId: "outside" },
          ],
        },
        skip: 10,
        take: 10,
      }),
    );
  });
  it("does not expose out-of-scope detail or roster records", async () => {
    db.researchCohort.findFirst.mockResolvedValue(null);
    await expect(getCohort(user(), "outside")).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(listCohortMembers(user(), "outside")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(db.researchCohortMember.findMany).not.toHaveBeenCalled();
  });
  it("denies researcher management even when called directly with elevated permissions", async () => {
    const researcher = user(["RESEARCHER"], {
      permissions: ["workflow.edit", "research.assign"],
    });
    await expect(createCohort(researcher, creation)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(
      assignCohortWorkflow(researcher, "cohort", "workflow"),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.researchCohort.update).not.toHaveBeenCalled();
  });
  it("limits researcher rosters to active members and basic identities", async () => {
    await listCohortMembers(user(["RESEARCHER"]), "cohort");
    expect(db.researchCohortMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cohortId: "cohort", status: "ACTIVE" },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    );
  });
});

describe("cohort configuration and workflow assignment", () => {
  it("creates a scoped draft and audit event in one transaction", async () => {
    await createCohort(user(), creation);
    expect(db.researchCohort.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { ...creation, description: null, createdBy: "coordinator" },
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CREATE",
          entityType: "ResearchCohort",
        }),
      }),
    );
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });
  it("rejects cross-college or cross-program creation before any write", async () => {
    await expect(
      createCohort(user(), { ...creation, collegeId: "outside" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      createCohort(user(), { ...creation, programId: "outside" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.researchCohort.create).not.toHaveBeenCalled();
  });
  it.each(["researchType", "academicYear"] as const)(
    "rejects invalid or inactive %s context",
    async (model) => {
      db[model].findFirst.mockResolvedValue(null);
      await expect(createCohort(user(), creation)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(db.researchCohort.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    [null, 404],
    [{ id: "w", researchTypeId: "outside", status: "PUBLISHED" }, 400],
    [{ id: "w", researchTypeId: "type", status: "DRAFT" }, 409],
    [{ id: "w", researchTypeId: "type", status: "ARCHIVED" }, 409],
  ])(
    "rejects unavailable or incompatible workflow %j",
    async (workflow, statusCode) => {
      db.workflow.findUnique.mockResolvedValue(workflow);
      await expect(
        assignCohortWorkflow(user(), "cohort", "w"),
      ).rejects.toMatchObject({ statusCode });
      expect(db.researchCohort.update).not.toHaveBeenCalled();
    },
  );
  it("assigns the process on the cohort without updating the global research-type pointer", async () => {
    await assignCohortWorkflow(user(), "cohort", "workflow");
    expect(db.$executeRaw).toHaveBeenCalled();
    expect(db.researchCohort.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { workflowId: "workflow" } }),
    );
    expect(db.auditLog.create).toHaveBeenCalled();
  });
  it("protects attached workspaces/projects from a silent process replacement", async () => {
    db.researchCohort.findFirst.mockResolvedValue({
      ...cohort,
      _count: { workspaces: 1, researchProjects: 0 },
    });
    await expect(
      assignCohortWorkflow(user(), "cohort", "workflow"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.researchCohort.update).not.toHaveBeenCalled();
  });
  it("requires an assigned published process for activation", async () => {
    await expect(
      updateCohort(user(), "cohort", { status: "ACTIVE" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    db.researchCohort.findFirst.mockResolvedValue({
      ...cohort,
      workflowId: "workflow",
    });
    await updateCohort(user(), "cohort", { status: "ACTIVE" });
    expect(db.workflow.findUnique).toHaveBeenCalled();
  });
  it("rejects rollback to draft and keeps archived cohorts read-only", async () => {
    db.researchCohort.findFirst.mockResolvedValue({
      ...cohort,
      status: "ACTIVE",
    });
    await expect(
      updateCohort(user(), "cohort", { status: "DRAFT" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    db.researchCohort.findFirst.mockResolvedValue({
      ...cohort,
      status: "ARCHIVED",
    });
    await expect(
      updateCohort(user(), "cohort", { name: "Changed" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      updateCohort(user(), "cohort", { status: "ARCHIVED" }),
    ).resolves.toMatchObject({ status: "ARCHIVED" });
  });
});

describe("transactional cohort membership", () => {
  it("rejects an ineligible batch before adding any researcher", async () => {
    db.user.findMany.mockResolvedValue([{ id: "eligible" }]);
    await expect(
      addCohortMembers(user(), "cohort", ["eligible", "outside"]),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.researchCohortMember.upsert).not.toHaveBeenCalled();
  });
  it("reactivates the existing unique row and clears removal metadata", async () => {
    db.researchCohortMember.findMany.mockResolvedValue([
      { id: "member", userId: "student", status: "REMOVED" },
    ]);
    await addCohortMembers(user(), "cohort", ["student"]);
    expect(db.researchCohortMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cohortId_userId: { cohortId: "cohort", userId: "student" } },
        update: {
          status: "ACTIVE",
          removedAt: null,
          joinedAt: expect.any(Date),
        },
      }),
    );
  });
  it("preserves joinedAt when an active member is added again", async () => {
    const active = {
      id: "member",
      userId: "student",
      status: "ACTIVE",
      joinedAt: new Date(0),
    };
    db.researchCohortMember.findMany.mockResolvedValue([active]);
    expect(
      await addCohortMembers(user(), "cohort", ["student", "student"]),
    ).toEqual([active]);
    expect(db.researchCohortMember.upsert).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it("removes softly and records the removal without changing legacy enrollment", async () => {
    db.researchCohortMember.findUnique.mockResolvedValue({
      id: "member",
      status: "ACTIVE",
    });
    await removeCohortMember(user(), "cohort", "student");
    expect(db.researchCohortMember.update).toHaveBeenCalledWith({
      where: { id: "member" },
      data: { status: "REMOVED", removedAt: expect.any(Date) },
    });
    expect(db.auditLog.create).toHaveBeenCalled();
  });
  it("returns an already removed row without rewriting its timestamp", async () => {
    const removed = { id: "member", status: "REMOVED", removedAt: new Date(0) };
    db.researchCohortMember.findUnique.mockResolvedValue(removed);
    expect(await removeCohortMember(user(), "cohort", "student")).toEqual(
      removed,
    );
    expect(db.researchCohortMember.update).not.toHaveBeenCalled();
  });
  it.each(["CLOSED", "ARCHIVED"])(
    "rejects membership changes in %s cohorts",
    async (status) => {
      db.researchCohort.findFirst.mockResolvedValue({ ...cohort, status });
      await expect(
        addCohortMembers(user(), "cohort", ["student"]),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        removeCohortMember(user(), "cohort", "student"),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(db.researchCohortMember.update).not.toHaveBeenCalled();
    },
  );
});
