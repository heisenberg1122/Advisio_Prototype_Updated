import { describe, it, expect } from "vitest";
import {
  beginEvaluationIdentityChange,
  cancelEvaluationIdentityChange,
  evaluationIdentityGeneration,
  evaluationIdentityIsCurrent,
} from "./evaluation-identity";
describe("demo identity profile request races", () => {
  it("rejects profile responses issued before cookie rotation while preserving ordinary authentication", () => {
    const before = evaluationIdentityGeneration();
    expect(evaluationIdentityIsCurrent(before, "__evaluation__")).toBe(true);
    beginEvaluationIdentityChange();
    expect(evaluationIdentityIsCurrent(before, "__evaluation__")).toBe(false);
    expect(
      evaluationIdentityIsCurrent(
        evaluationIdentityGeneration(),
        "__evaluation__",
      ),
    ).toBe(false);
    expect(evaluationIdentityIsCurrent(before, "ordinary-session")).toBe(true);
    cancelEvaluationIdentityChange();
    expect(evaluationIdentityIsCurrent(before, "__evaluation__")).toBe(false);
    expect(
      evaluationIdentityIsCurrent(
        evaluationIdentityGeneration(),
        "__evaluation__",
      ),
    ).toBe(true);
  });
});
