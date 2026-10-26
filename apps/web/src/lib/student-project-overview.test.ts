import { describe, expect, it } from "vitest";
import {
  projectSectionHref,
  researchTitleLabel,
  resolveProjectNextStep,
  type OverviewProject,
  type ProjectMilestoneProgress,
} from "./student-project-overview";
import { studentTaskDetailsHref } from "./student-task-navigation";

const project: OverviewProject = {
  id: "project",
  title: "Advisio",
  status: "DRAFT",
  workflowInstance: {
    currentStage: { id: "stage", name: "Community field research" },
  },
};
const stage: ProjectMilestoneProgress = {
  id: "stage",
  name: "Community field research",
  sequence: 1,
  isCurrent: true,
  requiresDocument: true,
  tasks: [{ id: "task", title: "Fieldwork plan", isRequired: true }],
};
const resolve = (
  milestones = [stage],
  changes: Partial<OverviewProject> = {},
) =>
  resolveProjectNextStep({
    project: { ...project, ...changes },
    milestones,
    isLeader: true,
  });

describe("research title labels", () => {
  it("does not present workflow participation as a registered project", () => {
    expect(researchTitleLabel({ title: "", workflowDraft: true })).toBe("Research title not registered");
  });
  it("identifies a title registered through proposal approval", () => {
    expect(researchTitleLabel({ ...project, registeredAt: "2026-10-27" })).toBe("Registered Research Project");
  });
  it("distinguishes absent and proposed titles", () => {
    expect(researchTitleLabel({ title: " " })).toBe("Research title not added");
    expect(researchTitleLabel(project)).toBe("Proposed research title");
    expect(
      researchTitleLabel({ ...project, status: "APPROVED" } as OverviewProject),
    ).toBe("Proposed research title");
  });
  it("requires a recorded decision for the exact current title", () => {
    const decision = {
      proposedTitle: "Advisio",
      status: "ACCEPTED",
      reviewedAt: "2026-10-25",
      reviewedBy: "professor",
    };
    expect(researchTitleLabel({ ...project, titleRevisions: [decision] })).toBe(
      "Approved research title",
    );
    for (const change of [
      { status: "APPLIED" },
      { status: "PENDING" },
      { proposedTitle: "Old title" },
      { reviewedBy: null },
      { reviewedAt: null },
    ]) {
      expect(
        researchTitleLabel({
          ...project,
          titleRevisions: [{ ...decision, ...change }],
        }),
      ).toBe("Proposed research title");
    }
  });
});

describe("project next step", () => {
  it("uses the actual workflow requirement rather than a college-specific title proposal", () => {
    expect(resolve()).toMatchObject({
      title: "Complete Fieldwork plan",
      buttonLabel: "Open task",
      action: { kind: "task", taskId: "task" },
    });
  });
  it("does not show waiting while another required task is unfinished", () => {
    expect(
      resolve([
        {
          ...stage,
          tasks: [
            { id: "submitted", title: "First", status: "SUBMITTED" },
            { id: "next", title: "Second" },
          ],
        },
      ]),
    ).toMatchObject({ action: { taskId: "next" }, tone: "action" });
  });
  it("prioritizes revision feedback over a different unfinished requirement", () => {
    expect(
      resolve([
        {
          ...stage,
          tasks: [
            ...stage.tasks!,
            { id: "revise", title: "Revise plan", status: "REVISION_REQUIRED" },
          ],
        },
      ]),
    ).toMatchObject({
      label: "Changes requested",
      action: { taskId: "revise" },
    });
  });
  it.each(["SUBMITTED", "UNDER_REVIEW", "AWAITING_REVIEW"])(
    "shows waiting for %s",
    (status) => {
      expect(
        resolve([
          {
            ...stage,
            tasks: [{ ...stage.tasks![0], status, submissionId: "submission" }],
          },
        ]),
      ).toMatchObject({
        label: "Waiting for review",
        buttonLabel: "View submission",
        tone: "pending",
      });
    },
  );
  it("ignores unfinished optional tasks when all required work awaits review", () => {
    expect(
      resolve([
        {
          ...stage,
          tasks: [
            { id: "required", title: "Required", status: "SUBMITTED" },
            { id: "optional", title: "Optional", isRequired: false },
          ],
        },
      ]),
    ).toMatchObject({ label: "Waiting for review" });
  });
  it("opens a document-free milestone without asking for a submission", () => {
    expect(
      resolve([{ ...stage, tasks: [], requiresDocument: false }]),
    ).toMatchObject({
      buttonLabel: "Open milestone",
      action: { taskId: "milestone-stage" },
    });
  });

  it("uses an existing task URL for a document milestone with only optional tasks", () => {
    expect(
      resolve([
        {
          ...stage,
          tasks: [
            { id: "optional", title: "Optional document", isRequired: false },
          ],
        },
      ]),
    ).toMatchObject({ action: { taskId: "optional" } });
  });
  it("does not guess the next stage before the workflow advances", () => {
    expect(resolve([{ ...stage, tasks: [], completed: true }])).toMatchObject({
      label: "Milestone completed",
      action: { kind: "timeline" },
    });
  });
  it("checks defense requirements after workflow completion without claiming eligibility", () => {
    const next = resolve([stage], {
      workflowInstance: { completedAt: "2026-10-25" },
    });
    expect(next).toMatchObject({
      label: "Workflow completed",
      buttonLabel: "View defense requirements",
    });
    expect(next.description).toContain("remaining eligibility");
  });
  it("never offers a workflow action after access removal, even with cached progress", () => {
    const next = resolve([stage], { workflowAccessRemoved: true });
    expect(next.label).toBe("Workflow access removed");
    expect(next.action).toBeUndefined();
  });
  it("shows loading and retry instead of an assumed task", () => {
    expect(
      resolveProjectNextStep({ project, isLeader: true, loading: true }).action,
    ).toBeUndefined();
    expect(
      resolveProjectNextStep({
        project,
        isLeader: true,
        milestones: [stage],
        error: true,
      }),
    ).toMatchObject({ buttonLabel: "Retry", action: { kind: "retry" } });
  });
  it("does not offer members the title editing action", () => {
    expect(
      resolveProjectNextStep({
        project: { ...project, status: "REJECTED" },
        isLeader: false,
      }).action,
    ).toBeUndefined();
    expect(resolve([stage], { status: "REJECTED" })).toMatchObject({
      action: { kind: "edit" },
    });
  });
  it("does not borrow a different milestone when the current stage is unavailable", () => {
    expect(
      resolve([{ ...stage, id: "unrelated", isCurrent: false }]),
    ).toMatchObject({
      buttonLabel: "View requirements",
      action: { kind: "tasks" },
    });
  });
});

describe("project navigation", () => {
  it("nests group settings under the project and preserves task project context", () => {
    expect(projectSectionHref("my-group")).toBe(
      "/student/dashboard?tab=group&section=my-group",
    );
    expect(projectSectionHref("overview")).toBe("/student/dashboard?tab=group");
    expect(studentTaskDetailsHref("task", "project")).toBe(
      "/student/tasks/task?projectId=project",
    );
  });
});
