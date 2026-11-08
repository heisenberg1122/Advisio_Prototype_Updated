import { WORKFLOW_TIME_ZONE } from "./workflow-deadlines";
import type {
  ProjectMilestoneProgress,
  ProjectNextStep,
} from "./student-project-overview";

const URGENT_DAYS = 7;
const DAY_MS = 86_400_000;

function manilaDayNumber(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WORKFLOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / DAY_MS;
}

export function calendarDaysUntil(date: Date, now: number) {
  return manilaDayNumber(date) - manilaDayNumber(new Date(now));
}

export function relativeDays(date: Date, now: number) {
  const days = calendarDaysUntil(date, now);
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ago`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export function calendarTile(date: Date) {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-PH", {
      timeZone: WORKFLOW_TIME_ZONE,
      ...options,
    }).format(date);
  return { month: format({ month: "short" }), day: format({ day: "numeric" }) };
}

export function manilaTime(date: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: WORKFLOW_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function dueLabel(date: Date, now: number) {
  const { month, day } = calendarTile(date);
  return `Due ${month} ${day}, ${relativeDays(date, now)}`;
}

export function isDueSoon(date: Date, now: number) {
  return calendarDaysUntil(date, now) <= URGENT_DAYS;
}

export interface ComingUpInput {
  id: string;
  kind: "deadline" | "consultation" | "defense";
  title: string;
  date: string | Date;
  href: string;
  mode?: string;
}

export interface ComingUpItem {
  id: string;
  kind: ComingUpInput["kind"];
  title: string;
  detail: string;
  href: string;
  month: string;
  day: string;
  urgent: boolean;
  overdue: boolean;
  dateTime: string;
  time: number;
}

function deadlineDetail(date: Date, now: number) {
  const days = calendarDaysUntil(date, now);
  if (days < 0)
    return `Overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`;
  return `Due ${relativeDays(date, now)}`;
}

/**
 * Merges deadlines and scheduled sessions into one list, soonest first, so
 * overdue deadlines lead the list instead of disappearing.
 */
export function buildComingUp(
  items: ComingUpInput[],
  now: number,
  limit = 4,
): ComingUpItem[] {
  return items
    .map((item) => ({ item, date: new Date(item.date) }))
    .filter(({ date }) => Number.isFinite(date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, limit)
    .map(({ item, date }) => {
      const deadline = item.kind === "deadline";
      const detail = deadline
        ? deadlineDetail(date, now)
        : [manilaTime(date), item.mode].filter(Boolean).join(", ");
      return {
        id: `${item.kind}-${item.id}`,
        kind: item.kind,
        title: item.title,
        detail,
        href: item.href,
        ...calendarTile(date),
        urgent: deadline && isDueSoon(date, now),
        overdue: deadline && calendarDaysUntil(date, now) < 0,
        dateTime: date.toISOString(),
        time: date.getTime(),
      };
    });
}

export interface UpdateInput {
  id: string;
  title?: string | null;
  date?: string | null;
  href?: string | null;
  unread?: boolean;
}

export interface UpdateItem {
  id: string;
  title: string;
  date: string | null;
  href: string | null;
  unread: boolean;
  icon: string;
  tone: "danger" | "success" | "neutral";
}

function updateVisual(title: string): Pick<UpdateItem, "icon" | "tone"> {
  if (/revis|change|reject|declin|overdue/i.test(title))
    return { icon: "ti-message-exclamation", tone: "danger" };
  if (/approv|accept|complet|releas|confirm/i.test(title))
    return { icon: "ti-circle-check", tone: "success" };
  if (/consult|meeting/i.test(title))
    return { icon: "ti-calendar-event", tone: "neutral" };
  if (/defen[cs]e|panel/i.test(title))
    return { icon: "ti-presentation", tone: "neutral" };
  if (/submi|upload|document|manuscript|file/i.test(title))
    return { icon: "ti-file-text", tone: "neutral" };
  return { icon: "ti-bell", tone: "neutral" };
}

/**
 * Merges notifications and project activity, newest first. Notifications come
 * first in the input so they win when both report the same event on one day.
 */
export function buildLatestUpdates(
  items: UpdateInput[],
  limit = 3,
): UpdateItem[] {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      const title = item.title?.trim();
      if (!title) return false;
      const key = `${title.toLowerCase()}|${(item.date || "").slice(0, 10)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(b.date || "") - Date.parse(a.date || "") || 0)
    .slice(0, limit)
    .map((item) => {
      const title = item.title!.trim();
      return {
        id: item.id,
        title,
        date: item.date || null,
        href: item.href || null,
        unread: Boolean(item.unread),
        ...updateVisual(title),
      };
    });
}

export type JourneyState = "done" | "current" | "upcoming";

export interface JourneyStep {
  id: string;
  name: string;
  state: JourneyState;
}

export function buildJourney(
  milestones: ProjectMilestoneProgress[] | undefined,
  currentId: string | undefined,
  workflowCompleted = false,
): JourneyStep[] {
  return [...(milestones || [])]
    .sort((a, b) => a.sequence - b.sequence)
    .map((milestone) => ({
      id: milestone.id,
      name: milestone.name,
      state:
        workflowCompleted || milestone.completed
          ? "done"
          : milestone.id === currentId
            ? "current"
            : "upcoming",
    }));
}

/** The step named on small screens, where the full timeline is replaced by a bar. */
export function journeyPosition(steps: JourneyStep[]) {
  if (!steps.length) return null;
  const currentIndex = steps.findIndex(({ state }) => state === "current");
  if (currentIndex >= 0)
    return {
      index: currentIndex + 1,
      total: steps.length,
      name: steps[currentIndex].name,
    };
  const done = steps.filter(({ state }) => state === "done").length;
  const index = Math.min(done + 1, steps.length);
  return { index, total: steps.length, name: steps[index - 1].name };
}

export function nextStepVisual(step: Pick<ProjectNextStep, "label" | "tone">): {
  tone: "danger" | "warning" | "success" | "neutral";
  icon: string;
} {
  if (step.label === "Changes requested")
    return { tone: "danger", icon: "ti-alert-circle" };
  if (step.tone === "pending") return { tone: "warning", icon: "ti-hourglass" };
  if (step.tone === "success")
    return { tone: "success", icon: "ti-circle-check" };
  if (step.tone === "action") return { tone: "neutral", icon: "ti-arrow-right" };
  return { tone: "neutral", icon: "ti-info-circle" };
}

export function memberInitials(user?: {
  firstName?: string | null;
  lastName?: string | null;
}) {
  return (
    [user?.firstName, user?.lastName]
      .map((name) => name?.trim()?.[0] || "")
      .join("")
      .toUpperCase() || "?"
  );
}
