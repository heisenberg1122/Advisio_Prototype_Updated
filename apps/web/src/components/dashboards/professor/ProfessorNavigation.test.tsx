import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/hooks/use-sidebar-collapsed", () => ({
  useSidebarCollapsed: () => ({ collapsed: false, toggle: vi.fn() }),
}));
vi.mock("@/components/layout/AppSidebar", () => ({
  AppSidebar: ({ navSections, roleTitle }: any) => (
    <nav>
      <h1>{roleTitle}</h1>
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
import { ProfessorSidebar } from "./ProfessorSidebar";
describe("coordinator primary navigation", () => {
  it("separates academic cohorts and reusable templates without promoting process participants", () => {
    const html = renderToStaticMarkup(<ProfessorSidebar />);
    expect(html).toContain("Research Coordinator");
    expect(html).toContain('href="/professor/cohorts"');
    expect(html).toContain("Research Cohorts");
    expect(html).toContain("Process Templates");
    expect(html).toContain("Research Cases");
    expect(html).toContain('href="/professor/dashboard?tab=builder"');
    for (const obsolete of [
      "Course Professor",
      "Workflow Participants",
      "Register Projects",
    ])
      expect(html).not.toContain(obsolete);
    for (const kept of [
      "Manuscript Reviews",
      "Official Copies",
      "Defense",
      "Calendar",
    ])
      expect(html).toContain(kept);
  });
});
