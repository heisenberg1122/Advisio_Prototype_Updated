import React, { useMemo, useRef, useState } from "react";
import { calendarDay, initialMonthIndex, monthBar, timelineMonths } from "@/lib/gantt-layout";

export type GanttPhoneStage = {
  id: string;
  name: string;
  sequence: number;
  status: "completed" | "active" | "upcoming";
  startDate: Date;
  endDate: Date;
  range: string;
};

const RULER_DAYS = [1, 8, 15, 22, 29];
const SWIPE_DISTANCE = 60;
const statusLabel = { completed: "approved", active: "in progress", upcoming: "planned" };

/** Phone timeline: one calendar month at a time, opening on the current month. */
export function GanttPhoneMonths({ stages, now, timeZone }: { stages: GanttPhoneStage[]; now: number; timeZone: string }) {
  const months = useMemo(() => timelineMonths(stages, timeZone), [stages, timeZone]);
  const today = calendarDay(new Date(now), timeZone);
  const [index, setIndex] = useState(() => initialMonthIndex(months, today));
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const safeIndex = Math.min(index, months.length - 1);
  const month = months[safeIndex];

  const placed = (item: GanttPhoneStage, target = month) => monthBar(calendarDay(item.startDate, timeZone), calendarDay(item.endDate, timeZone), target);
  const rows = stages.flatMap((stage) => {
    const bar = placed(stage);
    return bar ? [{ stage, bar }] : [];
  });
  const isThisMonth = today.year === month.year && today.month === month.month;
  const todayLeft = `${((today.day - 0.5) / month.days) * 100}%`;
  const go = (next: number) => setIndex(Math.max(0, Math.min(months.length - 1, next)));
  const yearLabel = `${month.label} ${month.year}`;

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) go(safeIndex + (dx < 0 ? 1 : -1));
  };

  return (
    <div
      className="gm"
      style={{ "--gm-days": month.days } as React.CSSProperties}
      onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
      onTouchEnd={onTouchEnd}
    >
      <div className="gm-pager">
        <button type="button" aria-label="Previous month" disabled={safeIndex === 0} onClick={() => go(safeIndex - 1)}>
          <i className="ti ti-chevron-left" aria-hidden="true" />
        </button>
        <strong aria-live="polite">{yearLabel}</strong>
        <button type="button" aria-label="Next month" disabled={safeIndex === months.length - 1} onClick={() => go(safeIndex + 1)}>
          <i className="ti ti-chevron-right" aria-hidden="true" />
        </button>
      </div>

      <div className="gm-months" role="group" aria-label="Choose a month">
        {months.map((item, itemIndex) => {
          const count = stages.filter((stage) => placed(stage, item)).length;
          return (
            <button
              key={`${item.year}-${item.month}`}
              type="button"
              aria-pressed={itemIndex === safeIndex}
              aria-label={`${item.label} ${item.year}, ${count} ${count === 1 ? "milestone" : "milestones"}`}
              onClick={() => go(itemIndex)}
            >
              {item.short}<em>{count}</em>
            </button>
          );
        })}
      </div>

      <div className="gm-ruler" aria-hidden="true">
        {RULER_DAYS.filter((day) => day <= month.days).map((day) => (
          <span key={day} style={{ left: `${((day - 1) / month.days) * 100}%` }}>{day}</span>
        ))}
        {isThisMonth && <i style={{ left: todayLeft }} />}
      </div>

      {rows.length ? (
        <ul className="gm-rows">
          {rows.map(({ stage, bar }) => (
            <li key={stage.id} className="gm-row" data-status={stage.status}>
              <div className="gm-line">
                <span className="gc-num" aria-hidden="true">
                  {stage.status === "completed" ? <i className="ti ti-check" /> : stage.sequence}
                </span>
                <span className="gm-name">{stage.name}</span>
                <span className="gm-dates">{stage.range}</span>
                <span className="sr-only">, {statusLabel[stage.status]}</span>
              </div>
              <div className="gm-track" aria-hidden="true">
                <span
                  className="gm-bar"
                  data-before={bar.continuesBefore || undefined}
                  data-after={bar.continuesAfter || undefined}
                  style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                />
                {isThisMonth && <i className="gm-today" style={{ left: todayLeft }} />}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="gm-empty">No milestones in {month.label}.</p>
      )}

      <div className="gm-legend" aria-hidden="true">
        <span><i data-tone="completed" />Approved</span>
        <span><i data-tone="active" />In progress</span>
        <span><i data-tone="upcoming" />Planned</span>
        <span><i data-tone="today" />Today</span>
      </div>
    </div>
  );
}
