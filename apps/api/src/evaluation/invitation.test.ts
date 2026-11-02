import { expect, test } from "vitest";
import { evaluationInvitationUrl } from "./invitation.js";
import { EVALUATION_COURSES, EVALUATION_ROLES } from "./catalog.js";

test("invitation QR targets are pinned to the evaluation and support every role/program pair", () => {
  const origin = "https://evaluation.example.org";
  expect(evaluationInvitationUrl(origin)).toBe(`${origin}/evaluate`);
  for (const role of EVALUATION_ROLES)
    for (const course of EVALUATION_COURSES) {
      const url = new URL(
        evaluationInvitationUrl(origin, { role: role.id, course: course.id }),
      );
      expect(url.origin).toBe(origin);
      expect(url.pathname).toBe("/evaluate");
      expect(url.searchParams.get("role")).toBe(role.id);
      expect(url.searchParams.get("course")).toBe(course.id);
      expect([...url.searchParams.keys()]).toEqual(["role", "course"]);
    }
});

test("invitation QR rejects unknown roles, duplicate values, extra identifiers and redirect targets", () => {
  for (const query of [
    { role: "system-admin" },
    { course: "unknown" },
    { role: ["student", "dean"] },
    { course: { id: "BSIT" } },
    { url: "https://other.example" },
    { role: "dean", userId: "somebody" },
    { role: "" },
  ])
    expect(() =>
      evaluationInvitationUrl("https://evaluation.example.org", query),
    ).toThrow("valid evaluation role");
});
