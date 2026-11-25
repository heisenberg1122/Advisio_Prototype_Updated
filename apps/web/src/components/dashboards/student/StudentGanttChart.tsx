import React, { useMemo } from "react";
import { buildWorkflowTimeline, WorkflowProjectLike } from "@/lib/workflow-progress";
import { WORKFLOW_TIME_ZONE } from "@/lib/workflow-deadlines";
import { calendarDaysUntil, relativeDays } from "@/lib/researcher-home";
import { datePlacement, visibleMonths, weekLabelStep, type MonthCandidate } from "@/lib/gantt-layout";
import { useIsPhone } from "@/hooks/use-is-phone";
import { GanttPhoneMonths } from "./GanttPhoneMonths";
import "./gantt-chart.css";

interface StudentGanttChartProps {
  project?: (WorkflowProjectLike & { title?: string }) | null;
  milestoneProgress?: Array<{
    id: string;
    completed: boolean;
    status: string;
    completedRequirements: number;
    totalRequirements: number;
  }>;
}

const DAY_MS = 86_400_000;
const formatDate = (date: Date) => date.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: WORKFLOW_TIME_ZONE });
const formatPart = (date: Date, part: "month" | "day") =>
  date.toLocaleDateString("en-PH", part === "month" ? { month: "long", timeZone: WORKFLOW_TIME_ZONE } : { day: "numeric", timeZone: WORKFLOW_TIME_ZONE });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "Oct 10 – 24" within one month, "Oct 28 – Nov 10" across months. */
function formatRange(start: Date, end: Date) {
  const sameMonth = formatPart(start, "month") === formatPart(end, "month");
  return `${formatDate(start)} – ${sameMonth ? formatPart(end, "day") : formatDate(end)}`;
}

