import { WORKFLOW_TIME_ZONE } from "./workflow-deadlines";

const ISO_TIMESTAMP =
  /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})\b/g;

function manilaParts(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: WORKFLOW_TIME_ZONE,
    ...options,
  }).format(date);
}

/**
 * "Nov 6" for dates in the current Manila year, "Nov 6, 2025" otherwise, with
 * an optional time ("Nov 9, 10:00 AM").
 */
export function shortDate(
  value: string | Date,
  now = Date.now(),
  withTime = false,
) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const sameYear =
    manilaParts(date, { year: "numeric" }) ===
    manilaParts(new Date(now), { year: "numeric" });
  return manilaParts(date, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

/** Replaces raw ISO timestamps inside server-written text with readable dates. */
export function humanizeTimestamps(text: string | null | undefined, now = Date.now()) {
  if (!text) return "";
  return text.replace(ISO_TIMESTAMP, (match) => shortDate(match, now, true) || match);
}

const ATTENTION = /revision|reject|overdue|declin|redefense|changes requested/i;

/**
 * Reduces a "Recently updated · Latest submission · Revision required" detail
 * to the one status worth showing: an attention status when there is one,
 * otherwise the first part.
 */
export function primaryStatus(detail: string | null | undefined) {
  const parts = (detail || "")
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  const attention = parts.find((part) => ATTENTION.test(part));
  if (attention) return { text: attention, attention: true };
  return parts[0] ? { text: parts[0], attention: false } : null;
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}
