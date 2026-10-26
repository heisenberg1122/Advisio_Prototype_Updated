import { describe, expect, it } from "vitest";
import { workflowPublicationIssues } from "./workflow-publication.service.js";

describe("workflowPublicationIssues", () => {
  it("accepts a complete workflow", () => {
    expect(
      workflowPublicationIssues({
        topics: [{ id: "topic" }],
        stages: [
          {
            name: "Proposal",
            topicId: "topic",
            category: "Milestone",
            requiresDocument: true,
            tasks: [{ isRequired: true }],
          },
        ],
      }),
    ).toEqual([]);
  });

  it("reports incomplete draft requirements before publication", () => {
    expect(
      workflowPublicationIssues({
        topics: [],
        stages: [
          {
            name: "Proposal",
            topicId: null,
            category: "Milestone",
            requiresDocument: true,
            tasks: [{ isRequired: false }],
          },
        ],
      }),
    ).toEqual([
      "Add at least one workflow topic.",
      "Assign “Proposal” to a workflow topic.",
      "Add at least one required submission to “Proposal”.",
    ]);
  });

  it("ignores preserved archived milestones", () => {
    expect(
      workflowPublicationIssues({
        topics: [{ id: "topic" }],
        stages: [
          {
            name: "Preserved history",
            topicId: null,
            category: "Archived",
            requiresDocument: true,
            tasks: [],
          },
          {
            name: "Orientation",
            topicId: "topic",
            category: "Milestone",
            requiresDocument: false,
            tasks: [],
          },
        ],
      }),
    ).toEqual([]);
  });
});
