import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const sidebar = vi.hoisted(() => ({ collapsed: false }));
vi.mock("@/hooks/use-sidebar-collapsed", () => ({ useSidebarCollapsed: () => sidebar }));
import { AppShellSkeleton, ContentSkeletonForPath, DefenseEvaluationsSkeleton, TaskDetailsSkeleton } from "./Skeleton";
import { DefenseSkeleton } from "@/components/defense/DefenseSkeleton";

describe("shared loading skeletons", () => {
  it("uses the same defense record layout while the route and data load", () => {
    const page = renderToStaticMarkup(<DefenseSkeleton />);
    const route = renderToStaticMarkup(<ContentSkeletonForPath pathname="/student/defense/session-1" />);
    expect(route).toBe(page);
    expect(page).toContain("Loading research defense");
    expect(page).toContain('aria-busy="true"');
    expect(page).not.toContain("Loading cards");
  });

  it("keeps evaluation placeholders accessible while released scores load", () => {
    const html = renderToStaticMarkup(<DefenseEvaluationsSkeleton />);
    expect(html).toContain("Loading consolidated evaluations");
    expect(html).toContain('role="status"');
    expect(html).toContain('data-slot="skeleton"');
  });
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
