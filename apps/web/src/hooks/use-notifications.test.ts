import { describe, expect, it } from "vitest";
import { notificationLink } from "../lib/notification-navigation";

describe("notification workflow links", () => {
  it("keeps exact manuscript context for students", () => {
    expect(notificationLink("/research/manuscript?projectId=p1&documentId=d1&versionId=v2", "student"))
      .toBe("/student/documents?projectId=p1&documentId=d1&versionId=v2");
  });

  it("routes an assigned faculty review to the review workspace", () => {
    expect(notificationLink("/research/manuscript?projectId=p1&assignmentId=a1&versionId=v2", "adviser"))
      .toBe("/adviser/reviews?projectId=p1&assignmentId=a1&versionId=v2");
  });

  it("preserves project context for defense sessions", () => {
    expect(notificationLink("/defense/session?sessionId=s1&projectId=p1", "student"))
      .toBe("/student/defense/s1?projectId=p1");
  });
});
