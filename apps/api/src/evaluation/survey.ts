import {
  EVALUATION_COURSES,
  EVALUATION_ROLES,
  type EvaluationRole,
} from "./catalog.js";

// Google Forms prefill is a convenience, not authentication or proof of submit.
// Always rebuild the query so no supplied link can pre-answer attitude ratings.
export function evaluationSurveyUrl(
  selection?: { role: EvaluationRole; course: string },
  env: NodeJS.ProcessEnv = process.env,
) {
  const value = env.EVALUATION_SURVEY_URL;
  if (!value) return null;
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hostname !== "docs.google.com" ||
    !/^\/forms\/(d\/e\/[^/]+\/viewform|d\/[^/]+\/viewform)$/.test(url.pathname)
  )
    throw new Error(
      "EVALUATION_SURVEY_URL must be a published Google Forms respondent link.",
    );
  url.search = "";
  url.hash = "";
  const roleEntry = env.EVALUATION_SURVEY_ROLE_ENTRY;
  const programEntry = env.EVALUATION_SURVEY_PROGRAM_ENTRY;
  for (const field of [roleEntry, programEntry])
    if (field && !/^entry\.\d+$/.test(field))
      throw new Error(
        "Google Forms prefill fields must be public entry identifiers.",
      );
  if (!selection) return url.toString();
  const role = EVALUATION_ROLES.find((r) => r.id === selection.role);
  const course = EVALUATION_COURSES.find((c) => c.id === selection.course);
  if (!role || !course) throw new Error("Unknown evaluation role or program.");
  if (roleEntry) {
    url.searchParams.set("usp", "pp_url");
    url.searchParams.set(roleEntry, role.surveyRole);
  }
  if (programEntry && role.id === "student") {
    url.searchParams.set("usp", "pp_url");
    url.searchParams.set(programEntry, course.label);
  }
  return url.toString();
}
