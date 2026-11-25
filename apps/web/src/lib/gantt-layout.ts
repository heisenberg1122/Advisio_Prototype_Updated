/** Layout rules that keep Gantt labels from colliding. Positions are in days on the chart scale. */
export type MonthCandidate = { label: string; start: number };

/** Keeps month names far enough apart to read; the later month wins a tight pair. */
export function visibleMonths(months: MonthCandidate[], totalDays: number, minGapRatio: number) {
  const gap = Math.ceil(totalDays * minGapRatio);
  const kept: MonthCandidate[] = [];
  months.forEach((month, index) => {
    const next = months[index + 1];
    if (next && next.start - month.start < gap) return;
    if (totalDays - month.start < gap * 0.7) return;
    if (kept.length && month.start - kept[kept.length - 1].start < gap) return;
    kept.push(month);
  });
  return kept;
}

/** Shows every Nth week number so the numbers never touch on the narrowest chart. */
export function weekLabelStep(weeks: number, minTrackPx = 640, minLabelPx = 34) {
  return Math.max(1, Math.ceil(minLabelPx / (minTrackPx / weeks)));
}

export type DatePlacement = "right" | "left" | "inside";

/** Picks the side of a bar with room for its date label. */
export function datePlacement(start: number, span: number, totalDays: number, labelRatio = 0.17): DatePlacement {
  if ((start + span) / totalDays + labelRatio <= 1) return "right";
  if (start / totalDays >= labelRatio) return "left";
  return "inside";
}

export type CalendarDay = { year: number; month: number; day: number };
export type TimelineMonth = { year: number; month: number; days: number; label: string; short: string };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Calendar date in the given time zone; month is 0-11. */
export function calendarDay(date: Date, timeZone: string): CalendarDay {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month") - 1, day: value("day") };
}

const order = (item: { year: number; month: number }) => item.year * 12 + item.month;

/** Every calendar month from the first start to the last end, including quiet months. */
export function timelineMonths(ranges: Array<{ startDate: Date; endDate: Date }>, timeZone: string): TimelineMonth[] {
  if (!ranges.length) return [];
  const first = Math.min(...ranges.map((range) => order(calendarDay(range.startDate, timeZone))));
  const last = Math.max(...ranges.map((range) => order(calendarDay(range.endDate, timeZone))));
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const year = Math.floor((first + index) / 12);
    const month = (first + index) % 12;
    return { year, month, days: new Date(Date.UTC(year, month + 1, 0)).getUTCDate(), label: MONTH_NAMES[month], short: MONTH_NAMES[month].slice(0, 3) };
  });
}

/** Opens on the current month, or the nearest month in the schedule. */
export function initialMonthIndex(months: TimelineMonth[], today: CalendarDay) {
  const index = months.findIndex((month) => order(month) === order(today));
  if (index >= 0) return index;
  return months.length && order(today) > order(months[months.length - 1]) ? months.length - 1 : 0;
}

/** Where a milestone sits inside one month, or null when it is outside that month. */
export function monthBar(start: CalendarDay, end: CalendarDay, month: TimelineMonth) {
  if (order(start) > order(month) || order(end) < order(month)) return null;
  const continuesBefore = order(start) < order(month);
  const continuesAfter = order(end) > order(month);
  const first = continuesBefore ? 1 : start.day;
  const last = continuesAfter ? month.days : end.day;
  return {
    left: ((first - 1) / month.days) * 100,
    width: ((last - first + 1) / month.days) * 100,
    continuesBefore,
    continuesAfter,
  };
}
