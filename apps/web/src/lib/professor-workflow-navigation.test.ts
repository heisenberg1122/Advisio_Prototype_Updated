import { describe, expect, it } from "vitest";
import { professorWorkflowSelectionUrl, resolveProfessorWorkflowId } from "./professor-workflow-navigation";

const workflows = [{ id: "one" }, { id: "two" }];

describe("professor workflow navigation", () => {
  it("switches away from a workflow pinned by a section link without leaving the section", () => {
    const url = professorWorkflowSelectionUrl("tab=builder&workflowView=participants&workflowId=one", "two");
    const params = new URL(url, "http://localhost").searchParams;
    expect(params.get("tab")).toBe("builder");
    expect(params.get("workflowView")).toBe("participants");
    expect(resolveProfessorWorkflowId(workflows, params.get("workflowId")!)).toBe("two");
  });

  it("preserves resources and other filters while changing workflows", () => {
    const url = professorWorkflowSelectionUrl("tab=builder&workflowView=resources&filter=active&workflowId=one", "two");
    expect(url).toContain("workflowView=resources");
    expect(url).toContain("filter=active");
    expect(url).toContain("workflowId=two");
  });

  it("resolves selection from restored URLs without stale local state", () => {
    for (const id of ["one", "two", "one"]) {
      expect(resolveProfessorWorkflowId(workflows, id)).toBe(id);
    }
    expect(resolveProfessorWorkflowId([...workflows, { id: "new" }], "new")).toBe("new");
  });

  it("falls back safely for missing, invalid, or deleted workflow IDs", () => {
    expect(resolveProfessorWorkflowId(workflows, "")).toBe("one");
    expect(resolveProfessorWorkflowId(workflows, "deleted")).toBe("one");
    expect(resolveProfessorWorkflowId([], "one")).toBe("");
  });
});
