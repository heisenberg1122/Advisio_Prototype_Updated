import { describe, expect, it } from "vitest";
import { adviserRequestNotificationLink, notificationLink } from "../lib/notification-navigation";

describe("adviser request notifications", () => {
  it("opens the exact request, including requests outside the dashboard preview", () => {
    const link = adviserRequestNotificationLink("request-4");
    expect(link).toBe("/adviser/dashboard?requestId=request-4");
    expect(notificationLink(link, "adviser")).toBe(link);
  });

  it("encodes request identifiers without creating extra query parameters", () => {
    const link = adviserRequestNotificationLink("request&tab=other");
    const url = new URL(link, "https://advisio.local");
    expect(url.searchParams.get("requestId")).toBe("request&tab=other");
    expect(url.searchParams.has("tab")).toBe(false);
  });

  it("keeps notifications without request context usable", () => {
    expect(adviserRequestNotificationLink(undefined)).toBe("/adviser/dashboard");
    expect(adviserRequestNotificationLink(null)).toBe("/adviser/dashboard");
    expect(adviserRequestNotificationLink("")).toBe("/adviser/dashboard");
  });
});

describe("notification workflow links", () => {
  it("rejects external, malformed, retired-dashboard and unassigned-dashboard destinations", () => {
    for (const link of ["https://example.com/student/documents", "//example.com", "javascript:alert(1)", "/admin/reviews?workspace=ethics", "/panelist/reviews"]) {
      expect(notificationLink(link, "professor", ["RESEARCH_COORDINATOR"])).toBeUndefined();
    }
  });
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

  it("keeps coordinator notifications in their own defense workspace", () => {
    expect(
      notificationLink(
        "/defense/session?sessionId=s1&projectId=p1",
        "professor",
        ["RESEARCH_COORDINATOR", "PANELIST"]
      )
    ).toBe("/professor/dashboard?tab=defenses&sessionId=s1&projectId=p1");
  });
});

describe("workflow access notification destinations", () => {
  it("opens the intended Advisio inbox thread for researchers", () => {
    expect(notificationLink("/student/inbox?thread=invitation-thread", "student")).toBe("/student/inbox?thread=invitation-thread");
  });
  it("preserves the owner's workflow participant context", () => {
    expect(notificationLink("/professor/dashboard?tab=builder&workflowView=participants&workflowId=w1", "professor")).toBe("/professor/dashboard?tab=builder&workflowView=participants&workflowId=w1");
  });
  it("opens cross-dashboard links when user holds that target dashboard", () => {
    expect(
      notificationLink(
        "/panelist/reviews?documentId=doc-1",
        "professor",
        ["RESEARCH_COORDINATOR", "PANELIST"]
      )
    ).toBe("/panelist/reviews?documentId=doc-1");
  });
});
