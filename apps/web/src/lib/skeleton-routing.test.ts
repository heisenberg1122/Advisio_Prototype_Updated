import { describe, expect, it } from "vitest";
import { contentSkeletonKindForPath } from "./skeleton-routing";

describe("skeleton route selection", () => {
  it.each([
    ["/student/dashboard", "dashboard"],
    ["/student/groups", "cards"],
    ["/student/documents", "files"],
    ["/professor/reviews", "table"],
    ["/panelist/profile", "profile"],
    ["/admin/notifications", "notifications"],
    ["/adviser/calendar", "calendar"],
    ["/system-admin/settings", "form"],
    ["/professor/inbox", "mail"],
    ["/student/tasks/task-1", "task-details"],
    ["/adviser/tasks/task-1", "task-details"],
    ["/professor/tasks/task-1", "task-details"],
    ["/panelist/tasks/task-1", "task-details"],
    ["/admin/tasks/task-1", "task-details"],
    ["/student/tasks", "table"],
  ] as const)("maps %s to the %s skeleton", (pathname, expected) => {
    expect(contentSkeletonKindForPath(pathname)).toBe(expected);
  });

  it("checks dashboard before role words such as panelist", () => {
    expect(contentSkeletonKindForPath("/panelist/dashboard")).toBe(
      "dashboard",
    );
  });

  it("matches bookmarked task detail links with a trailing slash", () => {
    expect(contentSkeletonKindForPath("/adviser/tasks/task-1/")).toBe("task-details");
  });
});
