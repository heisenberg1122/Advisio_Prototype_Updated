import { describe, expect, it } from "vitest";
import { canReviewTaskSubmission } from "./task-submission-access.service.js";

const user = (
  id: string,
  roles: string[],
  collegeId: string | null = "college-a",
) => ({
  id,
  email: `${id}@example.edu`,
  universityId: id,
  roles: roles as any,
  permissions: [],
  collegeId,
  programId: null,
});

const context = {
  submittedBy: "student-a",
  researchCollegeId: "college-a",
  workflowOwnerId: "professor-a",
  responsibleRole: "RESEARCH_COORDINATOR",
};

describe("canReviewTaskSubmission", () => {
  it("allows only the professor who owns the project's workflow", () => {
    expect(
      canReviewTaskSubmission(
        user("professor-a", ["RESEARCH_COORDINATOR"]),
        context,
      ),
    ).toBe(true);
    expect(
      canReviewTaskSubmission(
        user("professor-b", ["RESEARCH_COORDINATOR"]),
        context,
      ),
    ).toBe(false);
  });

  it("prevents submitters and system administrators from making academic decisions", () => {
    expect(
      canReviewTaskSubmission(user("student-a", ["RESEARCH_COORDINATOR"]), {
        ...context,
        workflowOwnerId: "student-a",
      }),
    ).toBe(false);
    expect(
      canReviewTaskSubmission(user("admin-a", ["SYSTEM_ADMIN"], null), context),
    ).toBe(false);
  });

  it("limits RPO review to RPO stages in the same college", () => {
    const rpoContext = { ...context, responsibleRole: "RPO" };
    expect(
      canReviewTaskSubmission(user("rpo-a", ["RPO"], "college-a"), rpoContext),
    ).toBe(true);
    expect(
      canReviewTaskSubmission(user("rpo-b", ["RPO"], "college-b"), rpoContext),
    ).toBe(false);
    expect(
      canReviewTaskSubmission(
        user("rpo-unassigned", ["RPO"], null),
        rpoContext,
      ),
    ).toBe(false);
  });
});
