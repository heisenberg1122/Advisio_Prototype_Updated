import React from "react";
import { renderToString, renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  cohortKeys,
  type CoordinatorCohort,
  type CohortStatus,
} from "@/lib/coordinator-cohorts";
const auth = vi.hoisted(() => ({
  user: {
    id: "coordinator",
    roles: ["RESEARCH_COORDINATOR"],
    permissions: [],
    college: { id: "college" },
    program: { id: "program" },
  } as any,
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => auth }));
import Page, {
  CohortList,
  CohortCreateForm,
  CohortRoster,
  CohortSetupGuide,
} from "./page";
const named = { id: "named", name: "Science" };
const cohort: CoordinatorCohort = {
  id: "cohort",
  name: "Biology Batch A",
  description: "Research class",
  collegeId: "college",
  programId: "program",
  researchTypeId: "track",
  academicYearId: "year",
  status: "DRAFT",
  workflowId: "process",
  workflow: {
    id: "process",
    name: "Published Process",
    version: 1,
    researchTypeId: "track",
    status: "PUBLISHED",
  },
  college: named,
  program: { ...named, id: "program", name: "Biology" },
  researchType: { ...named, name: "Thesis" },
  academicYear: { ...named, name: "2026" },
  _count: { members: 2, workspaces: 0, researchProjects: 0 },
};
const render = (element: React.ReactNode) =>
  renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
function detail(status: CohortStatus, counts = cohort._count) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const item = { ...cohort, status, _count: counts };
  client.setQueryData(cohortKeys.list, { cohorts: [item] });
  client.setQueryData(cohortKeys.detail("cohort"), { cohort: item });
  client.setQueryData(cohortKeys.members("cohort"), {
    members: [
      {
        id: "m",
        userId: "student",
        status: "ACTIVE",
        joinedAt: "2026-10-27",
        removedAt: null,
        user: { id: "student", firstName: "Nicole", lastName: "B" },
      },
    ],
  });
  client.setQueryData(["coordinator-cohorts", "processes", "track"], {
    workflows: [cohort.workflow],
  });
  const html = renderToString(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/professor/cohorts/cohort"]}>
        <Routes>
          <Route path="/professor/cohorts/:id" element={<Page />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}
describe("coordinator cohort screens", () => {
  it("distinguishes an empty search from having no cohorts", () => {
    const html = render(
      <CohortList cohorts={[]} filtered onCreate={vi.fn()} />,
    );
    expect(html).toContain("No cohorts match your search");
    expect(html).not.toContain("No research cohorts yet");
  });
  it("starts with cohort creation, not template creation, in the empty state", () => {
    const html = render(<CohortList cohorts={[]} onCreate={vi.fn()} />);
    expect(html).toContain("No research cohorts yet");
    expect(html).toContain("Create Research Cohort");
    expect(html).not.toContain("Create workflow");
  });
  it.each(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"] as const)(
    "renders %s, academic context and authoritative assignment/counts",
    (status) => {
      const html = render(
        <CohortList cohorts={[{ ...cohort, status }]} onCreate={vi.fn()} />,
      );
      expect(html).toContain(status[0] + status.slice(1).toLowerCase());
      for (const text of [
        "Biology",
        "Thesis",
        "2026",
        "Published Process",
        "v1",
        "published",
        "Active Researchers",
        "View / Manage",
      ])
        expect(html).toContain(text);
    },
  );
  it("shows all seven setup steps without registration or enrollment-first guidance", () => {
    const html = render(<CohortSetupGuide />);
    for (const text of [
      "Create Research Cohort",
      "Assign Research Process",
      "Add Researchers",
      "Activate Cohort",
      "Team leader starts research",
      "Monitor Research Cases",
    ])
      expect(html).toContain(text);
    expect(html).not.toMatch(
      /Register Project|Add participants|enrolled researcher registers/i,
    );
  });
  it("cohort create asks only for supported academic fields and metadata", () => {
    const html = render(
      <CohortCreateForm
        programs={[
          {
            id: "program",
            name: "Biology",
            collegeId: "college",
            researchTypes: [
              {
                id: "track",
                name: "Thesis",
                programId: "program",
                isActive: true,
              },
              {
                id: "inactive",
                name: "Inactive Track",
                programId: "program",
                isActive: false,
              },
            ],
          },
        ]}
        years={[{ id: "year", name: "2026", isActive: true }]}
        pending={false}
        onSubmit={vi.fn()}
      />,
    );
    for (const key of [
      "name",
      "description",
      "programId",
      "researchTypeId",
      "academicYearId",
    ])
      expect(html).toContain(`name="${key}"`);
    for (const key of ["collegeId", "workflowId", "title", "userId"])
      expect(html).not.toContain(`name="${key}"`);
    expect(html).not.toContain("Inactive Track");
  });
  it("shows active and removed membership without confusing them with access permissions", () => {
    const member = {
      id: "m",
      userId: "student",
      status: "ACTIVE" as const,
      joinedAt: "2026-10-27",
      removedAt: null,
      user: { id: "student", firstName: "Nicole", lastName: "B" },
    };
    const html = render(
      <CohortRoster
        members={[member, { ...member, id: "removed", status: "REMOVED" }]}
        canManage
        pending={false}
        onRemove={vi.fn()}
      />,
    );
    expect(html).toContain("Active member");
    expect(html).toContain("historical membership");
    expect(html.match(/Remove Researcher/g)).toHaveLength(1);
    expect(
      render(
        <CohortRoster
          members={[member]}
          canManage={false}
          pending={false}
          onRemove={vi.fn()}
        />,
      ),
    ).not.toContain("Remove Researcher");
  });
  it("draft management shows assignment/members/activation without a member-count activation prerequisite", () => {
    const html = detail("DRAFT", {
      members: 0,
      workspaces: 0,
      researchProjects: 0,
    });
    for (const text of [
      "Assign Process",
      "Add Researchers",
      "Activate Cohort",
      "Edit Cohort",
      "Published Process",
    ])
      expect(html).toContain(text);
    expect(html).not.toContain("Close Cohort");
    expect(html).not.toContain('name="userId"');
  });
  it("active cohort with teams keeps process assignment locked", () => {
    const html = detail("ACTIVE", {
      members: 2,
      workspaces: 1,
      researchProjects: 0,
    });
    expect(html).toContain("Close Cohort");
    expect(html).toContain("Process assignment is locked because");
    expect(html).not.toContain("Choose a published process");
  });
  it.each(["CLOSED", "ARCHIVED"] as const)(
    "%s keeps history but locks researcher and process editing",
    (status) => {
      const html = detail(status);
      expect(html).not.toContain("Add Researchers</button>");
      expect(html).not.toContain("Remove Researcher");
      expect(html).not.toContain("Choose a published process");
      expect(html).toContain("Monitor Research Cases");
      if (status === "ARCHIVED") {
        expect(html).not.toContain("Edit Cohort");
        expect(html).not.toContain("Activate Cohort");
      }
    },
  );
  it("researcher-only accounts cannot render coordinator management", () => {
    auth.user.roles = ["RESEARCHER"];
    try {
      expect(render(<Page />)).toContain(
        "Research Coordinator access is required",
      );
    } finally {
      auth.user.roles = ["RESEARCH_COORDINATOR"];
    }
  });
});
