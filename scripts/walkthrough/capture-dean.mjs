import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";
import { root, output, assets, readJson, readScript, writeJson, duration, encode } from "./common.mjs";
import { beatKey, scriptHash, validateScript } from "../../walkthrough/shared/timing.mjs";

const script = await readScript();
if (script.id !== "dean") throw new Error("Use --role=dean.");
validateScript(script);
const demo = await readJson(path.join(output, "demo.json"));
if (!/^walkthrough_dean_[a-f0-9]{16}$/.test(demo.schema) || demo.url !== "http://localhost:3200") throw new Error("Only the isolated Dean recording fixture may be captured.");
const auditOnly = process.argv.includes("--audit");
const only = process.argv.find((x) => x.startsWith("--only="))?.slice(7).split(",");
const resume = process.argv.includes("--resume");
const voice = await readJson(path.join(output, "voice.json"));
if (!auditOnly && voice.scriptHash !== scriptHash(script)) throw new Error("Generate matching narration before capture.");
const prior = resume ? await readJson(path.join(output, "captures.json")) : null;
if (prior && (prior.scriptHash !== scriptHash(script) || prior.auditOnly !== auditOnly)) throw new Error("Resume requires matching capture mode and script.");
const report = { scriptHash: scriptHash(script), presentationVersion: script.presentationVersion, auditOnly, role: "dean", viewport: { width: 1366, height: 768 }, beats: prior?.beats || {}, errors: [] };
await fs.mkdir(path.join(assets, "clips"), { recursive: true });
const browser = await chromium.launch({ headless: true });
const auth = await browser.newContext({ baseURL: demo.url });
const login = await auth.request.post("/api/auth/login", { data: { email: demo.email, password: demo.password } });
if (!login.ok()) throw new Error(`Demo login failed: ${login.status()}`);
const token = (await login.json()).token;
try {
  for (const chapter of script.chapters) for (const beat of chapter.beats) {
    const id = beatKey(chapter, beat);
    if (["intro", "outro"].includes(beat.action) || (only && !only.includes(chapter.id)) || (resume && report.beats[id])) continue;
    console.log(`Capturing ${id}`);
    const context = await browser.newContext({ baseURL: demo.url, viewport: report.viewport, locale: "en-PH", timezoneId: "Asia/Manila", colorScheme: "light", recordVideo: { dir: path.join(output, "raw"), size: report.viewport } });
    if (beat.action !== "login") await context.addInitScript((value) => localStorage.setItem("advisio_token", value), token);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [], apiFailures = [], pending = new Set();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => { if (response.status() >= 500 && new URL(response.url()).pathname.startsWith("/api/")) apiFailures.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/") && !/stream|realtime|notifications|events/.test(request.url())) pending.add(request); });
    page.on("requestfinished", (request) => pending.delete(request)); page.on("requestfailed", (request) => pending.delete(request));
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      const font = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"].includes(url.hostname) && ["font", "stylesheet"].includes(route.request().resourceType());
      return url.origin === demo.url || ["blob:", "data:"].includes(url.protocol) || font ? route.continue() : route.abort();
    });
    let started, finished;
    const events = [];
    const at = () => (performance.now() - started) / 1000;
    const hold = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    async function settled() {
      const deadline = performance.now() + 20000;
      while (pending.size) { if (performance.now() > deadline) throw new Error(`Pending API: ${[...pending].map((r) => new URL(r.url()).pathname).join(", ")}`); await hold(70); }
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.waitForFunction(() => { const node = document.querySelector("main > div"); return !node || Number(getComputedStyle(node).opacity) > .98; });
    }
    async function ready(locator) { await locator.first().waitFor({ state: "visible" }); await settled(); return locator.first(); }
    async function point(locator, activate = false) {
      locator = await ready(locator);
      if (!auditOnly) {
        const outside = await locator.evaluate((el) => { const r = el.getBoundingClientRect(); return r.top < 70 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth; });
        if (outside) { await locator.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })); await hold(450); }
      }
      await locator.scrollIntoViewIfNeeded();
      if (activate) await locator.click({ trial: true });
      const box = await locator.boundingBox(); if (!box) throw new Error("Missing target bounds.");
      const event = { at: at(), x: (box.x + box.width / 2) * 1920 / 1366, y: (box.y + box.height / 2) * 1080 / 768, box: { x: box.x * 1920 / 1366, y: box.y * 1080 / 768, width: box.width * 1920 / 1366, height: box.height * 1080 / 768 } };
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 }); await hold(auditOnly ? 30 : 160); event.clickAt = at(); events.push(event);
      if (activate) { await locator.click(); await settled(); }
    }
    const click = (locator) => point(locator, true);
    const button = (name) => page.getByRole("button", { name, exact: true }).first();
    async function cue(text) {
      if (auditOnly) return;
      const index = beat.narration.indexOf(text), seconds = voice.beats[id].alignment.character_start_times_seconds[index];
      if (index < 0 || !Number.isFinite(seconds)) throw new Error(`Missing narration cue: ${text}`);
      await hold(Math.max(0, seconds * 1000 - at() * 1000));
    }
    async function nav(name) { await click(page.getByRole("link", { name, exact: true }).first()); }
    async function choose(label, value) { const target = page.getByRole("combobox", { name: new RegExp(`^${label}`, "i") }).first(); await point(target); await target.selectOption(value); await settled(); }
    async function fill(label, value) { const target = page.getByLabel(label, { exact: true }); await point(target); await target.fill(value); }
    try {
      const route = beat.action === "login" ? "/login" : chapter.route;
      await page.goto(demo.url + route, { waitUntil: "domcontentloaded" });
      if (beat.action === "login") await ready(page.locator('input[type="email"]'));
      else { await ready(page.getByRole("link", { name: "Overview", exact: true })); await settled(); }
      started = performance.now();
      if (beat.action === "login") {
        await page.locator('input[type="email"]').fill(demo.email);
        await page.locator('input[type="password"]').fill(demo.password);
        await cue("then select"); await click(page.getByRole("button", { name: /Sign In/i }).first());
        await ready(page.getByRole("link", { name: "Overview", exact: true }));
      } else if (beat.action === "overview") {
        await point(page.getByText("Research Students", { exact: true }));
        await cue("Research Program Overview"); await point(page.getByText("Research Program Overview", { exact: true }));
        await cue("Research Pipeline"); await point(page.getByText("Research Pipeline", { exact: true }));
        await cue("Needs Dean Attention"); await point(page.getByText("Needs Dean Attention", { exact: true }));
      } else if (beat.action === "filters") {
        await choose("Academic year", demo.priorYearId);
        await cue("Choose a program"); await choose("Program", demo.programId);
        await cue("Return to all"); await choose("Academic year", "all"); await choose("Program", "all");
      } else if (beat.action === "students") {
        await cue("Search by name"); const search = page.getByPlaceholder("Search records…"); await point(search); await search.fill("Mika Santos");
        await ready(page.getByText("mika.santos@example.invalid", { exact: false }));
        await cue("selecting Approve"); const approve = button("Approve"); if (await approve.count()) await click(approve);
        await ready(page.getByText("ACTIVE", { exact: true }).first());
      } else if (beat.action === "progress") {
        await point(page.getByText("Research Group Registry", { exact: true }));
        await cue("Open Progress"); await nav("Progress & Risk");
        const risk = page.locator('select').filter({ has: page.locator('option[value="high"]') }); await point(risk); await risk.selectOption("high");
        await ready(page.getByText("No activity for 35 days", { exact: true }).first());
      } else if (beat.action === "faculty") {
        if (auditOnly && await page.getByText("Awaiting approval", { exact: true }).count()) {
          await point(page.getByText("Awaiting approval", { exact: true }));
        } else {
        await click(button("Invite or request access"));
        await fill("Email address", "rowan.faculty@example.invalid"); await fill("First name", "Rowan"); await fill("Last name", "Garcia"); await fill("Institutional ID", "DEMO-FAC-026");
        await page.getByLabel("Professor Coordinator", { exact: true }).check();
        await page.getByLabel(/I verified this person/).check(); await fill("Verification note", "Fictional appointment verified for the isolated Dean walkthrough.");
        await cue("This example submits"); await click(button("Submit invitation or request"));
        await ready(page.getByText("Awaiting approval", { exact: true }).first());
        }
      } else if (beat.action === "advisers") {
        await point(page.getByText("Active advisee groups", { exact: true }));
        await cue("select Edit"); await click(page.getByRole("button", { name: /^Edit Andrea Reyes$/ }));
        await fill("Maximum active groups", "6"); await fill("Reason for change", "Capacity reviewed for the fictional college research assignment.");
        await cue("before saving"); await click(button("Save changes")); await ready(page.getByText("Adviser directory updated and the faculty member was notified.", { exact: true }));
      } else if (beat.action === "signatures") {
        await point(page.getByText("Please review the attached demonstration clearance request.", { exact: false }));
        await cue("choosing Add signature"); await click(button("Add signature"));
        await ready(page.getByRole("dialog")); await ready(page.getByRole("button", { name: "type", exact: true }));
        await click(button("type")); await fill("Type your signature", "Aurelia Mendoza");
        await cue("Review its placement"); await point(page.getByLabel("Signature position. Drag or use arrow keys to move."));
        await fill("Confirm your password", demo.password);
        await page.getByRole("checkbox").filter({ visible: true }).last().check();
        await cue("select Confirm and Sign"); await click(button("Confirm & Sign"));
        await ready(page.getByText("Your signed PDF has been saved successfully.", { exact: true }));
        await click(button("Done"));
        await ready(page.getByText("Signed", { exact: true }).first());
        const reply = page.getByPlaceholder('Type a reply, e.g. “I already signed your request. Good luck!”'); await reply.fill("Reviewed and signed. Please retain the verified copy for the college record."); await click(page.getByRole("button", { name: "Send reply", exact: true }));
      } else if (beat.action === "defenses") {
        await point(page.getByText("Upcoming defenses", { exact: true }));
        await cue("Needs Attention"); await click(button("Needs Attention"));
        await cue("Open View details"); await click(button("View details")); await ready(page.getByRole("dialog"));
        await page.getByRole("button", { name: "Close dialog", exact: true }).click();
        await cue("A completed record"); await click(button("Completed")); await click(button("View details")); await ready(page.getByRole("dialog"));
      } else if (beat.action === "reports") {
        await choose("Report", "research-progress"); await choose("Academic year", demo.academicYearId); await choose("Program", demo.programId);
        await cue("Export PDF downloads"); const download = page.waitForEvent("download"); await click(button("Export PDF")); await (await download).saveAs(path.join(output, "research-progress-demo.pdf"));
        await ready(page.getByText("PDF report downloaded.", { exact: true })); await point(button("Export CSV"));
      } else if (beat.action === "announcements") {
        if (await page.getByRole("combobox", { name: /^Audience/ }).isEnabled()) await choose("Audience", demo.programId);
        else await point(page.getByRole("combobox", { name: /^Audience/ }));
        await fill("Title", "College Research Progress Review"); await fill("Message", "Please prepare your current proposal status and adviser follow-up items for the upcoming college research review. Demonstration notice.");
        await cue("Publish announcement"); await click(button("Publish announcement")); await ready(page.getByText(/Published to \d+ account/));
        await point(page.getByRole("heading", { name: "Current announcements", exact: true }));
      } else if (beat.action === "calendar") {
        await cue("Select the prepared"); await click(page.getByRole("button").filter({ hasText: "College Research Progress Review" }).last()); await ready(page.getByRole("dialog"));
      } else if (beat.action === "manuscripts") {
        await cue("Review and decide opens"); await click(page.getByRole("button", { name: "Review and decide", exact: true }).last());
        await ready(page.getByRole("dialog")); await ready(page.getByText("Select text on the page to attach a comment.", { exact: true }));
        await cue("Select a passage"); const text = page.locator(".advisio-pdf-text span").filter({ hasText: "CampusWay:" }).first(); await ready(text);
        const box = await text.boundingBox(); await page.mouse.move(box.x + 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + Math.min(280, box.width - 2), box.y + box.height / 2, { steps: 25 }); await page.mouse.up();
        await click(button("Comment on selection")); await page.getByPlaceholder("Write feedback or a reply…").fill("Please align this scope statement with the proposed outputs."); await click(button("Post comment")); await ready(page.getByText("Comment posted.", { exact: true }));
      } else if (beat.action === "official") {
        await choose("Research project", demo.projectId);
        await ready(page.getByText("CampusWay - Archived Research Proposal", { exact: true }));
        await cue("Open or download"); const download = page.waitForEvent("download"); await click(button("Download")); await (await download).saveAs(path.join(output, "official-copy-demo.pdf"));
        await cue("Verify integrity checks"); await click(button("Verify integrity"));
        await ready(page.getByText(/integrity verified|matches.*checksum|verified successfully/i).first());
      } else throw new Error(`Unknown action: ${beat.action}`);
      await settled();
      const target = auditOnly ? at() + .5 : voice.beats[id].durationSeconds + .75;
      if (!auditOnly && at() > target) throw new Error(`Actions overrun ${id}: ${at().toFixed(1)} > ${target.toFixed(1)} seconds.`);
      await page.screenshot({ path: path.join(output, `${id}.png`) });
      await writeJson(path.join(output, `${id}-ui.json`), { text: await page.locator("body").innerText(), apiFailures });
      await hold(Math.max(0, (target - at()) * 1000)); finished = performance.now();
      if (errors.length || apiFailures.length) throw new Error(JSON.stringify({ errors, apiFailures }));
    } catch (error) {
      await page.screenshot({ path: path.join(output, `${id}-failure.png`), fullPage: true }).catch(() => {});
      await writeJson(path.join(output, `${id}-failure.json`), { message: error.message, text: await page.locator("body").innerText(), errors, apiFailures }); throw error;
    } finally { await page.close(); await context.close(); }
    const raw = await page.video().path(), seconds = (finished - started) / 1000, total = await duration(raw), clip = `clips/${id}.mp4`;
    await encode(["-ss", String(Math.max(0, total - seconds)), "-i", raw, "-t", String(seconds), "-an", "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", path.join(assets, clip)]);
    report.beats[id] = { clip, durationSeconds: await duration(path.join(assets, clip)), events, framing: "overview" };
    await writeJson(path.join(output, "captures.json"), report);
  }
} catch (error) { report.errors.push(error.message); throw error; }
finally { await writeJson(path.join(output, "captures.json"), report); await auth.close(); await browser.close(); }
console.log(auditOnly ? "Dean audit complete; these clips are not publishable." : "Timed Dean capture complete.");
