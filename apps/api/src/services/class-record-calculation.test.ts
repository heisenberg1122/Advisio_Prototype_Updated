import { describe, expect, it } from "vitest";
import {
  calculateClassPeriod,
  type RecordScore,
} from "./class-record-calculation.js";
const item = (
  score: number | null,
  maxPoints = 100,
  kind = "INDIVIDUAL",
  state = score === null ? "UNGRADED" : "GRADED",
): RecordScore => ({ score, maxPoints, kind, state });
describe("class record calculations", () => {
  it("uses earned/possible points, not an average of percentages", () => {
    expect(
      calculateClassPeriod([item(10, 10), item(50, 100)], [], null, 100),
    ).toMatchObject({ score: 54.55, complete: true });
  });
  it("counts Missing as zero and excludes Excused from possible points", () => {
    expect(
      calculateClassPeriod(
        [
          item(80),
          item(0, 100, "INDIVIDUAL", "MISSING"),
          item(null, 100, "INDIVIDUAL", "EXCUSED"),
        ],
        [],
        null,
        100,
      ),
    ).toMatchObject({ score: 40, complete: true });
  });
  it("keeps ungraded work and unmarked attendance incomplete", () => {
    expect(
      calculateClassPeriod([item(80), item(null)], [null], null, 100),
    ).toMatchObject({ score: 80, complete: false, graded: 1 });
  });
  it("records attendance without changing total-points grades", () => {
    expect(
      calculateClassPeriod([item(90)], ["ABSENT", "ABSENT"], null, 100),
    ).toMatchObject({
      score: 90,
      complete: true,
      attendance: { absent: 2, percentage: 0 },
    });
  });
  it("combines individual, shared milestone and attendance using configured weights", () => {
    expect(
      calculateClassPeriod(
        [item(85, 100, "MILESTONE"), item(92)],
        ["PRESENT", "LATE", "ABSENT", "EXCUSED"],
        { MILESTONE: 60, INDIVIDUAL: 30, ATTENDANCE: 10 },
        50,
      ),
    ).toMatchObject({
      score: 83.6,
      complete: true,
      attendance: { percentage: 50, excused: 1 },
    });
  });
  it("does not silently reweight an empty required category", () => {
    expect(
      calculateClassPeriod(
        [item(100)],
        [],
        { MILESTONE: 50, INDIVIDUAL: 50, ATTENDANCE: 0 },
        100,
      ),
    ).toMatchObject({ score: null, complete: false });
  });
  it("does not turn an empty record or all excused activities into a grade", () => {
    for (const items of [[], [item(null, 100, "INDIVIDUAL", "EXCUSED")]])
      expect(calculateClassPeriod(items, [], null, 100)).toMatchObject({
        score: null,
        complete: false,
      });
  });
});
