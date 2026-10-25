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

  it("routes cross-dashboard panelist defense notification for multi-role coordinator", () => {
    expect(
      notificationLink(
        "/defense/session?sessionId=s1&projectId=p1",
        "professor",
        ["RESEARCH_COORDINATOR", "PANELIST"]
      )
    ).toBe("/panelist/dashboard?sessionId=s1&projectId=p1");
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
