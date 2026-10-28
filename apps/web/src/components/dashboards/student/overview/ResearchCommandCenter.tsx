import React, { type ReactNode } from "react";
import "./research-command-center.css";

export interface OverviewAction {
  label: string;
  icon: string;
  onClick: () => void;
}

export function OverviewHeader({
  firstName,
  actions,
}: {
  firstName?: string | null;
  actions: ReactNode;
}) {
  return (
    <header className="rcc-header">
      <div>
        <p className="rcc-eyebrow">Today&apos;s overview</p>
        <h1>Good day, {firstName?.trim() || "Student Researcher"}</h1>
        <p className="rcc-header-summary">
          Here&apos;s an overview of your research progress and what needs your
          attention.
        </p>
      </div>
      <div className="rcc-header-actions">{actions}</div>
    </header>
  );
}

interface ProjectPresentation {
  title: string;
  code: string;
  stage: string;
  instructor: string;
  description: string;
  shortcuts: OverviewAction[];
}

export function OverviewProjectPanel({
  project,
  status,
  statusTone,
  progress,
  actions,
  onProject,
  onMilestones,
}: {
  project?: ProjectPresentation;
  status: string;
  statusTone: "success" | "danger" | "info";
  progress: number;
  actions: ReactNode;
  onProject: () => void;
  onMilestones: () => void;
}) {
  return (
    <section
      className="rcc-panel rcc-project"
      aria-label="Active research project"
    >
      {project && (
        <>
          <div className="rcc-project-topline">
            <div className="rcc-section-label">
              <h2>Active Research Study</h2>
              <span className="rcc-enrollment">ENROLLED</span>
              <p className="rcc-project-code">{project.code}</p>
            </div>
            <button type="button" className="rcc-link" onClick={onProject}>
              Manage Project{" "}
              <i aria-hidden="true" className="ti ti-arrow-up-right" />
            </button>
          </div>
          <div className="rcc-project-copy">
            <h3 className="rcc-project-title">{project.title}</h3>
            <p className="rcc-project-description">{project.description}</p>
          </div>
          <dl className="rcc-project-details">
            <div>
              <dt>Current Workflow Stage</dt>
              <dd>{project.stage}</dd>
            </div>
            <div>
              <dt>Assigned adviser</dt>
              <dd className="rcc-adviser">
                <span aria-hidden="true" className="rcc-avatar">
                  {project.instructor.slice(0, 2).toUpperCase()}
                </span>
                <span>{project.instructor}</span>
              </dd>
            </div>
          </dl>
        </>
      )}
      <div className="rcc-project-state">
        <div className="rcc-status-block">
          <span className="rcc-caption">Project Status</span>
          <button
            type="button"
            className={`rcc-status rcc-status--${statusTone}`}
            onClick={onProject}
          >
            <span aria-hidden="true" />
            {status}
          </button>
        </div>
        <div className="rcc-progress-block">
          <button
            type="button"
            className="rcc-progress-action"
            onClick={onMilestones}
            aria-label={`Research progress ${progress}%. View milestones`}
          >
            <span>Research progress</span>
            <strong>{progress}%</strong>
          </button>
          <div
            className="rcc-progress-track"
            role="progressbar"
            aria-label="Research progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
        <div className="rcc-project-actions">{actions}</div>
      </div>
      {project && (
        <nav className="rcc-shortcuts" aria-label="Project shortcuts">
          {project.shortcuts.map((action) => (
            <button key={action.label} type="button" onClick={action.onClick}>
              <i aria-hidden="true" className={`ti ${action.icon}`} />
              <span>{action.label}</span>
            </button>
          ))}
        </nav>
      )}
    </section>
  );
}

export function OverviewDefenseResult({
  decision,
  releasedOn,
}: {
  decision: string;
  releasedOn: string;
}) {
  const tone =
    decision === "REJECTED"
      ? "danger"
      : decision === "MAJOR_REVISIONS_REQUIRED"
        ? "warning"
        : "success";
  return (
    <section
      className={`rcc-defense rcc-defense--${tone}`}
      aria-label="Official defense result"
    >
      <i aria-hidden="true" className="ti ti-certificate" />
      <div>
        <p className="rcc-caption">Official defense result</p>
        <h2>{String(decision).replace(/_/g, " ")}</h2>
      </div>
      <p className="rcc-defense-release">
        Released by the defense facilitator on {releasedOn}.
      </p>
    </section>
  );
}

