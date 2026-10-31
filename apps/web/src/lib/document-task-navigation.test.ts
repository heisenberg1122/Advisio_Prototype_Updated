import { describe, expect, it } from "vitest";
import {
  documentTaskDetailsHref,
  taskDocumentsHref,
  type TaskPortal,
} from "./document-task-navigation";

describe("task links from documents", () => {
  it.each([
    "student",
    "adviser",
    "professor",
    "panelist",
    "admin",
  ] as TaskPortal[])(
    "keeps %s in its own portal with exact task and project context",
    (portal) => {
      expect(documentTaskDetailsHref(portal, "task/1", "project&1")).toBe(
        `/${portal}/tasks/task%2F1?projectId=project%261`,
      );
    },
  );
  it("returns to the same project's milestone files", () => {
    expect(taskDocumentsHref("adviser", "p1")).toBe(
      "/adviser/documents?tab=milestones&projectId=p1",
    );
  });
  it("opens the submitted document's exact version in the faculty portal", () => {
    expect(taskDocumentsHref("adviser", "p1", "d1", "v1")).toBe(
      "/adviser/documents?tab=workspace&projectId=p1&documentId=d1&versionId=v1",
    );
  });
});
