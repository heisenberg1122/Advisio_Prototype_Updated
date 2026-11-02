import { expect, test } from "vitest";
import { resolveInvitation, evaluationLink } from "./evaluation-invitation";
import type { EvaluationConfig } from "./evaluation-client";
const config: EvaluationConfig = {
  roles: [
    { id: "dean", label: "College Dean", tasks: [] },
    { id: "adviser", label: "Research adviser", tasks: [] },
  ],
  courses: [
    {
      id: "BSIT",
      label: "IT",
      college: "Information Technology",
      collegeCode: "CIT",
    },
    {
      id: "BSCE",
      label: "Civil Engineering",
      college: "Engineering and Architecture",
      collegeCode: "CEA",
    },
    {
      id: "BSARCH",
      label: "Architecture",
      college: "Engineering and Architecture",
      collegeCode: "CEA",
    },
  ],
  entryUrl: "https://evaluation.example.org/evaluate",
  localOnly: false,
  temporaryStorage: true,
};
test("invitation resolves canonical IDs and human-friendly role/unique-college aliases", () => {
  expect(resolveInvitation("?role=dean&course=BSIT", config)).toMatchObject({
    role: { id: "dean" },
    course: { id: "BSIT" },
    invalid: false,
  });
  expect(
    resolveInvitation("?role=research-adviser&scenario=cit", config),
  ).toMatchObject({
    role: { id: "adviser" },
    course: { id: "BSIT" },
    invalid: false,
  });
});
test("invalid or ambiguous assignments never silently select a privileged role or an arbitrary program", () => {
  expect(
    resolveInvitation("?role=system-admin&course=unknown", config),
  ).toEqual({ role: undefined, course: undefined, invalid: true });
  expect(resolveInvitation("?scenario=CEA", config)).toMatchObject({
    course: undefined,
    invalid: true,
  });
  expect(
    resolveInvitation("?role=dean&role=adviser&course=BSIT", config),
  ).toMatchObject({ role: undefined, invalid: true });
  expect(resolveInvitation("?course=BSIT&scenario=CEA", config)).toMatchObject({
    course: undefined,
    invalid: true,
  });
});
test("generated links keep only the selected role/program and use the requested internal entry/guide path", () => {
  expect(
    evaluationLink(config.entryUrl, { role: "dean", course: "BSIT" }),
  ).toBe("https://evaluation.example.org/evaluate?role=dean&course=BSIT");
  expect(
    evaluationLink(config.entryUrl, { role: "dean" }, "/evaluate/guide"),
  ).toBe("https://evaluation.example.org/evaluate/guide?role=dean");
});
