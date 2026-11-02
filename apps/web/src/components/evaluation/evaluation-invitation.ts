import type { EvaluationConfig } from "./evaluation-client";

const aliases: Record<string, string> = {
  researcher: "student",
  "researchers-students": "student",
  "research-professor": "professor",
  "research-adviser": "adviser",
  "research-advisor": "adviser",
  "evaluation-panelist": "panelist",
  "college-dean": "dean",
};

export function resolveInvitation(search: string, config: EvaluationConfig) {
  const params = new URLSearchParams(search);
  const roleValues = params.getAll("role");
  const courseValues = [
    ...params.getAll("course"),
    ...params.getAll("scenario"),
  ];
  const roleHint =
    roleValues.length === 1 ? roleValues[0].trim().toLowerCase() : undefined;
  const courseHint =
    courseValues.length === 1
      ? courseValues[0].trim().toUpperCase()
      : undefined;
  const roleId = roleHint ? aliases[roleHint] || roleHint : undefined;
  const role = config.roles.find((item) => item.id === roleId);
  const exactCourse = config.courses.find(
    (item) => item.id.toUpperCase() === courseHint,
  );
  const colleges = courseHint
    ? config.courses.filter(
        (item) => item.collegeCode?.toUpperCase() === courseHint,
      )
    : [];
  const course =
    exactCourse || (colleges.length === 1 ? colleges[0] : undefined);
  return {
    role,
    course,
    invalid: Boolean(
      roleValues.length > 1 ||
      courseValues.length > 1 ||
      (roleHint && !role) ||
      (courseHint && !course),
    ),
  };
}

export function evaluationLink(
  base: string,
  selection: { role?: string; course?: string },
  path = "/evaluate",
) {
  const url = new URL(path, base);
  if (selection.role) url.searchParams.set("role", selection.role);
  if (selection.course) url.searchParams.set("course", selection.course);
  return url.toString();
}
