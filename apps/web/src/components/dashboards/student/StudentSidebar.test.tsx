import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const context = vi.hoisted(() => ({
  authorizedProjectIds: [] as string[],
  activeProjectId: null,
  projectHref: (path: string) => path,
}));
vi.mock("@/providers/active-project-provider", () => ({
  useActiveProjectContext: () => context,
}));
vi.mock("@/hooks/use-sidebar-collapsed", () => ({
  useSidebarCollapsed: () => ({ collapsed: false, toggle: vi.fn() }),
}));
vi.mock("@/components/layout/AppSidebar", () => ({
  AppSidebar: ({ navSections }: any) => (
    <nav>
      {navSections.flatMap((section: any) =>
        section.items.map((item: any) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        )),
      )}
    </nav>
  ),
}));
import { StudentSidebar } from "./StudentSidebar";
describe("researcher navigation", () => {
  it("prioritizes cohort and team setup before a case exists", () => {
    context.authorizedProjectIds = [];
    const html = renderToStaticMarkup(<StudentSidebar />);
    expect(html).toContain("Research Cohort &amp; Team");
    for (const label of [
      "Tasks",
      "Documents",
      "Defense",
      "Consultations",
      "Group Files",
    ])
      expect(html).not.toContain(label);
  });
  it("preserves research modules after an authorized case exists", () => {
    context.authorizedProjectIds = ["case"];
    const html = renderToStaticMarkup(<StudentSidebar />);
    for (const label of [
      "My Research",
      "Tasks",
      "Documents",
      "Defense",
      "Consultations",
      "Group Files",
    ])
      expect(html).toContain(label);
  });
});
