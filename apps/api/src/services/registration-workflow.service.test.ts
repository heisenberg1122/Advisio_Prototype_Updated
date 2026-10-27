import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../middleware/auth.js";

const db = vi.hoisted(() => ({
  workflowEnrollment: { findMany: vi.fn() },
  researchType: { findMany: vi.fn() },
  workflow: { findFirst: vi.fn() },
  researchCohort: { findMany: vi.fn() },
}));
vi.mock("../lib/prisma.js", async (original) => ({
  ...(await original<any>()),
  prisma: db,
}));
import { resolveRegistrationWorkflow } from "./registration-workflow.service.js";
import { assignedCohortWorkflows } from "./cohort-workflow-selection.service.js";

const user = {
  id: "student",
  email: "student@isolated.test",
  universityId: "student",
  roles: ["RESEARCHER"],
  permissions: [],
  collegeId: "college",
  programId: "program",
} as AuthenticatedUser;
const workflow = (id: string) => ({
  id,
  researchTypeId: "type",
  status: "PUBLISHED",
  stages: [{ id: "stage" }],
});
const assignment = (id = "selected") => ({
  id: `cohort-${id}`,
  collegeId: "college",
  programId: "program",
  researchTypeId: "type",
  workflowId: id,
  program: { collegeId: "college" },
  researchType: { programId: "program" },
  workflow: { researchTypeId: "type" },
  members: [{ userId: user.id }],
});
beforeEach(() => {
  vi.resetAllMocks();
  db.workflowEnrollment.findMany.mockResolvedValue([
    { workflow: workflow("selected") },
  ]);
  db.researchType.findMany.mockResolvedValue([
    {
      id: "type",
      programId: "program",
      workflowId: "legacy-global",
      workflow: workflow("legacy-global"),
    },
  ]);
  db.researchCohort.findMany.mockResolvedValue([assignment()]);
  db.workflow.findFirst.mockResolvedValue(workflow("selected"));
});

describe("cohort-owned runtime process selection", () => {
  it("uses the enrolled cohort assignment and ignores legacy default metadata", async () => {
    expect(
      (await resolveRegistrationWorkflow(user, "program")).workflow?.id,
    ).toBe("selected");
  });
  it("does not activate an unassigned published template from enrollment alone", async () => {
    db.researchCohort.findMany.mockResolvedValue([]);
    await expect(
      resolveRegistrationWorkflow(user, "program", "selected"),
    ).rejects.toThrow("active cohorts");
  });
  it("does not turn cohort membership into legacy workflow authorization", async () => {
    db.workflowEnrollment.findMany.mockResolvedValue([]);
    await expect(
      resolveRegistrationWorkflow(user, "program", "selected"),
    ).rejects.toThrow("Join an active workflow");
  });
  it("uses the existing workspace's cohort and the registration year for new selection", async () => {
    await resolveRegistrationWorkflow(user, "program", "selected", undefined, {
      cohortId: "workspace-cohort",
      academicYearId: "year",
    });
    expect(db.researchCohort.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            expect.any(Object),
            expect.objectContaining({
              id: "workspace-cohort",
              academicYearId: "year",
              workflowId: "selected",
            }),
          ],
        },
      }),
    );
  });
  it("requires selection when different active cohorts assign different enrolled processes", async () => {
    db.workflowEnrollment.findMany.mockResolvedValue([
      { workflow: workflow("selected") },
      { workflow: workflow("other") },
    ]);
    db.researchCohort.findMany.mockResolvedValue([
      assignment(),
      assignment("other"),
    ]);
    await expect(resolveRegistrationWorkflow(user, "program")).rejects.toThrow(
      "Select the workflow",
    );
  });
  it("keeps promotion of an already-running legacy draft pinned to its stored workflow", async () => {
    db.researchCohort.findMany.mockResolvedValue([]);
    expect(
      (
        await resolveRegistrationWorkflow(
          user,
          "program",
          undefined,
          undefined,
          { existingWorkflowId: "selected" },
        )
      ).workflow?.id,
    ).toBe("selected");
    expect(db.researchCohort.findMany).not.toHaveBeenCalled();
  });
  it("never uses the legacy default for staff registration without explicit selection", async () => {
    const staff = {
      ...user,
      roles: ["RESEARCH_COORDINATOR"],
    } as AuthenticatedUser;
    expect(
      (await resolveRegistrationWorkflow(staff, "program")).workflow,
    ).toBeNull();
    expect(db.workflow.findFirst).not.toHaveBeenCalled();
    expect(db.researchType.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({ include: expect.anything() }),
    );
  });
  it("requires an active scoped cohort for explicitly selected staff processes", async () => {
    const staff = {
      ...user,
      roles: ["RESEARCH_COORDINATOR"],
    } as AuthenticatedUser;
    db.researchCohort.findMany.mockResolvedValue([]);
    await expect(
      resolveRegistrationWorkflow(staff, "program", "selected"),
    ).rejects.toThrow("active cohort");
    db.researchCohort.findMany.mockResolvedValue([assignment()]);
    expect(
      (await resolveRegistrationWorkflow(staff, "program", "selected")).workflow
        ?.id,
    ).toBe("selected");
  });
  it("constrains selection to active cohorts, active membership, year, and academic scope", async () => {
    await assignedCohortWorkflows(user, "program", {
      workflowId: "selected",
      academicYearId: "year",
      cohortId: "cohort",
    });
    expect(db.researchCohort.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            expect.objectContaining({
              collegeId: "college",
              programId: "program",
              members: { some: { userId: "student", status: "ACTIVE" } },
            }),
            expect.objectContaining({
              id: "cohort",
              status: "ACTIVE",
              programId: "program",
              workflowId: "selected",
              academicYearId: "year",
              workflow: { is: { status: "PUBLISHED" } },
            }),
          ],
        },
      }),
    );
  });
  it("does not bypass researcher membership through an additional management role", async () => {
    await assignedCohortWorkflows(
      { ...user, roles: ["RESEARCHER", "RESEARCH_COORDINATOR"] },
      "program",
    );
    expect(db.researchCohort.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            expect.objectContaining({
              members: { some: { userId: "student", status: "ACTIVE" } },
            }),
            expect.any(Object),
          ],
        },
      }),
    );
  });
  it.each([
    { workflow: { researchTypeId: "other" } },
    { researchType: { programId: "other" } },
    { program: { collegeId: "other" } },
  ])("rejects inconsistent academic references %j", async (changes) => {
    db.researchCohort.findMany.mockResolvedValue([
      { ...assignment(), ...changes },
    ]);
    expect(await assignedCohortWorkflows(user, "program")).toEqual([]);
  });
});
