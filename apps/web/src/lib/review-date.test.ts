import { describe, expect, it } from "vitest";
import { formatReviewDateTime } from "./review-date";
describe("academic activity dates", () => {
  it("shows the full Philippine date even when the stored UTC date is the previous day", () => {
    const formatted = formatReviewDateTime("2026-11-01T16:10:20Z");
    expect(formatted).toContain("Nov 2, 2026");
    expect(formatted).toContain("12:10:20");
  });
  it("does not invent a timestamp when the source is missing or invalid", () => {
    expect(formatReviewDateTime()).toBe("Not recorded");
    expect(formatReviewDateTime("invalid")).toBe("Not recorded");
  });
});
