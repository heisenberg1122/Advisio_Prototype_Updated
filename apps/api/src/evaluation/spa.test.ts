import { test, expect } from "vitest";
import express from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { evaluationSpa } from "./spa.js";

test("hosted portals use a first-party SPA, bounded CSP, and real API 404 responses", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "advisio-evaluation-spa-"),
  );
  const bootstrap =
    '\r\ndocument.documentElement.dataset.appearance="light";\r\n';
  const html = `<!doctype html><script>${bootstrap}</script><div id="root"></div><script src="/assets/main.js"></script>`;
  await fs.mkdir(path.join(directory, "assets"));
  await fs.writeFile(path.join(directory, "index.html"), html);
  await fs.writeFile(
    path.join(directory, "assets/main.js"),
    'console.log("loaded")',
  );
  const app = express();
  app.use(evaluationSpa(directory));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing local test address.");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const route of [
      "/evaluate",
      "/evaluate/print",
      "/student/dashboard",
      "/adviser/dashboard",
      "/professor/dashboard",
      "/panelist/dashboard",
      "/admin/dashboard",
    ]) {
      const response = await fetch(base + route);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(html);
      const policy = response.headers.get("content-security-policy")!;
      expect(policy).toContain(
        `'sha256-${createHash("sha256").update(bootstrap.replace(/\r\n/g, "\n")).digest("base64")}'`,
      );
      expect(policy).toContain("worker-src 'self' blob:");
      expect(policy).toContain("frame-ancestors 'none'");
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(await (await fetch(`${base}/assets/main.js`)).text()).toContain(
      "loaded",
    );
    const api = await fetch(`${base}/api/not-a-real-route`);
    expect(api.status).toBe(404);
    expect(await api.json()).toEqual({ error: "API route not found." });
    expect((await fetch(`${base}/assets/missing.js`)).status).toBe(404);
    expect((await fetch(`${base}/.env`)).status).toBe(404);
    expect((await fetch(`${base}/%2eenv`)).status).toBe(404);
    expect((await fetch(`${base}/assets/.keys`)).status).toBe(404);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await fs.rm(directory, { recursive: true, force: true });
  }
});
