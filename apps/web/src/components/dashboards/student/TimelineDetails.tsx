import React, { useState } from "react";
import { WORKFLOW_TIME_ZONE } from "@/lib/workflow-deadlines";
import { calendarDaysUntil, relativeDays } from "@/lib/researcher-home";
import type { ProjectActivity } from "@/lib/student-project-overview";
import "./timeline-details.css";

const INITIAL_EVENTS = 6;
const ISO_DATE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})/g;

const dayLabel = (date: Date) => date.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: WORKFLOW_TIME_ZONE });
const timeLabel = (date: Date) => date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: WORKFLOW_TIME_ZONE });

/** Turn raw timestamps inside event text into "Nov 9, 10:00 AM". */
export function readableActivityText(text = "") {
  return text.replace(ISO_DATE, (iso) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : `${dayLabel(date)}, ${timeLabel(date)}`;
  });
}

/** Icon and tone for an event, read from its title. */
export function activityKind(title: string): { icon: string; tone: string } {
  const text = title.toLowerCase();
  if (/revision|reject|returned/.test(text)) return { icon: "ti-pencil-exclamation", tone: "danger" };
  if (/decision/.test(text)) return { icon: "ti-gavel", tone: "warning" };
  if (/complet|approv|passed/.test(text)) return { icon: "ti-circle-check", tone: "success" };
  if (/consultation|meeting/.test(text)) return { icon: "ti-calendar-event", tone: "info" };
  if (/defense/.test(text)) return { icon: "ti-presentation", tone: "info" };
  if (/reviewer|assigned/.test(text)) return { icon: "ti-user-check", tone: "neutral" };
  if (/submit|upload/.test(text)) return { icon: "ti-upload", tone: "neutral" };
  if (/official/.test(text)) return { icon: "ti-certificate", tone: "neutral" };
  if (/document|version|file/.test(text)) return { icon: "ti-file-plus", tone: "neutral" };
  return { icon: "ti-point", tone: "neutral" };
}

export function RecordedActivity({
  events,
  hrefFor,
  onOpen,
}: {
  events: ProjectActivity[];
  hrefFor: (event: ProjectActivity) => string | null;
  onOpen: (href: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const now = Date.now();
  const shown = expanded ? events : events.slice(0, INITIAL_EVENTS);
  const days: Array<{ key: string; label: string; items: ProjectActivity[] }> = [];
  for (const event of shown) {
    const date = new Date(event.timestamp);
    const key = dayLabel(date);
    const offset = calendarDaysUntil(date, now);
    const label = offset === 0 ? `Today · ${key}` : offset === -1 ? `Yesterday · ${key}` : key;
    if (days.at(-1)?.key !== key) days.push({ key, label, items: [] });
    days.at(-1)!.items.push(event);
  }

  return (
    <section className="tl-card" aria-labelledby="tl-activity-title">
      <div className="tl-head">
        <div>
          <h3 id="tl-activity-title">Recorded activity</h3>
          <p>What actually happened, newest first. The timeline above is the planned schedule.</p>
        </div>
        {events.length > 0 && <span className="tl-count">{events.length} {events.length === 1 ? "event" : "events"}</span>}
      </div>
      {!events.length && <p className="tl-empty">No recorded activity for this project yet.</p>}
      {days.map((day) => (
        <div key={day.key} className="tl-day">
          <h4>{day.label}</h4>
          <ul>
            {day.items.map((event) => {
              const href = hrefFor(event);
              const { icon, tone } = activityKind(event.title);
              const date = new Date(event.timestamp);
              const body = (
                <>
                  <span className="tl-icon" data-tone={tone} aria-hidden="true"><i className={`ti ${icon}`} /></span>
                  <span className="tl-text">
                    <span className="tl-title">{event.title}</span>
                    {event.description && <span className="tl-desc">{readableActivityText(event.description)}</span>}
                  </span>
                  <time dateTime={event.timestamp} title={`${dayLabel(date)}, ${timeLabel(date)}`}>{timeLabel(date)}</time>
                </>
              );
              return (
                <li key={event.id}>
                  {href ? <button type="button" className="tl-event" onClick={() => onOpen(href)}>{body}</button> : <div className="tl-event">{body}</div>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {events.length > INITIAL_EVENTS && (
        <button type="button" className="tl-more" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show fewer" : `Show ${events.length - INITIAL_EVENTS} earlier ${events.length - INITIAL_EVENTS === 1 ? "event" : "events"}`}
        </button>
      )}
    </section>
  );
}

export interface MilestoneDetail {
  id: string;
  title: string;
  status: string;
  sequence?: number;
  topicId?: string | null;
  topicTitle?: string;
  description?: string;
  requiresApproval?: boolean;
  isBlocked?: boolean;
  requiredMilestone?: { name?: string } | null;
  targetCompletionDate?: string | null;
}

const STATUS_TEXT: Record<string, string> = { completed: "Approved", "in-progress": "In progress", upcoming: "Planned" };

export function MilestoneDetails({
  milestones,
  formatTarget,
}: {
  milestones: MilestoneDetail[];
  formatTarget: (milestone: MilestoneDetail) => string;
}) {
  const now = Date.now();
  return (
    <section className="tl-card" aria-labelledby="tl-milestones-title">
      <div className="tl-head">
        <div>
          <h3 id="tl-milestones-title" data-guide="timeline-milestones">Milestone details</h3>
          <p>Order, due dates and approval steps set by your professor.</p>
        </div>
      </div>
      {!milestones.length && <p className="tl-empty">No project milestones recorded. Register your research study to start the workflow.</p>}
      <ul className="tl-milestones">
        {milestones.map((milestone, index) => {
          const showTopic = milestone.topicId && milestone.topicId !== milestones[index - 1]?.topicId;
          const due = formatTarget(milestone);
          const target = milestone.targetCompletionDate ? new Date(milestone.targetCompletionDate) : null;
          const left = milestone.status === "in-progress" && target && !Number.isNaN(target.getTime()) ? relativeDays(target, now) : null;
          const meta = [
            milestone.isBlocked ? `Opens after ${milestone.requiredMilestone?.name || "the previous milestone"} is approved` : null,
            due,
            left,
            !milestone.isBlocked && milestone.requiresApproval ? "Adviser approval" : null,
          ].filter(Boolean).join(" · ");
          return (
            <React.Fragment key={milestone.id}>
              {showTopic && <li className="tl-topic">{milestone.topicTitle}</li>}
              <li className="tl-milestone" data-status={milestone.status}>
                <span className="tl-num" aria-hidden="true">
                  {milestone.status === "completed" ? <i className="ti ti-check" /> : milestone.sequence ?? index + 1}
                </span>
                <span className="tl-text">
                  <span className="tl-title">{milestone.title}</span>
                  <span className="tl-desc">
                    {milestone.isBlocked && <i className="ti ti-lock" aria-hidden="true" />}
                    {meta}
                  </span>
                  {milestone.description && <span className="tl-note">{milestone.description}</span>}
                </span>
                <span className="tl-state">{STATUS_TEXT[milestone.status] || milestone.status}</span>
              </li>
            </React.Fragment>
          );
        })}
      </ul>
    </section>
  );
}
