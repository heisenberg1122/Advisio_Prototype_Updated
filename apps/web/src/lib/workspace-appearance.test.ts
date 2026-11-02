import { describe, expect, it } from "vitest";
import { workspaceViewForLocation } from "./workspace-appearance";

describe("workspace background selection", () => {
  it.each([
    "student",
    "adviser",
    "professor",
    "panelist",
    "admin",
    "system-admin",
  ])("uses the overview background for %s before content loads", (role) => {
    expect(workspaceViewForLocation(`/${role}/dashboard`)).toBe("overview");
    expect(
      workspaceViewForLocation(
        `/${role}/dashboard`,
        "?tab=overview&projectId=p1",
      ),
    ).toBe("overview");
    expect(
      workspaceViewForLocation(`/${role}/dashboard`, "?tab=settings"),
    ).toBe("page");
    expect(workspaceViewForLocation(`/${role}/inbox`)).toBe("page");
  });
  it("handles dashboard aliases and retains project and workspace context", () => {
    expect(workspaceViewForLocation("/dashboard", "?projectId=p1")).toBe(
      "overview",
    );
    expect(
      workspaceViewForLocation("/admin/dashboard", "?workspace=dean"),
    ).toBe("overview");
    expect(
      workspaceViewForLocation("/adviser/dashboard", "?tab=advisees"),
    ).toBe("page");
    expect(
      workspaceViewForLocation("/adviser/tasks/task-1", "?projectId=p1"),
    ).toBe("page");
  });
});
