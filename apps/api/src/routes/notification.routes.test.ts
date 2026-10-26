import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  notification: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: db,
  NotificationType: {},
  UserStatus: {},
  AuditAction: {},
}));
import router from "./notification.routes.js";

async function call(method: string, path: string, inbox?: string, id = "n1") {
  const handler = (router as any).stack
    .find(
      (layer: any) => layer.route?.path === path && layer.route.methods[method],
    )
    .route.stack.at(-1).handle;
  const res = {
    statusCode: 200,
    body: {} as any,
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
      user: { id: "u1", roles: ["PANELIST", "RESEARCH_COORDINATOR"] },
      query: { inbox },
      body: { inbox },
      params: { id },
    },
    res,
  );
  return res;
}

describe("notification API isolation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.notification.findMany.mockResolvedValue([]);
    db.notification.count.mockResolvedValue(73);
    db.notification.updateMany.mockResolvedValue({ count: 1 });
  });
  it("scopes listing and full unread counts to the same recipient and inbox", async () => {
    const res = await call("get", "/", "panelist");
    expect(res.body.unreadCount).toBe(73);
    const where = { recipientId: "u1", archivedAt: null, audience: "panelist" };
    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, take: 50 }),
    );
    expect(db.notification.count).toHaveBeenCalledWith({
      where: { ...where, isRead: false },
    });
  });
  it("never treats an omitted or unauthorized inbox as an account-wide request", async () => {
    expect((await call("get", "/")).statusCode).toBe(400);
    expect((await call("patch", "/read-all")).statusCode).toBe(400);
    expect((await call("get", "/", "dean")).statusCode).toBe(403);
    expect(db.notification.findMany).not.toHaveBeenCalled();
    expect(db.notification.updateMany).not.toHaveBeenCalled();
  });
  it("bulk reading a dashboard cannot clear another dashboard or account notices", async () => {
    expect((await call("patch", "/read-all", "panelist")).statusCode).toBe(200);
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: {
        recipientId: "u1",
        audience: "panelist",
        archivedAt: null,
        isRead: false,
      },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });
  it.each(["/:id/read", "/:id/archive"])(
    "keeps ownership and inbox checks on %s",
    async (path) => {
      db.notification.updateMany.mockResolvedValue({ count: 0 });
      expect(
        (await call("patch", path, "coordinator", "foreign-id")).statusCode,
      ).toBe(404);
      expect(db.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            recipientId: "u1",
            audience: "coordinator",
            archivedAt: null,
            id: "foreign-id",
          },
        }),
      );
    },
  );
});
