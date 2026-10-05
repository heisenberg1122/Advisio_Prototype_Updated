import { describe, expect, it } from "vitest";
import { createWorkflowSchema } from "./workflow.js";

describe("createWorkflowSchema", () => {
  it("allows an empty draft workflow", () => {
    const result = createWorkflowSchema.parse({
      researchTypeId: "7ab0d87e-30fd-4df9-a324-0338e894598b",
      name: "BSIT Capstone Workflow",
    });
    expect(result.stages).toEqual([]);
  });

  it("trims and validates the workflow name", () => {
    const result = createWorkflowSchema.parse({
      researchTypeId: "7ab0d87e-30fd-4df9-a324-0338e894598b",
      name: "  Department Research Workflow  ",
    });
    expect(result.name).toBe("Department Research Workflow");
  });
});
