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
  const playerScript = 'document.querySelector("video").dataset.ready="true";';
  await fs.mkdir(path.join(directory, "walkthroughs"));
  await fs.writeFile(
    path.join(directory, "walkthroughs", "index.html"),
    `<video controls></video><script>${playerScript}</script>`,
  );
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
    for (const entry of ["/", "/index.html"]) {
      for (const search of ["", "?role=student&course=BSIT"]) {
        const response = await fetch(base + entry + search, {
          redirect: "manual",
        });
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe(`/evaluate${search}`);
        expect(response.headers.get("cache-control")).toBe("no-store");
        const redirected = await fetch(base + entry + search);
        expect(new URL(redirected.url).pathname).toBe("/evaluate");
        expect(new URL(redirected.url).search).toBe(search);
        expect(await redirected.text()).toBe(html);
      }
    }
    for (const route of [
      "/evaluate",
      "/evaluate/print",
      "/student/dashboard",
      "/adviser/dashboard",
      "/professor/dashboard",
      "/panelist/dashboard",
      "/panelist/reviews?tab=defense-packets&sessionId=completed&review=history",
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
    const player = await fetch(`${base}/walkthroughs/index.html`);
    expect(player.status).toBe(200);
    const playerPolicy = player.headers.get("content-security-policy")!;
    const scriptPolicy = playerPolicy
      .split(";")
      .find((rule) => rule.trim().startsWith("script-src"))!;
    expect(scriptPolicy).toContain(
      `'sha256-${createHash("sha256").update(playerScript).digest("base64")}'`,
    );
    expect(scriptPolicy).not.toContain("unsafe-inline");
    expect(scriptPolicy).not.toContain(
      createHash("sha256")
        .update(bootstrap.replace(/\r\n/g, "\n"))
        .digest("base64"),
    );
    expect(playerPolicy).toContain("frame-ancestors 'none'");
    expect(playerPolicy).toContain("media-src 'self' blob:");
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
