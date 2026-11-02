import { useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  SubmissionDocumentPreview,
  type SubmissionDocumentVersion,
} from "./SubmissionDocumentPreview";
import { SubmissionComments } from "@/components/documents/SubmissionComments";
import { SubmissionGradePanel } from "@/components/documents/SubmissionGradePanel";
import { SubmissionHighlightProvider } from "@/components/documents/SubmissionHighlightContext";
import { AdviserTaskReview } from "@/components/workflow/AdviserTaskReview";
import "./submission-review-workspace.css";

export function submittedReviewVersions(
  submission: any,
): SubmissionDocumentVersion[] {
  const versions = new Map<string, SubmissionDocumentVersion>();
  for (const attempt of submission.attempts || []) {
    if (attempt.documentVersion)
      versions.set(attempt.documentVersion.id, attempt.documentVersion);
  }
  if (submission.documentVersion)
    versions.set(submission.documentVersion.id, submission.documentVersion);
  // Legacy records may only include document.versions; never substitute a newer
  // working upload for the version attached to a submission.
  if (
    submission.documentVersionId &&
    !versions.has(submission.documentVersionId)
  ) {
    const exact = submission.document?.versions?.find(
      (version: SubmissionDocumentVersion) =>
        version.id === submission.documentVersionId,
    );
    if (exact) versions.set(exact.id, exact);
  }
  return [...versions.values()].sort(
    (a, b) => b.versionNumber - a.versionNumber,
  );
}

