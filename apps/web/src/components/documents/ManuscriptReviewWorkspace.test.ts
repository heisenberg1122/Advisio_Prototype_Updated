import { describe, expect, it } from "vitest";
import { assignmentDisplayState } from "../../lib/review-assignment-display";

const assignment = (status: string, reviewStatus?: string, statusReason?: string) =>
  ({
    status,
    statusReason,
    review: reviewStatus ? { status: reviewStatus } : null,
  }) as Parameters<typeof assignmentDisplayState>[0];

describe("assignmentDisplayState", () => {
  it("separates active assignment state from draft review state", () => {
    expect(assignmentDisplayState(assignment("ACTIVE")).label).toBe("Pending review");
    expect(assignmentDisplayState(assignment("ACTIVE", "DRAFT")).label).toBe("In progress");
  });

  it("surfaces submitted or returned reviews that still have an active assignment", () => {
    expect(assignmentDisplayState(assignment("ACTIVE", "SUBMITTED")).label).toBe("Submitted · Assignment active");
    expect(assignmentDisplayState(assignment("ACTIVE", "RETURNED")).label).toBe("Returned review");
  });

  it.each([
    ["COMPLETED", "Completed"],
    ["REVOKED", "Revoked"],
    ["REASSIGNED", "Reassigned"],
    ["SUPERSEDED", "Superseded"],
  ])("maps %s assignments to %s", (status, label) => {
    expect(assignmentDisplayState(assignment(status))).toMatchObject({ label });
  });

  it("retains the recorded reason for inactive assignments", () => {
    expect(assignmentDisplayState(assignment("REVOKED", undefined, "Assignment withdrawn."))).toMatchObject({
      description: "Assignment withdrawn.",
    });
  });
});
