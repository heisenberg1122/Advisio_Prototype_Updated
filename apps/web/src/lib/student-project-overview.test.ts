import { describe, expect, it } from "vitest";
import {
  projectSectionHref,
  milestoneSnapshot,
  pendingProjectRequirements,
  projectActivityHref,
  summarizeProjectDocuments,
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

describe("project overview summaries", () => {
  it("keeps completed milestones separate from the current stage and upcoming milestones", () => {
    const stages = [
      { id: "draft", name: "Draft", sequence: 1, completed: true },
      { id: "review", name: "Review", sequence: 2, isCurrent: true },
      { id: "defense", name: "Defense", sequence: 3 },
      { id: "archive", name: "Archive", sequence: 4 },
      { id: "end", name: "Complete", sequence: 5 },
    ];
    expect(milestoneSnapshot(project, stages)).toMatchObject({
      completed: 1, active: 1, pending: 3, activeId: "review", stages: stages.slice(0, 4),
    });
  });

  it("orders overdue requirements first and omits completed or locked work", () => {
    const configuredProject: OverviewProject = {
      ...project,
      workflowInstance: {
        ...project.workflowInstance,
        startedAt: "2026-10-01T00:00:00.000Z",
        workflow: { stages: [{
          id: stage.id, sequence: 1,
          tasks: [{ id: "late", dueDays: 1 }, { id: "later", dueDays: 7 }],
        }] },
      },
    };
    const current = { ...stage, tasks: [
      { id: "later", title: "Later" },
      { id: "approved", title: "Approved", status: "APPROVED" },
      { id: "late", title: "Late" },
      { id: "waiting", title: "Waiting", status: "SUBMITTED" },
      { id: "optional", title: "Optional", isRequired: false },
    ] };
    const now = Date.parse("2026-10-03T00:00:00.000Z");
    expect(pendingProjectRequirements(configuredProject, [current], now).map(({ id, overdue }) => [id, overdue]))
      .toEqual([["late", true], ["later", false], ["waiting", false]]);
    expect(pendingProjectRequirements(configuredProject, [{ ...current, isBlocked: true }], now)).toEqual([]);
    expect(pendingProjectRequirements({ ...configuredProject, workflowAccessRemoved: true }, [current], now)).toEqual([]);
  });

  it("never treats an uploaded draft as a submission and links the exact version", () => {
    const records = summarizeProjectDocuments([
      { id: "draft", title: "New draft", versions: [{ id: "upload", uploadedAt: "2026-10-22" }] },
      { id: "paper", title: "Paper", lifecycleStatus: "REVISION_REQUIRED", versions: [
        { id: "revise", uploadedAt: "2026-10-21", submittedAt: "2026-10-21", manuscriptStatus: "REVISION_REQUIRED" },
      ] },
    ], "p");
    expect(records.map(({ id }) => id)).toEqual(["updated", "submitted"]);
    expect(records[1].href).toBe("/student/documents?tab=workspace&projectId=p&documentId=paper&versionId=revise");
  });

  it("uses actual destinations for consultation and defense activity", () => {
    const event = { id: "event", title: "Update", timestamp: "2026-10-21" };
    expect(projectActivityHref({ ...event, defenseSessionId: "d" }, "p")).toBe("/student/defense/d?projectId=p");
    expect(projectActivityHref({ ...event, consultationId: "c" }, "p"))
      .toBe("/student/dashboard?tab=consultations&consultationId=c&projectId=p");
  });
});
