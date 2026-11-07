import React, { type ReactNode } from "react";
import Link from "next/link";
import type { ProjectNextStep } from "@/lib/student-project-overview";
import { overviewDate } from "@/lib/student-project-overview";
import {
  dueLabel,
  isDueSoon,
  journeyPosition,
  nextStepVisual,
  type ComingUpItem,
  type JourneyStep,
  type UpdateItem,
} from "@/lib/researcher-home";
import "./researcher-home.css";

const RING_RADIUS = 36;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ value }: { value: number }) {
  const percent = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div
      className="rh-ring"
      role="img"
      aria-label={`Research progress ${percent} percent`}
    >
      <svg viewBox="0 0 84 84" aria-hidden="true">
        <circle className="rh-ring-track" cx="42" cy="42" r={RING_RADIUS} />
        <circle
          className="rh-ring-value"
          cx="42"
          cy="42"
          r={RING_RADIUS}
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - percent / 100)}
        />
      </svg>
      <strong aria-hidden="true">{percent}%</strong>
    </div>
  );
}

export function ResearcherHomeHero({
  firstName,
  title,
  steps,
  progress,
  members,
  memberCount,
  adviserName,
  logoSrc,
  action,
}: {
  firstName?: string | null;
  title: string;
  steps: JourneyStep[];
  progress: number | null;
  members: Array<{ id: string; initials: string }>;
  memberCount: number;
  adviserName?: string;
  /** The account's college logo, shown as a faint decorative watermark. */
  logoSrc?: string;
  action: ReactNode;
}) {
  const position = journeyPosition(steps);
  const shownMembers = members.slice(0, 4);
  const teamLabel = [
    memberCount > 0
      ? `${memberCount} ${memberCount === 1 ? "member" : "members"}`
      : "",
    adviserName ? `Adviser: ${adviserName}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <section
      className="rh-hero"
      aria-label="Your research progress"
      data-tour="researcher-project"
    >
      {logoSrc && (
        <img
          className="rh-hero-logo"
          src={logoSrc}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      )}
      <div className="rh-hero-head">
        <div className="rh-hero-copy">
          <h1 className="rh-greeting" data-guide="researcher-home-heading">
            <i aria-hidden="true" className="ti ti-sun" />
            Good day, {firstName?.trim() || "Student Researcher"}
          </h1>
          <h2 className="rh-project-title">{title}</h2>
          {teamLabel && (
            <div className="rh-team">
              {shownMembers.length > 0 && (
                <span className="rh-avatars" aria-hidden="true">
                  {shownMembers.map((member) => (
                    <span key={member.id}>{member.initials}</span>
                  ))}
                </span>
              )}
              <span>{teamLabel}</span>
            </div>
          )}
        </div>
        <div className="rh-hero-side">
          {progress !== null && <ProgressRing value={progress} />}
          <div className="rh-hero-action rh-hero-action--wide">{action}</div>
        </div>
      </div>
      {steps.length > 0 && (
        <div
          className="rh-steps-scroll"
          tabIndex={steps.length > 8 ? 0 : undefined}
          role={steps.length > 8 ? "region" : undefined}
          aria-label={steps.length > 8 ? "Research milestones" : undefined}
        >
          <ol
            className="rh-steps"
            aria-label="Research milestones"
            style={{ "--rh-step-count": steps.length } as React.CSSProperties}
          >
            {steps.map((step, index) => (
              <li
                key={step.id}
                className={`rh-step rh-step--${step.state}`}
                aria-current={step.state === "current" ? "step" : undefined}
                title={step.name}
              >
                <span className="rh-step-node" aria-hidden="true">
                  {step.state === "done" ? (
                    <i className="ti ti-check" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="rh-step-name">
                  {step.name}
                  {step.state === "done" && (
                    <span className="sr-only"> (completed)</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {position && (
        <div className="rh-mobile-step">
          <p>
            Step {position.index} of {position.total}:{" "}
            <strong>{position.name}</strong>
          </p>
          {progress !== null && (
            <div className="rh-mobile-bar" aria-hidden="true">
              <div style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
            </div>
          )}
        </div>
      )}
      <div className="rh-hero-action rh-hero-action--narrow">{action}</div>
    </section>
  );
}

export function ResearcherNextStep({
  step,
  now,
  action,
}: {
  step: Pick<ProjectNextStep, "label" | "title" | "description" | "tone" | "dueAt">;
  now: number;
  action: ReactNode;
}) {
  const visual = nextStepVisual(step);
  const due = step.dueAt && Number.isFinite(step.dueAt.getTime()) ? step.dueAt : null;
  return (
    <section
      className="rh-card rh-next"
      aria-label="Your next step"
      data-tour="researcher-next"
    >
      <span className={`rh-tile rh-tone-${visual.tone}`} aria-hidden="true">
        <i className={`ti ${visual.icon}`} />
      </span>
      <div className="rh-next-body">
        <p className={`rh-chip rh-tone-${visual.tone}`}>{step.label}</p>
        <h2>{step.title}</h2>
        <p className="rh-next-description">{step.description}</p>
      </div>
      {(action || due) && (
        <div className="rh-next-foot">
          {action}
          {due && (
            <span
              className={`rh-due ${isDueSoon(due, now) ? "rh-due--soon" : ""}`}
            >
              <i aria-hidden="true" className="ti ti-clock" />
              {dueLabel(due, now)}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

export function ResearcherComingUp({
  items,
  emptyMessage,
  calendarHref,
  onBookConsultation,
}: {
  items: ComingUpItem[];
  emptyMessage: string;
  calendarHref: string;
  onBookConsultation?: () => void;
}) {
  return (
    <section
      className="rh-card rh-coming-up"
      aria-labelledby="rh-coming-up-title"
      data-tour="researcher-deadlines"
    >
      <div className="rh-panel-head">
        <h2 id="rh-coming-up-title">
          <i aria-hidden="true" className="ti ti-calendar-due" />
          Coming up
        </h2>
        <Link className="rh-link" href={calendarHref}>
          See calendar
        </Link>
      </div>
      {items.length > 0 ? (
        <ul className="rh-agenda">
          {items.map((item) => (
            <li key={item.id}>
              <time
                className={`rh-date ${item.urgent ? "rh-date--urgent" : ""}`}
                dateTime={item.dateTime}
              >
                <span>{item.month}</span>
                <strong>{item.day}</strong>
              </time>
              <div className="rh-row-body">
                <Link href={item.href}>{item.title}</Link>
                <small className={item.overdue ? "rh-overdue" : undefined}>
                  {item.overdue && <i aria-hidden="true" className="ti ti-alert-triangle" />}
                  {item.detail}
                </small>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rh-empty">
          <i aria-hidden="true" className="ti ti-calendar-event" />
          {emptyMessage}
        </p>
      )}
      {onBookConsultation && (
        <button type="button" className="rh-link rh-book" onClick={onBookConsultation}>
          <i aria-hidden="true" className="ti ti-calendar-plus" />
          Book consultation
        </button>
      )}
    </section>
  );
}

export function ResearcherLatestUpdates({
  items,
  emptyMessage,
  viewAllHref,
}: {
  items: UpdateItem[];
  emptyMessage: string;
  viewAllHref: string;
}) {
  return (
    <section className="rh-card" aria-labelledby="rh-updates-title">
      <div className="rh-panel-head">
        <h2 id="rh-updates-title">
          <i aria-hidden="true" className="ti ti-bell-ringing" />
          Latest updates
        </h2>
        <Link className="rh-link" href={viewAllHref}>
          View all
        </Link>
      </div>
      {items.length > 0 ? (
        <ul className="rh-updates">
          {items.map((item) => (
            <li key={item.id} className="rh-update">
              <span className={`rh-update-icon rh-tone-${item.tone}`} aria-hidden="true">
                <i className={`ti ${item.icon}`} />
              </span>
              <div className="rh-row-body">
                {item.href ? <Link href={item.href}>{item.title}</Link> : <b>{item.title}</b>}
                <small>
                  {item.unread && <span className="rh-unread">Unread · </span>}
                  {item.date ? overviewDate(item.date) : ""}
                </small>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rh-empty">
          <i aria-hidden="true" className="ti ti-bell" />
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

export function ResearcherWorkflows({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  if (!count) return null;
  return (
    <details className="rh-card rh-workflows">
      <summary>
        <span>
          <i aria-hidden="true" className="ti ti-route" />
          Your workflows ({count})
        </span>
        <i aria-hidden="true" className="ti ti-chevron-down rh-workflows-chevron" />
      </summary>
      <div className="rcc-joined rh-workflows-content">{children}</div>
    </details>
  );
}
