import { describe, expect, it } from "vitest";
import { withProjectContext } from "./active-project";
import { researcherDestination, WORKSPACE_SECTIONS } from "./researcher-navigation";

function destination(href: string) {
  const url = new URL(href, "https://advisio.test");
  return researcherDestination(url.pathname, url.searchParams);
}

describe("researcher navigation", () => {
  it("keeps each workspace link tied to its existing project route", () => {
    for (const section of WORKSPACE_SECTIONS) {
      const href = withProjectContext(section.href, "project-2");
      expect(destination(href)).toBe(section.id);
      expect(new URL(href, "https://advisio.test").searchParams.get("projectId")).toBe("project-2");
    }
    expect(destination("/student/dashboard?projectId=project-2")).toBe("home");
  });

  it.each([
    ["/student/dashboard?tab=my-group&researchId=p", "group"],
    ["/student/tasks/task-id?projectId=p", "tasks"],
    ["/student/documents?tab=reviews&documentId=d&versionId=v", "documents"],
    ["/student/dashboard?tab=version-control", "documents"],
    ["/student/group-files?projectId=p", "documents"],
    ["/student/dashboard?tab=progress", "timeline"],
    ["/student/defense/session-id", "defense"],
    ["/student/grades", "grades"],
    ["/student/dashboard?tab=history", "consultations"],
    ["/student/calendar", "calendar"],
    ["/student/dashboard?tab=chat", "messages"],
    ["/student/inbox?threadId=t", "inbox"],
    ["/student/notifications", "notifications"],
  ])("recognizes the direct route %s as %s", (href, expected) => {
    expect(destination(href)).toBe(expected);
  });

  it("leaves other roles and settings outside the workspace navigation", () => {
    expect(destination("/adviser/dashboard")).toBeNull();
    expect(destination("/student/settings")).toBeNull();
  });
});
