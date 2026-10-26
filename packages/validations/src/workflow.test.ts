import { describe, expect, it } from "vitest";
import {
  createWorkflowSchema,
  createWorkflowTopicSchema,
  reorderWorkflowMilestonesSchema,
  updateWorkflowTopicSchema,
} from "./workflow.js";

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

  it("allows one adviser milestone and rejects duplicates", () => {
    const adviserStage = {
      name: "Select an adviser",
      sequence: 1,
      responsibleRoleId: "7ab0d87e-30fd-4df9-a324-0338e894598b",
      milestoneType: "ADVISER_SELECTION" as const,
      requiresDocument: false,
      requiresApproval: true,
      submissionMode: "GROUP" as const,
    };
    const base = {
      researchTypeId: "7ab0d87e-30fd-4df9-a324-0338e894598b",
      name: "BSIT Capstone Workflow",
    };

    expect(
      createWorkflowSchema.parse({ ...base, stages: [adviserStage] }).stages,
    ).toHaveLength(1);
    expect(() =>
      createWorkflowSchema.parse({
        ...base,
        stages: [adviserStage, { ...adviserStage, sequence: 2 }],
      }),
    ).toThrow("A workflow can contain only one Adviser Milestone.");
  });
});

describe("workflow topic schemas", () => {
  it("trims a topic title and accepts an optional description", () => {
    expect(
      createWorkflowTopicSchema.parse({
        title: "  Title Defense  ",
        description: "  Proposal chapters  ",
      }),
    ).toEqual({ title: "Title Defense", description: "Proposal chapters" });
  });

  it("requires an update to contain a changed field", () => {
    expect(() => updateWorkflowTopicSchema.parse({})).toThrow();
  });
});

describe("workflow milestone reorder schema", () => {
  it("allows ordered milestones to move into a topic or Needs organization", () => {
    expect(
      reorderWorkflowMilestonesSchema.parse({
        milestones: [
          {
            id: "7ab0d87e-30fd-4df9-a324-0338e894598b",
            topicId: "5fb5ec70-89a0-4b8e-8fea-c917782c01ea",
          },
          {
            id: "5a69fb14-1cd4-4384-a20e-73a1bf6f3b25",
            topicId: null,
          },
        ],
      }).milestones,
    ).toHaveLength(2);
  });

  it("rejects an empty milestone order", () => {
    expect(() =>
      reorderWorkflowMilestonesSchema.parse({ milestones: [] }),
    ).toThrow();
  });
});
