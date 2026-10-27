import { describe, expect, it } from "vitest";
import {
  activeBuilderRequirements,
  processPublicationIssues,
  requirementConditionOptions,
} from "./process-builder";

const requirement = (
  id: string,
  sequence: number,
  topicId: string | null = null,
) => ({ id, title: id, sequence, topicId, requiresDocument: false });
describe("Process Builder publication readiness", () => {
  it("allows no Phases, fully phased, and mixed Requirements without mutating order", () => {
    for (const topics of [
      [null, null, null],
      ["phase", "phase", "phase"],
      [null, "phase", null],
    ]) {
      const items = topics
        .map((topic, i) => requirement(String(i), i + 1))
        .map((item, i) => ({ ...item, topicId: topics[i] }));
      const before = structuredClone(items);
      expect(processPublicationIssues(items)).toEqual([]);
      expect(items).toEqual(before);
    }
  });
  it("does not count Archived Requirements as active", () => {
    expect(processPublicationIssues([])).toEqual([
      "Add at least one active requirement before publishing this process.",
    ]);
    expect(
      processPublicationIssues([
        { ...requirement("Old", -1), scope: "Archived" },
      ]),
    ).toHaveLength(1);
  });
  it.each(
    [
      undefined,
      [],
      [{ isRequired: false, allowedFileTypes: "PDF" }],
      [{ isRequired: true, allowedFileTypes: "ZIP" }],
      [{ isRequired: true, allowedFileTypes: "   " }],
    ].map((tasks) => ({ tasks })),
  )("blocks unusable document configuration: $tasks", ({ tasks }) => {
    expect(
      processPublicationIssues([
        { ...requirement("Proposal", 1), requiresDocument: true, tasks },
      ])[0],
    ).toContain("usable required submission item");
  });
  it.each([
    null,
    "PDF,DOCX",
    "application/pdf",
    ".doc",
    "ZIP | TXT",
    ".application/pdf",
  ])("uses existing submission formats: %s", (allowedFileTypes) => {
    expect(
      processPublicationIssues([
        {
          ...requirement("Proposal", 1),
          requiresDocument: true,
          tasks: [{ isRequired: true, allowedFileTypes }],
        },
      ]),
    ).toEqual([]);
  });
  it("conditions use earlier global sequence regardless of Phase", () => {
    const items = [
      requirement("last", 3),
      requirement("first", 1),
      {
        ...requirement("middle", 2, "phase"),
        milestoneType: "ADVISER_SELECTION",
      },
      { ...requirement("old", -1), scope: "Archived" },
    ];
    expect(activeBuilderRequirements(items).map((item) => item.id)).toEqual([
      "first",
      "middle",
      "last",
    ]);
    expect(requirementConditionOptions(items, "last")).toEqual([
      { value: "first", label: "first" },
      { value: "middle", label: "Adviser Selection Requirement: middle" },
    ]);
    expect(requirementConditionOptions(items, "first")).toEqual([]);
    expect(requirementConditionOptions(items)).toHaveLength(3);
  });
});
