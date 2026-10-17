import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import app from "../app.js";

describe("Faculty Profile API Suite", () => {
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

  it("rejects unauthenticated access to GET /api/faculty-profiles/me", async () => {
    const res = await fetch(`${baseUrl}/api/faculty-profiles/me`);
    expect(res.status).toBe(401);
    const data = (await res.json()) as any;
    expect(data.error).toBeDefined();
  });

  it("rejects unauthenticated access to PUT /api/faculty-profiles/me", async () => {
    const res = await fetch(`${baseUrl}/api/faculty-profiles/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        biography: "Unauthorized test",
      }),
    });
    expect(res.status).toBe(401);
    const data = (await res.json()) as any;
    expect(data.error).toBeDefined();
  });

  it("rejects unauthenticated access to GET /api/faculty-profiles/:userId", async () => {
    const res = await fetch(`${baseUrl}/api/faculty-profiles/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(401);
  });
});
