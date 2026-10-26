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

  it("limits DEAN review to DEAN stages in the same college", () => {
    const rpoContext = { ...context, responsibleRole: "DEAN" };
    expect(
      canReviewTaskSubmission(user("dean-a", ["DEAN"], "college-a"), rpoContext),
    ).toBe(true);
    expect(
      canReviewTaskSubmission(user("dean-b", ["DEAN"], "college-b"), rpoContext),
    ).toBe(false);
    expect(
      canReviewTaskSubmission(
        user("dean-unassigned", ["DEAN"], null),
        rpoContext,
      ),
    ).toBe(false);
  });
});
