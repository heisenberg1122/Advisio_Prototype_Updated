import { describe, expect, it } from "vitest";
import {
  buildComingUp,
  buildJourney,
  buildLatestUpdates,
  calendarDaysUntil,
  dueLabel,
  journeyPosition,
  memberInitials,
  nextStepVisual,
  relativeDays,
} from "./researcher-home";

const now = Date.parse("2026-11-07T04:00:00.000Z"); // Nov 7, 12:00 noon in Manila

describe("Manila calendar days", () => {
  it("counts calendar days in Manila, not elapsed 24-hour periods", () => {
    // Nov 7 23:30 Manila to Nov 8 00:30 Manila is one hour but a new day.
    expect(
      calendarDaysUntil(
        new Date("2026-11-07T16:30:00.000Z"),
        Date.parse("2026-11-07T15:30:00.000Z"),
      ),
    ).toBe(1);
  });

  it("describes today, tomorrow, later, and past dates", () => {
    expect(relativeDays(new Date("2026-11-07T09:00:00.000Z"), now)).toBe("today");
    expect(relativeDays(new Date("2026-11-08T04:00:00.000Z"), now)).toBe("tomorrow");
    expect(relativeDays(new Date("2026-11-12T04:00:00.000Z"), now)).toBe("in 5 days");
    expect(relativeDays(new Date("2026-11-06T04:00:00.000Z"), now)).toBe("1 day ago");
  });

  it("formats a due label", () => {
    expect(dueLabel(new Date("2026-11-12T04:00:00.000Z"), now)).toBe(
      "Due Nov 12, in 5 days",
    );
  });
});

describe("buildComingUp", () => {
  const items = [
    { id: "d2", kind: "deadline" as const, title: "Chapter 3", date: "2026-11-20T04:00:00.000Z", href: "/d2" },
    { id: "c1", kind: "consultation" as const, title: "Adviser meeting", date: "2026-11-14T06:00:00.000Z", href: "/c1", mode: "Online" },
    { id: "d1", kind: "deadline" as const, title: "Protocol", date: "2026-11-12T04:00:00.000Z", href: "/d1" },
  ];

  it("merges deadlines and sessions, soonest first", () => {
    expect(buildComingUp(items, now).map(({ id }) => id)).toEqual([
      "deadline-d1",
      "consultation-c1",
      "deadline-d2",
    ]);
  });

  it("marks only deadlines within seven days as urgent", () => {
    const [protocol, meeting, chapter] = buildComingUp(items, now);
    expect(protocol.urgent).toBe(true);
    expect(meeting.urgent).toBe(false);
    expect(chapter.urgent).toBe(false);
  });

  it("shows a due phrase for deadlines and a time and mode for sessions", () => {
    const [protocol, meeting] = buildComingUp(items, now);
    expect(protocol.detail).toBe("Due in 5 days");
    expect(meeting.detail).toMatch(/2:00\s?pm, Online/i);
    expect([protocol.month, protocol.day]).toEqual(["Nov", "12"]);
  });

  it("keeps overdue deadlines at the top and labels them", () => {
    const [late, ...rest] = buildComingUp(
      [
        ...items,
        { id: "late", kind: "deadline" as const, title: "Ethics form", date: "2026-11-05T04:00:00.000Z", href: "/late" },
      ],
      now,
    );
    expect(late).toMatchObject({
      id: "deadline-late",
      detail: "Overdue by 2 days",
      overdue: true,
      urgent: true,
    });
    expect(rest.every(({ overdue }) => !overdue)).toBe(true);
  });

  it("says due today on the deadline day without calling it overdue", () => {
    const [today] = buildComingUp(
      [{ id: "t", kind: "deadline" as const, title: "Today", date: "2026-11-07T01:00:00.000Z", href: "/t" }],
      now,
    );
    expect(today).toMatchObject({ detail: "Due today", overdue: false });
  });

  it("applies the limit and ignores invalid dates", () => {
    expect(buildComingUp(items, now, 2)).toHaveLength(2);
    expect(
      buildComingUp([{ ...items[0], date: "not a date" }], now),
    ).toEqual([]);
  });
});

