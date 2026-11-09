import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DASHBOARD_WORKSPACES } from "@research-management/auth";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import {
  ResearcherGuideProvider,
  useResearcherGuide,
} from "./researcher-guide-provider";

const { useAuth, useDashboardWorkspace } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useDashboardWorkspace: vi.fn(),
}));

vi.mock("./auth-provider", () => ({ useAuth }));
vi.mock("./dashboard-workspace-provider", () => ({ useDashboardWorkspace }));
vi.mock("./active-project-provider", () => ({
  useActiveProjectContext: () => ({}),
}));
vi.mock("@/hooks/use-sidebar-collapsed", () => ({
  useSidebarCollapsed: () => ({}),
}));
vi.mock("@/hooks/use-researcher-guide-state", () => ({
  useResearcherGuideState: () => ({ state: {} }),
}));
vi.mock("@/components/guide/FloatingResearcherAssistant", () => ({
  FloatingResearcherAssistant: () => <button>Open Advisio Assistant</button>,
}));

function AssistancePreference() {
  return useResearcherGuide()?.assistantEnabled ? (
    <span>Assistant available</span>
  ) : null;
}

function renderWorkspace(
  workspace: (typeof DASHBOARD_WORKSPACES)[number],
  token = "__evaluation__",
  role = workspace.role,
) {
  useAuth.mockReturnValue({
    token,
    user: {
      id: "demo",
      roles: [role],
      permissions: [],
      college: { id: "demo-college" },
    },
  });
  useDashboardWorkspace.mockReturnValue({ activeWorkspace: workspace });
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[workspace.routePrefix + "/dashboard"]}>
        <ResearcherGuideProvider>
          <AssistancePreference />
        </ResearcherGuideProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it.each(DASHBOARD_WORKSPACES.filter(({ id }) => id !== "system-admin"))(
  "provides the assistant and its preference in TAM's $id workspace",
  (workspace) => {
    const markup = renderWorkspace(workspace);
    expect(markup).toContain("Open Advisio Assistant");
    expect(markup).toContain("Assistant available");
  },
);

it("limits the expanded rollout to eligible TAM accounts", () => {
  const researcher = DASHBOARD_WORKSPACES.find(
    ({ id }) => id === "researcher",
  )!;
  const adviser = DASHBOARD_WORKSPACES.find(({ id }) => id === "adviser")!;
  const systemAdmin = DASHBOARD_WORKSPACES.find(
    ({ id }) => id === "system-admin",
  )!;
  expect(renderWorkspace(researcher, "regular-session")).not.toContain(
    "Open Advisio Assistant",
  );
  expect(
    renderWorkspace(adviser, "__evaluation__", researcher.role),
  ).not.toContain("Open Advisio Assistant");
  expect(renderWorkspace(systemAdmin)).not.toContain("Open Advisio Assistant");
});
