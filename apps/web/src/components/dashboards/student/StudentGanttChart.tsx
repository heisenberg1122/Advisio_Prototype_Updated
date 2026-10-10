import React, { useMemo } from "react";
import { buildWorkflowTimeline, calculateWorkflowProgress, WorkflowProjectLike } from "@/lib/workflow-progress";

interface StudentGanttChartProps {
  project?: (WorkflowProjectLike & { title?: string }) | null;
}

const DAY_WIDTH = 12;
const LABEL_WIDTH = 220;

const formatDate = (date: Date) => date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });

export function StudentGanttChart({ project }: StudentGanttChartProps) {
  const stages = useMemo(() => buildWorkflowTimeline(project), [project]);
  const progress = calculateWorkflowProgress(project);
  const timelineStart = stages[0]?.startDate;
  const totalDays = stages.reduce((total, stage) => total + stage.durationDays, 0);
  const chartWidth = Math.max(720, totalDays * DAY_WIDTH);
  const todayOffset = timelineStart
    ? Math.floor((Date.now() - timelineStart.getTime()) / 86_400_000) * DAY_WIDTH
    : -1;

  if (!stages.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
        <i className="ti ti-timeline-event text-3xl text-slate-400" />
        <p className="mt-2 text-sm font-bold text-[#1b4264]">No workflow timeline available</p>
        <p className="mt-1 text-xs text-slate-500">A professor must deploy workflow milestones before a Gantt timeline can be generated.</p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Project Gantt timeline">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-extrabold text-[#102f49]">Project Gantt Timeline</h3>
          <p className="mt-0.5 text-xs text-slate-500">Dates are calculated from the professor-managed workflow and milestone durations.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
          <span className="text-sm font-extrabold text-[#173f63]">{progress}%</span>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <div style={{ minWidth: LABEL_WIDTH + chartWidth }}>
          <div className="flex h-12 border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">
            <div className="sticky left-0 z-20 flex items-center border-r border-slate-200 bg-slate-50 px-4 text-[#102f49]" style={{ width: LABEL_WIDTH }}>Milestone</div>
            <div className="relative" style={{ width: chartWidth }}>
              {stages.map((stage) => {
                const left = Math.floor((stage.startDate.getTime() - timelineStart!.getTime()) / 86_400_000) * DAY_WIDTH;
                return <span key={stage.id} className="absolute top-4" style={{ left: left + 6 }}>{formatDate(stage.startDate)}</span>;
              })}
            </div>
          </div>
          <div className="relative">
            {todayOffset >= 0 && todayOffset <= chartWidth && <div className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-rose-500" style={{ left: LABEL_WIDTH + todayOffset }}><span className="absolute -top-5 -translate-x-1/2 rounded bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">TODAY</span></div>}
            {stages.map((stage) => {
              const left = Math.floor((stage.startDate.getTime() - timelineStart!.getTime()) / 86_400_000) * DAY_WIDTH;
              const width = Math.max(40, stage.durationDays * DAY_WIDTH);
              const colors = stage.status === "completed" ? "bg-emerald-500" : stage.status === "active" ? "bg-[#f6a800]" : "bg-slate-300";
              return (
                <div key={stage.id} className="flex h-16 border-b border-slate-100 last:border-b-0">
                  <div className="sticky left-0 z-20 flex items-center gap-2 border-r border-slate-200 bg-white px-4" style={{ width: LABEL_WIDTH }}>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colors}`} />
                    <div className="min-w-0"><p className="truncate text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{stage.topic?.title || "Ungrouped"}</p><p className="truncate text-xs font-bold text-[#102f49]">{stage.sequence}. {stage.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{stage.durationDays} days{stage.requiresApproval ? " · Approval gate" : ""}</p></div>
                  </div>
                  <div className="relative bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px)] bg-[size:84px_100%]" style={{ width: chartWidth }}>
                    <div className={`absolute top-5 flex h-7 items-center rounded-md px-2 text-[10px] font-extrabold ${colors} ${stage.status === "active" ? "text-[#102f49]" : "text-white"}`} style={{ left, width }} title={`${formatDate(stage.startDate)} – ${formatDate(stage.endDate)}`}>
                      <span className="truncate">{formatDate(stage.startDate)} – {formatDate(stage.endDate)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {stages.map((stage) => <div key={stage.id} className="flex items-start gap-3 p-4"><span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${stage.status === "completed" ? "bg-emerald-500" : stage.status === "active" ? "bg-[#f6a800]" : "bg-slate-300"}`} /><div><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{stage.topic?.title || "Ungrouped milestones"}</p><p className="text-sm font-bold text-[#102f49]">{stage.sequence}. {stage.name}</p><p className="mt-1 text-xs text-slate-500">{formatDate(stage.startDate)} – {formatDate(stage.endDate)} · {stage.durationDays} days</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{stage.status}{stage.requiresApproval ? " · Adviser approval required" : ""}</p></div></div>)}
      </div>
    </section>
  );
}
