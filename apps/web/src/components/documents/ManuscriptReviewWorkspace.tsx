"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileSearch,
  FileText,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListRowsSkeleton } from "@/components/ui/Skeleton";
import { Tag } from "@/components/ui/Tag";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";

type Recommendation = "APPROVE" | "MINOR_REVISION" | "MAJOR_REVISION" | "REJECT";

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
  reviewer?: { id: string; firstName: string; lastName: string; email?: string } | null;
  review?: {
    id: string;
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
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusVariant(status: Assignment["status"]) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "ACTIVE") return "info" as const;
  if (status === "REVOKED") return "danger" as const;
  return "neutral" as const;
}

export function ManuscriptReviewWorkspace() {
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
  const [recommendation, setRecommendation] = useState<Recommendation>("APPROVE");
  const [overallComment, setOverallComment] = useState("");
  const [detailComment, setDetailComment] = useState("");
  const [detailSection, setDetailSection] = useState("");
  const [detailPage, setDetailPage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openingId, setOpeningId] = useState("");
  const [reviewWorkflow, setReviewWorkflow] = useState<ReviewWorkflow | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [candidates, setCandidates] = useState<ReviewerCandidate[]>([]);
  const [managementAction, setManagementAction] = useState<
    "ASSIGN" | "REASSIGN" | "REVOKE" | null
  >(null);
  const [managementTarget, setManagementTarget] = useState<Assignment | null>(null);
  const [candidateKey, setCandidateKey] = useState("");
  const [managementReason, setManagementReason] = useState("");
  const [managementRequired, setManagementRequired] = useState(true);
  const [managing, setManaging] = useState(false);
  const isCoordinator = Boolean(user?.roles.includes("RESEARCH_COORDINATOR"));

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
      setError(requestError.message || "Unable to open this manuscript version.");
    } finally {
      setOpeningId("");
    }
  };

  const openDecision = async (assignment: Assignment) => {
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
    if (!contextKey || loading || openedContextRef.current === contextKey) return;
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
      setNotice("Reviewer assignments were updated and recorded in the audit history.");
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
      setError(requestError.message || "Unable to update this reviewer assignment.");
    } finally {
      setManaging(false);
    }
  };

  const submitDecision = async () => {
    if (!selected) return;
    if (recommendation !== "APPROVE" && overallComment.trim().length < 10) {
      setError("Provide at least 10 characters of actionable feedback for a revision or rejection.");
      return;
    }
    const parsedPage = detailPage ? Number(detailPage) : undefined;
    if (detailPage && (!Number.isInteger(parsedPage) || Number(parsedPage) < 1)) {
      setError("The page number must be a positive whole number.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiClient.post(`/api/reviewer-assignments/${selected.id}/decision`, {
        recommendation,
        overallComment: overallComment.trim() || null,
        comments: detailComment.trim()
          ? [
              {
                comment: detailComment.trim(),
                locationData:
                  detailSection.trim() || parsedPage
                    ? { section: detailSection.trim() || undefined, page: parsedPage }
                    : undefined,
              },
            ]
          : [],
      });
      setSelected(null);
      setNotice("Your decision and feedback were saved to this exact submitted version.");
      await loadAssignments();
    } catch (requestError: any) {
      setError(requestError.message || "Unable to submit your review decision.");
    } finally {
      setSubmitting(false);
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
            <Tag variant="neutral">{assignment.reviewType.replace(/_/g, " ")}</Tag>
          </div>
          <CardTitle icon={FileText}>{assignment.document.title}</CardTitle>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {assignment.research.groupName || assignment.research.title}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--color-primary-light)] px-3 py-2 text-center text-[var(--color-primary)]">
          <span className="block text-[10px] font-bold uppercase tracking-wide">Version</span>
          <span className="text-lg font-black">{assignment.documentVersion.versionNumber}</span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-xs sm:grid-cols-3">
          <div>
            <span className="block font-bold text-[var(--color-text-primary)]">Milestone</span>
            <span className="text-[var(--color-text-secondary)]">
              {assignment.documentVersion.milestone?.name || "General manuscript"}
            </span>
          </div>
          <div>
            <span className="block font-bold text-[var(--color-text-primary)]">Submitted</span>
            <span className="text-[var(--color-text-secondary)]">
              {dateLabel(assignment.documentVersion.submittedAt)}
            </span>
          </div>
          <div>
            <span className="block font-bold text-[var(--color-text-primary)]">Snapshot</span>
            <span className="break-all text-[var(--color-text-secondary)]">
              {assignment.documentVersion.fileName}
            </span>
          </div>
        </div>

        {assignment.review && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              {assignment.review.recommendation?.replace(/_/g, " ") || "Decision submitted"}
            </div>
            {assignment.review.overallComment && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-950/80 dark:text-emerald-100/80">
                {assignment.review.overallComment}
              </p>
            )}
            {assignment.review.comments.map((comment) => (
              <div key={comment.id} className="mt-3 rounded-lg bg-white/70 p-3 text-xs text-slate-700 dark:bg-black/10 dark:text-slate-200">
                {(comment.locationData?.section || comment.locationData?.page) && (
                  <p className="mb-1 font-bold">
                    {[comment.locationData.section, comment.locationData.page ? `Page ${comment.locationData.page}` : ""]
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
              Review and decide
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <PageContainer>
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

      {error && !selected && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
          {notice}
        </div>
      )}

      {loading ? (
        <ListRowsSkeleton rows={4} />
      ) : (
        <>
          <section className="space-y-4" aria-labelledby="pending-review-heading">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="pending-review-heading" className="flex items-center gap-2 text-lg font-black text-[var(--color-text-primary)]">
                  <Clock3 className="h-5 w-5 text-[var(--color-primary)]" /> Pending reviews
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Only active assignments for your account can be decided.</p>
              </div>
              <Tag variant={active.length ? "warning" : "success"}>{active.length}</Tag>
            </div>
            {active.length ? (
              <div className="grid gap-4 xl:grid-cols-2">{active.map((item) => assignmentCard(item, true))}</div>
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title="No manuscript reviews are waiting"
                description="New work appears here only after you are explicitly assigned to a submitted version."
              />
            )}
          </section>

          <section className="space-y-4" aria-labelledby="review-history-heading">
            <div>
              <h2 id="review-history-heading" className="flex items-center gap-2 text-lg font-black text-[var(--color-text-primary)]">
                <FileSearch className="h-5 w-5 text-[var(--color-primary)]" /> Review history
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Completed, revoked, reassigned, and superseded assignments remain auditable.</p>
            </div>
            {history.length ? (
              <div className="grid gap-4 xl:grid-cols-2">{history.map((item) => assignmentCard(item, false))}</div>
            ) : (
              <EmptyState icon={FileSearch} title="No previous decisions" description="Your completed reviews will remain available here." />
            )}
          </section>
        </>
      )}

      <Modal
        isOpen={Boolean(selected)}
        onClose={() => !submitting && setSelected(null)}
        title="Submit manuscript decision"
        subtitle={selected ? `${selected.document.title} · Version ${selected.documentVersion.versionNumber}` : undefined}
        maxWidth="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)} disabled={submitting}>Cancel</Button>
            <Button onClick={() => void submitDecision()} isLoading={submitting}>Submit permanent decision</Button>
          </>
        }
      >
        <div className="space-y-5">
          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">{error}</div>
          )}
          <div>
            <label htmlFor="review-recommendation" className="mb-2 block text-sm font-bold text-[var(--color-text-primary)]">Recommendation</label>
            <select
              id="review-recommendation"
              value={recommendation}
              onChange={(event) => setRecommendation(event.target.value as Recommendation)}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--college-focus-ring)]"
            >
              {(Object.keys(recommendationLabels) as Recommendation[]).map((value) => (
                <option key={value} value={value}>{recommendationLabels[value]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="review-overall" className="mb-2 block text-sm font-bold text-[var(--color-text-primary)]">
              Overall feedback {recommendation !== "APPROVE" && <span className="text-rose-600">*</span>}
            </label>
            <textarea
              id="review-overall"
              rows={5}
              value={overallComment}
              onChange={(event) => setOverallComment(event.target.value)}
              placeholder="Summarize your decision and give actionable guidance."
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--college-focus-ring)]"
            />
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
            <p className="mb-3 text-sm font-bold text-[var(--color-text-primary)]">Optional page or section comment</p>
            <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_120px]">
              <input
                aria-label="Section or chapter"
                value={detailSection}
                onChange={(event) => setDetailSection(event.target.value)}
                placeholder="Section or chapter"
                className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none"
              />
              <input
                aria-label="Page number"
                type="number"
                min="1"
                value={detailPage}
                onChange={(event) => setDetailPage(event.target.value)}
                placeholder="Page"
                className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none"
              />
            </div>
            <textarea
              aria-label="Detailed review comment"
              rows={3}
              value={detailComment}
              onChange={(event) => setDetailComment(event.target.value)}
              placeholder="Add a precise comment tied to this location."
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text-primary)] outline-none"
            />
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              Previous versions and decisions
            </p>
            {historyLoading ? (
              <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                Loading review history…
              </p>
            ) : reviewWorkflow?.versions.some((version) =>
                version.reviewerAssignments.some(
                  (assignment) =>
                    assignment.id !== selected?.id && Boolean(assignment.review),
                ),
              ) ? (
              <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                {reviewWorkflow.versions.flatMap((version) =>
                  version.reviewerAssignments
                    .filter(
                      (assignment) =>
                        assignment.id !== selected?.id && Boolean(assignment.review),
                    )
                    .map((assignment) => (
                      <div
                        key={assignment.id}
                        className="rounded-lg bg-[var(--color-surface-subtle)] p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-[var(--color-text-primary)]">
                            Version {version.versionNumber} · {assignment.reviewType.replace(/_/g, " ")}
                          </span>
                          <Tag size="xs" variant={assignment.review?.recommendation === "APPROVE" ? "success" : "warning"}>
                            {assignment.review?.recommendation?.replace(/_/g, " ") || "DECIDED"}
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
              <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                No earlier faculty decisions are recorded for this manuscript.
              </p>
            )}
          </div>
          {isCoordinator && selectedWorkflowVersion && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">
                    Reviewer assignments
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
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
                {selectedWorkflowVersion.reviewerAssignments.map((assignment) => (
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
                        {assignment.reviewType.replace(/_/g, " ")} · {assignment.isRequired ? "Required" : "Optional"} · {assignment.status.replace(/_/g, " ")}
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
                ))}
              </div>

              {managementAction && (
                <div className="mt-4 space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--color-primary)]">
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
                      className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none"
                    >
                      <option value="">Select an eligible reviewer</option>
                      {availableCandidates.map((candidate) => (
                        <option
                          key={`${candidate.id}-${candidate.reviewType}`}
                          value={`${candidate.id}::${candidate.reviewType}`}
                        >
                          {candidate.firstName} {candidate.lastName} — {candidate.reviewType.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  )}
                  {managementAction === "ASSIGN" ? (
                    <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                      <input
                        type="checkbox"
                        checked={managementRequired}
                        onChange={(event) => setManagementRequired(event.target.checked)}
                        className="accent-[var(--color-primary)]"
                      />
                      This reviewer is mandatory for version approval
                    </label>
                  ) : (
                    <textarea
                      rows={2}
                      value={managementReason}
                      onChange={(event) => setManagementReason(event.target.value)}
                      placeholder="Reason for this assignment change"
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text-primary)] outline-none"
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
                      variant={managementAction === "REVOKE" ? "danger" : "primary"}
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
          <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
            This decision is recorded against the exact submitted snapshot and cannot be edited afterward. A revision request requires the researchers to submit a new version.
          </p>
        </div>
      </Modal>
    </PageContainer>
  );
}

export default ManuscriptReviewWorkspace;
