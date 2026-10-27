import { describe, expect, it } from "vitest";
import {
  backfillTarget,
  formatBackfillSummary,
  parseBackfillOptions,
  planLegacyCohortBackfill,
  type BackfillSnapshot,
} from "@research-management/database/legacy-cohort-backfill";

function snapshot(): BackfillSnapshot {
  return {
    projects: [
      {
        id: "p",
        collegeId: "c",
        programId: "pr",
        researchTypeId: "t",
        academicYearId: "y",
        workflowInstanceId: "i",
        cohortId: null,
        workspaceId: "w",
      },
    ],
    workspaces: [{ id: "w", collegeId: "c", programId: "pr", cohortId: null }],
    instances: [
      {
        id: "i",
        researchId: "p",
        workflowId: "f",
        workflowVersion: 1,
        currentStageId: "stage",
      },
    ],
    stages: [{ id: "stage", workflowId: "f" }],
    workflows: [
      {
        id: "f",
        researchTypeId: "t",
        name: "Persisted process",
        createdBy: "owner",
        status: "PUBLISHED",
      },
    ],
    cohorts: [
      {
        id: "co",
        collegeId: "c",
        programId: "pr",
        researchTypeId: "t",
        academicYearId: "y",
        workflowId: "f",
        status: "ACTIVE",
      },
    ],
    cohortMembers: [],
    researchMembers: [
      {
        id: "rm",
        researchId: "p",
        userId: "student",
        projectRole: "LEADER",
        leftAt: null,
      },
    ],
    workspaceMembers: [
      {
        id: "wm",
        workspaceId: "w",
        userId: "student",
        role: "LEADER",
        leftAt: null,
      },
    ],
    enrollments: [
      { id: "e", workflowId: "f", userId: "student", status: "ACTIVE" },
    ],
    users: [
      {
        id: "student",
        collegeId: "c",
        programId: "pr",
        status: "ACTIVE",
        roles: ["RESEARCHER"],
        academicYearId: "y",
      },
      {
        id: "owner",
        collegeId: "c",
        programId: "pr",
        status: "ACTIVE",
        roles: ["RESEARCH_COORDINATOR"],
        academicYearId: null,
      },
    ],
    programs: [{ id: "pr", collegeId: "c" }],
    researchTypes: [{ id: "t", programId: "pr" }],
    years: [{ id: "y", name: "2098-2099" }],
  };
}
const actions = (s: BackfillSnapshot) =>
  planLegacyCohortBackfill(s).groups.flatMap((group) => group.actions);
const reasons = (s: BackfillSnapshot) =>
  planLegacyCohortBackfill(s).findings.map((f) => f.code);
