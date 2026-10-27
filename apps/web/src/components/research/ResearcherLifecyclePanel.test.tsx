import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { resolveResearcherLifecycle } from "@/lib/researcher-lifecycle";
import { ResearcherLifecycleView } from "./ResearcherLifecyclePanel";

const cohort = {
  id: "c",
  name: "Biology 2026",
  status: "ACTIVE" as const,
  workflowId: "w",
  workflow: { id: "w", status: "PUBLISHED" },
};
const team = {
  id: "t",
  name: "Research Team",
  cohortId: "c",
  members: [
    { userId: "leader", role: "LEADER" },
    { userId: "member", role: "MEMBER" },
  ],
};
function render(
  input: Partial<Parameters<typeof resolveResearcherLifecycle>[0]> = {},
  flags = {},
) {
  const model = resolveResearcherLifecycle({
    cohorts: [cohort],
    teams: [],
    projects: [],
    userId: "leader",
    ...input,
  });
  const lifecycle = {
    ...model,
    loading: false,
    error: false,
    retry: vi.fn(),
    selectCase: vi.fn(),
    chooseContext: vi.fn(),
    ...flags,
  } as any;
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ResearcherLifecycleView lifecycle={lifecycle} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("researcher lifecycle interface", () => {
  it("shows no cohort without creation or registration actions", () => {
    const html = render({ cohorts: [] });
    expect(html).toContain(
      "not currently assigned to an active research cohort",
    );
    expect(html).not.toContain("Start Research");
    expect(html).not.toContain("Register");
  });
  it("shows the missing process as coordinator setup, not an error", () => {
    const html = render({ cohorts: [{ ...cohort, workflow: null }] });
    expect(html).toContain("coordinator has not assigned the research process");
    expect(html).not.toContain("Start Research");
  });
  it("offers cohort-linked team setup without title fields", () => {
    const html = render();
    expect(html).toContain("Create Research Team");
    expect(html).toContain("Join Research Team");
    expect(html).not.toContain("Register Project");
    expect(html).not.toContain("Start Research");
  });
  it("leader sees start while an ordinary member waits", () => {
    expect(render({ teams: [team] })).toContain("Start Research");
    const html = render({ teams: [team], userId: "member" });
    expect(html).toContain("Waiting for your team leader");
    expect(html).not.toContain("Start Research");
  });
  it.each(["CLOSED", "ARCHIVED"] as const)(
    "retains existing %s cohort research with a provisional label",
    (status) => {
      const html = render({
        cohorts: [{ ...cohort, status }],
        projects: [
          {
            id: "p",
            cohortId: "c",
            title: "Generated title",
            isTitleProvisional: true,
          },
        ],
      });
      expect(html).toContain("Continue Research");
      expect(html).toContain("Research title pending");
      expect(html).toContain("closed or archived");
      expect(html).not.toContain("Start Research");
    },
  );
  it("continues a legacy case without forcing cohort setup", () => {
    const html = render({
      cohorts: [],
      projects: [
        {
          id: "p",
          cohortId: null,
          title: "Existing research",
          isTitleProvisional: false,
        },
      ],
    });
    expect(html).toContain("Existing research");
    expect(html).toContain("Continue Research");
    expect(html).not.toContain("title pending");
    expect(html).not.toContain("Start Research");
  });
  it("keeps case navigation but clearly explains revoked process access", () => {
    const html = render({
      projects: [{ id: "p", workflowAccessRemoved: true }],
    });
    expect(html).toContain("process is currently restricted");
    expect(html).toContain("Continue Research");
  });
  it("shows loading and retry instead of premature setup actions", () => {
    expect(render({}, { loading: true })).toContain(
      "Loading your research cohort",
    );
    expect(render({}, { error: true })).toContain("Retry");
    expect(render({}, { loading: true })).not.toContain("Create Research Team");
  });
});
