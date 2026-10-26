"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileSearch,
  FileText,
  Layers3,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListRowsSkeleton } from "@/components/ui/Skeleton";
import { Tag } from "@/components/ui/Tag";
import { apiClient } from "@/lib/api-client";
import { assignmentDisplayState } from "@/lib/review-assignment-display";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useAsyncAction } from "@/hooks/use-async-action";

type Recommendation =
  | "APPROVE"
  | "MINOR_REVISION"
  | "MAJOR_REVISION"
  | "REJECT";

type Assignment = {
  id: string;
  status: "ACTIVE" | "COMPLETED" | "REVOKED" | "REASSIGNED" | "SUPERSEDED";
  reviewType: string;
  isRequired: boolean;
  assignedAt: string;
  completedAt?: string | null;
  statusReason?: string | null;
  document: { id: string; title: string; lifecycleStatus: string };
  documentVersion: {
    id: string;
    versionNumber: number;
    fileName: string;
    submittedAt?: string | null;
    manuscriptStatus?: string | null;
    googleDriveFileId?: string | null;
    milestone?: { id: string; name: string; sequence: number } | null;
  };
  research: { id: string; title: string; groupName?: string | null };
  reviewer?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  } | null;
  review?: {
    id: string;
    status: "DRAFT" | "SUBMITTED" | "RETURNED";
    recommendation?: Recommendation | null;
    overallComment?: string | null;
    submittedAt?: string | null;
    comments: Array<{
      id: string;
      comment: string;
      locationData?: { section?: string; page?: number } | null;
    }>;
  } | null;
};

type ReviewWorkflow = {
  versions: Array<{
    id: string;
    versionNumber: number;
    manuscriptStatus?: string | null;
    reviewerAssignments: Assignment[];
  }>;
};

type ReviewerCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  reviewType: string;
};

const recommendationLabels: Record<Recommendation, string> = {
  APPROVE: "Approve version",
  MINOR_REVISION: "Request minor revision",
  MAJOR_REVISION: "Request major revision",
  REJECT: "Reject version",
};

function dateLabel(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const readableStatus = (value: string) =>
  value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

function statusVariant(status: Assignment["status"]) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "ACTIVE") return "info" as const;
  if (status === "REVOKED") return "danger" as const;
  return "neutral" as const;
}

interface ManuscriptReviewWorkspaceProps {
  presentation?: "default" | "adviser";
}