export function SubmissionReviewWorkspace({
  submission,
  queue,
  feedback,
  saving,
  onFeedbackChange,
  onSelect,
  onClose,
  onReview,
}: {
  submission: any;
  queue: any[];
  feedback: string;
  saving: boolean;
  onFeedbackChange: (value: string) => void;
  onSelect: (submission: any) => void;
  onClose: () => void;
  onReview: (status: "APPROVED" | "REVISION_REQUIRED") => void;
}) {
  const [showFeedback, setShowFeedback] = useState(true);
  const [viewedVersionId, setViewedVersionId] = useState(
    submission.documentVersionId || "",
  );
  const versions = submittedReviewVersions(submission);
  const viewedVersion = versions.find(
    (version) => version.id === viewedVersionId,
  );
  const currentVersion = viewedVersionId === submission.documentVersionId;
  const canReview =
    currentVersion && ["SUBMITTED", "UNDER_REVIEW"].includes(submission.status);
  const reviewQueue = queue.some((item) => item.id === submission.id)
    ? queue
    : [submission, ...queue];
  const index = reviewQueue.findIndex((item) => item.id === submission.id);
  const navigate = (next?: any) => {
    if (saving) return;
    if (
      feedback !== (submission.reviewNote || "") &&
      !window.confirm(
        "Leave without saving your decision feedback? Posted comments are already saved.",
      )
    )
      return;
    if (next) onSelect(next);
    else onClose();
  };
  return (
    <section
      className="submission-review"
      aria-label="Submission review workspace"
    >
      <header className="submission-review-header">
        <button
          type="button"
          className="review-icon-button"
          aria-label="Back to submissions"
          title="Back to submissions"
          onClick={() => navigate()}
          disabled={saving}
        >
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
            Submission review
          </p>
          <h2 className="truncate text-base font-bold">
            {submission.task?.title || "Submitted document"}
          </h2>
        </div>
        <span className="review-status">
          {submission.status.replace(/_/g, " ").toLowerCase()}
        </span>
        <button
          type="button"
          className="review-icon-button"
          aria-label={
            showFeedback ? "Hide feedback panel" : "Show feedback panel"
          }
          title={showFeedback ? "Hide feedback panel" : "Show feedback panel"}
          onClick={() => setShowFeedback((value) => !value)}
        >
          {showFeedback ? (
            <PanelRightClose size={19} />
          ) : (
            <PanelRightOpen size={19} />
          )}
        </button>
      </header>
      <nav
        className="submission-review-navigation"
        aria-label="Submission navigation"
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Select submission</span>
          <select
            value={submission.id}
            disabled={saving}
            onChange={(event) =>
              navigate(
                reviewQueue.find((item) => item.id === event.target.value),
              )
            }
            className="review-submission-select"
          >
            {reviewQueue.map((item) => (
              <option key={item.id} value={item.id}>
                {item.projectTitle} · {item.task?.title}
              </option>
            ))}
          </select>
        </label>
        <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
          {index + 1} of {reviewQueue.length}
        </span>
        <button
          type="button"
          className="review-icon-button"
          aria-label="Previous submission"
          disabled={saving || index <= 0}
          onClick={() => navigate(reviewQueue[index - 1])}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="review-icon-button"
          aria-label="Next submission"
          disabled={saving || index < 0 || index >= reviewQueue.length - 1}
          onClick={() => navigate(reviewQueue[index + 1])}
        >
          <ChevronRight size={18} />
        </button>
      </nav>
      <SubmissionHighlightProvider
        key={viewedVersionId}
        versionId={viewedVersionId}
        onCompose={() => setShowFeedback(true)}
      >
        <div
          className={`submission-review-body ${showFeedback ? "" : "feedback-hidden"}`}
        >
          <div className="submission-review-document">
            <SubmissionDocumentPreview
              versions={versions}
              initialVersionId={submission.documentVersionId}
              selectedVersionId={viewedVersionId}
              onVersionChange={setViewedVersionId}
              title={
                submission.document?.title ||
                submission.task?.title ||
                "Submitted document"
              }
            />
          </div>
          <aside
            hidden={!showFeedback}
            className="submission-review-feedback"
            aria-label="Feedback and decision"
          >
            <section className="review-panel-section">
              <h3 className="flex items-center gap-2 text-base font-bold">
                <MessageSquare size={18} />
                Feedback & review
              </h3>
              <p className="mt-3 text-sm font-semibold">
                {submission.projectTitle}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                Submitted by {submission.submittedByUser?.firstName}{" "}
                {submission.submittedByUser?.lastName}
                <br />
                {new Date(submission.submittedAt).toLocaleString()}
              </p>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold">
                  Instructions & student note
                </summary>
                <p className="mt-2 whitespace-pre-wrap leading-6 text-[var(--color-text-secondary)]">
                  {submission.task?.instructions ||
                    "No additional instructions."}
                </p>
                <p className="mt-3 whitespace-pre-wrap leading-6">
                  <strong>Student note: </strong>
                  {submission.note || "No note included."}
                </p>
              </details>
            </section>
            <div className="review-panel-section">
              {viewedVersionId && <SubmissionGradePanel key={viewedVersionId} submissionId={submission.id} versionId={viewedVersionId} />}
            </div>
            <div className="review-panel-section">
              {!currentVersion && (
                <p
                  role="status"
                  className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
                >
                  Viewing an earlier submission. Select the current submitted
                  version to record a decision.
                </p>
              )}
              {canReview ? (
                <>
                  <label className="block text-sm font-bold">
                    Decision feedback
                    <textarea
                      rows={4}
                      maxLength={10000}
                      value={feedback}
                      disabled={saving}
                      onChange={(event) => onFeedbackChange(event.target.value)}
                      placeholder="Explain your approval or the changes needed…"
                      className="mt-2 w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm font-normal leading-6 outline-none focus:ring-2 focus:ring-[var(--college-focus-ring)]"
                    />
                  </label>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Required when requesting revision. Shared when you submit a
                    decision.
                  </p>
                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => onReview("APPROVED")}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-[var(--college-on-primary)] disabled:opacity-50"
                    >
                      <Check size={16} />
                      {saving ? "Saving…" : "Approve submission"}
                    </button>
                    <button
                      type="button"
                      disabled={saving || !feedback.trim()}
                      onClick={() => onReview("REVISION_REQUIRED")}
                      className="rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                      Request revision
                    </button>
                  </div>
                </>
              ) : (
                currentVersion && (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    This submission has already been reviewed.
                  </p>
                )
              )}
              {submission.reviewNote && (
                <div className="mt-4 text-sm">
                  <p className="font-bold">Saved decision feedback</p>
                  <p className="mt-1 whitespace-pre-wrap break-words leading-6 text-[var(--color-text-secondary)]">
                    {submission.reviewNote}
                  </p>
                </div>
              )}
            </div>
            {viewedVersionId && (
              <div className="review-panel-section">
                <SubmissionComments
                  key={viewedVersionId}
                  submissionId={submission.id}
                  versionId={viewedVersionId}
                  versionNumber={viewedVersion?.versionNumber}
                />
              </div>
            )}
            <div className="review-panel-section">
              <AdviserTaskReview
                required={submission.adviserReviewRequired}
                submission={submission}
              />
              <p className="mt-3 text-xs leading-5 text-[var(--color-text-secondary)]">
                Approving all required submissions advances the group’s current
                milestone. Posting a comment does not change its status.
              </p>
            </div>
          </aside>
        </div>
      </SubmissionHighlightProvider>
    </section>
  );
}
