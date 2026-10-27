import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";
import {
  addCoordinatorResearcher,
  assignCoordinatorProcess,
  cohortActions,
  cohortError,
  cohortKeys,
  createCoordinatorCohort,
  eligibleProcesses,
  loadCoordinatorCohorts,
  removeCoordinatorResearcher,
  scopedPrograms,
  updateCoordinatorCohort,
  type AcademicProgram,
  type CoordinatorCohort,
  type CoordinatorIdentity,
} from "./coordinator-cohorts";
const program: AcademicProgram = {
  id: "program",
  collegeId: "college",
  name: "Biology",
  researchTypes: [
    { id: "track", name: "Thesis", programId: "program", isActive: true },
  ],
};
const user: CoordinatorIdentity = {
  roles: ["RESEARCH_COORDINATOR"],
  permissions: [],
  college: { id: "college", name: "Science", code: "SCI" },
  program: { id: "program", name: "Biology", code: "BIO" },
};
const cohort = {
  id: "cohort",
  name: "Batch",
  description: null,
  collegeId: "college",
  programId: "program",
  researchTypeId: "track",
  academicYearId: "year",
  workflowId: null,
  status: "DRAFT",
  college: { id: "college", name: "Science" },
  program,
  researchType: { id: "track", name: "Thesis" },
  academicYear: { id: "year", name: "2026" },
  workflow: null,
  _count: { members: 0, workspaces: 0, researchProjects: 0 },
} as CoordinatorCohort;
const process = {
  id: "process",
  name: "Process",
  version: 1,
  status: "PUBLISHED",
  researchTypeId: "track",
};
const year = { id: "year", name: "2026", isActive: true };
const draft = {
  name: " Batch ",
  description: " team ",
  programId: "program",
  researchTypeId: "track",
  academicYearId: "year",
};
const respond = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
afterEach(() => vi.unstubAllGlobals());
describe("coordinator academic choices and lifecycle policy", () => {
  it("only allows active scoped programs and respects a coordinator's program assignment", () => {
    const sibling = { ...program, id: "sibling" };
    const foreign = { ...program, id: "foreign", collegeId: "other" };
    expect(
      scopedPrograms(
        [
          program,
          sibling,
          foreign,
          { ...program, id: "inactive", isActive: false },
        ],
        user,
      ),
    ).toEqual([program]);
    expect(
      scopedPrograms([program, sibling, foreign], { ...user, program: null }),
    ).toEqual([program, sibling]);
    expect(
      scopedPrograms([program], { ...user, roles: ["RESEARCHER"] }),
    ).toEqual([]);
  });
  it.each(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"] as const)(
    "follows existing %s transitions without inventing restore/delete",
    (status) => {
      const policy = cohortActions({ ...cohort, status });
      expect(policy.statuses).toEqual(
        {
          DRAFT: ["ACTIVE", "ARCHIVED"],
          ACTIVE: ["CLOSED", "ARCHIVED"],
          CLOSED: ["ACTIVE", "ARCHIVED"],
          ARCHIVED: [],
        }[status],
      );
      expect(policy.members).toBe(["DRAFT", "ACTIVE"].includes(status));
      expect(policy.edit).toBe(status !== "ARCHIVED");
    },
  );
  it("permits activation without inventing a nonempty-member requirement", () => {
    expect(cohortActions(cohort).statuses).toContain("ACTIVE");
  });
  it("blocks reassignment when any team or case exists, including active cohorts", () => {
    for (const _count of [
      { members: 0, workspaces: 1, researchProjects: 0 },
      { members: 0, workspaces: 0, researchProjects: 1 },
    ])
      expect(
        cohortActions({ ...cohort, status: "ACTIVE", _count }).assign,
      ).toBe(false);
  });
  it("selects only published same-track processes returned by the authorized API", () => {
    expect(
      eligibleProcesses(
        [
          process,
          { ...process, id: "draft", status: "DRAFT" },
          { ...process, id: "other", researchTypeId: "other" },
        ],
        cohort,
      ),
    ).toEqual([process]);
  });
});
describe("coordinator cohort mutation contracts and refresh", () => {
  it("creates only a cohort with college derived from the selected scoped program", async () => {
    const fetch = vi.fn().mockResolvedValue(respond({ cohort }, 201));
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const created = await createCoordinatorCohort(
      client,
      user,
      [program],
      [year],
      draft,
    );
    expect(created).toEqual(cohort);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/cohorts");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      name: "Batch",
      description: "team",
      collegeId: "college",
      programId: "program",
      researchTypeId: "track",
      academicYearId: "year",
    });
    expect(client.getQueryData(cohortKeys.list)).toEqual({ cohorts: [cohort] });
    expect(client.getQueryData(cohortKeys.detail("cohort"))).toEqual({
      cohort,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: cohortKeys.all });
    client.clear();
  });
  it.each([
    { programId: "forged" },
    { researchTypeId: "forged" },
    { academicYearId: "forged" },
  ])(
    "rejects unreturned or out-of-scope academic choice %s before writing",
    async (change) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const client = new QueryClient();
      await expect(
        createCoordinatorCohort(client, user, [program], [year], {
          ...draft,
          ...change,
        }),
      ).rejects.toThrow("within your scope");
      expect(fetch).not.toHaveBeenCalled();
      client.clear();
    },
  );
  it("assignment uses only the cohort endpoint and never mutates an existing research case", async () => {
    const updated = { ...cohort, workflowId: process.id, workflow: process };
    const fetch = vi.fn().mockResolvedValue(respond({ cohort: updated }));
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    const pinned = {
      projects: [
        {
          id: "case",
          workflowInstance: { workflowId: "old", currentStageId: "stage" },
        },
      ],
    };
    client.setQueryData(["professor-research"], pinned);
    await assignCoordinatorProcess(client, cohort, [process], process.id);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/cohorts/cohort/workflow");
    expect(fetch.mock.calls[0][1].method).toBe("PUT");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      workflowId: "process",
    });
    expect(client.getQueryData(cohortKeys.detail("cohort"))).toEqual({
      cohort: updated,
    });
    expect(client.getQueryData(["professor-research"])).toBe(pinned);
    client.clear();
  });
  it("rejects a draft, wrong-track or unavailable process without publishing/repairing it", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    for (const processes of [
      [],
      [{ ...process, status: "DRAFT" }],
      [{ ...process, researchTypeId: "other" }],
    ])
      await expect(
        assignCoordinatorProcess(client, cohort, processes, process.id),
      ).rejects.toThrow("cannot be assigned");
    expect(fetch).not.toHaveBeenCalled();
    client.clear();
  });
  it("uses backend-returned soft membership state and only cohort member endpoints", async () => {
    const active = {
      id: "membership",
      userId: "student",
      status: "ACTIVE",
      removedAt: null,
      joinedAt: "2026",
      user: { id: "student", firstName: "Nicole", lastName: "B" },
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(respond({ members: [active] }, 201))
      .mockResolvedValueOnce(
        respond({
          member: { ...active, status: "REMOVED", removedAt: "2026-10-27" },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    await addCoordinatorResearcher(
      client,
      "cohort",
      [
        {
          id: "student",
          firstName: "Nicole",
          lastName: "B",
          email: "n@example.test",
        },
      ],
      "student",
    );
    expect(client.getQueryData(cohortKeys.members("cohort"))).toEqual({
      members: [active],
    });
    await removeCoordinatorResearcher(client, "cohort", "student");
    expect(client.getQueryData(cohortKeys.members("cohort"))).toMatchObject({
      members: [
        { id: "membership", status: "REMOVED", removedAt: "2026-10-27" },
      ],
    });
    expect(fetch.mock.calls.map((call) => [call[0], call[1].method])).toEqual([
      ["/api/cohorts/cohort/members", "POST"],
      ["/api/cohorts/cohort/members/student", "DELETE"],
    ]);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      userIds: ["student"],
    });
    client.clear();
  });
  it("does not accept arbitrary researcher IDs or mutate enrollment as a fallback", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    await expect(
      addCoordinatorResearcher(client, "cohort", [], "forged"),
    ).rejects.toThrow("eligible researcher");
    expect(fetch).not.toHaveBeenCalled();
    client.clear();
  });
  it("status and metadata changes use the existing PATCH contract and refresh list/detail", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(respond({ cohort: { ...cohort, status: "ACTIVE" } }));
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    await updateCoordinatorCohort(client, "cohort", { status: "ACTIVE" });
    expect(fetch.mock.calls[0][0]).toBe("/api/cohorts/cohort");
    expect(fetch.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      status: "ACTIVE",
    });
    expect(client.getQueryData(cohortKeys.list)).toMatchObject({
      cohorts: [{ status: "ACTIVE" }],
    });
    client.clear();
  });
  it("preserves assignment and case state after an assignment failure", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        respond(
          { error: "Only a published workflow may be assigned to a cohort." },
          409,
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient();
    client.setQueryData(cohortKeys.detail("cohort"), { cohort });
    await expect(
      assignCoordinatorProcess(client, cohort, [process], process.id),
    ).rejects.toThrow("published");
    expect(client.getQueryData(cohortKeys.detail("cohort"))).toEqual({
      cohort,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    client.clear();
  });
  it("paginates authorized cohort lists instead of omitting later batches", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        respond({ cohorts: [cohort], pagination: { totalPages: 2 } }),
      )
      .mockResolvedValueOnce(
        respond({
          cohorts: [{ ...cohort, id: "second" }],
          pagination: { totalPages: 2 },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(
      (await loadCoordinatorCohorts()).cohorts.map((item) => item.id),
    ).toEqual(["cohort", "second"]);
    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      "/api/cohorts?page=1&limit=100",
      "/api/cohorts?page=2&limit=100",
    ]);
  });
});
describe("cohort error presentation", () => {
  it.each([
    [
      "Only a published workflow may be assigned to a cohort.",
      "published research processes",
    ],
    [
      "The workflow must belong to the cohort's research type and academic scope.",
      "cannot be assigned",
    ],
    [
      "Every selected account must be an active researcher in the cohort's college and program.",
      "cannot be added",
    ],
    ["This cohort status transition is not allowed.", "requested status"],
  ])("translates %s", (message, expected) =>
    expect(cohortError(new ApiError(message, 409))).toContain(expected),
  );
  it("does not expose raw database messages", () =>
    expect(
      cohortError(new ApiError("Prisma P2003 constraint failed", 500)),
    ).toBe("Unable to complete the cohort operation. Please try again."));
});
