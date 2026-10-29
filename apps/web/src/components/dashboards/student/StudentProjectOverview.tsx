import React from "react";
import {
  researchTitleLabel,
  resolveProjectNextStep,
  type OverviewProject,
  type ProjectAction,
  type ProjectMilestoneProgress,
} from "@/lib/student-project-overview";

const card = "mp-panel";
const secondary = "mp-button mp-button--secondary";

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
  const titleLabel = researchTitleLabel(project);
  const approvedTitle = titleLabel === "Approved research title" || titleLabel === "Registered Research Project";
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
      ? "mp-next--action"
      : nextStep.tone === "pending"
        ? "mp-next--pending"
        : nextStep.tone === "success"
          ? "mp-next--success"
          : "mp-next--neutral";

  return (
    <div className="student-projects-readable mp-workspace mp-project">
      <section className={`${card} mp-identity`} aria-label="Project details">
        <div className="mp-identity-layout">
          <div className="mp-identity-copy">
            <div className="mp-identity-metadata">
            <p className="mp-workflow-meta">
              {project.workflowAccessRemoved
                ? "Workflow access removed"
                : workflowName || "No workflow linked"}
              {academicYear && <span> · AY {academicYear}</span>}
            </p>
              <span
                className={`mp-status capitalize ${["SUBMITTED", "UNDER_REVIEW"].includes(project.status || "") ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]"}`}
              >
                {statusText}
              </span>
            </div>
            {coordinator && !project.workflowAccessRemoved && (
              <p className="mp-coordinator">
                Coordinator: {coordinator}
              </p>
            )}
            <h2 className="mp-project-title">
              {project.title || "Research workflow in progress"}
            </h2>
            <div className="mp-title-classification">
              <span
                className={
                  approvedTitle
                    ? "mp-title-approved text-emerald-700 dark:text-emerald-300"
                    : "mp-caption"
                }
              >
                {titleLabel}
              </span>

            </div>
            <p className="mp-group-reference">
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
        className={`${card} mp-next ${tone}`}
        aria-labelledby="project-next-step"
        aria-live="polite"
      >
        <p className="mp-eyebrow">
          {nextStep.label}
        </p>
        <h3
          id="project-next-step"
          className="mp-next-title"
        >
          {nextStep.title}
        </h3>
        <p className="mp-next-description">
          {nextStep.description}
        </p>
        {nextStep.action && (
          <button
            type="button"
            onClick={() => onAction(nextStep.action!)}
            className="mp-button mp-button--primary mp-next-action"
          >
            {nextStep.buttonLabel}
            <span aria-hidden="true">→</span>
          </button>
        )}
      </section>

      <section className={`${card} mp-progress`} aria-labelledby="project-workflow-progress">
        <div className="mp-section-heading">
          <h3
            id="project-workflow-progress"
            className="mp-section-title"
          >
            Workflow progress
          </h3>
          {!project.workflowAccessRemoved && (
            <button
              type="button"
              onClick={() => onAction({ kind: "timeline" })}
              className="mp-text-action"
            >
              View all milestones
            </button>
          )}
        </div>
        <p className="mp-current-stage">
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
            <p className="mp-stage-status capitalize">
              {project.workflowInstance?.completedAt
                ? "Workflow completed"
                : current?.status?.toLowerCase().replace(/_/g, " ") ||
                  "Not started"}
            </p>
            <div
              className="mp-progress-track"
              role="progressbar"
              aria-label="Workflow requirements completed"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="mp-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mp-progress-caption">
              <span className="mp-progress-value">{progress}%</span>{" "}
              <span>of workflow requirements completed</span>
            </p>
          </>
        )}
      </section>

      <div className="mp-adviser">{adviser}</div>

      <section
        className={`${card} mp-team`}
        aria-label="Team summary"
      >
        <div>
          <h3 className="mp-section-title">
            Team
          </h3>
          <p className="mp-team-description">
            {teamName} · {memberCount} member{memberCount === 1 ? "" : "s"}
          </p>
        </div>
        <button type="button" onClick={onGroup} className={secondary}>
          {isLeader ? "Manage group" : "View group"}
        </button>
      </section>

      <details
        className={`${card} mp-disclosure`}
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
        <summary className="mp-disclosure-heading">
          Defense readiness{" "}
          <span className="mp-disclosure-status">
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

      <details className={`${card} mp-disclosure`}>
        <summary className="mp-disclosure-heading">
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
