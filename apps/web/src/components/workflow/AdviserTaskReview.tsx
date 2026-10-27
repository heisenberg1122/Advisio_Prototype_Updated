import React from "react";
import { Tag } from "../ui/Tag";

type AdviserReview = {
  id: string;
  assignmentId?: string | null;
  recommendation: string | null;
  overallComment?: string | null;
  submittedAt?: string | null;
  comments?: Array<{
    id: string;
    comment: string;
    locationData?: { page?: number; section?: string } | null;
  }>;
};

type ReviewedVersion = {
  id: string;
  versionNumber: number;
  reviews?: AdviserReview[];
  reviewerAssignments?: Array<{
    id?: string;
    isRequired: boolean;
    status: string;
  }>;
};

type Submission = {
  documentVersionId?: string | null;
  documentVersion?: ReviewedVersion | null;
  attempts?: Array<{
    id: string;
    attemptNumber: number;
    documentVersionId?: string | null;
    documentVersion?: ReviewedVersion | null;
  }>;
};

export function needsAdviserApproval(task: {
  isAdviserMilestone?: boolean;
  isTitleProposal?: boolean;
  requiresDocument?: boolean;
  stage: { requiresApproval?: boolean; requiresDocument?: boolean };
  submission?: Submission | null;
}) {
  if (task.isAdviserMilestone || task.isTitleProposal) return false;
  const requiredAssignment =
    task.submission?.documentVersion?.reviewerAssignments?.some(
      (assignment) =>
        assignment.isRequired &&
        ["ACTIVE", "COMPLETED"].includes(assignment.status),
    );
  return Boolean(
    requiredAssignment ||
    (task.stage.requiresApproval &&
      task.requiresDocument !== false &&
      task.stage.requiresDocument !== false),
  );
}

function ReviewCard({
  review,
  version,
  previousAttempt,
}: {
  review: AdviserReview;
  version: ReviewedVersion;
  previousAttempt?: number;
}) {
  const approved = review.recommendation === "APPROVE";
  const label = approved
    ? "Approved by adviser"
    : review.recommendation === "REJECT"
      ? "Rejected by adviser"
      : ["MINOR_REVISION", "MAJOR_REVISION"].includes(
            review.recommendation || "",
          )
        ? "Adviser requested revisions"
        : "Reviewed by adviser";
  return (
    <article className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-[var(--color-text-primary)]">
          {previousAttempt
            ? `Previous attempt ${previousAttempt} · `
            : "Current submission · "}
          Version {version.versionNumber}
        </p>
        <Tag variant={approved ? "success" : "warn"}>{label}</Tag>
      </div>
      {review.submittedAt && (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Reviewed {new Date(review.submittedAt).toLocaleString()}
        </p>
      )}
      {review.overallComment && (
        <p className="mt-3 whitespace-pre-wrap text-base text-[var(--color-text-primary)]">
          {review.overallComment}
        </p>
      )}
      {review.comments?.map((comment) => (
        <div
          key={comment.id}
          className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        >
          {(comment.locationData?.section || comment.locationData?.page) && (
            <p className="mb-1 text-sm font-semibold text-[var(--color-text-secondary)]">
              {[
                comment.locationData.section,
                comment.locationData.page
                  ? `Page ${comment.locationData.page}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <p className="whitespace-pre-wrap text-base text-[var(--color-text-primary)]">
            {comment.comment}
          </p>
        </div>
      ))}
    </article>
  );
}

export function AdviserTaskReview({
  required,
  submission,
}: {
  required: boolean;
  submission?: Submission | null;
}) {
  const current = submission?.documentVersion;
  const previous = (submission?.attempts || []).filter(
    (attempt) =>
      attempt.documentVersion &&
      attempt.documentVersionId !== submission?.documentVersionId &&
      attempt.documentVersion.reviews?.length,
  );
  if (!required && !current?.reviews?.length && !previous.length) return null;
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
      <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
        Adviser review
      </h2>
      {required && (
        <p className="mt-2 text-base font-semibold text-[var(--color-primary)]">
          Adviser approval required
        </p>
      )}
      {current?.reviews?.length ? (
        current.reviews.map((review) => (
          <ReviewCard key={review.id} review={review} version={current} />
        ))
      ) : (
        <p className="mt-3 text-base text-[var(--color-text-secondary)]">
          {submission
            ? "Awaiting adviser review of the current submission."
            : "Submit your work to receive the adviser's review."}
        </p>
      )}
      {current?.reviews?.some(
        (review) => review.recommendation === "APPROVE",
      ) && (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          Other required faculty approvals may still be pending. Check the task
          status for overall completion.
        </p>
      )}
      {previous.map((attempt) =>
        attempt.documentVersion!.reviews!.map((review) => (
          <ReviewCard
            key={`${attempt.id}-${review.id}`}
            review={review}
            version={attempt.documentVersion!}
            previousAttempt={attempt.attemptNumber}
          />
        )),
      )}
    </section>
  );
}

export function AdviserApprovalBadge({
  required,
  submission,
}: {
  required: boolean;
  submission?: Submission | null;
}) {
  const current = submission?.documentVersion;
  const assignments = (current?.reviewerAssignments || []).filter(
    (item) => item.isRequired && ["ACTIVE", "COMPLETED"].includes(item.status),
  );
  const reviews = current?.reviews || [];
  const approved = assignments.length
    ? assignments.every(
        (item) =>
          item.status === "COMPLETED" &&
          reviews.some(
            (review) =>
              review.assignmentId === item.id &&
              review.recommendation === "APPROVE",
          ),
      )
    : reviews.length > 0 &&
      reviews.every((review) => review.recommendation === "APPROVE");
  const revisions = reviews.some((review) =>
    ["MINOR_REVISION", "MAJOR_REVISION", "REJECT"].includes(
      review.recommendation || "",
    ),
  );
  const label = approved
    ? "Adviser: approved"
    : revisions
      ? "Adviser: revisions requested"
      : required || assignments.length
        ? "Adviser: not yet approved"
        : "Adviser approval not required";
  return (
    <Tag
      variant={
        approved
          ? "success"
          : required || assignments.length || revisions
            ? "warn"
            : "neutral"
      }
    >
      {label}
    </Tag>
  );
}