describe("conservative legacy cohort planner", () => {
  it("plans unique cohort links and deduplicates independent project/team membership without mutating inputs", () => {
    const s = snapshot(),
      before = structuredClone(s),
      plan = planLegacyCohortBackfill(s);
    expect(plan.counts).toMatchObject({
      SAFE_EXISTING_COHORT_MATCH: 1,
      PROJECT_LINK_UPDATE: 1,
      WORKSPACE_LINK_UPDATE: 1,
      MEMBERSHIP_CREATE: 1,
    });
    expect(
      actions(s).find((a) => a.kind === "MEMBERSHIP_CREATE")?.evidence,
    ).toEqual(["ACTIVE_RESEARCH_MEMBER:p", "ACTIVE_WORKSPACE_MEMBER:w"]);
    expect(s).toEqual(before);
    expect(plan).toEqual(planLegacyCohortBackfill(s));
  });
  it.each(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"])(
    "matches existing %s cohorts without lifecycle mutation",
    (status) => {
      const s = snapshot();
      s.cohorts[0].status = status;
      expect(actions(s)).toHaveLength(3);
      expect(s.cohorts[0].status).toBe(status);
    },
  );
  it("no-ops correct links and existing ACTIVE membership", () => {
    const s = snapshot();
    s.projects[0].cohortId = "co";
    s.workspaces[0].cohortId = "co";
    s.cohortMembers.push({
      id: "cm",
      cohortId: "co",
      userId: "student",
      status: "ACTIVE",
    });
    const plan = planLegacyCohortBackfill(s);
    expect(plan.counts).toMatchObject({
      ALREADY_MIGRATED: 1,
      MEMBERSHIP_ALREADY_EXISTS: 1,
    });
    expect(plan.groups).toEqual([]);
  });
  it("skips multiple exact matches instead of using lifecycle, owner or ordering as a tie breaker", () => {
    const s = snapshot();
    s.cohorts.push({ ...s.cohorts[0], id: "second", status: "ARCHIVED" });
    expect(reasons(s)).toContain("AMBIGUOUS_EXISTING_COHORT");
    expect(actions(s)).toEqual([]);
    expect(formatBackfillSummary(planLegacyCohortBackfill(s), true)).toContain(
      "SKIP AMBIGUOUS_EXISTING_COHORT: ResearchProject:p",
    );
  });
  it.each([
    "collegeId",
    "programId",
    "researchTypeId",
    "academicYearId",
    "workflowId",
  ] as const)("does not match on an incompatible %s", (field) => {
    const s = snapshot();
    s.cohorts[0][field] = "other";
    expect(planLegacyCohortBackfill(s).counts.SAFE_EXISTING_COHORT_MATCH).toBe(
      0,
    );
  });
  it("requires the pinned instance, never substitutes another process", () => {
    const s = snapshot();
    s.projects[0].workflowInstanceId = null;
    expect(reasons(s)).toContain("NO_PINNED_WORKFLOW");
    expect(actions(s)).toEqual([]);
  });
  it("rejects a reverse-instance conflict and a current stage from another workflow", () => {
    for (const field of ["researchId", "currentStageId"] as const) {
      const s = snapshot();
      s.instances[0][field] = "wrong";
      expect(reasons(s)).toContain("PINNED_WORKFLOW_CONFLICT");
      expect(actions(s)).toEqual([]);
    }
  });
  it("reports missing academic year, which cannot be null in valid current database rows", () => {
    const s = snapshot();
    s.projects[0].academicYearId = null;
    expect(reasons(s)).toContain("MISSING_ACADEMIC_YEAR");
    expect(actions(s)).toEqual([]);
  });
  it.each(["project", "workspace"])(
    "fills the missing side of a valid partial %s linkage",
    (side) => {
      const s = snapshot();
      if (side === "project") s.projects[0].cohortId = "co";
      else s.workspaces[0].cohortId = "co";
      expect(
        actions(s).filter((a) => a.kind.endsWith("LINK_UPDATE")),
      ).toHaveLength(1);
    },
  );
  it("preserves disagreeing non-null project/workspace cohort IDs", () => {
    const s = snapshot();
    s.projects[0].cohortId = "co";
    s.workspaces[0].cohortId = "other";
    expect(reasons(s)).toContain("PROJECT_WORKSPACE_COHORT_CONFLICT");
    expect(actions(s)).toEqual([]);
  });
  it("links one workspace only after all its cases resolve", () => {
    const s = snapshot();
    s.projects.push({ ...s.projects[0], id: "p2", workflowInstanceId: "i2" });
    s.instances.push({ ...s.instances[0], id: "i2", researchId: "p2" });
    expect(
      actions(s).filter((a) => a.kind === "WORKSPACE_LINK_UPDATE"),
    ).toHaveLength(1);
    s.projects[1].workflowInstanceId = null;
    expect(reasons(s)).toContain("UNRESOLVED_WORKSPACE_CASE");
    expect(
      actions(s).filter((a) => a.kind === "WORKSPACE_LINK_UPDATE"),
    ).toHaveLength(0);
  });
  it("leaves a multi-cohort workspace null while retaining safe individual links", () => {
    const s = snapshot();
    s.workflows.push({ ...s.workflows[0], id: "f2" });
    s.cohorts.push({ ...s.cohorts[0], id: "co2", workflowId: "f2" });
    s.projects.push({ ...s.projects[0], id: "p2", workflowInstanceId: "i2" });
    s.instances.push({
      ...s.instances[0],
      id: "i2",
      researchId: "p2",
      workflowId: "f2",
      currentStageId: null,
    });
    expect(reasons(s)).toContain("WORKSPACE_MULTI_COHORT_CONFLICT");
    expect(
      actions(s).filter((a) => a.kind === "PROJECT_LINK_UPDATE"),
    ).toHaveLength(2);
    expect(actions(s).some((a) => a.kind === "WORKSPACE_LINK_UPDATE")).toBe(
      false,
    );
    expect(planLegacyCohortBackfill(s).groups).toHaveLength(1);
  });
  it("plans DRAFT creation only for a reconciled persisted workflow container", () => {
    const s = snapshot();
    s.cohorts = [];
    const create = actions(s).find((a) => a.kind === "CREATE_COHORT");
    expect(create).toMatchObject({
      createdBy: "owner",
      name: "Persisted process — 2098-2099 — Migrated",
    });
    s.enrollments = [];
    expect(actions(s)).toEqual([]);
    expect(reasons(s)).toContain("UNRECONCILED_LEGACY_POPULATION");
  });
  it("does not reconstruct a workflow container across academic years", () => {
    const s = snapshot();
    s.cohorts = [];
    s.years.push({ id: "y2", name: "2099-2100" });
    s.projects.push({
      ...s.projects[0],
      id: "p2",
      workspaceId: null,
      academicYearId: "y2",
      workflowInstanceId: "i2",
    });
    s.instances.push({ ...s.instances[0], id: "i2", researchId: "p2" });
    expect(actions(s)).toEqual([]);
    expect(reasons(s)).toContain("MULTIPLE_ACADEMIC_YEARS");
  });
  it("requires an authoritative eligible coordinator creator", () => {
    const s = snapshot();
    s.cohorts = [];
    s.users[1].roles = ["SYSTEM_ADMIN"];
    expect(reasons(s)).toContain("INSUFFICIENT_CREATOR_EVIDENCE");
    expect(actions(s)).toEqual([]);
  });
  it("preserves REMOVED membership while allowing independently safe links", () => {
    const s = snapshot();
    s.cohortMembers.push({
      id: "removed",
      cohortId: "co",
      userId: "student",
      status: "REMOVED",
    });
    expect(reasons(s)).toContain("REMOVED_MEMBERSHIP_CONFLICT");
    expect(actions(s).some((a) => a.kind === "MEMBERSHIP_CREATE")).toBe(false);
    expect(
      actions(s).filter((a) => a.kind.endsWith("LINK_UPDATE")),
    ).toHaveLength(2);
  });
  it("uses independent membership when enrollment is revoked, never revoked enrollment alone", () => {
    const s = snapshot();
    s.enrollments[0].status = "REVOKED";
    expect(
      actions(s).find((a) => a.kind === "MEMBERSHIP_CREATE")?.evidence,
    ).toContain("ACTIVE_RESEARCH_MEMBER:p");
    s.researchMembers = [];
    s.workspaceMembers = [];
    expect(actions(s).some((a) => a.kind === "MEMBERSHIP_CREATE")).toBe(false);
    expect(reasons(s)).toContain("NON_ACTIVE_ENROLLMENT_ONLY");
    expect(s.enrollments[0].status).toBe("REVOKED");
  });
  it("requires independent year evidence for an enrollment-only researcher", () => {
    const s = snapshot();
    s.researchMembers = [];
    s.workspaceMembers = [];
    expect(
      actions(s).find((a) => a.kind === "MEMBERSHIP_CREATE")?.evidence,
    ).toEqual(["ACTIVE_ENROLLMENT_WITH_PROFILE_YEAR:e"]);
    s.users[0].academicYearId = null;
    expect(actions(s).some((a) => a.kind === "MEMBERSHIP_CREATE")).toBe(false);
  });
  it("never adds an adviser or an out-of-scope/inactive account", () => {
    for (const change of [
      { programId: "other" },
      { status: "SUSPENDED" },
      { roles: ["ADVISER"] },
    ]) {
      const s = snapshot();
      Object.assign(s.users[0], change);
      expect(actions(s).some((a) => a.kind === "MEMBERSHIP_CREATE")).toBe(
        false,
      );
      expect(reasons(s)).toContain("OUT_OF_SCOPE_RESEARCHER");
    }
  });
  it("reports a projectless workspace rather than inferring its missing year/track", () => {
    const s = snapshot();
    s.projects = [];
    expect(actions(s)).toEqual([]);
    expect(reasons(s)).toContain("WORKSPACE_WITHOUT_CASE_EVIDENCE");
  });
  it("does not create competing memberships across different cohorts with the same academic/process identity", () => {
    const s = snapshot();
    s.cohorts.push({ ...s.cohorts[0], id: "co2" });
    s.projects[0].cohortId = "co";
    s.projects[0].workspaceId = null;
    s.projects.push({
      ...s.projects[0],
      id: "p2",
      cohortId: "co2",
      workflowInstanceId: "i2",
    });
    s.instances.push({ ...s.instances[0], id: "i2", researchId: "p2" });
    s.researchMembers.push({
      ...s.researchMembers[0],
      id: "rm2",
      researchId: "p2",
    });
    expect(actions(s).some((a) => a.kind === "MEMBERSHIP_CREATE")).toBe(false);
    expect(reasons(s)).toContain("CONFLICTING_COHORT_PARTICIPATION");
  });
});
describe("backfill command safety", () => {
  it("defaults to dry-run, including when only the creation policy flag is supplied", () => {
    expect(parseBackfillOptions([]).apply).toBe(false);
    expect(parseBackfillOptions(["--create-safe-cohorts"]).apply).toBe(false);
    expect(
      parseBackfillOptions(["--apply", "--create-safe-cohorts"]).apply,
    ).toBe(true);
  });
  it.each([
    ["--apply", "--dry-run"],
    ["--force"],
    ["--apply", "--apply"],
    ["--output"],
  ])(
    "rejects conflicting/unknown/duplicate/malformed options: %s",
    (...args) => {
      expect(() => parseBackfillOptions(args)).toThrow();
    },
  );
  it("requires an explicit target and refuses shared/production apply before database connection", () => {
    expect(() =>
      backfillTarget(
        { DATABASE_URL: "postgresql://x:y@localhost/live" },
        false,
      ),
    ).toThrow();
    const env = {
      BACKFILL_DATABASE_URL:
        "postgresql://test:test@127.0.0.1:5434/advisio_test?schema=public&application_name=advisio-integration-tests",
      NODE_ENV: "test",
      RUN_DATABASE_INTEGRATION_TESTS: "1",
      INTEGRATION_TEST_RUN_ID: "unit",
    };
    expect(backfillTarget(env, true).hostname).toBe("127.0.0.1");
    for (const value of [
      env.BACKFILL_DATABASE_URL.replace("advisio_test?", "live?"),
      env.BACKFILL_DATABASE_URL.replace("127.0.0.1", "preview.example.com"),
    ])
      expect(() =>
        backfillTarget({ ...env, BACKFILL_DATABASE_URL: value }, true),
      ).toThrow();
    expect(() =>
      backfillTarget({ ...env, NODE_ENV: "production" }, true),
    ).toThrow();
  });
});
