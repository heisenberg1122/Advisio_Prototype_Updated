import { describe, expect, it } from "vitest";
import { buildResearcherJourney } from "./researcher-walkthroughs";
import type { ResearcherGuideState } from "./researcher-guide";
import { workspaceOrientation, type OrientationWorkspace } from "./workspace-orientation";
import { loadOrientationProgress, matchesOrientationRoute, orientationProgressKey, orientationSamplePath, saveOrientationProgress } from "./orientation-progress";

const permissions = ["workflow.edit", "dean.report", "user.manage", "system.configure", "role.manage", "audit.view"];
const roles: [OrientationWorkspace, string, number][] = [
  ["adviser", "/adviser", 8], ["panelist", "/panelist", 8], ["coordinator", "/professor", 13],
  ["dean", "/admin", 13], ["system-admin", "/system-admin", 11],
];

describe("workspace orientation", () => {
  it.each(roles)("starts %s at Home and keeps its destinations in scope", (role, prefix, count) => {
    const chapters = workspaceOrientation(role, permissions);
    const steps = chapters.flatMap(chapter => chapter.steps);
    expect(chapters).toHaveLength(count);
    expect(chapters[0].id).toBe("home");
    expect(steps[0].route).toBe(prefix + "/dashboard" + (role === "dean" ? "?workspace=dean" : ""));
    expect(chapters[0].steps.at(-1)?.prepare).toBe("sidebar");
    expect(new Set(steps.map(step => step.id)).size).toBe(steps.length);
    for (const step of steps) {
      const url = new URL(step.route, "https://advisio.local");
      expect(url.pathname.startsWith(prefix + "/")).toBe(true);
      expect(url.searchParams.get("workspace")).toBe(role === "dean" ? "dean" : null);
    }
    expect(steps.at(-1)?.id).toMatch(/:future-help$/);
  });

  it("includes only authorized chapters and opens existing workflows before creation", () => {
    expect(workspaceOrientation("dean", []).some(chapter => chapter.id === "reports")).toBe(false);
    expect(workspaceOrientation("system-admin", ["audit.view"]).map(chapter => chapter.id)).toEqual([
      "home", "announcements", "audit", "calendar-inbox", "settings",
    ]);
    expect(workspaceOrientation("coordinator", []).some(chapter => chapter.id === "workflow")).toBe(false);
    const workflow = workspaceOrientation("coordinator", permissions).find(chapter => chapter.id === "workflow");
    expect(workflow?.steps.map(step => step.id)).toEqual([
      "workflow:existing", "workflow:requirements", "workflow:participants", "workflow:resources", "workflow:publication", "workflow:create",
    ]);
    expect(workflow?.steps.every(step => step.targets.every(target => !target.interaction))).toBe(true);
  });

  it("matches the intended view, including nested tabs and Dean scope", () => {
    expect(matchesOrientationRoute("/professor/dashboard?tab=builder&workflowId=w1", "/professor/dashboard?tab=builder")).toBe(true);
    expect(matchesOrientationRoute("/professor/dashboard?tab=builder", "/professor/dashboard?tab=builder&workflowView=participants")).toBe(false);
    expect(matchesOrientationRoute("/professor/dashboard?tab=submissions", "/professor/dashboard?tab=submissions&submissionView=deadlines")).toBe(false);
    expect(matchesOrientationRoute("/adviser/advisees/a1", "/adviser/advisees/a1?section=milestones")).toBe(false);
    expect(matchesOrientationRoute("/admin/dashboard?tab=reports", "/admin/dashboard?tab=reports&workspace=dean")).toBe(false);
    expect(matchesOrientationRoute("/admin/reviews?workspace=dean", "/admin/reviews?workspace=dean&orientationReview=r1")).toBe(false);
  });

  it("accepts only record paths and IDs for the expected workspace", () => {
    expect(orientationSamplePath("advisee", "/adviser/advisees/a-1", "")).toBe("/adviser/advisees/a-1");
    expect(orientationSamplePath("advisee", "/adviser/advisees/a-1?delete=1", "")).toBeNull();
    expect(orientationSamplePath("defense", "//other.example/panelist/defenses/a1", "")).toBeNull();
    expect(orientationSamplePath("defense", "/panelist/defenses/%2e%2e", "")).toBeNull();
    expect(orientationSamplePath("review", "r-1", "/admin/reviews?workspace=dean")).toBe("/admin/reviews?workspace=dean&orientationReview=r-1");
    expect(orientationSamplePath("review", "r-1&other=2", "/admin/reviews")).toBeNull();
    expect(orientationSamplePath("review", "r-1", "https://other.example/admin/reviews")).toBeNull();
  });

  it("scopes progress, replaces a paused cursor on completion and tolerates bad storage", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const key = orientationProgressKey("user-a:college-a:dean");
    saveOrientationProgress(storage, key, { stepId: "reports:preview" });
    expect(loadOrientationProgress(storage, key)).toEqual({ stepId: "reports:preview" });
    expect(loadOrientationProgress(storage, orientationProgressKey("user-a:college-b:dean"))).toBeNull();
    expect(loadOrientationProgress(storage, orientationProgressKey("user-b:college-a:dean"))).toBeNull();
    saveOrientationProgress(storage, key, { completed: true });
    expect(loadOrientationProgress(storage, key)).toEqual({ completed: true });
    expect(loadOrientationProgress({ getItem: () => "broken" }, key)).toBeNull();
  });

  it("preserves the existing Researcher introduction and task entry", () => {
    const state: ResearcherGuideState = {
      projectKnown: true, projectCount: 1, projectId: "p1", hasGroup: true, memberCount: 2,
      isLeader: false, hasAdviser: true, classAccess: "joined", enrollmentCount: 1,
      hasDocuments: true, documentsKnown: true, requestError: false,
    };
    const intro = buildResearcherJourney("introduction", state, "/student/dashboard");
    expect(intro.steps[0].targets.map(target => target.key)).toContain("researcher-home-heading");
    expect(intro.steps[0].route).toBe("/student/dashboard");
    const task = buildResearcherJourney("submit", state, "/student/dashboard");
    expect(task.steps[0].targets[0].key).toBe("nav-tasks");
  });
});