describe("buildLatestUpdates", () => {
  it("sorts newest first and limits the list", () => {
    const result = buildLatestUpdates(
      [
        { id: "a", title: "Older", date: "2026-11-01T00:00:00.000Z" },
        { id: "b", title: "Newest", date: "2026-11-06T00:00:00.000Z" },
        { id: "c", title: "Middle", date: "2026-11-03T00:00:00.000Z" },
        { id: "d", title: "Oldest", date: "2026-10-01T00:00:00.000Z" },
      ],
      3,
    );
    expect(result.map(({ id }) => id)).toEqual(["b", "c", "a"]);
  });

  it("keeps the notification when activity reports the same event that day", () => {
    const result = buildLatestUpdates([
      { id: "note", title: "Consultation approved", date: "2026-11-05T01:00:00.000Z", unread: true },
      { id: "event", title: "consultation approved", date: "2026-11-05T02:00:00.000Z" },
    ]);
    expect(result.map(({ id }) => id)).toEqual(["note"]);
    expect(result[0].unread).toBe(true);
  });

  it("drops untitled records and picks a meaningful tone", () => {
    const result = buildLatestUpdates([
      { id: "blank", title: "  ", date: "2026-11-05T01:00:00.000Z" },
      { id: "x", title: "Your adviser requested changes", date: "2026-11-05T01:00:00.000Z" },
      { id: "y", title: "Title accepted", date: "2026-11-04T01:00:00.000Z" },
    ]);
    expect(result.map(({ id, tone }) => [id, tone])).toEqual([
      ["x", "danger"],
      ["y", "success"],
    ]);
  });
});

describe("buildJourney", () => {
  const milestones = [
    { id: "m2", name: "Proposal", sequence: 2 },
    { id: "m1", name: "Title", sequence: 1, completed: true },
    { id: "m3", name: "Fieldwork", sequence: 3 },
  ];

  it("orders by sequence and marks each state", () => {
    expect(buildJourney(milestones, "m2")).toEqual([
      { id: "m1", name: "Title", state: "done" },
      { id: "m2", name: "Proposal", state: "current" },
      { id: "m3", name: "Fieldwork", state: "upcoming" },
    ]);
  });

  it("marks every step done when the workflow is complete", () => {
    expect(
      buildJourney(milestones, "m2", true).every(({ state }) => state === "done"),
    ).toBe(true);
  });

  it("handles workflows of any length, including none", () => {
    expect(buildJourney(undefined, undefined)).toEqual([]);
    expect(journeyPosition([])).toBeNull();
    const twelve = Array.from({ length: 12 }, (_, index) => ({
      id: `m${index}`,
      name: `Milestone ${index}`,
      sequence: index,
    }));
    expect(journeyPosition(buildJourney(twelve, "m9"))).toEqual({
      index: 10,
      total: 12,
      name: "Milestone 9",
    });
  });

  it("names the last step when everything is finished", () => {
    expect(journeyPosition(buildJourney(milestones, undefined, true))).toEqual({
      index: 3,
      total: 3,
      name: "Fieldwork",
    });
  });
});

describe("visual helpers", () => {
  it("maps next-step states to a tone", () => {
    expect(nextStepVisual({ label: "Changes requested", tone: "action" }).tone).toBe("danger");
    expect(nextStepVisual({ label: "Waiting for review", tone: "pending" }).tone).toBe("warning");
    expect(nextStepVisual({ label: "Milestone completed", tone: "success" }).tone).toBe("success");
    expect(nextStepVisual({ label: "Your next step", tone: "action" }).tone).toBe("neutral");
  });

  it("creates safe initials", () => {
    expect(memberInitials({ firstName: "Lea", lastName: "Reyes" })).toBe("LR");
    expect(memberInitials({ firstName: "Lea" })).toBe("L");
    expect(memberInitials(undefined)).toBe("?");
  });
});
