import React, { useMemo } from "react";
import { buildWorkflowTimeline, calculateMilestoneProgress, WorkflowProjectLike } from "@/lib/workflow-progress";
import { WORKFLOW_TIME_ZONE } from "@/lib/workflow-deadlines";

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

const DAY_WIDTH = 12;
const LABEL_WIDTH = 260;

const formatDate = (date: Date) => date.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: WORKFLOW_TIME_ZONE });

export function StudentGanttChart({ project, milestoneProgress = [] }: StudentGanttChartProps) {
  const stages = useMemo(() => {
    const progressById = new Map(milestoneProgress.map((milestone) => [milestone.id, milestone]));
    return buildWorkflowTimeline(project).map((stage) => {
      const actual = progressById.get(stage.id);
      if (!actual) return stage;
      return {
        ...stage,
        status: actual.completed
          ? "completed" as const
          : actual.status === "NOT_STARTED"
            ? "upcoming" as const
            : "active" as const,
      };
    });
  }, [milestoneProgress, project]);
  const progress = calculateMilestoneProgress(
    milestoneProgress,
    Boolean(project?.workflowInstance?.completedAt),
  );
  const timelineStart = stages.length
    ? new Date(Math.min(...stages.map((stage) => stage.startDate.getTime())))
    : undefined;
  const timelineEnd = stages.length
    ? Math.max(...stages.map((stage) => stage.endDate.getTime()))
    : 0;
  const totalDays = timelineStart
    ? Math.max(1, Math.ceil((timelineEnd - timelineStart.getTime()) / 86_400_000))
    : 0;
  const chartWidth = Math.max(720, totalDays * DAY_WIDTH + 40);
  const todayOffset = timelineStart
    ? Math.floor((Date.now() - timelineStart.getTime()) / 86_400_000) * DAY_WIDTH
    : -1;

  if (!stages.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-10 text-center">
        <i className="ti ti-timeline-event text-3xl text-[var(--color-text-muted)]" />
        <p className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">No workflow timeline available</p>
        <p className="mt-1 text-base text-[var(--color-text-secondary)]">A professor must deploy workflow milestones before a Gantt timeline can be generated.</p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card-soft)]" aria-label="Project Gantt timeline">
      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Project Gantt Timeline</h3>
          <p className="mt-0.5 text-base text-[var(--color-text-secondary)]">Dates follow milestone targets and legacy durations in Philippine time. Milestones without a target use a projected span.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-32 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm font-bold text-[var(--color-primary)]">{progress}%</span>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <div style={{ minWidth: LABEL_WIDTH + chartWidth }}>
          <div className="flex h-12 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs font-semibold text-[var(--color-text-secondary)]">
            <div className="sticky left-0 z-20 flex items-center border-r border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 text-[var(--color-text-primary)]" style={{ width: LABEL_WIDTH }}>
              Milestone
            </div>
            <div className="relative" style={{ width: chartWidth }}>
              {stages.map((stage) => {
                const left = Math.floor((stage.startDate.getTime() - timelineStart!.getTime()) / 86_400_000) * DAY_WIDTH;
                return <span key={stage.id} className="absolute top-3.5 text-xs text-[var(--color-text-secondary)]" style={{ left: left + 6 }}>{formatDate(stage.startDate)}</span>;
              })}
            </div>
          </div>
          <div className="relative">
            {todayOffset >= 0 && todayOffset <= chartWidth && (
              <div className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-rose-500" style={{ left: LABEL_WIDTH + todayOffset }}>
                <span className="absolute -top-5 -translate-x-1/2 rounded bg-rose-500 px-1.5 py-0.5 text-xs font-bold text-white shadow-xs">TODAY</span>
              </div>
            )}
            {stages.map((stage) => {
              const left = Math.floor((stage.startDate.getTime() - timelineStart!.getTime()) / 86_400_000) * DAY_WIDTH;
              const width = Math.max(40, stage.durationDays * DAY_WIDTH);
              const isCompleted = stage.status === "completed";
              const isActive = stage.status === "active";
              const dotColor = isCompleted ? "bg-emerald-500" : isActive ? "bg-[var(--color-primary)]" : "bg-[var(--color-text-muted)]";
              const barClasses = isCompleted
                ? "bg-emerald-600 text-white font-semibold"
                : isActive
                ? "bg-[var(--color-primary)] text-white font-semibold shadow-xs ring-1 ring-[var(--college-focus-ring)]"
                : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] border border-[var(--color-border)] font-medium";

              return (
                <div key={stage.id} className="flex h-16 border-b border-[var(--color-border-subtle)] last:border-b-0">
                  <div className="sticky left-0 z-20 flex items-center gap-2 border-r border-[var(--color-border)] bg-[var(--color-surface)] px-4" style={{ width: LABEL_WIDTH }}>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{stage.topic?.title || "Ungrouped"}</p>
                      <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]" title={`${stage.sequence}. ${stage.name}`}>{stage.sequence}. {stage.name}</p>
                      <p className="mt-0.5 text-base text-[var(--color-text-secondary)]">{stage.durationDays} days{stage.requiresApproval ? " · Approval gate" : ""}</p>
                    </div>
                  </div>
                  <div className="relative bg-[linear-gradient(to_right,var(--color-border-subtle)_1px,transparent_1px)] bg-[size:84px_100%]" style={{ width: chartWidth }}>
                    <div
                      className={`absolute top-4 flex h-7 items-center rounded-lg px-2 text-xs transition ${barClasses}`}
                      style={{ left, width }}
                      title={`${formatDate(stage.startDate)} – ${formatDate(stage.endDate)}`}
                    >
                      <span className="truncate">{formatDate(stage.startDate)} – {formatDate(stage.endDate)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="divide-y divide-[var(--color-border-subtle)] md:hidden">
        {stages.map((stage) => {
          const isCompleted = stage.status === "completed";
          const isActive = stage.status === "active";
          const dotColor = isCompleted ? "bg-emerald-500" : isActive ? "bg-[var(--color-primary)]" : "bg-[var(--color-text-muted)]";

          return (
            <div key={stage.id} className="flex items-start gap-3 p-4">
              <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${dotColor}`} />
              <div>
                <p className="text-sm font-extrabold uppercase tracking-wide text-[var(--color-text-muted)]">{stage.topic?.title || "Ungrouped milestones"}</p>
                <p className="text-base font-bold text-[var(--color-text-primary)]">{stage.sequence}. {stage.name}</p>
                <p className="mt-1 text-base text-[var(--color-text-secondary)]">{formatDate(stage.startDate)} – {formatDate(stage.endDate)} · {stage.durationDays} days</p>
                <p className="mt-1 text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{stage.status}{stage.requiresApproval ? " · Adviser approval required" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
