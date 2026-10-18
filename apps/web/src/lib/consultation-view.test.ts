import { describe, expect, it } from "vitest";
import { consultationViewModel, nextConsultation } from "./consultation-view";

const meeting = (id: string, status: string, start: string) =>
  consultationViewModel({
    id,
    title: "Advising",
    status,
    scheduledStart: start,
    scheduledEnd: new Date(new Date(start).getTime() + 3600000).toISOString(),
  });
describe("consultation page data contract", () => {
  it("normalizes completed sessions into visible history entries", () => {
    expect(meeting("done", "completed", "2026-10-18T17:00:00Z")).toMatchObject({
      status: "done",
      duration: "60 min",
    });
  });
  it("formats Manila dates and provides the fields rendered by the cards", () => {
    const view = meeting("next", "scheduled", "2026-10-18T17:00:00Z");
    expect(view.date).toContain("19");
    expect(view.timeRange).toMatch(/01:00|1:00/);
    expect(view.adviser).toBeTruthy();
  });
  it("selects the nearest eligible future meeting, excluding past and cancelled sessions", () => {
    const items = [
      meeting("later", "scheduled", "2026-10-20T00:00:00Z"),
      meeting("past", "scheduled", "2026-10-17T00:00:00Z"),
      meeting("cancelled", "cancelled", "2026-10-18T01:00:00Z"),
      meeting("next", "requested", "2026-10-18T02:00:00Z"),
    ];
    expect(
      nextConsultation(items, Date.parse("2026-10-18T00:00:00Z"))?.id,
    ).toBe("next");
  });
});
