import { describe, expect, it } from "vitest";
import { calendarDay, datePlacement, initialMonthIndex, monthBar, timelineMonths, visibleMonths, weekLabelStep } from "./gantt-layout";

describe("gantt label layout", () => {
  it("drops a month that only peeks in before the next one", () => {
    const months = [{ label: "October", start: 0 }, { label: "November", start: 4 }, { label: "December", start: 34 }];
    expect(visibleMonths(months, 105, 0.12).map((m) => m.label)).toEqual(["November", "December"]);
  });

  it("drops a month that starts too close to the end", () => {
    const months = [{ label: "May", start: 0 }, { label: "June", start: 31 }, { label: "July", start: 61 }];
    expect(visibleMonths(months, 64, 0.12).map((m) => m.label)).toEqual(["May", "June"]);
  });

  it("thins week numbers on long schedules only", () => {
    expect(weekLabelStep(15)).toBe(1);
    expect(weekLabelStep(52)).toBeGreaterThan(2);
  });

  it("lists every month across a year boundary, including quiet ones", () => {
    const months = timelineMonths([{ startDate: new Date("2026-10-11T04:00:00Z"), endDate: new Date("2027-01-14T04:00:00Z") }], "Asia/Manila");
    expect(months.map((m) => m.short)).toEqual(["Oct", "Nov", "Dec", "Jan"]);
    expect(months[3].year).toBe(2027);
  });

  it("uses the schedule's time zone for month edges", () => {
    expect(calendarDay(new Date("2026-10-31T20:00:00Z"), "Asia/Manila")).toEqual({ year: 2026, month: 10, day: 1 });
  });

  it("opens on this month, or the nearest one", () => {
    const months = timelineMonths([{ startDate: new Date("2026-10-11T04:00:00Z"), endDate: new Date("2026-12-14T04:00:00Z") }], "Asia/Manila");
    expect(initialMonthIndex(months, { year: 2026, month: 10, day: 9 })).toBe(1);
    expect(initialMonthIndex(months, { year: 2026, month: 0, day: 9 })).toBe(0);
    expect(initialMonthIndex(months, { year: 2027, month: 5, day: 9 })).toBe(2);
  });

  it("clips a milestone that crosses into another month", () => {
    const november = { year: 2026, month: 10, days: 30, label: "November", short: "Nov" };
    const bar = monthBar({ year: 2026, month: 9, day: 29 }, { year: 2026, month: 10, day: 11 }, november);
    expect(bar).toMatchObject({ left: 0, continuesBefore: true, continuesAfter: false });
    expect(bar?.width).toBeCloseTo((11 / 30) * 100);
    expect(monthBar({ year: 2026, month: 11, day: 3 }, { year: 2026, month: 11, day: 9 }, november)).toBeNull();
  });

  it("places date labels where they fit", () => {
    expect(datePlacement(10, 7, 100)).toBe("right");
    expect(datePlacement(85, 10, 100)).toBe("left");
    expect(datePlacement(2, 95, 100)).toBe("inside");
  });
});
