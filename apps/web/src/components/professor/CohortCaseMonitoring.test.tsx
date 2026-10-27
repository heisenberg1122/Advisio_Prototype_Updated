import React from "react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CohortCaseMonitoring } from "./CohortCaseMonitoring";
const project = {
  id: "case",
  cohortId: "cohort",
  title: "Generated Team Study",
  isTitleProvisional: true,
  workflowDraft: true,
  registeredAt: null,
  researchers: [{ id: "s" }],
  progress: 0,
  status: "draft",
  currentStage: { name: "First stage" },
};
const render = (projects: any[], cohortId: string | null = null) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <CohortCaseMonitoring
        projects={projects}
        cohortId={cohortId}
        loading={false}
        error={null}
        onOpen={vi.fn()}
        onRemove={vi.fn()}
      />
    </MemoryRouter>,
  );
describe("coordinator case monitoring", () => {
  it("shows provisional research cases without requiring registration", () => {
    const html = render([project]);
    expect(html).toContain("Generated Team Study");
    expect(html).toContain("Research title pending");
    expect(html).not.toContain("Register Project");
  });
  it("filters only by exact stored cohort ID, never by program or enrollment", () => {
    const html = render(
      [
        project,
        {
          ...project,
          id: "other",
          cohortId: null,
          title: "Legacy Case",
          isTitleProvisional: false,
        },
      ],
      "cohort",
    );
    expect(html).toContain("Generated Team Study");
    expect(html).not.toContain("Legacy Case");
  });
  it("keeps legacy cases in unfiltered monitoring and shows cohort-first setup when empty", () => {
    expect(
      render([
        {
          ...project,
          cohortId: null,
          title: "Legacy Case",
          isTitleProvisional: false,
        },
      ]),
    ).toContain("Legacy Case");
    const html = render([]);
    expect(html).toContain("Cases appear after team leaders start research");
    expect(html).toContain("Create Research Cohort");
    expect(html).not.toContain("register projects");
  });
});
