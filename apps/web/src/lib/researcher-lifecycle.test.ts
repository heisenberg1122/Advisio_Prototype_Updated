import { describe, expect, it } from "vitest";
import {
  resolveResearcherLifecycle,
  researchStartError,
  type ResearchCohortOption,
  type ResearchTeamOption,
  type ResearchCaseOption,
} from "./researcher-lifecycle";
const cohort: ResearchCohortOption = {
  id: "c",
  name: "2026 Biology",
  status: "ACTIVE",
  workflowId: "w",
  workflow: { id: "w", status: "PUBLISHED" },
};
const team: ResearchTeamOption = {
  id: "t",
  name: "Team",
  cohortId: "c",
  members: [
    { userId: "leader", role: "LEADER" },
    { userId: "member", role: "MEMBER" },
  ],
};
const study: ResearchCaseOption = {
  id: "p",
  title: "Working study",
  cohortId: "c",
  workspaceId: "t",
  isTitleProvisional: true,
  workflowInstance: { workflowId: "pinned" },
};
const resolve = (
  input: Partial<
    Parameters<typeof resolveResearcherLifecycle<ResearchCaseOption>>[0]
  > = {},
) =>
  resolveResearcherLifecycle({
    cohorts: [cohort],
    teams: [],
    projects: [],
    userId: "leader",
    ...input,
  });
