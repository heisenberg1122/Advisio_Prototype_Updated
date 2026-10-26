import { describe, expect, it, vi } from "vitest";
import {
  defenseSchedulerAudience,
  notificationDeliveries,
  notificationInbox,
  notificationWhere,
} from "./notification.service.js";
import type { AuthenticatedUser } from "../middleware/auth.js";

const user = {
  id: "u1",
  roles: ["RESEARCH_COORDINATOR", "PANELIST"],
} as AuthenticatedUser;
const base = {
  recipientId: "u1",
  type: "WORKFLOW_CHANGED",
  title: "Update",
  message: "Details",
  deduplicationKey: "same-event",
};

describe("notification inbox policy", () => {
  it("requires a recognized inbox and a current dashboard assignment", () => {
    expect(notificationInbox(user, "panelist")).toBe("panelist");
    expect(notificationInbox(user, "account")).toBe("account");
    expect(notificationInbox(user, "earlier")).toBe("earlier");
    for (const inbox of [undefined, "all", "ethics", "academic-affairs"])
      expect(() => notificationInbox(user, inbox)).toThrow();
    expect(() => notificationInbox(user, "dean")).toThrow("not assigned");
    expect(() =>
      notificationInbox(
        { ...user, roles: ["RESEARCH_COORDINATOR"] },
        "panelist",
      ),
    ).toThrow("not assigned");
  });
  it("uses the authenticated recipient and selected inbox for every query", () => {
    expect(notificationWhere(user, "panelist")).toEqual({
      recipientId: "u1",
      archivedAt: null,
      audience: "panelist",
    });
    expect(notificationWhere(user, "account").audience).toBe("account");
  });
});

describe("notification delivery audience", () => {
  it("keeps Dean scheduling responses in the Dean inbox and coordinator responses in the owning workflow", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValue({ roles: [{ role: { name: "DEAN" } }] });
    const project = vi
      .fn()
      .mockResolvedValue({
        workflowInstance: { workflow: { createdBy: "u1" } },
      });
    const tx = {
      user: { findUnique },
      researchProject: { findUnique: project },
    } as any;
    expect(await defenseSchedulerAudience(tx, "u1", "p1")).toBe("dean");
    findUnique.mockResolvedValue({
      roles: [
        { role: { name: "DEAN" } },
        { role: { name: "RESEARCH_COORDINATOR" } },
      ],
    });
    expect(await defenseSchedulerAudience(tx, "u1", "p1")).toBe("coordinator");
    project.mockResolvedValue({
      workflowInstance: { workflow: { createdBy: "other" } },
    });
    expect(await defenseSchedulerAudience(tx, "u1", "p1")).toBe("dean");
  });
  it("retains independent delivery state and deduplication across responsibilities", async () => {
    const data = await notificationDeliveries({} as any, [
      { ...base, audience: "panelist" },
      { ...base, audience: "coordinator" },
    ]);
    expect(data.map((row) => row.audience)).toEqual([
      "panelist",
      "coordinator",
    ]);
    expect(data[0].deduplicationKey).not.toBe(data[1].deduplicationKey);
    expect(
      await notificationDeliveries({} as any, [
        { ...base, audience: "panelist" },
      ]),
    ).toEqual([data[0]]);
  });
  it("resolves a review invitation from its exact reviewer assignment", async () => {
    const findFirst = vi.fn().mockResolvedValue({ reviewType: "PANEL" });
    const data = await notificationDeliveries(
      { reviewerAssignment: { findFirst } } as any,
      [
        {
          ...base,
          actionUrl: "/research/manuscript?projectId=p1&assignmentId=a1",
        },
      ],
    );
    expect(data[0].audience).toBe("panelist");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "a1", reviewerId: "u1" } }),
    );
  });
  it("splits a shared project event only for actual project responsibilities", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      members: [
        { userId: "u1", projectRole: "ADVISER" },
        { userId: "someone-else", projectRole: "LEADER" },
      ],
      workflowInstance: { workflow: { createdBy: "u1" } },
    });
    const data = await notificationDeliveries(
      { researchProject: { findUnique } } as any,
      [{ ...base, actionUrl: "/research/manuscript?projectId=p1" }],
    );
    expect(data.map((row) => row.audience)).toEqual(["adviser", "coordinator"]);
    expect(data.some((row) => row.audience === "panelist")).toBe(false);
  });
  it("rejects unresolved audiences instead of putting them in every dashboard", async () => {
    await expect(notificationDeliveries({} as any, [base])).rejects.toThrow(
      "explicit recipient responsibility",
    );
    await expect(
      notificationDeliveries({} as any, [{ ...base, audience: "earlier" }]),
    ).rejects.toThrow("Invalid notification audience");
  });
  it("queues one email when an event has multiple legitimate dashboard audiences", async () => {
    const tx = { researchProject: { findUnique: vi.fn().mockResolvedValue({ members: [{ userId: "u1", projectRole: "LEADER" }, { userId: "u1", projectRole: "ADVISER" }], workflowInstance: null }) } } as any;
    const rows = await notificationDeliveries(tx, [{ ...base, actionUrl: "/research/manuscript?projectId=p1", emailTemplate: "submission_approved", emailNextAttemptAt: new Date() }]);
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.emailTemplate)).toHaveLength(1);
    expect(rows.find((row) => row.emailTemplate)?.audience).toBe("researcher");
  });
});
