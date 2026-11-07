import { describe, expect, it } from "vitest";
import { DASHBOARD_WORKSPACES } from "@research-management/auth";
import {
  TOUR_PAGES, availableTourPages, currentTourPage, eligibleTourWorkspace, introductionTour,
  pageRouteKey, pageTour, readTourProgress, saveTourProgress, tourStorageKey,
} from "./workspace-tours";
import { withProjectContext } from "./active-project";

describe("workspace tour scope and coverage", () => {
  it.each(DASHBOARD_WORKSPACES)("uses the selected $id workspace instead of the account's first role", workspace => {
    expect(eligibleTourWorkspace({ roles: ["RESEARCHER", workspace.role], college: null }, workspace.routePrefix + "/dashboard")).toBe(workspace.id);
    const pages = TOUR_PAGES[workspace.id];
    const intro = introductionTour(workspace.id, pages);
    expect(intro.steps).toHaveLength(5);
    expect(new Set(pages.map(page => page.id)).size).toBe(pages.length);
    for (const page of pages) {
      const tour = pageTour(workspace.id, page);
      expect(tour.steps.length).toBeGreaterThanOrEqual(page.kind === "task" ? 2 : 1);
      for (const step of tour.steps) {
        expect(new URL(step.href, "https://local.test").pathname.startsWith(workspace.routePrefix + "/")).toBe(true);
        expect(step.target).toBeTruthy();
        expect(step.content.split(/\s+/).length).toBeLessThanOrEqual(20);
        if (workspace.id === "dean") expect(new URL(step.href, "https://local.test").searchParams.get("workspace")).toBe("dean");
      }
    }
  });
  it.each([["STUDENT", "/student", "researcher"], ["PROFESSOR", "/professor", "coordinator"], ["ADMIN", "/admin", "dean"]])("canonicalizes %s without creating another dashboard", (role, path, expected) => {
    expect(eligibleTourWorkspace({ roles: [role] }, path + "/dashboard")).toBe(expected);
  });
  it("does not use an approved role from a different college", () => {
    const user = { roles: ["ADVISER", "PANELIST"], college: { id: "b", code: "B", name: "B" }, collegeMemberships: [
      { college: { id: "a", code: "A", name: "A" }, roleNames: ["ADVISER"] },
      { college: { id: "b", code: "B", name: "B" }, roleNames: ["PANELIST"] },
    ] };
    expect(eligibleTourWorkspace(user, "/adviser/dashboard")).toBeNull();
    expect(eligibleTourWorkspace(user, "/panelist/dashboard")).toBe("panelist");
    expect(eligibleTourWorkspace({ ...user, college: null }, "/panelist/dashboard")).toBeNull();
  });
  it("keeps platform administrators eligible without granting unrelated college roles", () => {
    expect(eligibleTourWorkspace({ roles: ["SYSTEM_ADMIN"], collegeMemberships: [{ college: { id: "a", name: "A", code: "A" }, roleNames: [] }] }, "/system-admin/dashboard")).toBe("system-admin");
    expect(eligibleTourWorkspace({ roles: ["RESEARCHER"] }, "/panelist/dashboard")).toBeNull();
    expect(eligibleTourWorkspace({ roles: ["RESEARCHER"] }, "/student-impostor/dashboard")).toBeNull();
  });
  it("omits specialized workflows, reports and account tutorials without their permissions", () => {
    expect(availableTourPages("coordinator", []).some(page => page.id === "workflow")).toBe(false);
    expect(availableTourPages("dean", []).some(page => page.id === "reports")).toBe(false);
    expect(availableTourPages("system-admin", []).some(page => page.id === "users" || page.id === "audit")).toBe(false);
    expect(availableTourPages("coordinator", ["workflow.edit"]).some(page => page.id === "workflow")).toBe(true);
    expect(introductionTour("system-admin", availableTourPages("system-admin", [])).steps).toHaveLength(5);
  });
  it("recognizes actual query tabs, group sections, nested tasks and legacy aliases", () => {
    expect(pageRouteKey("/student/dashboard?tab=group&projectId=p1")).not.toBe(pageRouteKey("/student/dashboard?tab=group&section=my-group&projectId=p1"));
    expect(pageRouteKey("/student/dashboard?tab=version-control")).toBe(pageRouteKey("/student/dashboard?tab=submissions"));
    expect(currentTourPage(TOUR_PAGES.researcher, "/student/tasks/real-task?projectId=real-project")?.href).toBe("/student/tasks/real-task?projectId=real-project");
    expect(currentTourPage(TOUR_PAGES.panelist, "/panelist/dashboard?tab=evaluation")?.id).toBe("evaluations");
    expect(currentTourPage(TOUR_PAGES.panelist, "/panelist/dashboard?tab=grades")?.id).toBe("results");
    expect(currentTourPage(TOUR_PAGES.researcher, "/student/consultations?projectId=p1")?.id).toBe("consultations");
    expect(currentTourPage(TOUR_PAGES.researcher, "/student/profile")).toBeUndefined();
    expect(currentTourPage(TOUR_PAGES.adviser, "/adviser/advisees/assigned-project")?.href).toBe("/adviser/advisees/assigned-project");
    expect(currentTourPage(TOUR_PAGES.panelist, "/panelist/defenses/assigned-defense")?.href).toBe("/panelist/defenses/assigned-defense");
  });
  it("retains the chosen project without inventing another project or group", () => {
    for (const page of TOUR_PAGES.researcher) {
      const href = withProjectContext(page.href, "project-in-active-college");
      expect(new URL(href, "https://local.test").searchParams.get("projectId")).toBe("project-in-active-college");
    }
  });
  it("limits interactive spotlights to verified view-only controls", () => {
    const safe = new Set(["calendar-navigation", "page-filter", "audit-filters", "report-selection"]);
    for (const [workspace, pages] of Object.entries(TOUR_PAGES)) {
      for (const page of pages) for (const step of pageTour(workspace as keyof typeof TOUR_PAGES, page).steps) {
        if (step.interactive) expect(safe.has(step.target)).toBe(true);
        expect(Object.keys(step).some(key => /submit|mutation|request|click/i.test(key))).toBe(false);
      }
    }
  });
});

describe("versioned tour progress", () => {
  const scope = { userId: "person:1", collegeId: "CIT", workspace: "researcher" as const };
  it("isolates users, colleges, workspaces and evaluation sessions", () => {
    const keys = [scope, { ...scope, userId: "person:2" }, { ...scope, collegeId: "CEA" }, { ...scope, workspace: "adviser" as const }, { ...scope, evaluationSession: "respondent-1" }, { ...scope, evaluationSession: "respondent-2" }].map(item => tourStorageKey(item, "intro"));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[0]).toContain(":v2:");
  });
  it("distinguishes completion from dismissal and ignores corrupt/legacy values", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const key = tourStorageKey(scope, "intro");
    expect(readTourProgress(storage, key)).toBeNull();
    saveTourProgress(storage, key, "dismissed"); expect(readTourProgress(storage, key)).toBe("dismissed");
    saveTourProgress(storage, key, "completed"); expect(readTourProgress(storage, key)).toBe("completed");
    values.set(key, "invalid"); expect(readTourProgress(storage, key)).toBeNull();
    expect(() => saveTourProgress({ setItem: () => { throw new Error("Blocked"); } }, key, "completed")).not.toThrow();
    expect(readTourProgress({ getItem: () => { throw new Error("Blocked"); } }, key)).toBeNull();
  });
});