describe("cohort-driven researcher lifecycle", () => {
  it("does not offer start without active membership", () => {
    expect(resolve({ cohorts: [] })).toMatchObject({
      state: "NO_ACTIVE_COHORT",
      canStart: false,
    });
  });
  it("preselects exactly one active cohort and offers team setup", () => {
    expect(resolve()).toMatchObject({
      state: "COHORT_NO_TEAM",
      cohort,
      canStart: false,
    });
  });
  it.each([
    null,
    { id: "w", status: "DRAFT" },
    { id: "other", status: "PUBLISHED" },
  ])("requires the cohort's valid published process: %s", (workflow) => {
    expect(
      resolve({ cohorts: [{ ...cohort, workflow }], teams: [team] }),
    ).toMatchObject({ state: "COHORT_NO_PROCESS", canStart: false });
  });
  it("requires explicit selection among cohorts", () => {
    expect(
      resolve({ cohorts: [cohort, { ...cohort, id: "other" }] }),
    ).toMatchObject({ state: "SELECT_COHORT", cohort: null, canStart: false });
  });
  it("rejects an arbitrary cohort identifier", () => {
    expect(resolve({ cohortId: "unauthorized" })).toMatchObject({
      invalidContext: true,
      canStart: false,
    });
  });
  it("requires explicit team selection", () => {
    const teams = [team, { ...team, id: "second" }];
    expect(resolve({ teams })).toMatchObject({
      state: "SELECT_TEAM",
      team: null,
      canStart: false,
    });
    expect(resolve({ teams, workspaceId: "second" })).toMatchObject({
      state: "TEAM_FORMING",
      team: { id: "second" },
      canStart: true,
    });
  });
  it("rejects another cohort's team and legacy unlinked teams for new research", () => {
    for (const cohortId of ["other", null]) {
      expect(
        resolve({
          teams: [{ ...team, cohortId }],
          cohortId: "c",
          workspaceId: "t",
        }),
      ).toMatchObject({ invalidContext: true, canStart: false });
    }
  });
  it("workspace existence alone means team forming", () => {
    expect(resolve({ teams: [team] })).toMatchObject({
      state: "TEAM_FORMING",
      project: null,
      canStart: true,
    });
  });
  it("only the active leader may start", () => {
    expect(resolve({ teams: [team], userId: "member" })).toMatchObject({
      state: "TEAM_FORMING",
      canStart: false,
      isLeader: false,
    });
    expect(
      resolve({
        teams: [
          {
            ...team,
            members: [
              { userId: "leader", role: "LEADER", leftAt: "2026-10-27" },
            ],
          },
        ],
      }).canStart,
    ).toBe(false);
  });
  it("supports explicit solo workspaces without automatic creation", () => {
    expect(
      resolve({ teams: [{ ...team, participationMode: "SOLO" }] }),
    ).toMatchObject({ canStart: true, project: null });
  });
  it.each(["CLOSED", "ARCHIVED", "DRAFT"] as const)(
    "blocks new research in %s cohorts",
    (status) => {
      expect(
        resolve({
          cohorts: [{ ...cohort, status }],
          cohortId: "c",
          teams: [team],
        }),
      ).toMatchObject({ state: "COHORT_INACTIVE", canStart: false });
    },
  );
  it.each(["CLOSED", "ARCHIVED"] as const)(
    "keeps an authorized case in a %s cohort",
    (status) => {
      expect(
        resolve({
          cohorts: [{ ...cohort, status }],
          teams: [team],
          projects: [study],
        }),
      ).toMatchObject({
        state: "COHORT_HISTORY",
        project: study,
        canStart: false,
      });
    },
  );
  it("new assignments cannot replace a case's pinned process", () => {
    expect(
      resolve({ projects: [study], cohorts: [{ ...cohort, workflow: null }] }),
    ).toMatchObject({
      state: "RESEARCH_CASE_ACTIVE",
      project: { workflowInstance: { workflowId: "pinned" } },
    });
  });
  it("retains legacy cohort-null cases without Start Research", () => {
    expect(
      resolve({
        cohorts: [],
        projects: [
          {
            ...study,
            cohortId: null,
            workspaceId: null,
            isTitleProvisional: false,
          },
        ],
      }),
    ).toMatchObject({ state: "RESEARCH_CASE_ACTIVE", canStart: false });
  });
  it("keeps a case visible when process access is revoked", () => {
    expect(
      resolve({
        projects: [
          { ...study, workflowAccessRemoved: true, workflowInstance: null },
        ],
      }),
    ).toMatchObject({
      state: "RESEARCH_CASE_ACTIVE",
      project: { workflowAccessRemoved: true },
      canStart: false,
    });
  });
  it("never guesses between cases sharing a process", () => {
    const projects = [study, { ...study, id: "p2" }];
    expect(resolve({ projects })).toMatchObject({
      state: "SELECT_CASE",
      project: null,
    });
    expect(resolve({ projects, requestedProjectId: "p2" }).project?.id).toBe(
      "p2",
    );
    expect(resolve({ projects, requestedProjectId: "forged" })).toMatchObject({
      state: "SELECT_CASE",
      invalidContext: true,
      project: null,
    });
  });
  it("explicit setup supersedes a remembered unrelated case", () => {
    expect(
      resolve({
        projects: [{ ...study, cohortId: null }],
        projectId: "p",
        cohortId: "c",
        teams: [team],
      }),
    ).toMatchObject({ state: "TEAM_FORMING", project: null });
  });
  it("an authorized case URL wins over stale setup parameters", () => {
    expect(
      resolve({
        projects: [study],
        requestedProjectId: "p",
        cohortId: "stale",
        workspaceId: "stale",
      }).project,
    ).toBe(study);
  });
});
describe("research start errors", () => {
  it.each([
    ["Research can only start in an active cohort.", "not currently active"],
    [
      "The coordinator must assign a research process before the team starts.",
      "coordinator has not assigned",
    ],
    [
      "Active workspace membership is required to start research.",
      "membership must be resolved",
    ],
    [
      "Every active team participant must belong to this research cohort.",
      "not active members",
    ],
    [
      "This team cannot start because one or more members do not currently have access to the assigned research process. Ask the coordinator to resolve access.",
      "do not have access",
    ],
    [
      "Only the active workspace leader can start research.",
      "Only the research team leader",
    ],
  ])("translates the HTTP response: %s", (message, expected) => {
    expect(researchStartError(new Error(message))).toContain(expected);
  });
  it.each([
    ["COHORT_NOT_ACTIVE", "not currently active"],
    ["COHORT_PROCESS_UNAVAILABLE", "coordinator has not assigned"],
    ["INVALID_TEAM", "membership must be resolved"],
    ["TEAM_MEMBER_NOT_IN_COHORT", "not active members"],
    ["WORKFLOW_ACCESS_REVOKED", "do not have access"],
    ["ACTOR_NOT_WORKSPACE_LEADER", "Only the research team leader"],
  ])("translates %s without repairing access", (code, expected) => {
    expect(researchStartError(new Error(code))).toContain(expected);
  });
});
