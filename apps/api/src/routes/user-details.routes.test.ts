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
  findUnique: vi.fn(),
  recovery: vi.fn(),
}));
vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "admin", roles: state.roles, permissions: [] };
    next();
  },
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: { user: { findUnique: state.findUnique } },
  InstitutionalRole: {},
  AuditAction: {},
}));
vi.mock("../services/password-recovery.service.js", () => ({
  requestPasswordRecovery: state.recovery,
}));
vi.mock("../services/account-status.service.js", () => ({
  changeAccountStatus: vi.fn(),
}));
vi.mock("../services/user-deletion.service.js", () => ({
  previewUserDeletion: vi.fn(),
  permanentlyDeleteUser: vi.fn(),
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
  state.findUnique.mockResolvedValue({
    id: "user-1",
    passwordHash: "private-password-hash",
    googleSubject: "private-google-id",
    researcherProfile: { yearLevel: "4th year" },
    facultyProfile: null,
  });
});
describe("system administrator user details", () => {
  it("returns registration fields and credential metadata without exposing credentials", async () => {
    const res = await fetch(`${base}/details`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = await res.json();
    expect(data.user.researcherProfile.yearLevel).toBe("4th year");
    expect(data.user.authentication).toEqual({
      googleConnected: true,
      hasPassword: true,
      passwordStorage: "Hashed (bcrypt)",
    });
    expect(JSON.stringify(data)).not.toContain("private-");
    expect(data.user).not.toHaveProperty("passwordHash");
  });
  it.each(["RESEARCHER", "DEAN", "RESEARCH_COORDINATOR"])(
    "denies %s access to details and reset",
    async (role) => {
      state.roles = [role];
      expect((await fetch(`${base}/details`)).status).toBe(403);
      expect(
        (
          await fetch(`${base}/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirmed: true }),
          })
        ).status,
      ).toBe(403);
      expect(state.findUnique).not.toHaveBeenCalled();
      expect(state.recovery).not.toHaveBeenCalled();
    },
  );
  it("requires explicit confirmation before sending email", async () => {
    const res = await fetch(`${base}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
    expect(state.recovery).not.toHaveBeenCalled();
  });
  it("uses the target's saved email and authenticated administrator identity", async () => {
    state.findUnique.mockResolvedValue({ email: "saved@example.com" });
    state.recovery.mockResolvedValue("Email sent");
    const res = await fetch(`${base}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true, email: "injected@example.com" }),
    });
    expect(res.status).toBe(200);
    expect(state.recovery).toHaveBeenCalledWith("saved@example.com", "admin");
  });
  it("returns 404 for missing users", async () => {
    state.findUnique.mockResolvedValue(null);
    expect((await fetch(`${base}/details`)).status).toBe(404);
  });
});