export function OverviewResearchSummary({
  documents,
  consultations,
  onDocuments,
  onConsultations,
}: {
  documents: string;
  consultations: string;
  onDocuments: () => void;
  onConsultations: () => void;
}) {
  return (
    <section className="rcc-panel rcc-summary" aria-label="Research Summary">
      <button type="button" onClick={onDocuments}>
        <span className="rcc-caption">Documents</span>
        <strong>{documents}</strong>
      </button>
      <button type="button" onClick={onConsultations}>
        <span className="rcc-caption">Consultations</span>
        <strong>{consultations}</strong>
      </button>
    </section>
  );
}

export function OverviewConsultation({
  consultation,
  onConsultations,
}: {
  consultation: {
    topic: string;
    date: string;
    time: string;
    mode: string;
  } | null;
  onConsultations: () => void;
}) {
  return (
    <section className="rcc-panel rcc-consultation">
      <div className="rcc-panel-heading">
        <h2>Next Consultation</h2>
        <button
          type="button"
          className="rcc-icon-action"
          aria-label="Open consultations"
          onClick={onConsultations}
        >
          <i aria-hidden="true" className="ti ti-arrow-up-right" />
        </button>
      </div>
      <div className="rcc-consultation-content">
        <i aria-hidden="true" className="ti ti-calendar-time" />
        {consultation ? (
          <div>
            <p className="rcc-body-title">{consultation.topic}</p>
            <p className="rcc-supporting">
              {consultation.date} at {consultation.time} ({consultation.mode})
            </p>
          </div>
        ) : (
          <div>
            <p className="rcc-body-title">No upcoming consultation</p>
            <p className="rcc-supporting">
              Book a consultation with your adviser to get feedback and
              guidance.
            </p>
          </div>
        )}
      </div>
      <button
        type="button"
        className="rcc-button rcc-button--secondary rcc-book"
        onClick={onConsultations}
      >
        <i aria-hidden="true" className="ti ti-calendar-plus" />
        Book consultation
      </button>
    </section>
  );
}

export function OverviewGettingStarted({
  steps,
  onTour,
}: {
  steps: Array<OverviewAction & { complete: boolean; description: string }>;
  onTour: () => void;
}) {
  return (
    <section className="rcc-panel rcc-getting-started">
      <div className="rcc-panel-heading">
        <h2>Getting Started</h2>
        <button
          type="button"
          className="rcc-icon-action"
          title="Watch product tour"
          aria-label="Start interactive guide"
          onClick={onTour}
        >
          <i aria-hidden="true" className="ti ti-player-play-filled" />
        </button>
      </div>
      <p className="rcc-supporting">
        Complete these steps to begin your research journey.
      </p>
      <ol className="rcc-steps">
        {steps.map((step, index) => (
          <li key={step.label}>
            <button type="button" onClick={step.onClick}>
              <span
                className={`rcc-step-marker ${step.complete ? "rcc-step-marker--complete" : ""}`}
                aria-label={step.complete ? "Complete" : `Step ${index + 1}`}
              >
                {step.complete ? (
                  <i aria-hidden="true" className="ti ti-check" />
                ) : (
                  index + 1
                )}
              </span>
              <span>
                <strong>{step.label}</strong>
                <span className="rcc-supporting">{step.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function OverviewRecentActivity({
  items,
  onActivity,
}: {
  items: Array<{ id: string; msg: string; date: string }>;
  onActivity: () => void;
}) {
  return (
    <section className="rcc-panel rcc-recent-activity">
      <div className="rcc-panel-heading">
        <h2>Recent Activity</h2>
        <button
          type="button"
          className="rcc-icon-action"
          aria-label="View all activity"
          onClick={onActivity}
        >
          <i aria-hidden="true" className="ti ti-arrow-up-right" />
        </button>
      </div>
      {items.length > 0 ? (
        <ul className="rcc-activity-list">
          {items.map((item) => (
            <li key={item.id}>
              <span aria-hidden="true" className="rcc-activity-dot" />
              <p>{item.msg}</p>
              <span className="rcc-activity-date">{item.date}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rcc-activity-empty">
          <p className="rcc-body-title">No recent activity</p>
          <p className="rcc-supporting">
            Your updates, submissions, and consultations will appear here.
          </p>
        </div>
      )}
    </section>
  );
}

export function OverviewQuickActions({
  actions,
}: {
  actions: OverviewAction[];
}) {
  return (
    <section className="rcc-panel rcc-quick-actions">
      <h2>Quick Actions</h2>
      <div>
        {actions.map((action) => (
          <button type="button" key={action.label} onClick={action.onClick}>
            <i aria-hidden="true" className={`ti ${action.icon}`} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
