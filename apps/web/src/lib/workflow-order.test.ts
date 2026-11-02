import { describe, expect, it } from "vitest";
import { buildMilestoneMove } from "./workflow-order";

const stages = [
  { id: "a", topicId: "first" },
  { id: "b", topicId: "first" },
  { id: "c", topicId: "last" },
];
describe("workflow milestone movement", () => {
  it("moves up and down without losing another milestone", () => {
    expect(
      buildMilestoneMove(stages, ["first", "last"], "b", "first", "a").map(
        (stage) => stage.id,
      ),
    ).toEqual(["b", "a", "c"]);
    expect(
      buildMilestoneMove(stages, ["first", "last"], "a", "first", null).map(
        (stage) => stage.id,
      ),
    ).toEqual(["b", "a", "c"]);
  });
  it("places a milestone into an empty phase in phase order", () => {
    expect(
      buildMilestoneMove(
        stages,
        ["first", "empty", "last"],
        "a",
        "empty",
        null,
      ),
    ).toEqual([
      { id: "b", topicId: "first" },
      { id: "a", topicId: "empty" },
      { id: "c", topicId: "last" },
    ]);
  });
  it("moves across phases at the requested position", () => {
    expect(
      buildMilestoneMove(stages, ["first", "last"], "c", "first", "b"),
    ).toEqual([
      { id: "a", topicId: "first" },
      { id: "c", topicId: "first" },
      { id: "b", topicId: "first" },
    ]);
  });
  it("keeps ungrouped milestones before organized phases", () => {
    expect(
      buildMilestoneMove(stages, ["first", "last"], "c", null, null)[0],
    ).toEqual({ id: "c", topicId: null });
  });
  it("treats dropping on itself as a no-op and rejects foreign targets", () => {
    expect(
      buildMilestoneMove(stages, ["first", "last"], "a", "first", "a"),
    ).toBe(stages);
    expect(() =>
      buildMilestoneMove(stages, ["first", "last"], "a", "foreign", null),
    ).toThrow();
    expect(() =>
      buildMilestoneMove(stages, ["first", "last"], "a", "last", "b"),
    ).toThrow();
  });
});
