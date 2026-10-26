import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  createMany: vi.fn(),
  enrollments: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    workflowEnrollment: { findMany: mocks.enrollments },
    workflowInstance: { findMany: mocks.findMany },
    notification: { createMany: mocks.createMany },
  },
}));
import {
  queueDeadlineEmails,
  reminderDays,
  requirementDeadline,
} from "./deadline-email.service.js";
const now = new Date("2026-10-26T00:00:00Z");
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NOTIFICATION_EMAILS_ENABLED", "true");
  mocks.enrollments.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);
});
afterEach(() => vi.unstubAllEnvs());
describe("deadline reminders", () => {
  it("uses Manila end of day for fixed dates and actual activation for relative dates", () => {
    expect(
      requirementDeadline(
        { targetCompletionDate: new Date("2026-10-29"), deadlineDays: 9 },
        now,
      )?.toISOString(),
    ).toBe("2026-10-29T15:59:59.999Z");
    expect(
      requirementDeadline(
        { targetCompletionDate: null, deadlineDays: 3 },
        now,
        1,
      )?.toISOString(),
    ).toBe("2026-10-27T00:00:00.000Z");
    expect(
      requirementDeadline(
        { targetCompletionDate: null, deadlineDays: 3 },
        null,
      ),
    ).toBeNull();
    expect(reminderDays(new Date("2026-10-29T00:00:00Z"), now)).toBe(3);
    expect(reminderDays(new Date("2026-10-27T00:00:00Z"), now)).toBe(1);
    expect(reminderDays(now, now)).toBeNull();
  });
  it("queues once per due date, offset, and team member; skips submitted requirements", async () => {
    const instance = {
      id: "i1",
      startedAt: now,
      transitions: [],
      currentStage: {
        id: "m1",
        sequence: 1,
        name: "Milestone",
        category: "Milestone",
        milestoneType: "STANDARD",
        targetCompletionDate: null,
        deadlineDays: 3,
        tasks: [{ id: "t1", title: "Chapter 1", dueDays: 3 }],
      },
      research: {
        id: "p1",
        title: "Research",
        members: [{ userId: "u1" }, { userId: "u2" }],
        taskSubmissions: [],
        documents: [],
      },
    };
    mocks.findMany.mockResolvedValue([instance]);
    await queueDeadlineEmails(now);
    expect(mocks.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            recipientId: "u1",
            emailTemplate: "requirement_due",
            deduplicationKey: expect.stringContaining(":3:u1"),
          }),
        ]),
      }),
    );
    mocks.createMany.mockClear();
    mocks.findMany.mockResolvedValue([
      {
        ...instance,
        research: {
          ...instance.research,
          taskSubmissions: [{ taskId: "t1", status: "UNDER_REVIEW" }],
        },
      },
    ]);
    await queueDeadlineEmails(now);
    expect(mocks.createMany).not.toHaveBeenCalled();
  });
});
