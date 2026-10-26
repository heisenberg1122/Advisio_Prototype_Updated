import { describe, it, expect } from "vitest";
import {
  DASHBOARD_WORKSPACES,
  canonicalizeRole,
  getEligibleWorkspaces,
  getWorkspaceById,
  getWorkspaceForRole,
  resolveWorkspaceFromPath,
  getCanonicalAdminUrl,
  isSafeInternalUrl,
  getSafeReturnWorkspace,
  getDefaultWorkspace,
} from "./dashboard-workspaces.js";
import { InstitutionalRoles } from "./roles.js";

describe("Dashboard Workspaces Registry", () => {
  it("defines 6 supported workspaces in stable order", () => {
    expect(DASHBOARD_WORKSPACES).toHaveLength(6);
    const ids = DASHBOARD_WORKSPACES.map((w) => w.id);
    expect(ids).toEqual([
      "researcher",
      "adviser",
      "panelist",
      "coordinator",
      "dean",
      "system-admin",
    ]);

    DASHBOARD_WORKSPACES.forEach((w, index) => {
      expect(w.order).toBe(index + 1);
      expect(w.label).toBeTruthy();
      expect(w.description).toBeTruthy();
      expect(w.homeUrl).toBeTruthy();
      expect(w.routePrefix).toBeTruthy();
    });
  });

  it("canonicalizes standard roles and legacy aliases", () => {
    expect(canonicalizeRole("RESEARCHER")).toBe(InstitutionalRoles.RESEARCHER);
    expect(canonicalizeRole("researcher")).toBe(InstitutionalRoles.RESEARCHER);
    expect(canonicalizeRole("STUDENT")).toBe(InstitutionalRoles.RESEARCHER);
    expect(canonicalizeRole("PROFESSOR")).toBe(InstitutionalRoles.RESEARCH_COORDINATOR);
    expect(canonicalizeRole("ADMIN")).toBe(InstitutionalRoles.DEAN);
    expect(canonicalizeRole("UNKNOWN_ROLE")).toBeNull();
    expect(canonicalizeRole("RPO")).toBeNull();
    expect(canonicalizeRole("VPAA")).toBeNull();
    expect(canonicalizeRole("REB")).toBeNull();
    expect(getEligibleWorkspaces(["RPO", "VPAA", "REB"])).toEqual([]);
    expect(canonicalizeRole(null)).toBeNull();
  });

  it("filters eligible workspaces for single and multi-role users", () => {
    // Single role: RESEARCHER
    const researcherOnly = getEligibleWorkspaces(["RESEARCHER"]);
    expect(researcherOnly).toHaveLength(1);
    expect(researcherOnly[0].id).toBe("researcher");

    // Dean + Coordinator (DEAN + RESEARCH_COORDINATOR)
    const deanCoordinator = getEligibleWorkspaces(["DEAN", "RESEARCH_COORDINATOR"]);
    expect(deanCoordinator.map((w) => w.id)).toEqual(["coordinator", "dean"]);

    // Panelist + Coordinator
    const panelistCoordinator = getEligibleWorkspaces(["PANELIST", "RESEARCH_COORDINATOR"]);
    expect(panelistCoordinator.map((w) => w.id)).toEqual(["panelist", "coordinator"]);

    // System Admin alone does not grant faculty dashboards
    const sysAdminOnly = getEligibleWorkspaces(["SYSTEM_ADMIN"]);
    expect(sysAdminOnly.map((w) => w.id)).toEqual(["system-admin"]);

    // Empty or unknown roles
    expect(getEligibleWorkspaces([])).toEqual([]);
    expect(getEligibleWorkspaces(["GUEST", "UNKNOWN"])).toEqual([]);
  });

  it("looks up workspaces by id and role", () => {
    expect(getWorkspaceById("dean")?.label).toBe("Dean's Office");
    expect(getWorkspaceById("ethics")).toBeNull();
    expect(getWorkspaceById("nonexistent")).toBeNull();

    expect(getWorkspaceForRole("RESEARCHER")?.id).toBe("researcher");
    expect(getWorkspaceForRole("STUDENT")?.id).toBe("researcher");
    expect(getWorkspaceForRole("DEAN")?.id).toBe("dean");
    expect(getWorkspaceForRole("REB")).toBeNull();
  });

  it("resolves workspace from URL path and search params", () => {
    expect(resolveWorkspaceFromPath("/student/dashboard")?.id).toBe("researcher");
    expect(resolveWorkspaceFromPath("/student/tasks/123")?.id).toBe("researcher");
    expect(resolveWorkspaceFromPath("/adviser/dashboard")?.id).toBe("adviser");
    expect(resolveWorkspaceFromPath("/panelist/defenses/session-1")?.id).toBe("panelist");
    expect(resolveWorkspaceFromPath("/professor/milestones")?.id).toBe("coordinator");
    expect(resolveWorkspaceFromPath("/system-admin/dashboard")?.id).toBe("system-admin");

    // Admin routes with workspace param
    expect(resolveWorkspaceFromPath("/admin/dashboard", "?workspace=dean")?.id).toBe("dean");
    expect(resolveWorkspaceFromPath("/admin/reviews", "?workspace=ethics")).toBeNull();
    expect(
      resolveWorkspaceFromPath("/admin/dashboard", "?workspace=academic-affairs")
    ).toBeNull();

    // Admin routes without explicit workspace param return null
    expect(resolveWorkspaceFromPath("/admin/dashboard")).toBeNull();
    expect(resolveWorkspaceFromPath("/unknown/path")).toBeNull();
  });

  it("generates canonical admin URLs", () => {
    expect(getCanonicalAdminUrl("dean")).toBe("/admin/dashboard?workspace=dean");
    expect(getCanonicalAdminUrl("ethics", "/admin/reviews")).toBe(
      "/admin/reviews?workspace=dean"
    );
    expect(getCanonicalAdminUrl("academic-affairs")).toBe(
      "/admin/dashboard?workspace=dean"
    );
  });

  it("validates safe internal URLs", () => {
    expect(isSafeInternalUrl("/student/dashboard")).toBe(true);
    expect(isSafeInternalUrl("/panelist/defenses/123?tab=score")).toBe(true);
    expect(isSafeInternalUrl("//evil.com")).toBe(false);
    expect(isSafeInternalUrl("/\\evil.com")).toBe(false);
    expect(isSafeInternalUrl("https://evil.com")).toBe(false);
    expect(isSafeInternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeInternalUrl("/login")).toBe(false);
    expect(isSafeInternalUrl("/choose-dashboard")).toBe(false);
    expect(isSafeInternalUrl("")).toBe(false);
    expect(isSafeInternalUrl(null)).toBe(false);
  });

  it("matches safe return workspaces according to eligibility", () => {
    const eligible = getEligibleWorkspaces(["PANELIST", "RESEARCH_COORDINATOR"]);

    // Authorized return URL for panelist
    const panelistReturn = getSafeReturnWorkspace(
      "/panelist/defenses/session-42",
      eligible
    );
    expect(panelistReturn?.id).toBe("panelist");

    // Return URL for a role user does NOT have (e.g. researcher)
    const unauthorizedReturn = getSafeReturnWorkspace("/student/dashboard", eligible);
    expect(unauthorizedReturn).toBeNull();

    // Admin user return URL without param
    const adminEligible = getEligibleWorkspaces(["DEAN"]);
    const adminReturn = getSafeReturnWorkspace("/admin/reviews", adminEligible);
    expect(adminReturn?.id).toBe("dean");
  });

  it("resolves default workspace with remembered preference", () => {
    const eligible = getEligibleWorkspaces(["PANELIST", "RESEARCH_COORDINATOR"]);

    // No preference: returns first available
    expect(getDefaultWorkspace(eligible)?.id).toBe("panelist");

    // Valid preference
    expect(getDefaultWorkspace(eligible, "coordinator")?.id).toBe("coordinator");

    // Invalid / stale preference for a removed role
    expect(getDefaultWorkspace(eligible, "dean")?.id).toBe("panelist");
  });
});
