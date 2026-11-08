import {
  EVALUATION_COURSES,
  EVALUATION_ROLES,
  evaluationCourse,
} from "./catalog.js";

export function evaluationEntryUrl(origin: string, launcher?: string) {
  if (!launcher) return new URL("/evaluate", origin).toString();
  // The launcher checks availability only; sessions remain on the evaluation
  // origin. Never accept a visitor-supplied redirect destination.
  if (
    launcher !== "https://advisio-ua.com/evaluate/start" &&
    launcher !== "https://advisio-prototype-updated.vercel.app/evaluate/start"
  )
    throw new Error(
      "EVALUATION_LAUNCH_URL must use the official ADVISIO starter page.",
    );
  return launcher;
}

export function evaluationInvitationUrl(
  origin: string,
  query: Record<string, unknown> = {},
  launcher?: string,
) {
  const invalid = () =>
    Object.assign(
      new Error("Use a valid evaluation role and program for this QR code."),
      { statusCode: 400 },
    );
  if (Object.keys(query).some((key) => !["role", "course"].includes(key)))
    throw invalid();
  const url = new URL(evaluationEntryUrl(origin, launcher));
  for (const key of ["role", "course"] as const) {
    const value = query[key];
    if (value === undefined) continue;
    const allowed: readonly { id: string }[] =
      key === "role" ? EVALUATION_ROLES : EVALUATION_COURSES;
    if (
      typeof value !== "string" ||
      !(key === "course"
        ? evaluationCourse(value)
        : allowed.some((item) => item.id === value))
    )
      throw invalid();
    url.searchParams.set(key, value);
  }
  return url.toString();
}
