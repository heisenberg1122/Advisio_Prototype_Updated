import React from "react";
import {
  researchTitleLabel,
  resolveProjectNextStep,
  type OverviewProject,
  type ProjectAction,
  type ProjectMilestoneProgress,
} from "@/lib/student-project-overview";

const card =
  "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs sm:p-6";
const secondary =
  "text-sm font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4";

export function StudentProjectOverview({
  project,
  isLeader,
  workflowName,
  coordinator,
  academicYear,
  progress,
  milestones,
  loading,
  error,
  adviser,
  titleHistory,
  teamName,
  memberCount,
  defenseSession,
  onAction,
  onGroup,
  onArchive,
}: {
  project: OverviewProject;
  isLeader: boolean;
  workflowName?: string;
  coordinator?: string;
  academicYear?: string;
  progress: number;
  milestones?: ProjectMilestoneProgress[];
  loading: boolean;
  error: boolean;
  adviser: React.ReactNode;
  titleHistory?: React.ReactNode;
  teamName: string;
  memberCount: number;
  defenseSession?: { status: string; scheduledDate?: string } | null;
  onAction: (action: ProjectAction) => void;
  onGroup: () => void;
  onArchive: () => void;
}) {
  const nextStep = resolveProjectNextStep({
    project,
    milestones,
    loading,
    error,
    isLeader,
  });
  const recordedTitleLabel = researchTitleLabel(project);
  const titleLabel = recordedTitleLabel === "Approved research title" && milestones?.some(stage => stage.capturesResearchTitle && ["REVISION_REQUIRED", "NEEDS_REVALIDATION"].includes(stage.status || ""))
    ? "Previously approved research title"
    : recordedTitleLabel;
  const approvedTitle = titleLabel === "Approved research title";
  const current = milestones?.find(
    (stage) =>
      stage.id === project.workflowInstance?.currentStage?.id ||
      stage.isCurrent,
  );
  const statusText = (project.status || "DRAFT")
    .toLowerCase()
    .replace(/_/g, " ");
  const pendingTitle = project.titleRevisions?.find(
    (revision) => revision.status === "PENDING",
  );
  const tone =
    nextStep.tone === "action"
      ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]"
      : nextStep.tone === "pending"
        ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
        : nextStep.tone === "success"
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-[var(--color-border)] bg-[var(--color-surface-muted)]";

  return (
    <div className="student-projects-readable space-y-5">
      <section className={card} aria-label="Project details">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
              {project.workflowAccessRemoved
                ? "Workflow access removed"
                : workflowName || "No workflow linked"}
              {academicYear && <span> · AY {academicYear}</span>}
            </p>
            {coordinator && !project.workflowAccessRemoved && (
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Coordinator: {coordinator}
              </p>
            )}
            <h2 className="mt-4 break-words text-2xl font-bold leading-tight tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
              {project.title || "Research title not added"}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span
                className={
                  approvedTitle
                    ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "text-[var(--color-text-secondary)]"
                }
              >
                {titleLabel}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${["SUBMITTED", "UNDER_REVIEW"].includes(project.status || "") ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]"}`}
              >
                {statusText}
              </span>
            </div>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              {teamName}
            </p>
            {pendingTitle && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                Title amendment awaiting review:{" "}
                <strong>{pendingTitle.proposedTitle}</strong>
              </p>
            )}
          </div>
          {isLeader && (
            <button
              type="button"
              onClick={() => onAction({ kind: "edit" })}
              className={`${secondary} shrink-0 self-start`}
            >
              Edit details
            </button>
          )}
        </div>
      </section>

      <section
        className={`rounded-2xl border p-5 sm:p-6 ${tone}`}
        aria-labelledby="project-next-step"
        aria-live="polite"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">
          {nextStep.label}
        </p>
        <h3
          id="project-next-step"
          className="mt-2 text-xl font-bold text-[var(--color-text-primary)]"
        >
          {nextStep.title}
        </h3>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-[var(--color-text-secondary)]">
          {nextStep.description}
        </p>
        {nextStep.action && (
          <button
            type="button"
            onClick={() => onAction(nextStep.action!)}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-[var(--college-on-primary)] transition hover:bg-[var(--color-primary-dark)] dark:text-[var(--college-on-primary-dark)]"
          >
            {nextStep.buttonLabel}
            <span aria-hidden="true">→</span>
          </button>
        )}
      </section>

      {milestones && <section className={card} aria-label="Milestone availability">
        <h3 className="font-bold text-[var(--color-text-primary)]">Milestones and prerequisites</h3>
        <div className="mt-3 space-y-3">{milestones.map(stage => <div key={stage.id} className="rounded-xl border border-[var(--color-border)] p-3"><p className="font-semibold text-[var(--color-text-primary)]">{stage.name}</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{stage.status?.replace(/_/g, " ") || "Not started"}{stage.independent ? " · No prerequisites" : ""}{stage.locked ? " · Blocked" : ""}</p>{stage.blockedReason && <p className="mt-1 text-sm text-amber-800">{stage.blockedReason}</p>}{stage.reason && <p className="mt-1 whitespace-pre-line text-sm text-[var(--color-text-secondary)]">{stage.reason}</p>}</div>)}</div>
      </section>}
      <section className={card} aria-labelledby="project-workflow-progress">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3
            id="project-workflow-progress"
            className="text-base font-bold text-[var(--color-text-primary)]"
          >
            Workflow progress
          </h3>
          {!project.workflowAccessRemoved && (
            <button
              type="button"
              onClick={() => onAction({ kind: "timeline" })}
              className={secondary}
            >
              View all milestones
            </button>
          )}
        </div>
        <p className="mt-3 text-base font-semibold text-[var(--color-text-primary)]">
          {project.workflowAccessRemoved
            ? "Workflow unavailable"
            : loading
              ? "Loading milestone…"
              : error
                ? "Progress could not be loaded"
                : current?.name ||
                  project.workflowInstance?.currentStage?.name ||
                  "No current milestone"}
        </p>
        {!loading && !error && milestones && !project.workflowAccessRemoved && (
          <>
            <p className="mt-1 text-sm capitalize text-[var(--color-text-secondary)]">
              {project.workflowInstance?.completedAt
                ? "Workflow completed"
                : current?.status?.toLowerCase().replace(/_/g, " ") ||
                  "Not started"}
            </p>
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]"
              role="progressbar"
              aria-label="Workflow requirements completed"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-[var(--color-primary)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              {progress}% of workflow requirements completed
            </p>
          </>
        )}
      </section>

      {adviser}

      <section
        className={`${card} flex flex-wrap items-center justify-between gap-3`}
        aria-label="Team summary"
      >
        <div>
          <h3 className="text-base font-bold text-[var(--color-text-primary)]">
            Team
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {teamName} · {memberCount} member{memberCount === 1 ? "" : "s"}
          </p>
        </div>
        <button type="button" onClick={onGroup} className={secondary}>
          {isLeader ? "Manage group" : "View group"}
        </button>
      </section>

      <details
        className={card}
        open={Boolean(
          defenseSession &&
          [
            "SCHEDULED",
            "LIVE",
            "DELIBERATION",
            "PENDING_ACKNOWLEDGEMENT",
            "NEEDS_RESCHEDULING",
          ].includes(defenseSession.status),
        )}
      >
        <summary className="cursor-pointer text-base font-bold text-[var(--color-text-primary)]">
          Defense readiness{" "}
          <span className="ml-2 text-sm font-normal text-[var(--color-text-secondary)]">
            {defenseSession
              ? defenseSession.status.toLowerCase().replace(/_/g, " ")
              : project.workflowInstance?.completedAt
                ? "Check remaining requirements"
                : "Requirements incomplete"}
          </span>
        </summary>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {defenseSession
            ? "View your defense schedule, panel confirmations, and requirements in the Defense page."
            : "Defense eligibility also depends on the final manuscript, adviser assignment, and required approvals. Check the Defense page for the full requirements."}
        </p>
        <button
          type="button"
          onClick={() => onAction({ kind: "defense" })}
          className={`mt-3 ${secondary}`}
        >
          {defenseSession ? "View defense" : "View requirements"}
        </button>
      </details>

      <details className={card}>
        <summary className="cursor-pointer text-base font-bold text-[var(--color-text-primary)]">
          Project management
        </summary>
        {titleHistory}
        {isLeader ? (
          <>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              Archive this project when it is no longer active. This requires
              confirmation and preserves academic records.
            </p>
            <button
              type="button"
              onClick={onArchive}
              className="mt-3 text-sm font-semibold text-rose-700 underline-offset-4 hover:underline dark:text-rose-300"
            >
              Archive project
            </button>
          </>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            Your group leader manages project details. Membership options are
            available in the My Group tab.
          </p>
        )}
      </details>
    </div>
  );
}
