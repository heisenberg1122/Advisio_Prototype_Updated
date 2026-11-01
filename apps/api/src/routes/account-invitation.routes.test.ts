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
  role: "SYSTEM_ADMIN",
  authenticated: true,
  create: vi.fn(),
  preview: vi.fn(),
  accept: vi.fn(),
  resend: vi.fn(),
  revoke: vi.fn(),
  review: vi.fn(),
  list: vi.fn(),
}));
vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!state.authenticated)
      return res.status(401).json({ error: "Unauthorized" });
    req.user = {
      id: "admin",
      collegeId: "a0000000-0000-4000-8000-000000000001",
      roles: [state.role],
    };
    next();
  },
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: { accountInvitation: { findMany: state.list } },
}));
vi.mock("../services/account-invitation.service.js", () => ({
  createAccountInvitation: state.create,
  previewAccountInvitation: state.preview,
  acceptAccountInvitation: state.accept,
  resendAccountInvitation: state.resend,
  revokeAccountInvitation: state.revoke,
  reviewAccountInvitation: state.review,
}));
import router from "./account-invitation.routes.js";
let server: http.Server, base: string;
const payload = {
  email: "faculty@example.edu",
  universityId: "FACULTY-01",
  firstName: "Demo",
  lastName: "Faculty",
  collegeId: "a0000000-0000-4000-8000-000000000001",
  roleNames: ["PANELIST"],
  verificationConfirmed: true,
  verificationNote: "Verified faculty appointment",
};
const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(router);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  vi.clearAllMocks();
  state.authenticated = true;
  state.role = "SYSTEM_ADMIN";
  state.create.mockResolvedValue({ message: "Sent" });
  state.list.mockResolvedValue([]);
});
describe("account invitation routes", () => {
  it.each(["RESEARCHER", "ADVISER", "PANELIST", "RESEARCH_COORDINATOR"])(
    "denies %s invitation administration",
    async (role) => {
      state.role = role;
      expect((await post("/", payload)).status).toBe(403);
      expect((await fetch(`${base}/`)).status).toBe(403);
      expect(
        (await post("/a0000000-0000-4000-8000-000000000001/resend", {})).status,
      ).toBe(403);
      expect(
        (await post("/a0000000-0000-4000-8000-000000000001/revoke", {})).status,
      ).toBe(403);
      expect(state.create).not.toHaveBeenCalled();
      expect(state.list).not.toHaveBeenCalled();
    },
  );
  it("requires an authenticated system administrator", async () => {
    state.authenticated = false;
    expect((await post("/", payload)).status).toBe(401);
    expect(state.create).not.toHaveBeenCalled();
  });
  it("rejects elevated roles and missing verification before writing", async () => {
    expect(
      (await post("/", { ...payload, roleNames: ["SYSTEM_ADMIN"] })).status,
    ).toBe(400);
    expect(
      (await post("/", { ...payload, verificationConfirmed: false })).status,
    ).toBe(400);
    expect(state.create).not.toHaveBeenCalled();
  });
  it("allows system administrators to send validated invitations", async () => {
    const response = await post("/", payload);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.create).toHaveBeenCalledWith(
      payload,
      "admin",
      payload.collegeId,
    );
  });
  it("passes a Dean's active college to the invitation policy and restricts approvals to administrators", async () => {
    state.role = "DEAN";
    expect((await post("/", payload)).status).toBe(201);
    expect(state.create).toHaveBeenCalledWith(
      payload,
      "admin",
      payload.collegeId,
    );
    expect(
      (
        await post(`/${payload.collegeId}/approve`, {
          verificationConfirmed: true,
          verificationNote: "Verified appointment",
        })
      ).status,
    ).toBe(403);
    expect(state.review).not.toHaveBeenCalled();
  });
  it("allows token validation and acceptance before signing in", async () => {
    state.authenticated = false;
    state.preview.mockResolvedValue({ email: payload.email });
    state.accept.mockResolvedValue({ message: "Ready" });
    const token = "a".repeat(64);
    expect((await post("/preview", { token })).status).toBe(200);
    expect(
      (await post("/accept", { token, password: "A unique long password" }))
        .status,
    ).toBe(200);
    expect(state.accept).toHaveBeenCalledWith(token, "A unique long password");
  });
  it("keeps internal provider errors out of API responses", async () => {
    state.create.mockRejectedValue(new Error("secret provider value"));
    const response = await post("/", payload);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
  });
});
