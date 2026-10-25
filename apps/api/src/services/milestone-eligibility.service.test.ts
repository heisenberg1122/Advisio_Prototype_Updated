import { describe, expect, it } from "vitest";
import {
  evaluateMilestoneGraph,
  validatePrerequisiteGraph,
  type MilestoneNode,
} from "./milestone-eligibility.service.js";

const node = (
  id: string,
  overrides: Partial<MilestoneNode> = {},
): MilestoneNode => ({
  id,
  name: id,
  sequence: 1,
  requiresApproval: true,
  prerequisiteIds: [],
  ownRequirementsSatisfied: false,
  generation: 0,
  decision: "PENDING",
  approvalBasis: null,
  ...overrides,
});

describe("group milestone prerequisite eligibility", () => {
  it("makes an Independent milestone available even in a later topic/sequence", () => {
    const result = evaluateMilestoneGraph(
      [node("later", { sequence: 9 })],
      "PREREQUISITES",
      1,
    );
    expect(result.get("later")).toMatchObject({
      locked: false,
      completed: false,
    });
  });
  it("retains sequence locks for legacy workflows", () => {
    expect(
      evaluateMilestoneGraph(
        [node("later", { sequence: 9 })],
        "LEGACY_SEQUENCE",
        1,
      ).get("later")?.locked,
    ).toBe(true);
  });
  it("requires every selected prerequisite to currently pass", () => {
    const a = node("a", { ownRequirementsSatisfied: true });
    const b = node("b");
    const defense = node("defense", { prerequisiteIds: ["a", "b"] });
    expect(
      evaluateMilestoneGraph([a, b, defense], "PREREQUISITES", 1).get(
        "defense",
      ),
    ).toMatchObject({ locked: true, unmetPrerequisiteIds: ["b"] });
    b.ownRequirementsSatisfied = true;
    expect(
      evaluateMilestoneGraph([a, b, defense], "PREREQUISITES", 1).get("defense")
        ?.locked,
    ).toBe(false);
  });
  it("blocks transitive dependents while leaving independent work available", () => {
    const results = evaluateMilestoneGraph(
      [
        node("title"),
        node("proposal", {
          prerequisiteIds: ["title"],
          ownRequirementsSatisfied: true,
        }),
        node("defense", { prerequisiteIds: ["proposal"] }),
        node("ethics", { sequence: 8 }),
      ],
      "PREREQUISITES",
      1,
    );
    expect(results.get("proposal")).toMatchObject({
      completed: false,
      locked: true,
    });
    expect(results.get("defense")?.locked).toBe(true);
    expect(results.get("ethics")?.locked).toBe(false);
  });
  it("does not revive a downstream approval based on an old prerequisite generation", () => {
    const results = evaluateMilestoneGraph(
      [
        node("title", { ownRequirementsSatisfied: true, generation: 1 }),
        node("defense", {
          prerequisiteIds: ["title"],
          ownRequirementsSatisfied: true,
          decision: "APPROVED",
          approvalBasis: { title: 0 },
        }),
      ],
      "PREREQUISITES",
      1,
    );
    expect(results.get("defense")).toMatchObject({
      locked: false,
      completed: false,
      needsRevalidation: true,
    });
  });
  it("detects changes in transitive approval generations", () => {
    const results = evaluateMilestoneGraph(
      [
        node("title", { ownRequirementsSatisfied: true, generation: 2 }),
        node("proposal", {
          prerequisiteIds: ["title"],
          ownRequirementsSatisfied: true,
        }),
        node("defense", {
          prerequisiteIds: ["proposal"],
          ownRequirementsSatisfied: true,
          decision: "APPROVED",
          approvalBasis: { proposal: 0, title: 1 },
        }),
      ],
      "PREREQUISITES",
      1,
    );
    expect(results.get("defense")?.needsRevalidation).toBe(true);
  });
  it("keeps group evaluations isolated", () => {
    const defense = node("defense", { prerequisiteIds: ["title"] });
    expect(
      evaluateMilestoneGraph(
        [node("title", { ownRequirementsSatisfied: true }), defense],
        "PREREQUISITES",
        1,
      ).get("defense")?.locked,
    ).toBe(false);
    expect(
      evaluateMilestoneGraph([node("title"), defense], "PREREQUISITES", 1).get(
        "defense",
      )?.locked,
    ).toBe(true);
  });
  it("rejects self-references, cycles, foreign/missing targets and duplicate links", () => {
    for (const nodes of [
      [{ id: "a", prerequisiteIds: ["a"] }],
      [
        { id: "a", prerequisiteIds: ["b"] },
        { id: "b", prerequisiteIds: ["c"] },
        { id: "c", prerequisiteIds: ["a"] },
      ],
      [{ id: "a", prerequisiteIds: ["foreign"] }],
      [
        { id: "a", prerequisiteIds: ["b", "b"] },
        { id: "b", prerequisiteIds: [] },
      ],
    ])
      expect(() => validatePrerequisiteGraph(nodes)).toThrow();
  });
  it("accepts a shared prerequisite and fails closed on corrupt cycles", () => {
    expect(() =>
      validatePrerequisiteGraph([
        { id: "a", prerequisiteIds: [] },
        { id: "b", prerequisiteIds: ["a"] },
        { id: "c", prerequisiteIds: ["a", "b"] },
      ]),
    ).not.toThrow();
    const result = evaluateMilestoneGraph(
      [
        node("a", { prerequisiteIds: ["b"], ownRequirementsSatisfied: true }),
        node("b", { prerequisiteIds: ["a"], ownRequirementsSatisfied: true }),
      ],
      "PREREQUISITES",
      1,
    );
    expect(
      [...result.values()].every((stage) => !stage.completed && stage.locked),
    ).toBe(true);
  });
});
