import { describe, expect, it } from "vitest";
import { resolveActiveProject, withProjectContext } from "./active-project";

const projects = [{ id: "project-a" }, { id: "project-b" }];

describe("active project resolution", () => {
  it("uses an explicitly requested authorized project", () => {
    expect(resolveActiveProject(projects, "project-b", "project-a")).toMatchObject({
      projectId: "project-b",
      invalidRequestedProjectId: null,
      requiresSelection: false,
    });
  });

  it("never substitutes another project for an invalid requested id", () => {
    expect(resolveActiveProject(projects, "not-authorized", "project-a")).toEqual({
      project: null,
      projectId: null,
      invalidRequestedProjectId: "not-authorized",
      requiresSelection: false,
    });
  });

  it("requires a choice for multiple projects without context", () => {
    expect(resolveActiveProject(projects)).toMatchObject({
      project: null,
      projectId: null,
      requiresSelection: true,
    });
  });

  it("selects the sole authorized project", () => {
    expect(resolveActiveProject([projects[0]])).toMatchObject({
      projectId: "project-a",
      requiresSelection: false,
    });
  });
});

describe("project navigation", () => {
  it("preserves existing context while adding the project", () => {
    expect(withProjectContext("/student/documents?taskId=task-1", "project-b"))
      .toBe("/student/documents?taskId=task-1&projectId=project-b");
  });

  it("replaces stale project context", () => {
    expect(withProjectContext("/student/tasks?projectId=project-a", "project-b"))
      .toBe("/student/tasks?projectId=project-b");
  });
});
