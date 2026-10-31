import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const sidebar = vi.hoisted(() => ({ collapsed: false }));
vi.mock("@/hooks/use-sidebar-collapsed", () => ({ useSidebarCollapsed: () => sidebar }));
import { AppShellSkeleton, TaskDetailsSkeleton } from "./Skeleton";

describe("shared loading skeletons", () => {
  it.each([false, true])("preserves sidebar collapsed=%s while loading", collapsed => {
    sidebar.collapsed = collapsed;
    const html = renderToStaticMarkup(<AppShellSkeleton pathname="/adviser/tasks/task-1" />);
    expect(html).toContain(collapsed ? "w-[72px]" : "w-[260px]");
    expect(html).toContain(collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]");
    expect(html).toContain('alt="Advisio"');
    expect(html).toContain('data-workspace-layout="standard"');
    expect(html).toContain("Loading task details");
    expect(html).not.toContain("Loading table");
  });

  it("announces loading and supplies structured placeholders without an extra back link", () => {
    const html = renderToStaticMarkup(<TaskDetailsSkeleton backLink={false} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-slot="skeleton"');
    expect(html).toContain("min-h-[204px]");
    expect(html).not.toContain("my-3");
  });
});
