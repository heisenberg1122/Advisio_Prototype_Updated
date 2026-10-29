import express from "express";
import http from "node:http";
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
const state = vi.hoisted(() => ({
  roles: ["SYSTEM_ADMIN"],
  permissions: ["user.manage", "role.manage"],
  statusChange: vi.fn(),
  deletion: vi.fn(),
  findUnique: vi.fn(),
  recovery: vi.fn(),
}));
vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      id: "admin",
      roles: state.roles,
      permissions: state.permissions,
    };
    next();
  },
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: { user: { findUnique: state.findUnique } },
  InstitutionalRole: {},
  AuditAction: {},
}));
vi.mock("../services/account-status.service.js", () => ({
  changeAccountStatus: state.statusChange,
}));
vi.mock("../services/user-deletion.service.js", () => ({
  previewUserDeletion: vi.fn(),
  permanentlyDeleteUser: state.deletion,
}));
import router from "./user.routes";
let server: http.Server, base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/users", router);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}/api/users/user-1`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  vi.clearAllMocks();
  state.roles = ["SYSTEM_ADMIN"];
  state.permissions = ["user.manage", "role.manage"];
  state.findUnique.mockResolvedValue({
    id: "user-1",
    passwordHash: "private-password-hash",
    googleSubject: "private-google-id",
    researcherProfile: { yearLevel: "4th year" },
    facultyProfile: null,
  });
});
describe("archive API and legacy deletion protection", () => {
  it("archives through INACTIVE without invoking permanent deletion", async () => {
    state.statusChange.mockResolvedValue({ id: "user-1", status: "INACTIVE" });
    const res = await fetch(`${base}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "User has left the institution." }),
    });
    expect(res.status).toBe(200);
    expect(state.statusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        status: "INACTIVE",
        verificationNote: "User has left the institution.",
      }),
    );
    expect(state.deletion).not.toHaveBeenCalled();
  });
  it("rejects outdated DELETE calls without changing account data", async () => {
    const res = await fetch(base, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deleteAllData: true,
        confirmation: "delete TEST sudo",
      }),
    });
    expect(res.status).toBe(410);
    expect(state.deletion).not.toHaveBeenCalled();
    expect(state.statusChange).not.toHaveBeenCalled();
  });
  it.each(["DEAN", "RESEARCHER"])(
    "rejects %s archiving even with both permissions",
    async (role) => {
      state.roles = [role];
      expect((await fetch(`${base}/archive`, { method: "POST" })).status).toBe(
        403,
      );
      expect(state.statusChange).not.toHaveBeenCalled();
    },
  );
  it("requires both management permissions", async () => {
    state.permissions = ["user.manage"];
    expect((await fetch(`${base}/archive`, { method: "POST" })).status).toBe(
      403,
    );
    expect(state.statusChange).not.toHaveBeenCalled();
  });
});