export function StudentGanttChart({ project, milestoneProgress = [] }: StudentGanttChartProps) {
  const isPhone = useIsPhone();
  const stages = useMemo(() => {
    const progressById = new Map(milestoneProgress.map((milestone) => [milestone.id, milestone]));
    return buildWorkflowTimeline(project).map((stage) => {
      const actual = progressById.get(stage.id);
      if (!actual) return stage;
      return {
        ...stage,
        status: actual.completed
          ? "completed" as const
          : actual.status === "NOT_STARTED" || actual.status === "BLOCKED"
            ? "upcoming" as const
            : "active" as const,
      };
    });
  }, [milestoneProgress, project]);

  if (!stages.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-10 text-center">
        <i className="ti ti-timeline-event text-3xl text-[var(--color-text-muted)]" />
        <p className="mt-2 text-base font-semibold text-[var(--color-text-primary)]" data-guide="timeline-empty">No workflow timeline available</p>
        <p className="mt-1 text-base text-[var(--color-text-secondary)]">A professor must deploy workflow milestones before a Gantt timeline can be generated.</p>
      </div>
    );
  }

  const now = Date.now();
  const firstStart = new Date(Math.min(...stages.map((stage) => stage.startDate.getTime())));
  const lastEnd = new Date(Math.max(...stages.map((stage) => stage.endDate.getTime())));
  // Start the scale on the Monday of the first week so week columns line up.
  const weekday = WEEKDAYS.indexOf(firstStart.toLocaleDateString("en-US", { weekday: "short", timeZone: WORKFLOW_TIME_ZONE }));
  const scaleStart = new Date(firstStart.getTime() - Math.max(0, weekday) * DAY_MS);
  const dayIndex = (date: Date) => calendarDaysUntil(date, scaleStart.getTime());
  const weeks = Math.max(4, Math.ceil((dayIndex(lastEnd) + 1) / 7));
  const totalDays = weeks * 7;
  const pct = (days: number) => `${(days / totalDays) * 100}%`;

  const candidates: MonthCandidate[] = [];
  for (let day = 0; day < totalDays; day += 1) {
    const label = formatPart(new Date(scaleStart.getTime() + day * DAY_MS), "month");
    if (candidates.at(-1)?.label !== label) candidates.push({ label, start: day });
  }
  const shortMonths = isPhone || totalDays > 180;
  const months = visibleMonths(candidates, totalDays, isPhone ? 0.11 : shortMonths ? 0.06 : 0.12);
  const weekStep = weekLabelStep(weeks);
  const todayIndex = dayIndex(new Date(now));
  const showToday = todayIndex >= 0 && todayIndex < totalDays;

  const completed = stages.filter((stage) => stage.status === "completed").length;
  const current = stages.find((stage) => stage.status === "active") || stages.find((stage) => stage.status !== "completed");
  const grouped = stages.some((stage) => stage.topic?.title);

  return (
    <section className="gc" aria-label="Project Gantt timeline">
      <header className="gc-head">
        <div className="min-w-0">
          <h3 data-guide="timeline-plan">Research timeline</h3>
          <p>
            {current ? (
              <>
                {current.status === "active" ? "Now on" : "Next up"} <strong>{current.name}</strong>
                {" · due "}{formatDate(current.endDate)}{" · "}{relativeDays(current.endDate, now)}
              </>
            ) : (
              "Every milestone is approved."
            )}
          </p>
        </div>
        <dl className="gc-stats">
          <div><dt>Completed</dt><dd>{completed} of {stages.length}</dd></div>
          <div><dt>Expected finish</dt><dd>{formatDate(lastEnd)}</dd></div>
        </dl>
      </header>

      {isPhone ? (
        <GanttPhoneMonths
          stages={stages.map((stage) => ({ id: stage.id, name: stage.name, sequence: stage.sequence, status: stage.status, startDate: stage.startDate, endDate: stage.endDate, range: formatRange(stage.startDate, stage.endDate) }))}
          now={now}
          timeZone={WORKFLOW_TIME_ZONE}
        />
      ) : (
      <>
      <div className="gc-legend" aria-hidden="true">
        <span><i data-tone="completed" />Approved</span>
        <span><i data-tone="active" />In progress</span>
        <span><i data-tone="upcoming" />Planned</span>
        {showToday && <span className="gc-legend-today"><i data-tone="today" />Today, {formatDate(new Date(now))}</span>}
      </div>

      <div className="gc-scroll">
        <div className="gc-body" style={{ "--gc-weeks": weeks } as React.CSSProperties}>
          <div className="gc-row gc-scale" aria-hidden="true">
            <div className="gc-label">Milestone</div>
            <div className="gc-track">
              {months.map((month, index) => (
                <span key={`${month.label}-${month.start}`} className="gc-month" data-first={index === 0} style={{ left: pct(month.start) }}>{shortMonths ? month.label.slice(0, 3) : month.label}</span>
              ))}
              {Array.from({ length: weeks }, (_, week) => week % weekStep === 0 && (
                <span key={week} className="gc-week" style={{ left: pct(week * 7) }}>
                  {formatPart(new Date(scaleStart.getTime() + week * 7 * DAY_MS), "day")}
                </span>
              ))}
              {showToday && <span className="gc-today-dot" style={{ left: pct(todayIndex + 0.5) }} />}
            </div>
          </div>

          {stages.map((stage, index) => {
            const start = Math.max(0, dayIndex(stage.startDate));
            const span = Math.max(1, dayIndex(stage.endDate) - start + 1);
            const placement = datePlacement(start, span, totalDays);
            const range = formatRange(stage.startDate, stage.endDate);
            const dateStyle: React.CSSProperties =
              placement === "right"
                ? { left: `calc(${pct(start + span)} + 8px)` }
                : placement === "left"
                  ? { right: `calc(${pct(totalDays - start)} + 8px)` }
                  : { right: "6px" };
            const showGroup = grouped && stage.topic?.title && stage.topic.title !== stages[index - 1]?.topic?.title;
            return (
              <React.Fragment key={stage.id}>
                {showGroup && <div className="gc-group">{stage.topic?.title}</div>}
                <div
                  className="gc-row"
                  data-status={stage.status}
                  title={`${stage.name}: ${range} · ${stage.durationDays} days${stage.requiresApproval ? " · Adviser approval needed" : ""}`}
                >
                  <div className="gc-label">
                    <span className="gc-num" aria-hidden="true">
                      {stage.status === "completed" ? <i className="ti ti-check" /> : stage.sequence}
                    </span>
                    <span className="gc-name">{stage.name}</span>
                    <span className="sr-only">
                      {`, ${stage.status === "completed" ? "approved" : stage.status === "active" ? "in progress" : "planned"}, ${range}`}
                    </span>
                  </div>
                  <div className="gc-track" aria-hidden="true">
                    <span className="gc-bar" style={{ left: pct(start), width: pct(span) }} />
                    <span className="gc-dates" style={dateStyle}>
                      {range}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {showToday && <span className="gc-today-line" aria-hidden="true" style={{ "--gc-today": todayIndex + 0.5, "--gc-days": totalDays } as React.CSSProperties} />}
        </div>
      </div>

      <p className="gc-note">Planned dates follow milestone targets in Philippine time. Milestones without a target use a projected span.</p>
      </>
      )}
    </section>
  );
}
