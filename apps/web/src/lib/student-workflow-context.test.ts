import { describe, expect, it } from "vitest";
import { resolveStudentWorkflow } from "./student-workflow-context";
const joined = [{ workflowId: "new" }, { workflowId: "pinned" }];
const project = { workflowInstance: { workflowId: "pinned" } };
describe("case-owned process and separate enrollment authorization", () => {
  it("does not select the first enrollment before a case exists", () => {
    expect(resolveStudentWorkflow(joined)).toEqual({
      activeEnrollment: undefined,
      workflowProject: null,
    });
  });
  it("uses the selected case's pinned instance", () => {
    expect(resolveStudentWorkflow(joined, project)).toEqual({
      activeEnrollment: joined[1],
      workflowProject: project,
    });
  });
  it.each(["new", "unauthorized"])(
    "a workflow URL cannot override a case: %s",
    (id) => {
      expect(resolveStudentWorkflow(joined, project, id).workflowProject).toBe(
        project,
      );
    },
  );
  it.each([
    {},
    { workflowInstance: null },
    { workflowInstance: { workflowId: "missing" } },
    { ...project, workflowAccessRemoved: true },
  ])("does not grant process access for %s", (candidate) => {
    expect(
      resolveStudentWorkflow(joined, candidate).workflowProject,
    ).toBeNull();
  });
  it("requires separate enrollment authorization", () => {
    expect(resolveStudentWorkflow([], project).workflowProject).toBeNull();
  });
  it("never borrows another case's progress for a workflow URL", () => {
    const other = { workflowInstance: { workflowId: "new" } };
    expect(
      resolveStudentWorkflow(joined, project, "new", [project, other])
        .workflowProject,
    ).toBe(project);
    expect(
      resolveStudentWorkflow(joined, null, "new", [project, other])
        .workflowProject,
    ).toBeNull();
  });
  it("supports an unambiguous legacy pinned case", () => {
    expect(
      resolveStudentWorkflow(joined, null, null, [project]).workflowProject,
    ).toBe(project);
  });
});
