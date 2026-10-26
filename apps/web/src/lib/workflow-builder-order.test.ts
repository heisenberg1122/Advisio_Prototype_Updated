import { describe, expect, it } from "vitest";
import {
  moveWorkflowMilestone,
  moveWorkflowTopic,
} from "./workflow-builder-order";

const topics = ["topic-a", "topic-b"];
const milestones = [
  { id: "a-1", topicId: "topic-a", sequence: 1 },
  { id: "a-2", topicId: "topic-a", sequence: 2 },
  { id: "b-1", topicId: "topic-b", sequence: 3 },
  { id: "loose", topicId: null, sequence: 4 },
];

describe("workflow builder ordering", () => {
  it("reorders milestones inside a topic", () => {
    const result = moveWorkflowMilestone(
      milestones,
      topics,
      "a-1",
      "topic-a",
      2,
    );

    expect(result.map((item) => item.id)).toEqual([
      "a-2",
      "a-1",
      "b-1",
      "loose",
    ]);
    expect(result.map((item) => item.sequence)).toEqual([1, 2, 3, 4]);
  });

  it("moves milestones across topics at the requested drop position", () => {
    const result = moveWorkflowMilestone(
      milestones,
      topics,
      "a-2",
      "topic-b",
      0,
    );

    expect(result.map((item) => [item.id, item.topicId])).toEqual([
      ["a-1", "topic-a"],
      ["a-2", "topic-b"],
      ["b-1", "topic-b"],
      ["loose", null],
    ]);
  });

  it("moves milestones into Needs organization", () => {
    const result = moveWorkflowMilestone(
      milestones,
      topics,
      "b-1",
      null,
      1,
    );

    expect(result.map((item) => [item.id, item.topicId])).toEqual([
      ["a-1", "topic-a"],
      ["a-2", "topic-a"],
      ["loose", null],
      ["b-1", null],
    ]);
  });

  it("reorders topics using insertion drop positions", () => {
    expect(
      moveWorkflowTopic(
        [{ id: "one" }, { id: "two" }, { id: "three" }],
        "one",
        3,
      ).map((topic) => topic.id),
    ).toEqual(["two", "three", "one"]);
  });
});
