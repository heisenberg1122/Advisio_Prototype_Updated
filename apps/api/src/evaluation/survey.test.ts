import { test, expect } from "vitest";
import { evaluationSurveyUrl } from "./survey.js";
import { EVALUATION_ROLES, EVALUATION_COURSES } from "./catalog.js";
const base = "https://docs.google.com/forms/d/e/public-form/viewform";
const env = {
  EVALUATION_SURVEY_URL: base,
  EVALUATION_SURVEY_ROLE_ENTRY: "entry.1428349663",
  EVALUATION_SURVEY_PROGRAM_ENTRY: "entry.874351903",
};
test("only role and student program are prefilled across all 35 combinations", () => {
  const labels = [
    "Students",
    "Capstone professors",
    "Research advisers",
    "Evaluation panelists",
    "College Deans",
  ];
  for (const [index, role] of EVALUATION_ROLES.entries())
    for (const course of EVALUATION_COURSES) {
      const url = new URL(
        evaluationSurveyUrl({ role: role.id, course: course.id }, env)!,
      );
      expect(url.searchParams.get(env.EVALUATION_SURVEY_ROLE_ENTRY)).toBe(
        labels[index],
      );
      expect(url.searchParams.get(env.EVALUATION_SURVEY_PROGRAM_ENTRY)).toBe(
        role.id === "student" ? course.label : null,
      );
      expect([...url.searchParams.keys()].sort()).toEqual(
        (role.id === "student"
          ? [
              "usp",
              env.EVALUATION_SURVEY_ROLE_ENTRY,
              env.EVALUATION_SURVEY_PROGRAM_ENTRY,
            ]
          : ["usp", env.EVALUATION_SURVEY_ROLE_ENTRY]
        ).sort(),
      );
    }
});
test("strips ratings, comments, account hints, and identifiers from supplied links", () => {
  const url = new URL(
    evaluationSurveyUrl(
      { role: "student", course: "BSN" },
      {
        ...env,
        EVALUATION_SURVEY_URL: `${base}?entry.999=4&authuser=somebody&session=secret#fragment`,
      },
    )!,
  );
  expect(url.searchParams.has("entry.999")).toBe(false);
  expect(url.searchParams.has("authuser")).toBe(false);
  expect(url.searchParams.has("session")).toBe(false);
  expect(url.hash).toBe("");
});
test("requires a respondent link and validates public field mappings", () => {
  expect(evaluationSurveyUrl(undefined, {})).toBe(null);
  expect(
    evaluationSurveyUrl(
      { role: "dean", course: "BSARCH" },
      { EVALUATION_SURVEY_URL: base },
    ),
  ).toBe(base);
  for (const value of [
    "https://docs.google.com/forms/d/abc/edit",
    "http://docs.google.com/forms/d/e/abc/viewform",
    "https://untrusted.example/forms/d/e/abc/viewform",
  ])
    expect(() =>
      evaluationSurveyUrl(undefined, { EVALUATION_SURVEY_URL: value }),
    ).toThrow();
  expect(() =>
    evaluationSurveyUrl(
      { role: "student", course: "BSN" },
      { ...env, EVALUATION_SURVEY_ROLE_ENTRY: "invalid" },
    ),
  ).toThrow();
});
