import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  defenseSession: { findUnique: vi.fn() },
  defenseBadge: { createMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  researchMember: { findMany: vi.fn() },
  notification: { createMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("../lib/prisma.js", async (original) => ({
  ...(await original<any>()),
  prisma: db,
}));
import router from "./live-defense.routes.js";

const coordinator = {
  id: "coordinator",
  roles: ["RESEARCH_COORDINATOR"],
  collegeId: "college",
};
const approved = {
  id: "session",
  researchId: "project",
  status: "COMPLETED",
  decision: "APPROVED",
  releasedAt: new Date(),
  defenseEvent: { defenseType: "TITLE_DEFENSE" },
  research: {
    collegeId: "college",
    members: [
      { userId: "student", user: { firstName: "Ana", lastName: "Cruz" } },
    ],
  },
};

async function issue(user = coordinator) {
  const handler = (router as any).stack
    .find(
      (layer: any) =>
        layer.route?.path === "/defense-sessions/:id/badge" &&
        layer.route.methods.post,
    )
    .route.stack.at(-1).handle;
  const res = {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  };
  await handler(
    {
      user,
      params: { id: "session" },
      body: { kind: "FINAL_DEFENSE", issuedBy: "attacker" },
    },
    res,
  );
  return res;
}

describe("coordinator defense badge issuance", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation((callback) => callback(db));
    db.defenseSession.findUnique.mockResolvedValue(approved);
    db.defenseBadge.createMany.mockResolvedValue({ count: 1 });
    db.defenseBadge.findUniqueOrThrow.mockResolvedValue({
      id: "badge",
      kind: "TITLE_DEFENSE",
    });
    db.researchMember.findMany.mockResolvedValue([{ userId: "student" }]);
  });

  it.each(["RESEARCHER", "PANELIST", "ADVISER", "RPO", "SYSTEM_ADMIN"])(
    "rejects %s issuance",
    async (role) => {
      expect((await issue({ ...coordinator, roles: [role] })).statusCode).toBe(
        403,
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );

  it("rejects coordinators without a college", async () => {
    expect((await issue({ ...coordinator, collegeId: "" })).statusCode).toBe(
      403,
    );
  });

  it("rejects cross-college issuance even with an additional administrator role", async () => {
    expect(
      (
        await issue({
          ...coordinator,
          collegeId: "other",
          roles: ["RESEARCH_COORDINATOR", "SYSTEM_ADMIN"],
        })
      ).statusCode,
    ).toBe(404);
    expect(db.defenseBadge.createMany).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown session", async () => {
    db.defenseSession.findUnique.mockResolvedValue(null);
    expect((await issue()).statusCode).toBe(404);
  });

  it.each([
    { status: "LIVE" },
    { releasedAt: null },
    { decision: "REJECTED" },
    { decision: "MAJOR_REVISIONS_REQUIRED" },
    { decision: "APPROVED_WITH_MINOR_REVISIONS" },
    { defenseEvent: null },
    { defenseEvent: { defenseType: "PROPOSAL_DEFENSE" } },
    { defenseEvent: { defenseType: "PRE_ORAL_DEFENSE" } },
    { research: { ...approved.research, members: [] } },
  ])("rejects an ineligible result: %j", async (overrides) => {
    db.defenseSession.findUnique.mockResolvedValue({
      ...approved,
      ...overrides,
    });
    expect((await issue()).statusCode).toBe(409);
    expect(db.defenseBadge.createMany).not.toHaveBeenCalled();
  });

  it.each(["TITLE_DEFENSE", "FINAL_DEFENSE", "FINAL_ORAL_DEFENSE"])(
    "issues the correct badge for %s and records its recipients",
    async (defenseType) => {
      db.defenseSession.findUnique.mockResolvedValue({
        ...approved,
        defenseEvent: { defenseType },
      });
      const res = await issue();
      expect(res.statusCode).toBe(201);
      expect(db.defenseBadge.createMany).toHaveBeenCalledWith({
        data: [
          {
            defenseSessionId: "session",
            kind:
              defenseType === "TITLE_DEFENSE"
                ? "TITLE_DEFENSE"
                : "FINAL_DEFENSE",
            issuedBy: "coordinator",
            recipients: [{ userId: "student", name: "Ana Cruz" }],
          },
        ],
        skipDuplicates: true,
      });
      expect(db.auditLog.create).toHaveBeenCalledOnce();
      expect(db.notification.createMany).toHaveBeenCalledOnce();
    },
  );

  it("returns an existing badge without sending duplicate notifications or audits", async () => {
    db.defenseBadge.createMany.mockResolvedValue({ count: 0 });
    const res = await issue();
    expect(res.statusCode).toBe(200);
    expect(res.body.badge.id).toBe("badge");
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });
});
