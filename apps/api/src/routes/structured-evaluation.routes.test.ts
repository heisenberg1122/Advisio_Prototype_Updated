import express from "express";
import http from "node:http";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { defaultStructuredForm } from "@research-management/validations";
const state = vi.hoisted(() => ({
  user: {} as any,
  session: {} as any,
  item: null as any,
}));
vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = state.user;
    next();
  },
}));
vi.mock("../services/defense-manuscript.service.js", () => ({
  hasDefenseFacilitatorAccess: (u: any) =>
    u.roles.includes("RESEARCH_COORDINATOR") && Boolean(u.collegeId),
  defenseManuscriptService: { getReadiness: vi.fn() },
}));
vi.mock("../services/defense-eligibility.service.js", () => ({
  lockDefenseGroup: vi.fn(),
  consumeDefenseEligibility: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => {
  const db: any = {
    defenseSession: { findUnique: async () => state.session },
    structuredEvaluation: {
      findUnique: async () => state.item,
      upsert: async ({ create, update }: any) =>
        (state.item = state.item
          ? { ...state.item, ...update }
          : { id: "evaluation-1", ...create }),
      update: async ({ data }: any) =>
        (state.item = { ...state.item, ...data }),
    },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn(),
  };
  db.$transaction = async (fn: any) => fn(db);
  return { prisma: db };
});
import router from "./structured-evaluation.routes.js";
const id = "00000000-0000-4000-8000-000000000001",
  panel = "00000000-0000-4000-8000-000000000002",
  other = "00000000-0000-4000-8000-000000000003";
let server: http.Server, base: string;
const payload = () => ({
  researchers: {
    student: Object.fromEntries(
      defaultStructuredForm.presentation.map((c) => [c.id, 5]),
    ),
  },
  manuscript: Object.fromEntries(
    defaultStructuredForm.manuscript.map((c) => [c.id, 5]),
  ),
  recommendation: "APPROVED",
  feedback: "",
  signature: "",
});
const request = async (method: string, path = "", body?: unknown) => {
  const res = await fetch(
    `${base}/defense-sessions/${id}/structured-evaluation${path}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  return { status: res.status, body: await res.json() };
};
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
  state.item = null;
  state.user = { id: panel, roles: ["PANELIST"], collegeId: "college" };
  state.session = {
    id,
    researchId: "project",
    status: "LIVE",
    packet: {
      evaluationMode: "STRUCTURED",
      status: "PUBLISHED",
      structuredForm: {
        spec: defaultStructuredForm,
        roster: [{ userId: "student", name: "Solo Student" }],
        panelists: [{ userId: panel, name: "Panelist One", required: true }],
        researchTitle: "Solo research",
        manuscriptVersionId: "v1",
      },
    },
    invitations: [{ inviteeId: panel, status: "ACCEPTED", role: "PANELIST" }],
    research: { collegeId: "college", members: [] },
    structuredEvaluations: [],
  };
});
describe("structured evaluation HTTP access and submission", () => {
  it("saves, previews, confirms and locks an evaluation; retries do not create another submission", async () => {
    let r = await request("PUT", "", { revision: 0, answers: payload() });
    expect(r.status).toBe(200);
    expect(r.body.evaluation.revision).toBe(1);
    r = await request("POST", "/preview", { revision: 1 });
    expect(r.status).toBe(200);
    expect(r.body.evaluation.previewHash).toHaveLength(64);
    const submit = {
      revision: 1,
      previewHash: r.body.evaluation.previewHash,
      confirmed: true,
    };
    r = await request("POST", "/submit", submit);
    expect(r.status).toBe(200);
    expect(r.body.evaluation.lockedAt).toBeTruthy();
    expect((await request("POST", "/submit", submit)).status).toBe(200);
    expect(
      (await request("PUT", "", { revision: 1, answers: payload() })).status,
    ).toBe(409);
  });
  it("rejects stale revisions and outdated previews", async () => {
    await request("PUT", "", { revision: 0, answers: payload() });
    expect(
      (await request("PUT", "", { revision: 0, answers: payload() })).status,
    ).toBe(409);
    const preview = await request("POST", "/preview", { revision: 1 });
    await request("PUT", "", { revision: 1, answers: payload() });
    expect(
      (
        await request("POST", "/submit", {
          revision: 1,
          previewHash: preview.body.evaluation.previewHash,
          confirmed: true,
        })
      ).status,
    ).toBe(409);
  });
  it("requires complete answers and a preview before locking", async () => {
    const a = payload();
    delete (a.researchers.student as any).p0;
    expect((await request("PUT", "", { revision: 0, answers: a })).status).toBe(
      200,
    );
    expect((await request("POST", "/preview", { revision: 1 })).status).toBe(
      400,
    );
    expect(
      (
        await request("POST", "/submit", {
          revision: 1,
          previewHash: "a".repeat(64),
          confirmed: true,
        })
      ).status,
    ).toBe(400);
    await request("PUT", "", { revision: 1, answers: payload() });
    expect(
      (
        await request("POST", "/submit", {
          revision: 2,
          previewHash: "a".repeat(64),
          confirmed: true,
        })
      ).status,
    ).toBe(409);
  });
  it("rejects unassigned, declined and student scorers and non-live edits", async () => {
    state.user.id = other;
    expect((await request("GET")).status).toBe(404);
    state.user.id = panel;
    state.session.invitations[0].status = "DECLINED";
    expect(
      (await request("PUT", "", { revision: 0, answers: payload() })).status,
    ).toBe(404);
    state.session.invitations[0].status = "ACCEPTED";
    state.session.status = "SCHEDULED";
    expect((await request("GET")).status).toBe(200);
    expect(
      (await request("PUT", "", { revision: 0, answers: payload() })).status,
    ).toBe(409);
  });
  it("does not expose another panelist’s PDF or the consolidated report", async () => {
    const pdf = await fetch(
      `${base}/defense-sessions/${id}/structured-evaluations/${other}/pdf`,
    );
    expect(pdf.status).toBe(403);
    const report = await fetch(
      `${base}/defense-sessions/${id}/structured-results`,
    );
    expect(report.status).toBe(403);
  });
  it("requires the configured electronic signature", async () => {
    state.session.packet.structuredForm = {
      ...state.session.packet.structuredForm,
      spec: { ...defaultStructuredForm, signatureRequired: true },
    };
    await request("PUT", "", { revision: 0, answers: payload() });
    expect((await request("POST", "/preview", { revision: 1 })).status).toBe(
      400,
    );
    await request("PUT", "", {
      revision: 1,
      answers: { ...payload(), signature: "Panelist One" },
    });
    expect((await request("POST", "/preview", { revision: 2 })).status).toBe(
      200,
    );
  });
});
