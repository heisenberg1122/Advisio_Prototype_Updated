import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { chromium } from "playwright";

// Run after a frontend production build, without VITE_API_URL, using only synthetic data.
test(
  "researcher offline workspace survives reload, isolates accounts, refreshes access, and clears on logout",
  { timeout: 180_000 },
  async () => {
    const dist = resolve("apps/web/dist");
    const token = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.offline-test`;
    const otherToken = `${token}-other-account`;
    const user = {
      id: "offline-test-user",
      universityId: "test-university",
      firstName: "Test",
      lastName: "Researcher",
      email: "offline@example.invalid",
      roles: ["RESEARCHER"],
      permissions: [],
      college: { id: "college", name: "Test College", code: "TC" },
    };
    const workflow = {
      id: "workflow-1",
      name: "Research Methods",
      stages: [
        {
          id: "stage-1",
          name: "Chapter One",
          sequence: 1,
          targetCompletionDate: "2026-12-01",
          tasks: [
            {
              id: "task-1",
              title: "Introduction",
              instructions: "Explain the research problem.",
              allowedFileTypes: "PDF",
            },
          ],
        },
      ],
    };
    const project = {
      id: "project-1",
      title: "Offline Research Study",
      workflowInstance: { workflowId: workflow.id, workflow },
      taskSubmissions: [
        {
          taskId: "task-1",
          status: "REVISION_REQUIRED",
          reviewNote: "Clarify the objectives.",
        },
      ],
    };
    let removed = false;
    let authRejected = false;
    let revised = false;
    const writes = [];
    const server = createServer(async (request, response) => {
      const path = new URL(request.url, "http://localhost").pathname;
      const json = (value, status = 200) => {
        response.writeHead(status, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        response.end(JSON.stringify(value));
      };
      if (path.startsWith("/api/")) {
        if (request.method !== "GET") writes.push(path);
        if (path === "/api/auth/me")
          return json(
            authRejected ? { error: "Session revoked" } : { user },
            authRejected ? 401 : 200,
          );
        if (path === "/api/research")
          return json({
            projects: removed
              ? []
              : [
                  {
                    ...project,
                    workflowInstance: {
                      ...project.workflowInstance,
                      workflow: {
                        ...workflow,
                        stages: workflow.stages.map((stage) => ({
                          ...stage,
                          tasks: stage.tasks.map((task) => ({
                            ...task,
                            instructions: revised
                              ? "Updated instructions after reconnect."
                              : task.instructions,
                          })),
                        })),
                      },
                    },
                  },
                ],
          });
        if (path === "/api/workflows/enrollments/me")
          return json({
            enrollments: removed ? [] : [{ workflowId: workflow.id, workflow }],
          });
        if (path === "/api/research/project-1/manuscript-workflow")
          return json({
            milestones: [{ id: "stage-1", status: "REVISION_REQUIRED" }],
          });
        if (path === "/api/research/project-1/documents")
          return json({
            documents: [
              {
                title: "Chapter 1 manuscript",
                versions: [
                  {
                    id: "v1",
                    versionNumber: 1,
                    fileName: "chapter-one.pdf",
                    mimeType: "application/pdf",
                    webViewLink: "/api/documents/versions/v1/content",
                    reviews: [
                      {
                        status: "SUBMITTED",
                        overallComment: "Strengthen the literature review.",
                      },
                    ],
                  },
                ],
              },
            ],
          });
        if (path === "/api/workflows/workflow-1/resources")
          return json({ resources: [] });
        if (path === "/api/documents/versions/v1/content") {
          response.writeHead(200, { "Content-Type": "application/pdf" });
          return response.end("%PDF-1.4\nSynthetic offline test file\n%%EOF");
        }
        if (path === "/api/auth/logout") return json({ success: true });
        return json({ error: `Unexpected test endpoint: ${path}` }, 404);
      }
      try {
        let file = resolve(dist, `.${decodeURIComponent(path)}`);
        if (!file.startsWith(`${dist}${sep}`))
          file = resolve(dist, "index.html");
        let data;
        try {
          data = await readFile(file);
        } catch {
          file = resolve(dist, "index.html");
          data = await readFile(file);
        }
        const type =
          {
            ".js": "text/javascript",
            ".css": "text/css",
            ".html": "text/html",
            ".woff2": "font/woff2",
          }[extname(file)] || "application/octet-stream";
        response.writeHead(200, {
          "Content-Type": type,
          "Cache-Control": "no-cache",
        });
        response.end(data);
      } catch {
        response.writeHead(500);
        response.end("Test server error");
      }
    });
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === "win32" ? { channel: "chrome" } : {}),
    });
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1365, height: 950 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const assertVisible = async (locator) => {
      await locator.waitFor({ state: "visible", timeout: 25_000 });
    };
    const records = () =>
      page.evaluate(
        () =>
          new Promise((done, reject) => {
            const request = indexedDB.open("advisio-offline-v1", 1);
            request.onsuccess = () => {
              const read = request.result
                .transaction("records")
                .objectStore("records")
                .getAll();
              read.onsuccess = () => {
                done(read.result.map(({ key }) => key));
                request.result.close();
              };
              read.onerror = reject;
            };
            request.onerror = reject;
          }),
      );
    try {
      await page.goto(`${base}/login`);
      await page.evaluate(
        (value) => localStorage.setItem("advisio_token", value),
        token,
      );
      await page.goto(`${base}/student/offline`);
      await page.getByRole("button", { name: "Enable on this device" }).click();
      await assertVisible(
        page.getByText("Requirements and feedback saved.", { exact: false }),
      );
      await page.waitForFunction(() =>
        Boolean(navigator.serviceWorker.controller),
      );
      await page.getByRole("button", { name: /Introduction/ }).click();
      await assertVisible(
        page.getByText("Explain the research problem.", { exact: true }),
      );
      await assertVisible(
        page.getByText("Clarify the objectives.", { exact: true }),
      );
      await page
        .getByRole("button", { name: "Make available offline" })
        .click();
      await assertVisible(
        page.getByRole("button", { name: "Open saved file" }),
      );
      const editor = page.getByLabel("Private preparation draft");
      await editor.fill("My prepared submission note.");
      await assertVisible(
        page.getByText("Saved on this device · Not submitted", { exact: true }),
      );
      assert.equal(
        (await records()).some((key) => key.startsWith("session:")),
        true,
      );
      assert.equal(
        (await records()).some((key) => key.includes(token)),
        false,
        "raw auth tokens must not be stored in offline record keys",
      );

      await context.setOffline(true);
      await page.reload();
      await assertVisible(
        page.getByRole("heading", { name: "Offline workspace", exact: true }),
      );
      await assertVisible(page.getByText("You’re offline", { exact: true }));
      await assertVisible(
        page.getByText("Explain the research problem.", { exact: true }),
      );
      assert.equal(await editor.inputValue(), "My prepared submission note.");
      await editor.fill("Revision prepared during the outage.");
      await assertVisible(
        page.getByText("Saved on this device · Not submitted", { exact: true }),
      );
      const downloaded = page.waitForEvent("download");
      await page.getByRole("button", { name: "Open saved file" }).click();
      assert.equal((await downloaded).suggestedFilename(), "chapter-one.pdf");
      assert.deepEqual(
        writes,
        [],
        "offline work must never submit or send any action",
      );
      await page.reload();
      await assertVisible(editor);
      assert.equal(
        await editor.inputValue(),
        "Revision prepared during the outage.",
      );

      await page.evaluate(
        (value) => localStorage.setItem("advisio_token", value),
        otherToken,
      );
      await page.reload();
      await assertVisible(
        page.getByRole("heading", { name: "Unable to load your session" }),
      );
      assert.equal(
        await page
          .getByRole("heading", { name: "Offline workspace", exact: true })
          .count(),
        0,
        "another account must not open cached identity or files",
      );
      await page.evaluate(
        (value) => localStorage.setItem("advisio_token", value),
        token,
      );
      await page.reload();
      await assertVisible(editor);
      await page.evaluate(() => {
        history.pushState(null, "", "/admin/dashboard");
        dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.waitForURL(`${base}/student/offline`);
      await assertVisible(editor);

      revised = true;
      await context.setOffline(false);
      await assertVisible(
        page.getByText("Updated instructions after reconnect.", {
          exact: true,
        }),
      );
      await assertVisible(editor);
      assert.equal(
        await editor.inputValue(),
        "Revision prepared during the outage.",
      );
      await mkdir(resolve(".local/offline-qa"), { recursive: true });
      await page.screenshot({
        path: resolve(".local/offline-qa/desktop.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
        "mobile workspace must not overflow horizontally",
      );
      await page.screenshot({
        path: resolve(".local/offline-qa/mobile.png"),
        fullPage: true,
      });

      removed = true;
      await page
        .getByRole("button", { name: "Refresh saved information" })
        .click();
      await assertVisible(
        page.getByRole("heading", { name: "Other saved drafts" }),
      );
      assert.equal(
        (await records()).some((key) => key.includes("file:document:v1")),
        false,
        "revoked file access must prune the downloaded blob",
      );
      assert.equal(
        await page.getByRole("button", { name: "Open saved file" }).count(),
        0,
      );
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Log Out/ })
        .click();
      await page.waitForURL(`${base}/login`);
      await page.waitForLoadState("networkidle");
      assert.deepEqual(
        await records(),
        [],
        "logout clears cached identity, snapshots, files, and drafts",
      );
      assert.equal(
        await page.evaluate(() => localStorage.getItem("advisio_token")),
        null,
      );

      removed = false;
      await page.evaluate(
        (value) => localStorage.setItem("advisio_token", value),
        token,
      );
      await page.goto(`${base}/student/offline`);
      await page.getByRole("button", { name: "Enable on this device" }).click();
      await assertVisible(
        page.getByText("Requirements and feedback saved.", { exact: false }),
      );
      authRejected = true;
      await page
        .getByRole("button", { name: "Refresh saved information" })
        .click();
      await page.waitForURL(`${base}/login`);
      await page.waitForLoadState("networkidle");
      assert.deepEqual(
        await records(),
        [],
        "a server-rejected session must never fall back to cached access",
      );
      assert.deepEqual(errors, []);
    } catch (error) {
      await mkdir(resolve(".local/offline-qa"), { recursive: true });
      await page
        .screenshot({
          path: resolve(".local/offline-qa/failure.png"),
          fullPage: true,
        })
        .catch(() => {});
      console.error((await page.locator("body").innerText()).slice(-5000));
      throw error;
    } finally {
      await context.close();
      await browser.close();
      await new Promise((done) => server.close(done));
    }
  },
);
