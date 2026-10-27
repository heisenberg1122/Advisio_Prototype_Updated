import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "researcher", firstName: "Researcher", roles: ["RESEARCHER"] },
  }),
}));
vi.mock("@/providers/theme-provider", () => ({
  useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));
vi.mock("@/providers/active-project-provider", () => ({
  useActiveProjectContext: () => ({
    activeProjectId: null,
    requestedProjectId: null,
    authorizedProjectIds: [],
    selectProject: vi.fn(),
    projectHref: (path: string) => path,
  }),
}));
vi.mock("@/hooks/use-student", () => ({
  useNotifications: () => ({ data: [] }),
}));
import StudentDashboard from "./page";

function render(
  cohorts: any[] = [],
  workspaces: any[] = [],
  path = "/student/dashboard",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["student-research"], { projects: [] });
  client.setQueryData(["student-cohorts"], { cohorts });
  client.setQueryData(["student-workspaces"], { workspaces });
  client.setQueryData(["student-workflow-enrollments"], { enrollments: [] });
  const html = renderToString(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <StudentDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}
describe("normal researcher dashboard entry", () => {
  it("renders no-cohort guidance without start, registration or case-only shortcuts", () => {
    const html = render();
    expect(html).toContain(
      "not currently assigned to an active research cohort",
    );
    for (const label of [
      "Start Research",
      "Register Research Project",
      "New document",
      "Book consultation",
      "Submit draft",
    ])
      expect(html).not.toContain(label);
  });
  it("offers team setup with a published cohort process without a registration form", () => {
    const html = render([
      {
        id: "c",
        name: "Cohort",
        status: "ACTIVE",
        workflowId: "w",
        workflow: { id: "w", status: "PUBLISHED" },
      },
    ]);
    expect(html).toContain("Create Research Team");
    expect(html).toContain("Join Research Team");
    expect(html).not.toContain("Start Research");
    expect(html).not.toContain("Register Project");
  });
  it("ordinary team members wait for their leader on the actual dashboard", () => {
    const html = render(
      [
        {
          id: "c",
          name: "Cohort",
          status: "ACTIVE",
          workflowId: "w",
          workflow: { id: "w", status: "PUBLISHED" },
        },
      ],
      [
        {
          id: "t",
          name: "Team",
          cohortId: "c",
          members: [
            {
              userId: "researcher",
              role: "MEMBER",
              user: {
                firstName: "Team",
                lastName: "Member",
                email: "member@example.test",
              },
            },
          ],
        },
      ],
      "/student/dashboard?tab=group",
    );
    expect(html).toContain("Waiting for your team leader");
    expect(html).not.toContain("Start Research");
  });
});
