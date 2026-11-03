import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";
import {
  root,
  assets,
  output,
  readJson,
  readScript,
  writeJson,
  duration,
  encode,
} from "./common.mjs";
import {
  beatKey,
  scriptHash,
  validateScript,
} from "../../walkthrough/shared/timing.mjs";

const script = await readScript();
const viewport = { width: 1366, height: 768 };
try {
  process.loadEnvFile?.(path.join(root, ".env.walkthrough.local"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
validateScript(script);
const auditOnly = process.argv.includes("--audit");
const replaceBeats = process.argv
  .find((arg) => arg.startsWith("--replace="))
  ?.slice(10)
  .split(",");
const resume = process.argv.includes("--resume");
const prior =
  replaceBeats || resume
    ? await readJson(path.join(output, "captures.json"))
    : null;
if (
  prior &&
  (prior.auditOnly ||
    prior.scriptHash !== scriptHash(script) ||
    prior.presentationVersion !== script.presentationVersion)
)
  throw new Error("Selective recapture requires matching production assets.");
const only = process.argv
  .find((arg) => arg.startsWith("--only="))
  ?.slice(7)
  .split(",");
if (only && !auditOnly)
  throw new Error(
    "--only captures are diagnostic previews; production capture must include all chapters.",
  );
const fromChapter = process.argv
  .find((arg) => arg.startsWith("--from="))
  ?.slice(7);
if (fromChapter && !auditOnly)
  throw new Error(
    "--from is for audit diagnostics only. Production capture must cover every chapter.",
  );
const base = new URL(
  process.env.WALKTHROUGH_BASE_URL || "http://localhost:3100",
);
if (
  !["127.0.0.1", "localhost"].includes(base.hostname) ||
  base.protocol !== "http:" ||
  base.username ||
  base.password ||
  base.pathname !== "/"
)
  throw new Error(
    "Capture requires a loopback evaluation origin, never a production session.",
  );
const voice = await readJson(path.join(output, "voice.json")).catch(() => null);
if (!auditOnly && voice?.scriptHash !== scriptHash(script))
  throw new Error(
    "Generate narration first, or use --audit for non-publishable capture verification.",
  );
if (!auditOnly && voice?.voiceId !== process.env.ELEVENLABS_VOICE_ID)
  throw new Error(
    "The selected narrator changed. Generate all narration in that voice before timed capture.",
  );
await fs.mkdir(path.join(assets, "clips"), { recursive: true });
const browser = await chromium.launch({ headless: true });
const auth = await browser.newContext({ baseURL: base.origin });
let session;
const report = {
  presentationVersion: script.presentationVersion,
  viewport,
  scriptHash: scriptHash(script),
  auditOnly,
  course: script.course,
  role: script.role,
  beats: prior?.beats || {},
  previousErrors: [...(prior?.previousErrors || []), ...(prior?.errors || [])],
  errors: [],
};
async function request(endpoint, options) {
  const response = await auth.request.fetch(endpoint, {
    headers: { Origin: base.origin },
    ...options,
  });
  if (!response.ok())
    throw new Error(
      `Evaluation request failed: ${endpoint} (${response.status()}).`,
    );
  return response;
}
try {
  const health = await (await request("/api/health")).json();
  if (health.mode !== "evaluation")
    throw new Error("The selected server is not in evaluation mode.");
  await request("/api/evaluation/config");
  session = await (
    await request("/api/evaluation/session", {
      method: "POST",
      data: { role: script.role, course: script.course, acknowledged: true },
    })
  ).json();
  if (
    session.role !== "student" ||
    session.course !== "BSIT" ||
    !session.title.startsWith("CampusWay:")
  )
    throw new Error("Unexpected evaluation seed.");
  const me = await (await request("/api/auth/me")).json();
  if (
    JSON.stringify(me).includes("@") &&
    !JSON.stringify(me).includes("@evaluation.invalid")
  )
    throw new Error("Expected fictional evaluation identity.");
  const revision = {
    name: session.revisionName,
    mimeType: "application/pdf",
    buffer: await (await request("/api/evaluation/revision")).body(),
  };
  const workflow = await (
    await request(`/api/research/${session.projectId}/manuscript-workflow`)
  ).json();
  const task = workflow.milestones
    .flatMap((stage) => stage.tasks || [])
    .find((item) => item.title === "Revised research proposal");
  if (!task) throw new Error("Prepared revision task missing.");
  const taskRoute = `/student/tasks/${task.id}?projectId=${session.projectId}`;
  const cookies = await auth.cookies();
  for (const chapter of script.chapters)
    for (const beat of chapter.beats) {
      if (only && !only.includes(chapter.id)) continue;
      if (
        fromChapter &&
        script.chapters.indexOf(chapter) <
          script.chapters.findIndex((item) => item.id === fromChapter)
      )
        continue;
      const id = beatKey(chapter, beat);
      if (resume && prior?.beats[id] && !replaceBeats?.includes(id)) continue;
      if (!resume && replaceBeats && !replaceBeats.includes(id)) continue;
      if (["intro", "outro"].includes(beat.action)) continue;
      console.log(`Capturing ${id}`);
      const context = await browser.newContext({
        baseURL: base.origin,
        viewport,
        recordVideo: {
          dir: path.join(output, "raw"),
          size: viewport,
        },
        locale: "en-US",
        timezoneId: "Asia/Manila",
        colorScheme: "light",
      });
      await context.addCookies(cookies);
      await context.addInitScript(() => {
        localStorage.setItem("advisio_token", "__evaluation__");
        // Recording-only removal of study controls. They remain in the live product.
        const prepare = () => {
          const style = document.createElement("style");
          style.textContent =
            ".evaluation-banner,.evaluation-overlay{display:none!important}";
          document.head.appendChild(style);
          const redact = (node) => {
            if (
              node.nodeType === Node.TEXT_NODE &&
              node.textContent.includes("@evaluation.invalid")
            )
              node.textContent = node.textContent.replaceAll(
                "@evaluation.invalid",
                "@example.invalid",
              );
            else if (
              node.nodeType === Node.ELEMENT_NODE &&
              !["SCRIPT", "STYLE"].includes(node.nodeName)
            )
              for (const child of node.childNodes) redact(child);
          };
          new MutationObserver((records) => {
            for (const record of records) {
              if (record.type === "characterData") redact(record.target);
              else for (const node of record.addedNodes) redact(node);
            }
          }).observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
          });
          redact(document.body);
        };
        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", prepare, {
            once: true,
          });
        else prepare();
      });
      const page = await context.newPage();
      // Keep the displayed date consistent while allowing Motion's clock to tick.
      // A fixed Date.now() leaves route transitions permanently transparent.
      await page.clock.setSystemTime(
        new Date(`${new Date().toISOString().slice(0, 10)}T04:00:00Z`),
      );
      const uiErrors = [];
      const pendingApi = new Set();
      const waiters = new Set();
      page.on("request", (req) => {
        if (
          new URL(req.url()).pathname.startsWith("/api/") &&
          new URL(req.url()).pathname !== "/api/research" &&
          !/stream|realtime|events|notifications/.test(req.url())
        )
          pendingApi.add(req);
      });
      const complete = (req) => {
        pendingApi.delete(req);
        if (!pendingApi.size) for (const resolve of waiters) resolve();
      };
      page.on("requestfinished", complete);
      page.on("requestfailed", complete);
      async function settled() {
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        if (pendingApi.size) await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            waiters.delete(done);
            reject(
              new Error(
                `API readiness timed out: ${[...pendingApi].map((req) => new URL(req.url()).pathname).join(", ")}`,
              ),
            );
          }, 30000);
          const done = () => {
            clearTimeout(timer);
            waiters.delete(done);
            resolve();
          };
          waiters.add(done);
        });
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        await page.waitForFunction(() => {
          const content = document.querySelector("main > div");
          return content && Number(getComputedStyle(content).opacity) >= 0.99;
        });
      }
      page.on("pageerror", (error) => uiErrors.push(error.message));
      const failedRequests = [];
      page.on("requestfailed", (req) =>
        failedRequests.push(new URL(req.url()).pathname),
      );
      // Block external navigation/requests rather than using a real integration.
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        const productFont =
          [
            "fonts.googleapis.com",
            "fonts.gstatic.com",
            "cdn.jsdelivr.net",
          ].includes(url.hostname) &&
          ["stylesheet", "font"].includes(route.request().resourceType());
        return ["data:", "blob:"].includes(url.protocol) ||
          url.origin === base.origin ||
          productFont
          ? route.continue()
          : route.abort();
      });
      let started,
        finish,
        events = [],
        focus;
      const at = () => (performance.now() - started) / 1000;
      const hold = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); // Intentional reading/cursor dwell, never readiness.
      async function untilNarration(phrase) {
        if (auditOnly) return hold(250);
        const index = beat.narration.indexOf(phrase);
        const seconds =
          voice.beats[id].alignment?.character_start_times_seconds[index];
        if (index < 0 || !Number.isFinite(seconds))
          throw new Error(`Narration cue missing: ${phrase}`);
        await hold(Math.max(0, (seconds - at()) * 1000));
      }
      const visible = async (locator) => {
        await locator.waitFor({ state: "visible", timeout: 30000 });
        return locator;
      };
      async function click(locator) {
        await visible(locator);
        // Trial click waits for Motion layout transitions and node replacement
        // without activating the target or guessing a readiness delay.
        await locator.click({ trial: true });
        const box = await locator.boundingBox();
        if (!box) throw new Error("Capture target has no bounds.");
        const position = {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        };
        const start = at();
        await page.mouse.move(position.x, position.y, { steps: 18 });
        await hold(200);
        const scaleX = script.width / viewport.width,
          scaleY = script.height / viewport.height;
        events.push({
          at: start,
          clickAt: at(),
          x: position.x * scaleX,
          y: position.y * scaleY,
          box: {
            x: box.x * scaleX,
            y: box.y * scaleY,
            width: box.width * scaleX,
            height: box.height * scaleY,
          },
        });
        await locator.click();
      }
      async function go(route, ready) {
        pendingApi.clear();
        const url = new URL(route, base);
        url.searchParams.set("projectId", session.projectId);
        await page.goto(url.href, { waitUntil: "domcontentloaded" });
        await visible(
          ready
            ? page.getByText(ready, { exact: true }).first()
            : page.locator("main").first(),
        );
        await visible(
          page.getByRole("link", { name: "Overview", exact: true }).first(),
        );
        await settled();
      }
      async function openProposal() {
        await click(
          page
            .getByRole("button")
            .filter({ hasText: "Research proposal" })
            .first(),
        );
        await visible(
          page.getByRole("heading", { name: "Research proposal", exact: true }),
        );
        await visible(page.locator("canvas").first());
        await visible(
          page.getByText("Preview page 1 of 3", { exact: true }).first(),
        );
        await page
          .locator('.advisio-pdf-page[data-rendering="false"]')
          .first()
          .waitFor({ state: "visible" });
      }
      try {
        const action = beat.action;
        const route =
          action === "task"
            ? "/student/tasks"
            : action === "revision"
              ? taskRoute
              : action === "inbox"
                ? "/student/inbox"
                : action === "preferences"
                  ? "/student/profile"
                  : chapter.route;
        const navigationLabels = {
          project: "My Project",
          tasks: "Tasks",
          documents: "Documents",
          files: "Group Files",
          timeline: "Timeline",
          defense: "Defense",
          grades: "My Grades",
          consultations: "Consultations",
          calendar: "Calendar",
          communication: "Messages",
        };
        const enterFromSidebar =
          chapter.beats[0] === beat && navigationLabels[chapter.id];
        const enterNotifications = action === "notifications";
        await go(
          enterFromSidebar || enterNotifications ? "/student/dashboard" : route,
        );
        await page.evaluate(() => document.fonts.ready);
        // Start after the real shell is ready; actions and reading dwell are recorded.
        started = performance.now();
        if (enterFromSidebar) {
          await click(
            page
              .getByRole("link", {
                name: navigationLabels[chapter.id],
                exact: true,
              })
              .first(),
          );
          await settled();
        }
        if (enterNotifications) {
          await click(
            page.getByRole("button", { name: /^Notifications/ }).first(),
          );
          await click(
            page.getByRole("link", { name: /View all notifications/ }),
          );
          await settled();
        }
        if (action === "overview" || action === "sidebar") {
          await visible(page.getByText(session.title, { exact: true }).first());
          if (action === "overview") {
            await untilNarration("Other sections");
            await page
              .getByRole("heading", { name: "Recent Activity", exact: true })
              .scrollIntoViewIfNeeded();
          } else {
            await untilNarration("Defense, My Grades");
            await page
              .getByRole("link", { name: "Inbox", exact: true })
              .scrollIntoViewIfNeeded();
          }
        } else if (action === "project")
          await visible(
            page.getByRole("button", { name: "Project Overview", exact: true }),
          );
        else if (action === "group") {
          await click(
            page.getByRole("button", { name: "My Group", exact: true }),
          );
          await visible(
            page.getByText("Joshua Villanueva", { exact: true }).first(),
          );
        } else if (action === "tasks")
          await visible(
            page
              .getByText("Revised research proposal", { exact: true })
              .first(),
          );
        else if (action === "task") {
          await click(
            page
              .getByRole("button")
              .filter({ hasText: "Revised research proposal" })
              .first(),
          );
          await visible(
            page.getByRole("heading", {
              name: "Revised research proposal",
              exact: true,
            }),
          );
        } else if (action === "documents") await openProposal();
        else if (action === "versions") {
          await openProposal();
          const select = page.getByLabel("Preview version", { exact: true });
          const options = await select.locator("option").allTextContents();
          const old = options.find((text) => /version 1|v1\b/i.test(text));
          const current = options.find((text) => /version 2|v2\b/i.test(text));
          if (!old || !current)
            throw new Error("Proposal versions 1 and 2 missing.");
          await select.selectOption({ label: old });
          await click(page.getByRole("tab", { name: "Feedback", exact: true }));
          await visible(
            page.getByText("No feedback for this version", { exact: true }),
          );
          await untilNarration("Return to version two");
          await select.selectOption({ label: current });
          await click(page.getByRole("tab", { name: "Feedback", exact: true }));
        } else if (action === "upload-dialog") {
          await click(
            page.locator("summary").filter({ hasText: "Add document" }),
          );
          await click(
            page.getByRole("button", { name: /Upload working file/ }),
          );
          await visible(
            page.getByRole("heading", { name: "Upload working document" }),
          );
        } else if (action === "revision") {
          await click(
            page.getByRole("button", { name: /Upload.*file/i }).first(),
          );
          await page.locator("input[type=file]").setInputFiles(revision);
          await click(
            page.getByRole("button", {
              name: "Review file submission",
              exact: true,
            }),
          );
          await visible(
            page.getByRole("dialog", { name: "Confirm submission" }),
          );
          await hold(auditOnly ? 500 : 4000);
          await untilNarration("The application records");
          const response = page.waitForResponse(
            (res) =>
              res.url().includes(`/tasks/${task.id}/submissions/upload`) &&
              res.request().method() === "POST",
          );
          await click(
            page
              .getByRole("dialog")
              .getByRole("button", { name: "Confirm submission", exact: true }),
          );
          if (!(await response).ok())
            throw new Error("Prepared revision submission failed.");
          await visible(
            page.getByText("Requirement submitted for the entire group.", {
              exact: true,
            }),
          );
        } else if (action === "official") {
          await click(page.getByRole("tab", { name: /Official copies/ }));
          await visible(
            page.getByText("No official copies yet", { exact: true }),
          );
        } else if (action === "files") {
          await visible(
            page.getByText("No files in this folder", { exact: true }),
          );
          await untilNarration("Create a folder");
          await click(
            page.getByRole("button", { name: "New folder", exact: true }),
          );
          await page
            .getByPlaceholder("e.g. Research Instruments")
            .fill("Research materials");
          await click(
            page.getByRole("button", { name: "Create folder", exact: true }),
          );
          await visible(
            page.getByText("Research materials", { exact: true }).first(),
          );
          await click(
            page.getByRole("button", { name: /Research materials/ }).first(),
          );
          await page.locator("input[type=file]").setInputFiles(revision);
          await untilNarration("Files can be opened");
          await click(page.getByRole("button", { name: /^Upload 1$/ }));
          await visible(
            page.getByText(session.revisionName, { exact: true }).first(),
          );
        } else if (action === "timeline") {
          await visible(
            page
              .getByText("1. Topic and scope preparation", { exact: true })
              .first(),
          );
          await hold(auditOnly ? 500 : 5000);
          await page
            .getByText("Milestone Details", { exact: true })
            .scrollIntoViewIfNeeded();
          await visible(page.getByText("completed", { exact: true }).first());
        } else if (action === "defense")
          await visible(
            page.getByText("No defense session has been created", {
              exact: true,
            }),
          );
        else if (action === "grades") {
          await hold(auditOnly ? 400 : 4000);
          await click(
            page.getByRole("button", { name: "Defense Grades", exact: true }),
          );
          await visible(
            page.getByText("Available after defense", { exact: true }),
          );
        } else if (action === "consultations") {
          await visible(
            page
              .getByText("Proposal revision consultation", { exact: true })
              .first(),
          );
          await untilNarration("The request form");
          await page
            .getByText("Discussion Topic *", { exact: true })
            .scrollIntoViewIfNeeded();
        } else if (action === "notes") {
          await click(
            page.getByRole("button", { name: /Import Chat/ }).first(),
          );
          await visible(
            page.getByRole("heading", {
              name: "Consultation Records & Google Meet Chat Archive",
            }),
          );
        } else if (action === "calendar") {
          await visible(
            page
              .getByText("Proposal revision consultation", { exact: true })
              .first(),
          );
          await click(
            page
              .getByText("Proposal revision consultation", { exact: true })
              .first(),
          );
        } else if (action === "messages") {
          await visible(
            page.getByText("No active conversations yet", { exact: true }),
          );
          await visible(
            page.getByText("No pending invitations", { exact: true }),
          );
        } else if (action === "inbox") {
          await click(page.getByRole("button", { name: /Compose/ }).first());
          await visible(
            page.getByRole("heading", {
              name: "New academic correspondence",
              exact: true,
            }),
          );
        } else if (action === "notifications") {
          await click(page.getByRole("button", { name: /^unread/i }).first());
          await click(
            page.getByText("Revision guidance available", { exact: true }),
          );
          await visible(page.getByText(session.title, { exact: true }).first());
        } else if (action === "preferences") {
          await visible(
            page.getByText("Mikaela Santos", { exact: true }).first(),
          );
          await hold(auditOnly ? 500 : 5000);
          await go("/student/settings");
          await untilNarration("Notification preferences");
          await click(
            page
              .getByRole("button")
              .filter({ hasText: "Notifications" })
              .first(),
          );
          await visible(page.getByText("Milestone deadlines", { exact: true }));
          await hold(auditOnly ? 400 : 2500);
          await untilNarration("Open Appearance");
          await click(page.getByRole("button", { name: /Appearance/ }).first());
          await visible(page.getByText("Display mode", { exact: true }));
        } else throw new Error(`Unknown capture action: ${action}`);
        const targetSeconds = auditOnly
          ? at() + 1
          : voice.beats[id].durationSeconds + 0.75;
        await settled();
        if (!auditOnly && at() > targetSeconds)
          throw new Error(
            `Actions overrun narration: ${id}; split this beat or revise narration.`,
          );
        await page.screenshot({ path: path.join(output, `${id}.png`) });
        const mainBox = await page.locator("main").first().boundingBox();
        if (mainBox) {
          const top = Math.max(0, mainBox.y),
            bottom = Math.min(viewport.height, mainBox.y + mainBox.height);
          focus = {
            x:
              ((mainBox.x + mainBox.width / 2) * script.width) / viewport.width,
            y:
              ((top + (bottom - top) * 0.42) * script.height) / viewport.height,
          };
        }
        await hold(Math.max(0, (targetSeconds - at()) * 1000));
        finish = performance.now();
        if (uiErrors.length)
          throw new Error(`UI errors in ${id}: ${uiErrors.join("; ")}`);
      } catch (error) {
        await page
          .screenshot({
            path: path.join(output, `${id}-failure.png`),
            fullPage: true,
          })
          .catch(() => {});
        await writeJson(path.join(output, `${id}-failure.json`), {
          url: page.url(),
          text: await page
            .locator("body")
            .innerText()
            .catch(() => ""),
          uiErrors,
          failedRequests,
        });
        error.message += uiErrors.length
          ? ` UI errors: ${uiErrors.join("; ")}`
          : "";
        throw error;
      } finally {
        await page.close();
        await context.close();
      }
      const raw = await page.video().path();
      const seconds = (finish - started) / 1000;
      const total = await duration(raw);
      const clip = `clips/${id}.mp4`;
      await encode([
        "-ss",
        String(Math.max(0, total - seconds)),
        "-i",
        raw,
        "-t",
        String(seconds),
        "-an",
        "-r",
        String(script.fps),
        "-c:v",
        "libx264",
        "-crf",
        "16",
        "-pix_fmt",
        "yuv420p",
        path.join(assets, clip),
      ]);
      report.beats[id] = {
        clip,
        durationSeconds: await duration(path.join(assets, clip)),
        events,
        focus,
        framing: beat.framing || "overview",
      };
      await writeJson(path.join(output, "captures.json"), report);
    }
} catch (error) {
  report.errors.push(error.message);
  throw error;
} finally {
  await writeJson(path.join(output, "captures.json"), report);
  if (session)
    await request("/api/evaluation/end", { method: "POST" }).catch(() =>
      console.error(
        "Capture session could not be ended; it will expire automatically.",
      ),
    );
  await auth.close();
  await browser.close();
}
console.log(
  auditOnly
    ? "Audit capture complete. These clips cannot be published."
    : "Timed Researcher capture complete.",
);
