import { describe, expect, it } from "vitest";
import {
  legacyTaskDetailsHref,
  studentTaskDetailsHref,
  studentTasksHref,
} from "./student-task-navigation";

describe("student task navigation", () => {
  it("creates a bookmarkable task details URL with project context", () => {
    expect(studentTaskDetailsHref("task/one", "project-1")).toBe(
      "/student/tasks/task%2Fone?projectId=project-1",
    );
  });

  it("returns to the task list without losing the active project", () => {
    expect(studentTasksHref("project-1")).toBe(
      "/student/tasks?projectId=project-1",
    );
  });

  it("upgrades legacy task query links to the full-page route", () => {
    expect(
      legacyTaskDetailsHref(
        "?researchId=project-1&milestoneId=stage-1&taskId=task-1",
      ),
    ).toBe("/student/tasks/task-1?projectId=project-1");
  });

  it("does not redirect a normal task-list URL", () => {
    expect(legacyTaskDetailsHref("?projectId=project-1")).toBeNull();
  });
});
