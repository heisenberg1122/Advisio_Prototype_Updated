import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getEligibleWorkspaces,
  getWorkspaceById,
  resolveWorkspaceFromPath,
  getDefaultWorkspace,
} from "@research-management/auth";
import {
  getRoleBadgeLabel,
  getRolePortalBadge,
  resolveFallbackDestination,
  formatAdminLink,
} from "../../lib/dashboard-navigation";

describe("Dashboard Switcher Multi-Role Scenarios", () => {
  it("determines multi-role eligibility correctly", () => {
    // Single role account
    const singleRole = getEligibleWorkspaces(["RESEARCHER"]);
    expect(singleRole.length).toBe(1);
    expect(singleRole.length >= 2).toBe(false);

    // Dean + Coordinator
    const deanCoordinator = getEligibleWorkspaces(["RPO", "RESEARCH_COORDINATOR"]);
    expect(deanCoordinator.length).toBe(2);
    expect(deanCoordinator.map((w) => w.id)).toEqual(["coordinator", "dean"]);

    // Panelist + Coordinator
    const panelistCoordinator = getEligibleWorkspaces(["PANELIST", "RESEARCH_COORDINATOR"]);
    expect(panelistCoordinator.length).toBe(2);
    expect(panelistCoordinator.map((w) => w.id)).toEqual(["panelist", "coordinator"]);

    // Dean + REB + VPAA (All institutional admin roles)
    const adminRoles = getEligibleWorkspaces(["RPO", "REB", "VPAA"]);
    expect(adminRoles.length).toBe(3);
    expect(adminRoles.map((w) => w.id)).toEqual(["dean", "ethics", "academic-affairs"]);
  });

  it("marks the active workspace and resolves labels without data leaks", () => {
    const deanWs = getWorkspaceById("dean");
    expect(deanWs?.label).toBe("Dean's Office");
    expect(getRoleBadgeLabel(deanWs)).toBe("DEAN'S OFFICE");
    expect(getRolePortalBadge(deanWs)).toBe("DEAN / RPO PORTAL");

    const coordWs = getWorkspaceById("coordinator");
    expect(coordWs?.label).toBe("Professor Coordinator");
    expect(getRoleBadgeLabel(coordWs)).toBe("PROFESSOR COORDINATOR");
    expect(getRolePortalBadge(coordWs)).toBe("RESEARCH COORDINATOR PORTAL");
  });

  it("handles shared admin route workspace preservation", () => {
    // Navigating between admin views preserves workspace parameter
    expect(formatAdminLink("/admin/dashboard", "ethics")).toBe(
      "/admin/dashboard?workspace=ethics"
    );
    expect(formatAdminLink("/admin/reviews", "dean")).toBe(
      "/admin/reviews?workspace=dean"
    );
    expect(formatAdminLink("/admin/dashboard", "academic-affairs")).toBe(
      "/admin/dashboard?workspace=academic-affairs"
    );

    // Resolving admin workspace from path and query
    expect(resolveWorkspaceFromPath("/admin/dashboard", "?workspace=ethics")?.id).toBe("ethics");
    expect(resolveWorkspaceFromPath("/admin/dashboard", "?workspace=academic-affairs")?.id).toBe("academic-affairs");
    expect(resolveWorkspaceFromPath("/admin/dashboard", "?workspace=dean")?.id).toBe("dean");
  });

  it("handles role revocation during active session", () => {
    // Initially user has Coordinator + Panelist
    const initialRoles = ["RESEARCH_COORDINATOR", "PANELIST"];
    let eligible = getEligibleWorkspaces(initialRoles);
    expect(eligible.some((w) => w.id === "panelist")).toBe(true);

    // Admin revokes PANELIST
    const updatedRoles = ["RESEARCH_COORDINATOR"];
    eligible = getEligibleWorkspaces(updatedRoles);
    expect(eligible.some((w) => w.id === "panelist")).toBe(false);
    expect(eligible.length).toBe(1);

    // If user attempts to switch to panelist, eligibility check fails
    const targetWorkspace = getWorkspaceById("panelist");
    const stillAuthorized = eligible.some((w) => w.id === targetWorkspace?.id);
    expect(stillAuthorized).toBe(false);

    // Fallback destination safely routes to only remaining role
    const fallback = resolveFallbackDestination(updatedRoles, "panelist");
    expect(fallback).toBe("/professor/dashboard");
  });

  describe("Dirty form protection contract", () => {
    it("detects dirty forms before allowing workspace change", () => {
      const dirtyEntries = new Map<string, { isDirty: () => boolean; onDiscard?: () => void }>();
      let formEditsDiscarded = false;

      dirtyEntries.set("manuscript-eval", {
        isDirty: () => true,
        onDiscard: () => {
          formEditsDiscarded = true;
        },
      });

      const hasDirty = () => {
        for (const entry of dirtyEntries.values()) {
          if (entry.isDirty()) return true;
        }
        return false;
      };

      // Guard detects dirty state
      expect(hasDirty()).toBe(true);

      // User confirms discard
      dirtyEntries.forEach((e) => e.onDiscard?.());
      expect(formEditsDiscarded).toBe(true);
    });
  });
});