export function ManuscriptReviewWorkspace({
  presentation = "default",
}: ManuscriptReviewWorkspaceProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const contextualAssignmentId = searchParams.get("assignmentId");
  const contextualVersionId = searchParams.get("versionId");
  const openedContextRef = useRef("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [recommendation, setRecommendation] =
    useState<Recommendation>("APPROVE");
  const [overallComment, setOverallComment] = useState("");
  const [detailComment, setDetailComment] = useState("");
  const [detailSection, setDetailSection] = useState("");
  const [detailPage, setDetailPage] = useState("");
  const decisionAction = useAsyncAction();
  const submitting = decisionAction.isPending;
  const [openingId, setOpeningId] = useState("");
  const [reviewWorkflow, setReviewWorkflow] = useState<ReviewWorkflow | null>(
    null,
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [candidates, setCandidates] = useState<ReviewerCandidate[]>([]);
  const [managementAction, setManagementAction] = useState<
    "ASSIGN" | "REASSIGN" | "REVOKE" | null
  >(null);
  const [managementTarget, setManagementTarget] = useState<Assignment | null>(
    null,
  );
  const [candidateKey, setCandidateKey] = useState("");
  const [managementReason, setManagementReason] = useState("");
  const [managementRequired, setManagementRequired] = useState(true);
  const [managing, setManaging] = useState(false);
  const isCoordinator = Boolean(user?.roles.includes("RESEARCH_COORDINATOR"));
  const isAdviserPresentation = presentation === "adviser";

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get<{ assignments: Assignment[] }>(
        "/api/reviewer-assignments/me",
      );
      setAssignments(response.assignments);
    } catch (requestError: any) {
      setError(requestError.message || "Unable to load manuscript reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const active = useMemo(
    () => assignments.filter((assignment) => assignment.status === "ACTIVE"),
    [assignments],
  );
  const history = useMemo(
    () => assignments.filter((assignment) => assignment.status !== "ACTIVE"),
    [assignments],
  );
  const completedCount = useMemo(
    () =>
      assignments.filter((assignment) => assignment.status === "COMPLETED")
        .length,
    [assignments],
  );
  const selectedWorkflowVersion = reviewWorkflow?.versions.find(
    (version) => version.id === selected?.documentVersion.id,
  );
  const availableCandidates =
    managementAction === "REASSIGN" && managementTarget
      ? candidates.filter(
          (candidate) =>
            candidate.reviewType === managementTarget.reviewType &&
            candidate.id !== managementTarget.reviewer?.id,
        )
      : candidates;

  const openSnapshot = async (assignment: Assignment) => {
    const fileId = assignment.documentVersion.googleDriveFileId;
    if (!fileId) {
      setError("This submitted version does not have a stored snapshot.");
      return;
    }
    setOpeningId(assignment.id);
    setError("");
    try {
      const blob = await apiClient.file(
        `/api/documents/files/${encodeURIComponent(fileId)}`,
      );
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (requestError: any) {
      setError(
        requestError.message || "Unable to open this manuscript version.",
      );
    } finally {
      setOpeningId("");
    }
  };

  const openDecision = async (assignment: Assignment) => {
    decisionAction.reset();
    setSelected(assignment);
    setRecommendation("APPROVE");
    setOverallComment("");
    setDetailComment("");
    setDetailSection("");
    setDetailPage("");
    setError("");
    setReviewWorkflow(null);
    setCandidates([]);
    setManagementAction(null);
    setManagementTarget(null);
    setCandidateKey("");
    setManagementReason("");
    setHistoryLoading(true);
    try {
      const [workflowResponse, candidateResponse] = await Promise.all([
        apiClient.get<{ document: ReviewWorkflow }>(
          `/api/documents/${assignment.document.id}/review-workflow`,
        ),
        isCoordinator
          ? apiClient.get<{ candidates: ReviewerCandidate[] }>(
              `/api/documents/versions/${assignment.documentVersion.id}/reviewer-candidates`,
            )
          : Promise.resolve({ candidates: [] }),
      ]);
      setReviewWorkflow(workflowResponse.document);
      setCandidates(candidateResponse.candidates);
    } catch (requestError: any) {
      setError(
        requestError.message || "Unable to load the previous review history.",
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const contextKey = contextualAssignmentId || contextualVersionId || "";
    if (!contextKey || loading || openedContextRef.current === contextKey)
      return;
    const assignment = assignments.find(
      (candidate) =>
        candidate.id === contextualAssignmentId ||
        candidate.documentVersion.id === contextualVersionId,
    );
    openedContextRef.current = contextKey;
    if (assignment) void openDecision(assignment);
  }, [assignments, contextualAssignmentId, contextualVersionId, loading]);

  const reloadWorkflow = async (assignment: Assignment) => {
    const [workflowResponse, candidateResponse] = await Promise.all([
      apiClient.get<{ document: ReviewWorkflow }>(
        `/api/documents/${assignment.document.id}/review-workflow`,
      ),
      apiClient.get<{ candidates: ReviewerCandidate[] }>(
        `/api/documents/versions/${assignment.documentVersion.id}/reviewer-candidates`,
      ),
    ]);
    setReviewWorkflow(workflowResponse.document);
    setCandidates(candidateResponse.candidates);
  };

  const manageAssignment = async () => {
    if (!selected || !managementAction) return;
    if (
      (managementAction === "REASSIGN" || managementAction === "REVOKE") &&
      managementReason.trim().length < 3
    ) {
      setError("Provide a short reason for this reviewer assignment change.");
      return;
    }
    const [reviewerId, reviewType] = candidateKey.split("::");
    if (managementAction !== "REVOKE" && (!reviewerId || !reviewType)) {
      setError("Select an eligible reviewer.");
      return;
    }
    setManaging(true);
    setError("");
    try {
      if (managementAction === "ASSIGN") {
        await apiClient.post(
          `/api/documents/versions/${selected.documentVersion.id}/reviewer-assignments`,
          { reviewerId, reviewType, isRequired: managementRequired },
        );
      } else if (managementAction === "REASSIGN" && managementTarget) {
        await apiClient.post(
          `/api/reviewer-assignments/${managementTarget.id}/reassign`,
          { reviewerId, reason: managementReason.trim() },
        );
      } else if (managementAction === "REVOKE" && managementTarget) {
        await apiClient.patch(
          `/api/reviewer-assignments/${managementTarget.id}/revoke`,
          { reason: managementReason.trim() },
        );
      }
      await Promise.all([reloadWorkflow(selected), loadAssignments()]);
      setNotice(
        "Reviewer assignments were updated and recorded in the audit history.",
      );
      if (
        managementAction !== "ASSIGN" &&
        managementTarget?.id === selected.id
      ) {
        setSelected(null);
      }
      setManagementAction(null);
      setManagementTarget(null);
      setCandidateKey("");
      setManagementReason("");
    } catch (requestError: any) {
      setError(
        requestError.message || "Unable to update this reviewer assignment.",
      );
    } finally {
      setManaging(false);
    }
  };

  const submitDecision = async () => {
    if (!selected) return;
    if (recommendation !== "APPROVE" && overallComment.trim().length < 10) {
      setError(
        "Provide at least 10 characters of actionable feedback for a revision or rejection.",
      );
      return;
    }
    const parsedPage = detailPage ? Number(detailPage) : undefined;
    if (
      detailPage &&
      (!Number.isInteger(parsedPage) || Number(parsedPage) < 1)
    ) {
      setError("The page number must be a positive whole number.");
      return;
    }
    setError("");
    try {
      await decisionAction.run(
        async () => {
          await apiClient.post(
            `/api/reviewer-assignments/${selected.id}/decision`,
            {
              recommendation,
              overallComment: overallComment.trim() || null,
              comments: detailComment.trim()
                ? [
                    {
                      comment: detailComment.trim(),
                      locationData:
                        detailSection.trim() || parsedPage
                          ? {
                              section: detailSection.trim() || undefined,
                              page: parsedPage,
                            }
                          : undefined,
                    },
                  ]
                : [],
            },
          );
          setSelected(null);
          setNotice(
            "Your decision and feedback were saved to this exact submitted version.",
          );
          await loadAssignments();
        },
        {
          successMessage: "Review decision submitted successfully.",
          errorMessage: (requestError) =>
            requestError instanceof Error
              ? requestError.message
              : "Unable to submit your review decision.",
        },
      );
    } catch {
      // Review content remains in the modal for a safe retry.
    }
  };

  const assignmentCard = (assignment: Assignment, actionable: boolean) => (
    <Card key={assignment.id} className="p-5 sm:p-6">
      <CardHeader className="items-start">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Tag variant={statusVariant(assignment.status)} dot>
              {assignment.status.replace(/_/g, " ")}
            </Tag>
            <Tag variant={assignment.isRequired ? "warning" : "outline"}>
              {assignment.isRequired ? "Required" : "Optional"}
            </Tag>
            <Tag variant="neutral">
              {assignment.reviewType.replace(/_/g, " ")}
            </Tag>
          </div>
          <CardTitle icon={FileText}>{assignment.document.title}</CardTitle>
          <p className="mt-1 text-base text-[var(--color-text-secondary)]">
            {assignment.research.groupName || assignment.research.title}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--color-primary-light)] px-3 py-2 text-center text-[var(--color-primary)]">
          <span className="block text-xs font-bold uppercase tracking-wide">
            Version
          </span>
          <span className="text-lg font-black">
            {assignment.documentVersion.versionNumber}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-xs sm:grid-cols-3">
          <div>
            <span className="block font-bold text-[var(--color-text-primary)]">
              Milestone
            </span>
            <span className="text-[var(--color-text-secondary)]">
              {assignment.documentVersion.milestone?.name ||
                "General manuscript"}
            </span>
          </div>
          <div>
            <span className="block font-bold text-[var(--color-text-primary)]">
              Submitted
            </span>
            <span className="text-[var(--color-text-secondary)]">
              {dateLabel(assignment.documentVersion.submittedAt)}
            </span>
          </div>
          <div>
            <span className="block font-bold text-[var(--color-text-primary)]">
              Snapshot
            </span>
            <span className="break-all text-[var(--color-text-secondary)]">
              {assignment.documentVersion.fileName}
            </span>
          </div>
        </div>

        {assignment.review?.status === "SUBMITTED" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              {assignment.review.recommendation
                ? readableStatus(assignment.review.recommendation)
                : "Decision submitted"}
            </div>
            {assignment.review.overallComment && (
              <p className="mt-2 whitespace-pre-wrap text-base text-emerald-950/80 dark:text-emerald-100/80">
                {assignment.review.overallComment}
              </p>
            )}
            {assignment.review.comments.map((comment) => (
              <div
                key={comment.id}
                className="mt-3 rounded-lg bg-white/70 p-3 text-xs text-slate-700 dark:bg-black/10 dark:text-slate-200"
              >
                {(comment.locationData?.section ||
                  comment.locationData?.page) && (
                  <p className="mb-1 font-bold">
                    {[
                      comment.locationData.section,
                      comment.locationData.page
                        ? `Page ${comment.locationData.page}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {comment.comment}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<ExternalLink className="h-4 w-4" />}
            isLoading={openingId === assignment.id}
            onClick={() => void openSnapshot(assignment)}
          >
            Open frozen version
          </Button>
          {actionable && (
            <Button
              size="sm"
              icon={<MessageSquareText className="h-4 w-4" />}
              onClick={() => void openDecision(assignment)}
            >
              {assignment.review?.status === "DRAFT"
                ? "Continue review"
                : "Review and decide"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const adviserPendingCard = (assignment: Assignment) => {
    const state = assignmentDisplayState(assignment);
    const canDecide =
      assignment.status === "ACTIVE" &&
      assignment.review?.status !== "SUBMITTED";
    return (
      <article
        key={assignment.id}
        className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card-soft)]"
      >
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                <Tag size="xs" variant={state.variant} dot>
                  {state.label}
                </Tag>
                <span>{readableStatus(assignment.reviewType)} review</span>
                <span aria-hidden="true">·</span>
                <span>
                  {assignment.isRequired
                    ? "Required assignment"
                    : "Optional assignment"}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-black leading-snug text-[var(--color-text-primary)] sm:text-xl">
                {assignment.document.title}
              </h3>
              <p className="mt-1.5 text-base font-medium text-[var(--color-text-secondary)]">
                {assignment.research.groupName || assignment.research.title}
              </p>
            </div>
            <div className="shrink-0 rounded-xl bg-[var(--color-primary-light)] px-3.5 py-2 text-center text-[var(--color-primary)]">
              <span className="block text-xs font-bold uppercase tracking-wider">
                Version
              </span>
              <span className="text-xl font-black leading-none">
                {assignment.documentVersion.versionNumber}
              </span>
            </div>
          </div>

          <dl className="mt-5 grid gap-x-6 gap-y-3 border-y border-[var(--color-border-subtle)] py-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Milestone
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                {assignment.documentVersion.milestone?.name ||
                  "General manuscript"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Submitted
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                {dateLabel(assignment.documentVersion.submittedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Assignment status
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                {readableStatus(assignment.status)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Review status
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                {assignment.review
                  ? readableStatus(assignment.review.status)
                  : "Not started"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-base font-bold text-[var(--color-text-primary)]">
                {state.label}
              </p>
              <p className="mt-0.5 text-base leading-5 text-[var(--color-text-secondary)]">
                {state.description}
              </p>
              <p
                className="mt-1 truncate text-sm text-[var(--color-text-muted)]"
                title={assignment.documentVersion.fileName}
              >
                Frozen file: {assignment.documentVersion.fileName}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {canDecide && (
                <Button
                  size="md"
                  icon={<MessageSquareText className="h-4 w-4" />}
                  onClick={() => void openDecision(assignment)}
                >
                  {assignment.review?.status === "DRAFT"
                    ? "Continue review"
                    : "Review and decide"}
                </Button>
              )}
              <Button
                variant="secondary"
                size="md"
                icon={<ExternalLink className="h-4 w-4" />}
                isLoading={openingId === assignment.id}
                onClick={() => void openSnapshot(assignment)}
              >
                Open frozen version
              </Button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  const adviserHistoryRow = (assignment: Assignment) => {
    const state = assignmentDisplayState(assignment);
    const review = assignment.review;
    return (
      <article
        key={assignment.id}
        className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Tag size="xs" variant={state.variant} dot>
                {state.label}
              </Tag>
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Version {assignment.documentVersion.versionNumber}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {readableStatus(assignment.reviewType)} review
              </span>
            </div>
            <h3 className="mt-2 truncate text-lg font-bold text-[var(--color-text-primary)]">
              {assignment.document.title}
            </h3>
            <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">
              {assignment.research.groupName || assignment.research.title} ·{" "}
              {assignment.documentVersion.milestone?.name ||
                "General manuscript"}{" "}
              ·{" "}
              {dateLabel(
                assignment.completedAt ||
                  review?.submittedAt ||
                  assignment.assignedAt,
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<ExternalLink className="h-4 w-4" />}
              isLoading={openingId === assignment.id}
              onClick={() => void openSnapshot(assignment)}
            >
              Open frozen version
            </Button>
          </div>
        </div>

        <details className="mt-3 border-t border-[var(--color-border-subtle)] pt-3">
          <summary className="cursor-pointer text-xs font-bold text-[var(--color-primary)]">
            View complete review details
          </summary>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Assignment
              </p>
              <p className="mt-1 font-semibold text-[var(--color-text-primary)]">
                {readableStatus(assignment.status)}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Review
              </p>
              <p className="mt-1 font-semibold text-[var(--color-text-primary)]">
                {review ? readableStatus(review.status) : "No review recorded"}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Decision
              </p>
              <p className="mt-1 font-semibold text-[var(--color-text-primary)]">
                {review?.recommendation
                  ? readableStatus(review.recommendation)
                  : "No decision recorded"}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Submitted
              </p>
              <p className="mt-1 font-semibold text-[var(--color-text-primary)]">
                {dateLabel(review?.submittedAt)}
              </p>
            </div>
          </div>
          {(state.description || review?.overallComment) && (
            <div className="mt-3 rounded-xl bg-[var(--color-surface-subtle)] p-3 text-xs leading-5 text-[var(--color-text-secondary)]">
              {review?.overallComment || state.description}
            </div>
          )}
          {review?.comments.length ? (
            <div className="mt-3 space-y-2">
              {review.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-xl bg-[var(--color-surface-subtle)] p-3 text-xs text-[var(--color-text-secondary)]"
                >
                  {(comment.locationData?.section ||
                    comment.locationData?.page) && (
                    <p className="mb-1 font-bold text-[var(--color-text-primary)]">
                      {[
                        comment.locationData.section,
                        comment.locationData.page
                          ? `Page ${comment.locationData.page}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {comment.comment}
                </div>
              ))}
            </div>
          ) : null}
        </details>
      </article>
    );
  };

  return (
    <PageContainer
      maxWidth={isAdviserPresentation ? "full" : "default"}
      className={cn(
        isAdviserPresentation && "max-w-[1800px] gap-5 px-0 py-0 lg:py-0",
      )}
    >
      {isAdviserPresentation ? (
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B3A53] via-[#0E4968] to-[#072A3D] p-5 text-white shadow-lg sm:p-6 lg:p-7">
          <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#C9A227]/20 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#E4C864]">
                Global review center
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Manuscript Reviews
              </h1>
              <p className="mt-2 text-base leading-6 text-white/75">
                Review exact frozen manuscript versions assigned to you across
                all research groups. Decisions remain permanent and
                version-scoped.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => void loadAssignments()}
              isLoading={loading}
            >
              Refresh assignments
            </Button>
          </div>
        </header>
      ) : (
        <PageHeader
          title="Manuscript Reviews"
          subtitle="Review the exact frozen version assigned to you. Decisions are permanent, version-scoped, and visible in the research workflow."
          category="Research workspace"
          badge={`${active.length} pending`}
          actions={
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => void loadAssignments()}
              isLoading={loading}
            >
              Refresh
            </Button>
          }
        />
      )}

      {isAdviserPresentation && !loading && (
        <section
          aria-label="Review assignment summary"
          className="grid gap-3 sm:grid-cols-3"
        >
          {[
            {
              label: "Pending assignments",
              value: active.length,
              detail: "Active assignments requiring attention",
              icon: Clock3,
              tone: "text-[#C58A18] bg-[#FEF7EA] dark:bg-[#C58A18]/15",
            },
            {
              label: "Completed reviews",
              value: completedCount,
              detail: "Version-scoped decisions submitted",
              icon: CheckCircle2,
              tone: "text-[#2E7D5B] bg-[#EAF5EE] dark:bg-[#2E7D5B]/15",
            },
            {
              label: "Total assignments",
              value: assignments.length,
              detail: "Including retained audit history",
              icon: Layers3,
              tone: "text-[var(--color-primary)] bg-[var(--color-primary-light)]",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3.5"
            >
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                  stat.tone,
                )}
              >
                <stat.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {stat.label}
                </span>
                <span className="mt-0.5 block text-xl font-black text-[var(--color-text-primary)]">
                  {stat.value}
                </span>
                <span className="block truncate text-xs text-[var(--color-text-secondary)]">
                  {stat.detail}
                </span>
              </span>
            </div>
          ))}
        </section>
      )}

      {error && !selected && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
        >
          {notice}
        </div>
      )}

      {loading ? (
        <ListRowsSkeleton rows={4} />
      ) : (
        <>
          <section
            className={cn(
              "space-y-4",
              isAdviserPresentation &&
                "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 sm:p-5",
            )}
            aria-labelledby="pending-review-heading"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2
                  id="pending-review-heading"
                  className="flex items-center gap-2 text-xl font-black text-[var(--color-text-primary)]"
                >
                  <Clock3 className="h-5 w-5 text-[var(--color-primary)]" />{" "}
                  Pending reviews
                </h2>
                <p className="mt-1 text-base text-[var(--color-text-secondary)]">
                  Only active assignments for your account can be decided.
                </p>
              </div>
              {!isAdviserPresentation && (
                <Tag variant={active.length ? "warning" : "success"}>
                  {active.length}
                </Tag>
              )}
            </div>
            {active.length ? (
              <div
                className={cn(
                  "grid gap-4",
                  !isAdviserPresentation && "xl:grid-cols-2",
                )}
              >
                {active.map((item) =>
                  isAdviserPresentation
                    ? adviserPendingCard(item)
                    : assignmentCard(item, true),
                )}
              </div>
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title="No manuscript reviews are waiting"
                description="New work appears here only after you are explicitly assigned to a submitted version."
              />
            )}
          </section>

          <section
            className={cn(
              "space-y-4",
              isAdviserPresentation &&
                "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5",
            )}
            aria-labelledby="review-history-heading"
          >
            <div>
              <h2
                id="review-history-heading"
                className="flex items-center gap-2 text-xl font-black text-[var(--color-text-primary)]"
              >
                <FileSearch className="h-5 w-5 text-[var(--color-primary)]" />{" "}
                Review history
              </h2>
              <p className="mt-1 text-base text-[var(--color-text-secondary)]">
                Completed, revoked, reassigned, and superseded assignments
                remain auditable.
              </p>
            </div>
            {history.length ? (
              <div
                className={cn(
                  "grid gap-3",
                  !isAdviserPresentation && "gap-4 xl:grid-cols-2",
                )}
              >
                {history.map((item) =>
                  isAdviserPresentation
                    ? adviserHistoryRow(item)
                    : assignmentCard(item, false),
                )}
              </div>
            ) : (
              <EmptyState
                icon={FileSearch}
                title="No previous decisions"
                description="Your completed reviews will remain available here."
              />
            )}
          </section>
        </>
      )}

      <Modal
        isOpen={Boolean(selected)}
        onClose={() => !submitting && setSelected(null)}
        title="Submit manuscript decision"
        subtitle={
          selected
            ? `${selected.document.title} · Version ${selected.documentVersion.versionNumber}`
            : undefined
        }
        maxWidth="lg"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setSelected(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void submitDecision()}
              status={decisionAction.status}
              successText="Decision submitted"
              errorText="Try submitting again"
            >
              Submit permanent decision
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <ActionFeedback
            feedback={decisionAction.feedback}
            tone={error ? "error" : undefined}
            message={error}
          />
          <div>
            <label
              htmlFor="review-recommendation"
              className="mb-2 block text-sm font-bold text-[var(--color-text-primary)]"
            >
              Recommendation
            </label>
            <select
              id="review-recommendation"
              value={recommendation}
              onChange={(event) =>
                setRecommendation(event.target.value as Recommendation)
              }
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--college-focus-ring)]"
            >
              {(Object.keys(recommendationLabels) as Recommendation[]).map(
                (value) => (
                  <option key={value} value={value}>
                    {recommendationLabels[value]}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <label
              htmlFor="review-overall"
              className="mb-2 block text-sm font-bold text-[var(--color-text-primary)]"
            >
              Overall feedback{" "}
              {recommendation !== "APPROVE" && (
                <span className="text-rose-600">*</span>
              )}
            </label>
            <textarea
              id="review-overall"
              rows={5}
              value={overallComment}
              onChange={(event) => setOverallComment(event.target.value)}
              placeholder="Summarize your decision and give actionable guidance."
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-base text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--college-focus-ring)]"
            />
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
            <p className="mb-3 text-base font-bold text-[var(--color-text-primary)]">
              Optional page or section comment
            </p>
            <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_120px]">
              <input
                aria-label="Section or chapter"
                value={detailSection}
                onChange={(event) => setDetailSection(event.target.value)}
                placeholder="Section or chapter"
                className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base text-[var(--color-text-primary)] outline-none"
              />
              <input
                aria-label="Page number"
                type="number"
                min="1"
                value={detailPage}
                onChange={(event) => setDetailPage(event.target.value)}
                placeholder="Page"
                className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base text-[var(--color-text-primary)] outline-none"
              />
            </div>
            <textarea
              aria-label="Detailed review comment"
              rows={3}
              value={detailComment}
              onChange={(event) => setDetailComment(event.target.value)}
              placeholder="Add a precise comment tied to this location."
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-base text-[var(--color-text-primary)] outline-none"
            />
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-base font-bold text-[var(--color-text-primary)]">
              Previous versions and decisions
            </p>
            {historyLoading ? (
              <p className="mt-3 text-base text-[var(--color-text-secondary)]">
                Loading review history…
              </p>
            ) : reviewWorkflow?.versions.some((version) =>
                version.reviewerAssignments.some(
                  (assignment) =>
                    assignment.id !== selected?.id &&
                    Boolean(assignment.review),
                ),
              ) ? (
              <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                {reviewWorkflow.versions.flatMap((version) =>
                  version.reviewerAssignments
                    .filter(
                      (assignment) =>
                        assignment.id !== selected?.id &&
                        Boolean(assignment.review),
                    )
                    .map((assignment) => (
                      <div
                        key={assignment.id}
                        className="rounded-lg bg-[var(--color-surface-subtle)] p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-[var(--color-text-primary)]">
                            Version {version.versionNumber} ·{" "}
                            {assignment.reviewType.replace(/_/g, " ")}
                          </span>
                          <Tag
                            size="xs"
                            variant={
                              assignment.review?.recommendation === "APPROVE"
                                ? "success"
                                : "warning"
                            }
                          >
                            {assignment.review?.recommendation?.replace(
                              /_/g,
                              " ",
                            ) || "DECIDED"}
                          </Tag>
                        </div>
                        <p className="mt-1 text-[var(--color-text-secondary)]">
                          {assignment.reviewer
                            ? `${assignment.reviewer.firstName} ${assignment.reviewer.lastName}`
                            : "Authorized reviewer"}
                          {assignment.review?.submittedAt
                            ? ` · ${dateLabel(assignment.review.submittedAt)}`
                            : ""}
                        </p>
                        {assignment.review?.overallComment && (
                          <p className="mt-2 whitespace-pre-wrap text-[var(--color-text-secondary)]">
                            {assignment.review.overallComment}
                          </p>
                        )}
                      </div>
                    )),
                )}
              </div>
            ) : (
              <p className="mt-3 text-base text-[var(--color-text-secondary)]">
                No earlier faculty decisions are recorded for this manuscript.
              </p>
            )}
          </div>
          {isCoordinator && selectedWorkflowVersion && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-[var(--color-text-primary)]">
                    Reviewer assignments
                  </p>
                  <p className="mt-1 text-base text-[var(--color-text-secondary)]">
                    Only eligible project-scoped faculty appear in this list.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setManagementAction("ASSIGN");
                    setManagementTarget(null);
                    setCandidateKey("");
                    setManagementReason("");
                  }}
                >
                  Assign reviewer
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {selectedWorkflowVersion.reviewerAssignments.map(
                  (assignment) => (
                    <div
                      key={assignment.id}
                      className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 text-xs">
                        <p className="truncate font-bold text-[var(--color-text-primary)]">
                          {assignment.reviewer
                            ? `${assignment.reviewer.firstName} ${assignment.reviewer.lastName}`
                            : "Authorized reviewer"}
                        </p>
                        <p className="mt-1 text-[var(--color-text-secondary)]">
                          {assignment.reviewType.replace(/_/g, " ")} ·{" "}
                          {assignment.isRequired ? "Required" : "Optional"} ·{" "}
                          {assignment.status.replace(/_/g, " ")}
                        </p>
                      </div>
                      {assignment.status === "ACTIVE" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setManagementAction("REASSIGN");
                              setManagementTarget(assignment);
                              setCandidateKey("");
                              setManagementReason("");
                            }}
                          >
                            Reassign
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-600"
                            onClick={() => {
                              setManagementAction("REVOKE");
                              setManagementTarget(assignment);
                              setCandidateKey("");
                              setManagementReason("");
                            }}
                          >
                            Revoke
                          </Button>
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>

              {managementAction && (
                <div className="mt-4 space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <p className="text-sm font-extrabold uppercase tracking-wide text-[var(--color-primary)]">
                    {managementAction === "ASSIGN"
                      ? "New assignment"
                      : managementAction === "REASSIGN"
                        ? "Reassign reviewer"
                        : "Revoke assignment"}
                  </p>
                  {managementAction !== "REVOKE" && (
                    <select
                      aria-label="Eligible reviewer"
                      value={candidateKey}
                      onChange={(event) => setCandidateKey(event.target.value)}
                      className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-base text-[var(--color-text-primary)] outline-none"
                    >
                      <option value="">Select an eligible reviewer</option>
                      {availableCandidates.map((candidate) => (
                        <option
                          key={`${candidate.id}-${candidate.reviewType}`}
                          value={`${candidate.id}::${candidate.reviewType}`}
                        >
                          {candidate.firstName} {candidate.lastName} —{" "}
                          {candidate.reviewType.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  )}
                  {managementAction === "ASSIGN" ? (
                    <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                      <input
                        type="checkbox"
                        checked={managementRequired}
                        onChange={(event) =>
                          setManagementRequired(event.target.checked)
                        }
                        className="accent-[var(--color-primary)]"
                      />
                      This reviewer is mandatory for version approval
                    </label>
                  ) : (
                    <textarea
                      rows={2}
                      value={managementReason}
                      onChange={(event) =>
                        setManagementReason(event.target.value)
                      }
                      placeholder="Reason for this assignment change"
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-base text-[var(--color-text-primary)] outline-none"
                    />
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={managing}
                      onClick={() => {
                        setManagementAction(null);
                        setManagementTarget(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        managementAction === "REVOKE" ? "danger" : "primary"
                      }
                      isLoading={managing}
                      onClick={() => void manageAssignment()}
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <p className="text-base leading-5 text-[var(--color-text-secondary)]">
            This decision is recorded against the exact submitted snapshot and
            cannot be edited afterward. A revision request requires the
            researchers to submit a new version.
          </p>
        </div>
      </Modal>
    </PageContainer>
  );
}

export default ManuscriptReviewWorkspace;
