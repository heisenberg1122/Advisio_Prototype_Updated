import { describe, expect, it } from "vitest";
import {
  humanizeTimestamps,
  initials,
  primaryStatus,
  shortDate,
} from "./project-overview-display";

const now = Date.parse("2026-11-07T04:00:00.000Z");

describe("shortDate", () => {
  it("drops the year for the current year and keeps it otherwise", () => {
    expect(shortDate("2026-11-06T04:00:00.000Z", now)).toBe("Nov 6");
    expect(shortDate("2025-11-06T04:00:00.000Z", now)).toBe("Nov 6, 2025");
  });

  it("adds the Manila time when asked", () => {
    expect(shortDate("2026-11-09T02:00:00.000Z", now, true)).toMatch(/^Nov 9, 10:00\s?am$/i);
  });

  it("returns nothing for invalid dates", () => {
    expect(shortDate("not a date", now)).toBe("");
  });
});

describe("humanizeTimestamps", () => {
  it("rewrites raw timestamps in activity text", () => {
    expect(
      humanizeTimestamps("Proposal revision consultation · 2026-11-09T02:00:00.000Z", now),
    ).toMatch(/^Proposal revision consultation · Nov 9, 10:00\s?am$/i);
  });

  it("leaves ordinary text and plain dates alone", () => {
    expect(humanizeTimestamps("Chapter 1 due 2026-11-09", now)).toBe("Chapter 1 due 2026-11-09");
    expect(humanizeTimestamps(undefined, now)).toBe("");
  });
});

describe("primaryStatus", () => {
  it("prefers a status that needs attention", () => {
    expect(primaryStatus("Recently updated · Latest submission · Revision required")).toEqual({
      text: "Revision required",
      attention: true,
    });
  });

  it("falls back to the first part", () => {
    expect(primaryStatus("Recently updated · Awaiting feedback")).toEqual({
      text: "Recently updated",
      attention: false,
    });
    expect(primaryStatus("")).toBeNull();
  });
});

describe("initials", () => {
  it("uses the first two names", () => {
    expect(initials("Mikaela Santos")).toBe("MS");
    expect(initials("Maria Clara de la Cruz")).toBe("MC");
    expect(initials("  ")).toBe("?");
  });
});
