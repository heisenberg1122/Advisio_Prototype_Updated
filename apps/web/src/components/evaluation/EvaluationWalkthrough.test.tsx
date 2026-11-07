import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { EvaluationWalkthrough } from "./EvaluationWalkthrough";

test.each([
  ["dean", "dean"],
  ["professor", "coordinator"],
  ["adviser", "adviser"],
  ["panelist", "panelist-structured"],
])("%s guide links to written resources", (role, folder) => {
  const html = renderToStaticMarkup(<EvaluationWalkthrough role={role} />);
  expect(html).toContain(
    `href="/walkthroughs/${folder}/index.html" target="_blank" rel="noopener noreferrer"`,
  );
  expect(html).toContain(`href="/walkthroughs/${folder}/transcript.txt"`);
  expect(html).not.toMatch(/<video|\.mp4|disabled/);
});

test.each([
  "dean",
  "coordinator",
  "adviser",
  "panelist-structured",
  "panelist-pdf",
  "panelist-preparation",
])(
  "published %s guide contains a transcript and no video references",
  (folder) => {
    const directory = path.resolve("public", "walkthroughs", folder);
    const html = fs.readFileSync(path.join(directory, "index.html"), "utf8");
    expect(html).toContain("Walkthrough transcript");
    expect(html).not.toMatch(/<video|\.mp4/);
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
      expect(fs.existsSync(path.resolve(directory, href))).toBe(true);
    }
  },
);

test("Researcher evaluation guide keeps the written chapters and narration", () => {
  const html = renderToStaticMarkup(<EvaluationWalkthrough role="student" />);
  expect(html).toContain("Read Written Guide");
  expect(html).toContain("Read narration transcript");
  expect(html).toContain(
    'href="/walkthrough/research-dashboard" target="_blank" rel="noopener noreferrer"',
  );
  expect(html).not.toMatch(/<video|\.mp4|Explore ADVISIO/);
});

test("Panelists retain the three written guide options", () => {
  const html = renderToStaticMarkup(<EvaluationWalkthrough role="panelist" />);
  expect(html).toContain("Structured evaluation");
  expect(html).toContain("PDF evaluation");
  expect(html).toContain("Defense preparation");
});

test("an unassigned role does not display another role's guide", () => {
  expect(renderToStaticMarkup(<EvaluationWalkthrough />)).toBe("");
  expect(renderToStaticMarkup(<EvaluationWalkthrough role="unknown" />)).toBe(
    "",
  );
});
