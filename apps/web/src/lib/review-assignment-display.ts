export type ReviewAssignmentLifecycle =
  | "ACTIVE"
  | "COMPLETED"
  | "REVOKED"
  | "REASSIGNED"
  | "SUPERSEDED";

export type ReviewLifecycle = "DRAFT" | "SUBMITTED" | "RETURNED";

export interface ReviewAssignmentDisplayInput {
  status: ReviewAssignmentLifecycle;
  statusReason?: string | null;
  review?: {
    status: ReviewLifecycle;
    submittedAt?: string | null;
  } | null;
}

const submittedDateLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export function assignmentDisplayState(assignment: ReviewAssignmentDisplayInput) {
  if (assignment.status === "ACTIVE" && assignment.review?.status === "DRAFT") {
    return {
      label: "In progress",
      description: "A draft review exists, but no decision has been submitted.",
      variant: "warning" as const,
    };
  }
  if (assignment.status === "ACTIVE" && assignment.review?.status === "SUBMITTED") {
    return {
      label: "Submitted · Assignment active",
      description: "A submitted decision is attached while the assignment still remains active.",
      variant: "warning" as const,
    };
  }
  if (assignment.status === "ACTIVE" && assignment.review?.status === "RETURNED") {
    return {
      label: "Returned review",
      description: "The review was returned and this assignment remains active.",
      variant: "warning" as const,
    };
  }
  if (assignment.status === "ACTIVE") {
    return {
      label: "Pending review",
      description: "Awaiting your decision for this submitted version.",
      variant: "info" as const,
    };
  }
  if (assignment.status === "COMPLETED") {
    const submittedAt = assignment.review?.submittedAt
      ? submittedDateLabel(assignment.review.submittedAt)
      : null;
    return {
      label: "Completed",
      description: submittedAt ? `Decision submitted ${submittedAt}.` : "The assignment is completed.",
      variant: "success" as const,
    };
  }
  if (assignment.status === "REVOKED") {
    return { label: "Revoked", description: assignment.statusReason || "This assignment was revoked.", variant: "danger" as const };
  }
  if (assignment.status === "REASSIGNED") {
    return { label: "Reassigned", description: assignment.statusReason || "This review was reassigned to another reviewer.", variant: "neutral" as const };
  }
  return { label: "Superseded", description: assignment.statusReason || "A later workflow decision superseded this assignment.", variant: "neutral" as const };
}
