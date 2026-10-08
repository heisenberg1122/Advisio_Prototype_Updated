import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import app from "./app";

describe("Advisio Express API Integration Suite", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = http.createServer(app).listen(0, () => {
        const port = (server.address() as any).port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("serves root service information", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.name).toBe("Advisio Research Management API");
    expect(data.status).toBe("running");
  });

  it("responds to /api/health with health inspection report", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect([200, 503]).toContain(res.status);
    const data = await res.json() as any;
    expect(data.service).toBe("Advisio Research Management API");
    expect(["healthy", "unhealthy"]).toContain(data.status);
    expect(["connected", "disconnected"]).toContain(data.database);
  });

  it("checks realtime SSE status endpoint", async () => {
    const res = await fetch(`${baseUrl}/api/realtime/status`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.status).toBe("ok");
    expect(data.activeConnections).toBeGreaterThanOrEqual(0);
  });

  it("protects group chats and messages from unauthenticated access", async () => {
    const resChats = await fetch(`${baseUrl}/api/chats`);
    expect(resChats.status).toBe(401);
    const createChat = await fetch(`${baseUrl}/api/chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Unauthorized test", participantIds: ["00000000-0000-0000-0000-000000000000"] }),
    });
    expect(createChat.status).toBe(401);
    const resMsg = await fetch(`${baseUrl}/api/chats/00000000-0000-0000-0000-000000000000/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Unauthorized message" }),
    });
    expect(resMsg.status).toBe(401);
  });

  it("fetches consultations list and verifies consultation data structure", async () => {
    const res = await fetch(`${baseUrl}/api/consultations`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(Array.isArray(data.consultations)).toBe(true);
    if (data.consultations.length > 0) {
      expect(data.consultations[0]).toHaveProperty("groupName");
      expect(data.consultations[0]).toHaveProperty("topic");
    }
  });

  it("validates auth login credentials with schema guardrails", async () => {
    // Attempting login with invalid email format should fail schema validation with 400
    const resInvalid = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "short",
      }),
    });
    expect(resInvalid.status).toBe(400);
    const errData = await resInvalid.json() as any;
    expect(errData).toHaveProperty("error");
  });
});
