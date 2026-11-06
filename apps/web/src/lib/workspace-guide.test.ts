import { describe, expect, it } from "vitest";
import { workspaceGuide } from "./workspace-guide";
import { withProjectContext } from "./active-project";

describe("workspace help", () => {
  it.each([
    ["student", "Researcher"], ["adviser", "Adviser"], ["panelist", "Panelist"],
    ["professor", "Professor Coordinator"], ["admin", "Dean’s Office"], ["system-admin", "System Administration"],
  ])("keeps %s guidance and destinations within the current role", (prefix, role) => {
    const guide = workspaceGuide(`/${prefix}/dashboard`);
    expect(guide.role).toBe(role);
    expect(guide.steps.length).toBeGreaterThanOrEqual(3);
    for (const step of guide.steps) {
      expect(step.href.startsWith(`/${prefix}/`)).toBe(true);
      expect(step.action).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it("keeps project context when opening a researcher guide destination", () => {
    const step = workspaceGuide("/student/tasks").steps[0];
    const target = new URL(withProjectContext(step.href, "project-1"), "https://local.test");
    expect(target.searchParams.get("projectId")).toBe("project-1");
    expect(target.searchParams.get("tab")).toBe("group");
  });

  it.each(["student", "adviser", "panelist", "professor", "admin", "system-admin"])(
    "shows calendar help in the %s calendar", prefix => {
      expect(workspaceGuide(`/${prefix}/calendar`).page.title).toBe("Using your calendar");
    },
  );

  it("explains the difference between drafts and task submissions", () => {
    expect(workspaceGuide("/student/documents").page.description).toContain("related task");
    expect(workspaceGuide("/student/tasks/t1").page.title).toBe("Working on a requirement");
  });

  it("resolves help from the active tab instead of the dashboard URL alone", () => {
    expect(workspaceGuide("/panelist/dashboard", "?tab=evaluation").page.title).toBe("Completing an evaluation");
    expect(workspaceGuide("/system-admin/dashboard", "?tab=logs").page.title).toBe("Reading the audit trail");
    expect(workspaceGuide("/student/dashboard", "?tab=submissions&projectId=p1").page.title).toBe("Working with documents");
  });

  it("preserves the Dean workspace in guide links", () => {
    for (const step of workspaceGuide("/admin/dashboard", "?workspace=dean").steps) {
      expect(new URL(step.href, "https://local.test").searchParams.get("workspace")).toBe("dean");
    }
  });
});
