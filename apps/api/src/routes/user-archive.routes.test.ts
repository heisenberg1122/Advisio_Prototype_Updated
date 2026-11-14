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
  college: vi.fn(),
  program: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
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
  prisma: {
    user: { findUnique: state.findUnique },
    college: { findFirst: state.college },
    program: { findFirst: state.program },
    $transaction: (callback: (tx: unknown) => unknown) => callback({
      user: { update: state.update },
      auditLog: { create: state.audit },
    }),
  },
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

describe("academic assignment", () => {
  const assignment = { collegeId: "cit", reason: "Verified faculty program assignment." };
  const save = (program: Record<string, unknown> = {}) =>
    fetch(`${base}/college`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...assignment, ...program }),
    });

  beforeEach(() => {
    state.college.mockResolvedValue({ id: "cit" });
    state.program.mockResolvedValue({ id: "bsit" });
    state.findUnique.mockResolvedValue({ id: "user-1", collegeId: "cit", programId: "bscs", memberships: [] });
    state.update.mockResolvedValue({ id: "user-1", program: { id: "bsit", name: "BS Information Technology" } });
  });

  it("validates and saves a program in the selected college and audits the change", async () => {
    const response = await save({ programId: "bsit" });
    expect(response.status).toBe(200);
    expect((await response.json()).user.program.id).toBe("bsit");
    expect(state.program).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "bsit", collegeId: "cit", isActive: true },
    }));
    expect(state.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { collegeId: "cit", programId: "bsit" },
    }));
    expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        oldValues: { collegeId: "cit", programId: "bscs" },
        newValues: { ...assignment, programId: "bsit" },
      }),
    }));
  });

  it("preserves the current program for older college-only requests", async () => {
    expect((await save()).status).toBe(200);
    expect(state.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { collegeId: "cit", programId: "bscs" },
    }));
  });

  it("rejects an ineligible program and restricts assignment to institution-wide administrators", async () => {
    state.program.mockResolvedValue(null);
    expect((await save({ programId: "elsewhere" })).status).toBe(400);
    state.roles = ["DEAN"];
    expect((await save({ programId: "bsit" })).status).toBe(403);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("allows a program assignment within the home college while blocking a conflicting college transfer", async () => {
    state.findUnique.mockResolvedValue({
      id: "user-1",
      collegeId: "cit",
      programId: null,
      memberships: [{ research: { collegeId: "cit", title: "Active project" } }],
    });
    expect((await save({ collegeId: "cas", programId: "bsbio" })).status).toBe(409);
    expect(state.update).not.toHaveBeenCalled();
    expect((await save({ programId: "bsit" })).status).toBe(200);
  });
});
