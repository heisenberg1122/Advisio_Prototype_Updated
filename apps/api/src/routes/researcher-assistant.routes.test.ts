import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import http from "node:http";
import type { Request, Response, NextFunction } from "express";
import { getPermissionsForRoles } from "@research-management/auth";
import { evaluationContext } from "../evaluation/context.js";

// Authentication itself has existing coverage. This isolated router harness verifies
// that the new endpoint invokes it and enforces the resulting role/permission scope.
vi.mock("../middleware/auth.js", () => ({
  requireAuth(req: Request, res: Response, next: NextFunction) {
    const role = req.get("x-test-role");
    if (
      !["RESEARCHER", "ADVISER", "PANELIST", "DEAN", "SYSTEM_ADMIN"].includes(
        role || "",
      )
    ) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    req.user = {
      id: role === "ADVISER" || role === "PANELIST" || role === "DEAN" ? `test-${role.toLowerCase()}` : "test-account",
      email: "test@example.test",
      universityId: "test",
      roles: [role as "RESEARCHER"],
      permissions: getPermissionsForRoles([role as "RESEARCHER"]),
      collegeId: req.get("x-test-no-college") ? null : "test-college",
    };
    next();
  },
}));
import { createResearcherAssistantRouter } from "./researcher-assistant.routes.js";
import {
  ResearcherAssistantService,
  assistantConfig,
} from "../services/researcher-assistant.service.js";

describe("Authenticated Researcher help API", () => {
  let server: http.Server, base: string;
  const provider = vi.fn<typeof fetch>();
  const service = new ResearcherAssistantService(
    { ...assistantConfig(), enabled: false, apiKey: "", requestsPerMinute: 3 },
    provider,
  );
  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: "12kb" }));
    app.use((req, _res, next) => {
      if (!req.get("x-test-evaluation")) return next();
      evaluationContext.run({ id: "test-evaluation", storageRoot: "", prisma: {} as never }, next);
    });
    app.use(
      "/api/researcher-assistant",
      createResearcherAssistantRouter(service),
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        base =
          "http://127.0.0.1:" +
          (server.address() as { port: number }).port +
          "/api/researcher-assistant";
        resolve();
      });
    });
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await service.close();
  });
  const post = (body: unknown, role = "RESEARCHER", headers = {}) =>
    fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Test-Role": role, ...headers },
      body: JSON.stringify(body),
    });
  it("requires authentication and rejects other dashboard roles", async () => {
    expect((await post({ message: "help" }, "")).status).toBe(401);
    expect((await post({ message: "help" }, "ADVISER")).status).toBe(403);
  });
  it("rejects forged authority, unknown pages and oversized messages", async () => {
    expect(
      (await post({ message: "help", roles: ["SYSTEM_ADMIN"] })).status,
    ).toBe(400);
    expect((await post({ message: "help", page: "system-admin" })).status).toBe(
      400,
    );
    expect((await post({ message: "x".repeat(1601) })).status).toBe(400);
    expect(
      (
        await post({
          message: "help",
          history: Array(4).fill({ role: "user", content: "漢".repeat(1000) }),
        })
      ).status,
    ).toBe(413);
  });
  it("serves local answers with no provider calls and a private cache policy", async () => {
    const result = await post({ message: "Where can I see my group?" });
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.json()).toMatchObject({
      source: "local",
      topicIds: ["group"],
    });
    expect(provider).not.toHaveBeenCalled();
  });
  it("enforces request limits and returns a retry delay", async () => {
    await post({ message: "Where can I see my group?" });
    await post({ message: "Where can I see my group?" });
    const limited = await post({ message: "Where can I see my group?" });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
  it("restricts aggregate metrics to the system administrator", async () => {
    expect(
      (
        await fetch(base + "/metrics", {
          headers: { "X-Test-Role": "RESEARCHER" },
        })
      ).status,
    ).toBe(403);
    const result = await fetch(base + "/metrics", {
      headers: { "X-Test-Role": "SYSTEM_ADMIN" },
    });
    expect(result.status).toBe(200);
    const metrics = await result.json();
    expect(metrics.requests).toBe(4);
    expect(JSON.stringify(metrics)).not.toContain("test-account");
    expect(JSON.stringify(metrics)).not.toContain("Where can");
  });
  it("authorizes Panelist help only in a college with the Panelist role", async () => {
    const body = { message: "Saan ang defense schedule ko?", page: "pn-04", workspace: "panelist" };
    expect((await post(body, "ADVISER")).status).toBe(403);
    expect((await post(body, "RESEARCHER")).status).toBe(403);
    expect((await post(body, "PANELIST", { "X-Test-No-College": "1" })).status).toBe(403);
    expect((await post({ ...body, page: "ad-07" }, "PANELIST")).status).toBe(400);
    const result = await post(body, "PANELIST");
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ source: "local", topicIds: ["pn-04"] });
    expect(provider).not.toHaveBeenCalled();
  });
  it("serves Dean help only to a Dean in an active college, including in evaluation", async () => {
    const body = {
      message: "How do I view or export a research report?",
      page: "dean-overview",
      workspace: "dean",
    };
    expect((await post(body, "SYSTEM_ADMIN")).status).toBe(403);
    expect((await post(body, "DEAN", { "X-Test-No-College": "1" })).status).toBe(403);
    const evaluationHeaders = { "X-Test-Evaluation": "1" };
    expect((await post(body, "SYSTEM_ADMIN", evaluationHeaders)).status).toBe(403);
    expect((await post(body, "DEAN", { ...evaluationHeaders, "X-Test-No-College": "1" })).status).toBe(403);
    expect((await post({ message: "How do I join a class?" }, "RESEARCHER", evaluationHeaders)).status).toBe(403);
    const evaluation = await post(body, "DEAN", evaluationHeaders);
    expect(evaluation.status).toBe(200);
    expect(await evaluation.json()).toMatchObject({ source: "local", topicIds: ["dean-reports"] });
    expect((await post({ ...body, page: "pn-04" }, "DEAN")).status).toBe(400);
    const result = await post(body, "DEAN");
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ source: "local", topicIds: ["dean-reports"] });
    expect(provider).not.toHaveBeenCalled();
  });
  it("uses only the requested workspace and requires an approved Adviser college", async () => {
    const body = {
      message: "How do I review a manuscript?",
      page: "ad-07",
      workspace: "adviser",
    };
    expect((await post(body, "PANELIST")).status).toBe(403);
    expect((await post(body, "RESEARCHER")).status).toBe(403);
    expect(
      (await post({ ...body, previousTopic: "class" }, "ADVISER")).status,
    ).toBe(400);
    const result = await fetch(base, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-Role": "ADVISER",
        "X-Test-No-College": "1",
      },
      body: JSON.stringify(body),
    });
    expect(result.status).toBe(403);
    const approved = await post(body, "ADVISER");
    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({
      source: "local",
      topicIds: ["ad-07"],
    });
  });
});
