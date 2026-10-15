import { describe, expect, it } from "vitest";
import { calculateMilestoneProgress } from "./workflow-progress";

describe("calculateMilestoneProgress", () => {
  it("uses completed mandatory requirements instead of the current stage position", () => {
    expect(calculateMilestoneProgress([
      { completedRequirements: 2, totalRequirements: 2 },
      { completedRequirements: 1, totalRequirements: 3 },
    ])).toBe(60);
  });

  it("returns zero when no milestone requirements exist", () => {
    expect(calculateMilestoneProgress([])).toBe(0);
  });

  it("reports a completed workflow as complete", () => {
    expect(calculateMilestoneProgress([], true)).toBe(100);
  });
});
