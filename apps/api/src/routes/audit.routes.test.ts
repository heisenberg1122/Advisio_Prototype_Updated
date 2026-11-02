import { describe, it, expect, vi, beforeEach } from "vitest";
const db = vi.hoisted(() => ({
  auditLog: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  researchProject: { findFirst: vi.fn() },
}));
vi.mock("../lib/prisma.js", () => ({ prisma: db }));
vi.mock("../middleware/auth.js", () => ({ requireAuth: vi.fn() }));
vi.mock("../services/security-audit.service.js", () => ({
  securityAuditHealth: { mode: "disabled" },
}));
import router, { auditWhere, csvCell } from "./audit.routes.js";

const route = (path: string) =>
  (router as any).stack
    .find((layer: any) => layer.route?.path === path)
    .route.stack.map((entry: any) => entry.handle);
const response = () => {
  const res: any = { statusCode: 200, body: null };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: unknown) => {
    res.body = body;
    return res;
  };
  res.set = () => res;
  return res;
};
beforeEach(() => vi.resetAllMocks());
describe("audit filters and authorization", () => {
  it("bounds filters and preserves deterministic equal-time pagination", () => {
    expect(() => auditWhere({ limit: "101" })).toThrow();
    expect(() =>
      auditWhere({ from: "2024-01-01T00:00:00Z", to: "2026-01-01T00:00:00Z" }),
    ).toThrow();
    expect(() => auditWhere({ category: "OTHER" })).toThrow();
    const cursor = Buffer.from(
      JSON.stringify({
        at: "2026-10-30T00:00:00.000Z",
        to: "2026-11-01T00:00:00.000Z",
        id: "11111111-1111-4111-8111-111111111111",
      }),
    ).toString("base64url");
    expect(auditWhere({ cursor }).where.OR).toEqual([
      { createdAt: { lt: new Date("2026-10-30T00:00:00Z") } },
      {
        createdAt: new Date("2026-10-30T00:00:00Z"),
        id: { lt: "11111111-1111-4111-8111-111111111111" },
      },
    ]);
  });
  it.each(["/admin/audit", "/admin/audit/:id", "/admin/audit/export"])(
    "blocks non-administrators at %s",
    (path) => {
      const res = response(),
        next = vi.fn();
      route(path)[1]({ user: { roles: ["RESEARCHER"] } }, res, next);
      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    },
  );
  it("does not query another project's events without membership", async () => {
    db.researchProject.findFirst.mockResolvedValue(null);
    const res = response();
    await route("/research/:researchId/audit").at(-1)(
      {
        params: { researchId: "11111111-1111-4111-8111-111111111111" },
        user: { id: "other" },
        query: {},
      },
      res,
    );
    expect(res.statusCode).toBe(404);
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
  });
  it("redacts historical secrets on detail reads", async () => {
    db.auditLog.findUnique.mockResolvedValue({
      oldValues: { passwordHash: "secret", status: "ACTIVE" },
      newValues: { accessToken: "secret" },
    });
    const res = response();
    await route("/admin/audit/:id").at(-1)(
      { params: { id: "11111111-1111-4111-8111-111111111111" } },
      res,
    );
    expect(res.body.event.oldValues).toEqual({ status: "ACTIVE" });
    expect(res.body.event.newValues).toEqual({});
  });
  it("neutralizes spreadsheet formulas in CSV", () => {
    expect(csvCell(' =HYPERLINK("evil")')).toBe('"\' =HYPERLINK(""evil"")"');
    expect(csvCell("normal")).toBe('"normal"');
  });
});
