import { EVALUATION_COURSES, EVALUATION_ROLES } from "./catalog.js";

export function evaluationInvitationUrl(
  origin: string,
  query: Record<string, unknown> = {},
) {
  const invalid = () =>
    Object.assign(
      new Error("Use a valid evaluation role and program for this QR code."),
      { statusCode: 400 },
    );
  if (Object.keys(query).some((key) => !["role", "course"].includes(key)))
    throw invalid();
  const url = new URL("/evaluate", origin);
  for (const key of ["role", "course"] as const) {
    const value = query[key];
    if (value === undefined) continue;
    const allowed: readonly { id: string }[] =
      key === "role" ? EVALUATION_ROLES : EVALUATION_COURSES;
    if (typeof value !== "string" || !allowed.some((item) => item.id === value))
      throw invalid();
    url.searchParams.set(key, value);
  }
  return url.toString();
}
