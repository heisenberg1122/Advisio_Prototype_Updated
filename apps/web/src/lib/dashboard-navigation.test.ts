import { describe, it, expect } from "vitest";
import {
  getRoleBadgeLabel,
  getRolePortalBadge,
  getRoleTitle,
  resolveFallbackDestination,
  formatAdminLink,
} from "./dashboard-navigation";
import { getWorkspaceById } from "@research-management/auth";

describe("Dashboard Navigation Helpers", () => {
  it("formats role badges and titles accurately across dashboards", () => {
    const dean = getWorkspaceById("dean");
    expect(getRoleBadgeLabel(dean)).toBe("DEAN'S OFFICE");
    expect(getRolePortalBadge(dean)).toBe("DEAN / RPO PORTAL");
    expect(getRoleTitle(dean)).toBe("Dean / RPO Office");

    const coordinator = getWorkspaceById("coordinator");
    expect(getRoleBadgeLabel(coordinator)).toBe("PROFESSOR COORDINATOR");
    expect(getRolePortalBadge(coordinator)).toBe("RESEARCH COORDINATOR PORTAL");
    expect(getRoleTitle(coordinator)).toBe("Professor Coordinator");

    const ethics = getWorkspaceById("ethics");
    expect(getRoleBadgeLabel(ethics)).toBe("ETHICS BOARD");
    expect(getRolePortalBadge(ethics)).toBe("REB ETHICS PORTAL");
    expect(getRoleTitle(ethics)).toBe("Research Ethics Board");

    const vpaa = getWorkspaceById("academic-affairs");
    expect(getRoleBadgeLabel(vpaa)).toBe("ACADEMIC AFFAIRS");
    expect(getRolePortalBadge(vpaa)).toBe("VPAA PORTAL");
    expect(getRoleTitle(vpaa)).toBe("Office of the VPAA");

    expect(getRoleBadgeLabel(null)).toBe("INSTITUTIONAL USER");
    expect(getRolePortalBadge(null)).toBe("ADVISIO PORTAL");
    expect(getRoleTitle(null)).toBe("Academic Portal");
  });

  it("resolves fallback destination according to assigned roles and preference", () => {
    // Researcher
    expect(resolveFallbackDestination(["RESEARCHER"])).toBe("/student/dashboard");

    // Dean + Coordinator without preference
    expect(resolveFallbackDestination(["RPO", "RESEARCH_COORDINATOR"])).toBe(
      "/professor/dashboard"
    );

    // Dean + Coordinator with dean preference
    expect(
      resolveFallbackDestination(["RPO", "RESEARCH_COORDINATOR"], "dean")
    ).toBe("/admin/dashboard?workspace=dean");

    // Account with zero roles
    expect(resolveFallbackDestination([])).toBe("/choose-dashboard?state=no-role");
  });

  it("formats admin links preserving active workspace parameter", () => {
    expect(formatAdminLink("/admin/dashboard", "dean")).toBe(
      "/admin/dashboard?workspace=dean"
    );
    expect(formatAdminLink("/admin/reviews", "ethics")).toBe(
      "/admin/reviews?workspace=ethics"
    );
    expect(
      formatAdminLink("/admin/documents?tab=official", "academic-affairs")
    ).toBe("/admin/documents?tab=official&workspace=academic-affairs");

    // Does not overwrite existing workspace query param
    expect(formatAdminLink("/admin/reviews?workspace=ethics", "dean")).toBe(
      "/admin/reviews?workspace=ethics"
    );

    // Non-admin link is left untouched
    expect(formatAdminLink("/student/tasks", "dean")).toBe("/student/tasks");
  });
});
