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
      "“Proposal” requires at least one usable required submission item before this process can be published.",
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

  const standard = {
    name: "Orientation",
    topicId: null,
    category: "Milestone",
    requiresDocument: false,
    tasks: [],
  };
  it("publishes an active standard Requirement with no Phase and no child task", () => {
    expect(
      workflowPublicationIssues({ topics: [], stages: [standard] }),
    ).toEqual([]);
  });
  it("publishes mixed phased/unphased Requirements without changing their definitions", () => {
    const process = {
      topics: [{ id: "phase" }],
      stages: [
        standard,
        { ...standard, name: "Proposal", topicId: "phase" },
        { ...standard, name: "Ethics" },
      ],
    };
    const before = structuredClone(process);
    expect(workflowPublicationIssues(process)).toEqual([]);
    expect(process).toEqual(before);
  });
  it.each([
    { stages: [] },
    { stages: [{ ...standard, category: "Archived" }] },
  ])("rejects zero active Requirements: %s", ({ stages }) => {
    expect(workflowPublicationIssues({ topics: [], stages })).toEqual([
      "Add at least one active requirement before publishing this process.",
    ]);
  });
  it.each(
    [
      [],
      [{ isRequired: false }],
      [{ isRequired: true, allowedFileTypes: "EXE,ZIP" }],
      [{ isRequired: true, allowedFileTypes: " , ; " }],
    ].map((tasks) => ({ tasks })),
  )("requires a usable required document Submission Item: %s", ({ tasks }) => {
    expect(
      workflowPublicationIssues({
        topics: [],
        stages: [
          { ...standard, name: "Proposal", requiresDocument: true, tasks },
        ],
      }),
    ).toEqual([
      "“Proposal” requires at least one usable required submission item before this process can be published.",
    ]);
  });
  it.each([
    undefined,
    null,
    "PDF,DOCX",
    ".pdf",
    "text/plain",
    "DOC",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "ZIP|TXT",
  ])(
    "uses the existing document format contract for %s",
    (allowedFileTypes) => {
      expect(
        workflowPublicationIssues({
          topics: [],
          stages: [
            {
              ...standard,
              requiresDocument: true,
              tasks: [{ isRequired: true, allowedFileTypes }],
            },
          ],
        }),
      ).toEqual([]);
    },
  );
  it("ignores archived invalid document Requirements when an active Requirement exists", () => {
    expect(
      workflowPublicationIssues({
        topics: [],
        stages: [
          standard,
          { ...standard, category: "Archived", requiresDocument: true },
        ],
      }),
    ).toEqual([]);
  });
});
