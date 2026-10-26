import type { AuthenticatedUser } from "../middleware/auth.js";

export type TaskSubmissionReviewContext = {
  submittedBy: string;
  researchCollegeId: string;
  workflowOwnerId: string;
  responsibleRole: string;
};

/** Keep academic decisions assignment-scoped even when RBAC grants a broad
 * workflow permission. Administrators may inspect records but cannot approve. */
export function canReviewTaskSubmission(
  user: AuthenticatedUser,
  context: TaskSubmissionReviewContext,
) {
  if (user.id === context.submittedBy) return false;
  if (
    user.roles.includes("RESEARCH_COORDINATOR") &&
    context.workflowOwnerId === user.id
  ) {
    return true;
  }
  if (
    user.roles.includes("DEAN") &&
    context.responsibleRole === "DEAN" &&
    Boolean(user.collegeId) &&
    user.collegeId === context.researchCollegeId
  ) {
    return true;
  }
  return false;
}
