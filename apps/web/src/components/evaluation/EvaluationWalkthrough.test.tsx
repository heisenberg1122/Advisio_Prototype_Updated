import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { EvaluationWalkthrough } from "./EvaluationWalkthrough";

test.each([
  ["dean", "dean"],
  ["professor", "coordinator"],
  ["adviser", "adviser"],
  ["panelist", "panelist-structured"],
])(
  "%s guide exposes its published video without requiring playback",
  (role, folder) => {
    const html = renderToStaticMarkup(
      <EvaluationWalkthrough role={role} onContinue={() => {}} />,
    );
    expect(html).toContain(`/walkthroughs/${folder}/`);
    expect(html).toContain('type="video/mp4"');
    expect(html).toContain('kind="captions"');
    expect(html).toContain("Start guided activities</button>");
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("autoPlay");
    for (const match of html.matchAll(
      /(?:src|href)="(\/walkthroughs\/[^"]+)"/g,
    )) {
      expect(fs.existsSync(path.resolve("public", `.${match[1]}`))).toBe(true);
    }
  },
);

test("Researcher player is expanded on the evaluation guide", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <EvaluationWalkthrough role="student" />
    </MemoryRouter>,
  );
  expect(html).toContain('aria-expanded="true"');
  expect(html).toContain('<div id="researcher-video">');
  expect(html).toContain("Read Written Guide");
});

test("Panelists get one player and an explicit choice of guides", () => {
  const html = renderToStaticMarkup(<EvaluationWalkthrough role="panelist" />);
  expect(html.match(/<video/g)).toHaveLength(1);
  expect(html).toContain("Structured evaluation");
  expect(html).toContain("PDF evaluation");
  expect(html).toContain("Defense preparation");
});

test("an unassigned role does not silently display another role's video", () => {
  expect(renderToStaticMarkup(<EvaluationWalkthrough />)).toBe("");
  expect(renderToStaticMarkup(<EvaluationWalkthrough role="unknown" />)).toBe(
    "",
  );
});
