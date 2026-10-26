import { describe, expect, it } from "vitest";
import { resolveStudentWorkflow } from "./student-workflow-context";

const joined = [{ workflowId: "new" }, { workflowId: "existing" }];

describe("researcher workflow visibility and project isolation", () => {
  it("shows an accepted workflow before project registration", () => {
    expect(resolveStudentWorkflow(joined)).toEqual({
      activeEnrollment: joined[0],
      workflowProject: null,
    });
  });

  it.each([
    {},
    { workflowInstance: null },
    { workflowInstance: { workflowId: "old" } },
    { workflowAccessRemoved: true, workflowInstance: null },
  ])("shows joined workflows despite an unrelated project: %s", (project) => {
    expect(resolveStudentWorkflow(joined, project)).toEqual({
      activeEnrollment: joined[0],
      workflowProject: null,
    });
  });

  it("keeps the assigned workflow and its submission context by default", () => {
    const project = { workflowInstance: { workflowId: "existing" } };
    expect(resolveStudentWorkflow(joined, project)).toEqual({
      activeEnrollment: joined[1],
      workflowProject: project,
    });
  });

  it("allows browsing another joined workflow without borrowing project progress", () => {
    const project = { workflowInstance: { workflowId: "existing" } };
    expect(resolveStudentWorkflow(joined, project, "new")).toEqual({
      activeEnrollment: joined[0],
      workflowProject: null,
    });
  });

  it("never grants visibility through a project without active enrollment", () => {
    expect(
      resolveStudentWorkflow([], { workflowInstance: { workflowId: "old" } }),
    ).toEqual({
      activeEnrollment: undefined,
      workflowProject: null,
    });
  });

  it("does not restore revoked project submission access", () => {
    const project = {
      workflowAccessRemoved: true,
      workflowInstance: { workflowId: "new" },
    };
    expect(resolveStudentWorkflow(joined, project).workflowProject).toBeNull();
  });

  it("ignores an unauthorized workflow URL and keeps an authorized context", () => {
    const project = { workflowInstance: { workflowId: "existing" } };
    expect(resolveStudentWorkflow(joined, project, "unauthorized")).toEqual({
      activeEnrollment: joined[1],
      workflowProject: project,
    });
  });
});
