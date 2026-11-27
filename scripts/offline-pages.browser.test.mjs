import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { chromium } from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";

// Uses the production build and synthetic API responses, never the real API/database.
test(
  "normal researcher pages retain offline navigation, notes, PDFs and account isolation",
  { timeout: 180_000 },
  async () => {
    const dist = resolve("apps/web/dist");
    const token = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.offline-pages-test`;
    const otherToken = `${token}-other-account`;
    const user = {
      id: "test-researcher",
      universityId: "test-university",
      firstName: "Test",
      lastName: "Researcher",
      email: "offline@example.invalid",
      roles: ["RESEARCHER"],
      permissions: [],
      college: { id: "college", name: "Test College", code: "TC" },
    };
    const task = {
      id: "task-1",
      title: "Introduction",
      instructions: "Explain the research problem.",
      allowedFileTypes: "PDF",
      sequence: 1,
      isRequired: true,
    };
    const stage = {
      id: "stage-1",
      name: "Chapter One",
      sequence: 1,
      workflowId: "workflow-1",
      milestoneType: "MANUSCRIPT",
      requiresDocument: true,
      targetCompletionDate: "2026-12-01",
      tasks: [task],
    };
    const workflow = {
      id: "workflow-1",
      name: "Research Methods",
      stages: [stage],
    };
    const project = {
      id: "project-1",
      title: "Offline Research Study",
      status: "IN_PROGRESS",
      participationMode: "SOLO",
      createdAt: "2026-11-01T00:00:00Z",
      members: [
        {
          id: "membership-1",
          userId: user.id,
          user,
          projectRole: "LEADER",
          leftAt: null,
        },
      ],
      workflowInstance: {
        workflowId: workflow.id,
        workflow,
        currentStage: stage,
        startedAt: "2026-11-01T00:00:00Z",
      },
      taskSubmissions: [],
    };
    const version = {
      id: "v1",
      versionNumber: 1,
      fileName: "chapter-one.pdf",
      mimeType: "application/pdf",
      webViewLink: "/api/documents/versions/v1/content",
      uploadedAt: "2026-11-01T00:00:00Z",
      manuscriptStatus: "SUBMITTED",
      isImmutable: true,
      reviews: [
        {
          id: "review-1",
          reviewType: "ADVISER",
          status: "SUBMITTED",
          submittedAt: "2026-11-02T00:00:00Z",
          overallComment: "Strengthen the literature review.",
          reviewer: null,
          comments: [],
        },
      ],
      reviewerAssignments: [
        {
          id: "assignment-1",
          reviewType: "ADVISER",
          status: "COMPLETED",
          isRequired: true,
          reviewer: null,
          review: {
            id: "review-1",
            submittedAt: "2026-11-02T00:00:00Z",
            recommendation: "MINOR_REVISION",
            overallComment: "Strengthen the literature review.",
            comments: [],
          },
        },
      ],
    };
    const document = {
      id: "document-1",
      title: "Chapter 1 manuscript",
      documentType: "MANUSCRIPT",
      lifecycleStatus: "SUBMITTED",
      currentVersion: 1,
      updatedAt: version.uploadedAt,
      milestoneId: stage.id,
      milestone: stage,
      versions: [version],
    };
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf
      .addPage([400, 500])
      .drawText("Offline research manuscript", {
        x: 30,
        y: 440,
        size: 18,
        font,
      });
    const pdfBytes = Buffer.from(await pdf.save());
    let removed = false,
      rejected = false,
      revised = false;
    const writes = [],
      unexpected = [];
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
            rejected ? { error: "Session revoked" } : { user },
            rejected ? 401 : 200,
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
                        stages: [
                          {
                            ...stage,
                            tasks: [
                              {
                                ...task,
                                instructions: revised
                                  ? "Updated instructions after reconnect."
                                  : task.instructions,
                              },
                            ],
                          },
                        ],
                      },
                    },
                  },
                ],
          });
        if (path === "/api/workflows/enrollments/me")
          return json({
            enrollments: removed
              ? []
              : [
                  {
                    id: "enrollment-1",
                    workflowId: workflow.id,
                    workflow,
                    status: "ACTIVE",
                  },
                ],
          });
        if (path === "/api/research/project-1/documents")
          return json({
            documents: [document],
            permissions: {
              canView: true,
              canManageWorkingDocuments: true,
              canSubmitManuscript: true,
              canReview: false,
              canApproveOfficialDocuments: false,
            },
          });
        if (path === "/api/research/project-1/manuscript-workflow")
          return json({
            milestones: [
              {
                ...stage,
                status: "IN_PROGRESS",
                isCurrent: true,
                completed: false,
                totalRequirements: 1,
                completedRequirements: 0,
                completionPercent: 0,
              },
            ],
            activity: [],
          });
        if (path === "/api/research/project-1/official-copies")
          return json({
            copies: [],
            eligibleVersions: [],
            permissions: {
              canView: true,
              canFinalize: false,
              canSign: false,
              canRevoke: false,
            },
          });
        if (path === "/api/research/project-1/defense-result")
          return json({ result: null });
        if (path === "/api/workflows/workflow-1/resources")
          return json({
            canManage: false,
            resources: removed
              ? []
              : [
                  {
                    id: "guide-1",
                    title: "Manuscript guide",
                    fileName: "manuscript-guide.pdf",
                    mimeType: "application/pdf",
                    fileSize: pdfBytes.length,
                    version: 1,
                    updatedAt: version.uploadedAt,
                  },
                ],
          });
        if (
          path === "/api/documents/versions/v1/content" ||
          path === "/api/workflows/resources/guide-1/file"
        ) {
          response.writeHead(200, { "Content-Type": "application/pdf" });
          return response.end(pdfBytes);
        }
        if (path === "/api/workflows/tasks/task-1/submission-options")
          return json({
            availability: { canSubmit: true, reasons: [] },
            task: { ...task, allowedFileTypes: ["PDF"] },
            options: [
              {
                kind: "STORED_VERSION",
                document: { id: document.id, title: document.title },
                version: {
                  id: version.id,
                  versionNumber: 1,
                  fileName: version.fileName,
                },
              },
            ],
            unavailableOptionReasons: [],
          });
        if (path === "/api/workflows/access/me") return json({ entries: [] });
        if (path === "/api/workspaces/me") return json({ workspaces: [] });
        if (path === "/api/consultations") return json({ consultations: [] });
        if (path === "/api/notifications")
          return json({ notifications: [], unreadCount: 0 });
        if (path === "/api/defense-management") return json({ sessions: [] });
        if (path === "/api/adviser-requests") return json({ requests: [] });
        if (path === "/api/research/project-1/join-requests")
          return json({ requests: [] });
        if (path === "/api/auth/logout") return json({ success: true });
        if (path.includes("/attachments"))
          return json({ attachments: [], canManage: false });
        if (path === "/api/users/me") return json({ user, profile: user });
        unexpected.push(path);
        return json({});
      }
      try {
        let file = resolve(dist, `.${decodeURIComponent(path)}`);
        if (!file.startsWith(`${dist}${sep}`))
          file = resolve(dist, "index.html");
        let bytes;
        try {
          bytes = await readFile(file);
        } catch {
          file = resolve(dist, "index.html");
          bytes = await readFile(file);
        }
        response.writeHead(200, {
          "Content-Type":
            {
              ".js": "text/javascript",
              ".mjs": "text/javascript",
              ".css": "text/css",
              ".html": "text/html",
              ".woff2": "font/woff2",
              ".png": "image/png",
              ".svg": "image/svg+xml",
            }[extname(file)] || "application/octet-stream",
          "Cache-Control": "no-cache",
        });
        response.end(bytes);
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
      reducedMotion: "reduce",
      viewport: { width: 1365, height: 950 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const visible = (locator) =>
      locator.waitFor({ state: "visible", timeout: 20_000 });
    const taskUrl = `${base}/student/tasks/task-1?projectId=project-1&workflowId=workflow-1`;
    const docsUrl = `${base}/student/documents?projectId=project-1&documentId=document-1&versionId=v1`;
    const settings = () =>
      page.getByRole("button", { name: "Offline settings", exact: true });
    const panel = () =>
      page.getByRole("dialog", { name: "Offline settings", exact: true });
    const records = () =>
      page.evaluate(
        () =>
          new Promise((done, reject) => {
            const request = indexedDB.open("advisio-offline-v1", 1);
            request.onsuccess = () => {
              const query = request.result
                .transaction("records")
                .objectStore("records")
                .getAll();
              query.onsuccess = () => {
                done(query.result.map(({ key }) => key));
                request.result.close();
              };
              query.onerror = reject;
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
      await page.goto(taskUrl);
      await visible(
        page.getByRole("heading", { name: "Introduction", exact: true }),
      );
      await settings().click();
      assert.equal(
        new URL(page.url()).pathname,
        "/student/tasks/task-1",
        "settings must not navigate away",
      );
      await panel()
        .getByRole("button", { name: "Enable on this device" })
        .click();
      await visible(
        panel().getByText("Ready for offline use.", { exact: false }),
      );
      await page.waitForFunction(() =>
        Boolean(navigator.serviceWorker.controller),
      );
      await page
        .getByRole("button", { name: "Close offline settings" })
        .click();
      const note = page.getByLabel("Note for faculty", { exact: false });
      await note.fill("My prepared submission note.");
      await visible(
        page.getByText("Saved on this device · Not submitted", { exact: true }),
      );
      assert.equal(
        await page
          .getByText("Private preparation draft", { exact: true })
          .count(),
        0,
        "there must be no separate draft editor",
      );

      await page.goto(docsUrl);
      await visible(
        page.getByRole("button", {
          name: "Make available offline",
          exact: true,
        }),
      );
      await visible(page.locator("canvas").first());
      await page
        .getByRole("button", { name: "Make available offline", exact: true })
        .click();
      await visible(
        page.getByRole("button", { name: "Available offline", exact: true }),
      );
      await page.goto(`${base}/student/tasks?projectId=project-1`);
      await page.getByRole("tab", { name: /Guides & Templates/ }).click();
      await page
        .getByRole("button", { name: "Make available offline", exact: true })
        .click();
      await visible(
        page.getByRole("button", { name: "Available offline", exact: true }),
      );
      await page.goto(docsUrl);
      await visible(page.locator("canvas").first());
      await context.setOffline(true);
      await page.reload();
      await visible(
        page.getByRole("button", { name: "Available offline", exact: true }),
      );
      await visible(page.locator("canvas").first());
      assert.equal(new URL(page.url()).pathname, "/student/documents");
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download version 1", exact: true })
        .click();
      assert.equal((await download).suggestedFilename(), version.fileName);
      await page.goto(taskUrl);
      await visible(note);
      assert.equal(await note.inputValue(), "My prepared submission note.");
      await note.fill("Revision prepared during the outage.");
      await visible(
        page.getByText("Saved on this device · Not submitted", { exact: true }),
      );
      await page.reload();
      await visible(note);
      assert.equal(
        await note.inputValue(),
        "Revision prepared during the outage.",
      );
      assert.equal(new URL(page.url()).pathname, "/student/tasks/task-1");
      await page
        .getByRole("button", { name: "Choose from Documents", exact: false })
        .click();
      await page
        .locator('input[name="document-submission-option"]')
        .first()
        .check();
      assert.equal(
        await page
          .getByRole("button", {
            name: "Review document submission",
            exact: true,
          })
          .isEnabled(),
        false,
      );
      assert.deepEqual(
        writes,
        [],
        "offline work must not replay an official action",
      );
      await page.goto(`${base}/student/dashboard?projectId=project-1`);
      await visible(
        page.getByRole("heading", { name: project.title, exact: true }),
      );
      assert.equal(new URL(page.url()).pathname, "/student/dashboard");
      await page.goto(`${base}/student/tasks?projectId=project-1`);
      await visible(settings());
      await page.getByRole("tab", { name: /Guides & Templates/ }).click();
      await page.getByRole("button", { name: "View", exact: true }).click();
      const guide = page.getByRole("dialog", {
        name: "manuscript-guide.pdf",
        exact: true,
      });
      await visible(guide.locator("canvas"));
      assert.equal(new URL(page.url()).pathname, "/student/tasks");
      await guide
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("heading", { name: "Offline workspace", exact: true })
          .count(),
        0,
      );

      await page.evaluate(
        (value) => localStorage.setItem("advisio_token", value),
        otherToken,
      );
      await page.reload();
      await visible(
        page.getByRole("heading", { name: "Unable to load your session" }),
      );
      assert.equal(
        await page.getByLabel("Note for faculty", { exact: false }).count(),
        0,
      );
      await page.evaluate(
        (value) => localStorage.setItem("advisio_token", value),
        token,
      );
      await page.goto(taskUrl);
      await visible(note);
      await page.evaluate(() => {
        history.pushState(null, "", "/admin/dashboard");
        dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.waitForURL(/\/student\/dashboard/);
      await page.goto(taskUrl);
      await visible(note);
      revised = true;
      await context.setOffline(false);
      await visible(
        page.getByText("Updated instructions after reconnect.", {
          exact: true,
        }),
      );
      await visible(note);
      assert.equal(
        await note.inputValue(),
        "Revision prepared during the outage.",
      );
      await visible(
        page.getByRole("button", {
          name: "I’ve reviewed this draft",
          exact: true,
        }),
      );
      await page
        .getByRole("button", { name: "I’ve reviewed this draft", exact: true })
        .click();
      await visible(
        page.getByText("Saved on this device · Not submitted", { exact: true }),
      );
      await mkdir(resolve(".local/offline-qa"), { recursive: true });
      await page.screenshot({
        path: resolve(".local/offline-qa/integrated-desktop.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector(".workspace-frame__body"))
            .paddingLeft === "0px",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await settings().click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: resolve(".local/offline-qa/integrated-mobile.png"),
        fullPage: true,
      });
      removed = true;
      await panel()
        .getByRole("button", { name: "Refresh saved information" })
        .click();
      await visible(
        panel().getByText("Ready for offline use.", { exact: false }),
      );
      assert.equal(
        (await records()).some((key) => key.includes("file:document:v1")),
        false,
      );
      assert.equal(
        (await records()).some((key) =>
          key.includes("response:/api/research/project-1/"),
        ),
        false,
      );
      const exported = page.waitForEvent("download");
      await panel()
        .getByRole("button", { name: "Export local drafts" })
        .click();
      assert.equal(
        (await exported).suggestedFilename(),
        "Advisio local drafts.txt",
      );
      await page
        .getByRole("button", { name: "Close offline settings" })
        .click();
      await page
        .getByRole("button", { name: "Open profile menu", exact: true })
        .click();
      await page
        .getByRole("button", { name: /Sign Out/i })
        .first()
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Log Out/ })
        .click();
      await page.waitForURL(`${base}/login`);
      await page.waitForLoadState("networkidle");
      assert.deepEqual(await records(), []);
      removed = false;
      await page.evaluate(
        (value) => localStorage.setItem("advisio_token", value),
        token,
      );
      await page.goto(taskUrl);
      await visible(settings());
      await settings().click();
      await panel()
        .getByRole("button", { name: "Enable on this device" })
        .click();
      await visible(
        panel().getByText("Ready for offline use.", { exact: false }),
      );
      rejected = true;
      await panel()
        .getByRole("button", { name: "Refresh saved information" })
        .click();
      await page.waitForURL(`${base}/login`);
      await page.waitForLoadState("networkidle");
      assert.deepEqual(await records(), []);
      assert.deepEqual(errors, []);
    } catch (error) {
      await mkdir(resolve(".local/offline-qa"), { recursive: true });
      await page
        .screenshot({
          path: resolve(".local/offline-qa/integrated-failure.png"),
          fullPage: true,
        })
        .catch(() => {});
      console.error("URL:", page.url(), "Unexpected API paths:", [
        ...new Set(unexpected),
      ]);
      console.error((await page.locator("body").innerText()).slice(-7000));
      console.error("Browser errors:", errors);
      throw error;
    } finally {
      await context.close();
      await browser.close();
      await new Promise((done) => server.close(done));
    }
  },
);
