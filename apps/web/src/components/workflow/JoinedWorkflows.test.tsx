import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { JoinedWorkflows } from "./JoinedWorkflows";

describe("joined workflows on the researcher dashboard", () => {
  it("links every enrollment to its workflow without requiring project data", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <JoinedWorkflows
          enrollments={[
            { workflowId: "one", workflow: { name: "Capstone One" } },
            { workflowId: "two", workflow: { name: "Capstone Two" } },
          ]}
        />
      </MemoryRouter>,
    );
    expect(html).toContain("Capstone One");
    expect(html).toContain("Capstone Two");
    expect(html).toContain('href="/student/tasks?workflowId=one"');
    expect(html).toContain('href="/student/tasks?workflowId=two"');
    expect(html).toContain(
      "requires a research project linked to that workflow",
    );
  });

  it("does not invent workflow access when there are no enrollments", () => {
    expect(renderToStaticMarkup(<JoinedWorkflows enrollments={[]} />)).toBe("");
  });
});
