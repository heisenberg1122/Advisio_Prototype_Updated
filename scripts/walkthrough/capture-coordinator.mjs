import { runCoordinatorAction, coordinatorRoute } from "./coordinator-actions.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";
import { root, output, assets, readJson, readScript, writeJson, duration, encode } from "./common.mjs";
import { beatKey, scriptHash, validateScript } from "../../walkthrough/shared/timing.mjs";

const script = await readScript();
if (script.id !== "coordinator") throw new Error("Use --role=coordinator.");
validateScript(script);
const demo = await readJson(path.join(output, "demo.json"));
if (!/^walkthrough_coordinator_[a-f0-9]{16}$/.test(demo.schema) || demo.url !== "http://localhost:3300") throw new Error("Only the isolated Dean recording fixture may be captured.");
const auditOnly = process.argv.includes("--audit");
const only = process.argv.find((x) => x.startsWith("--only="))?.slice(7).split(",");
const resume = process.argv.includes("--resume");
const voice = await readJson(path.join(output, "voice.json")).catch(() => null);
if (!auditOnly && voice?.scriptHash !== scriptHash(script)) throw new Error("Generate matching narration before capture.");
const prior = resume ? await readJson(path.join(output, "captures.json")) : null;
if (prior && (prior.scriptHash !== scriptHash(script) || prior.auditOnly !== auditOnly)) throw new Error("Resume requires matching capture mode and script.");
const report = { scriptHash: scriptHash(script), presentationVersion: script.presentationVersion, auditOnly, role: "coordinator", viewport: { width: 1366, height: 768 }, beats: prior?.beats || {}, errors: [] };
await writeJson(path.join(output, "captures.json"), report);
await fs.mkdir(path.join(assets, "clips"), { recursive: true });
const browser = await chromium.launch({ headless: true });
const auth = await browser.newContext({ baseURL: demo.url });
const login = await auth.request.post("/api/auth/login", { data: { email: demo.email, password: demo.password } });
if (!login.ok()) throw new Error(`Demo login failed: ${login.status()}`);
const token = (await login.json()).token;
const tokens = { professor: token };
for (const [key, actor] of Object.entries(demo.actors)) {
  if (key === "professor") continue;
  const response = await auth.request.post("/api/auth/login", { data: { email: actor.email, password: actor.password } });
  if (!response.ok()) throw new Error(`Demo actor login failed: ${key}`);
  tokens[key] = (await response.json()).token;
}
async function api(actor, route, body, method = body === undefined ? "GET" : "POST") {
 const response = await auth.request.fetch(demo.url + route, { method, headers: { Authorization: `Bearer ${tokens[actor]}` }, ...(body === undefined ? {} : { data: body }) });
 const result = await response.json(); if (!response.ok()) throw new Error(`${route}: ${response.status()} ${result.error || "Request failed"}`); return result;
}
try {
  for (const chapter of script.chapters) for (const beat of chapter.beats) {
    const id = beatKey(chapter, beat);
    if (["intro", "outro"].includes(beat.action) || (only && !only.includes(chapter.id)) || (resume && report.beats[id])) continue;
    console.log(`Capturing ${id}`);
    const context = await browser.newContext({ baseURL: demo.url, viewport: report.viewport, locale: "en-PH", timezoneId: "Asia/Manila", colorScheme: "light", recordVideo: { dir: path.join(output, "raw"), size: report.viewport } });
    if (beat.action !== "login") await context.addInitScript((value) => { if (!localStorage.getItem("advisio_token")) localStorage.setItem("advisio_token", value); }, token);
    const page = await context.newPage();
    page.on("dialog", async (dialog) => { if (dialog.type() === "confirm") await dialog.accept(); else await dialog.dismiss(); });
    page.setDefaultTimeout(20000);
    const errors = [], apiFailures = [], pending = new Set();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => { pending.delete(response.request()); if (response.status() >= 500 && new URL(response.url()).pathname.startsWith("/api/")) apiFailures.push({ path: new URL(response.url()).pathname, status: response.status() }); });
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
    const button = (name) => page.locator('body:has([role="dialog"]:visible) [role="dialog"]:visible button, body:not(:has([role="dialog"]:visible)) button').filter({ hasText: new RegExp(name, "i") }).filter({ visible: true }).last();
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
      const route = coordinatorRoute(beat, demo);
      await page.goto(demo.url + route, { waitUntil: "domcontentloaded" });
      if (beat.action === "login") await ready(page.locator('input[type="email"]'));
      else { await ready(page.getByRole("link", { name: "Overview", exact: true })); await settled(); }
      started = performance.now();
      const switchActor = async (actor, route) => {
        pending.clear();
        await page.evaluate((value) => localStorage.setItem("advisio_token", value), tokens[actor]);
        await page.goto(demo.url + route, { waitUntil: "domcontentloaded" });
        for (const request of pending) if (!request.frame()?.url().startsWith(demo.url)) pending.delete(request);
        await ready(page.getByRole("link", { name: "Overview", exact: true }).first());
      };
      const saveDemo = () => writeJson(path.join(output, "demo.json"), demo);
      await runCoordinatorAction({ page, demo, beat, auditOnly, button, click, point, ready, cue, choose, fill, nav, switchActor, api, saveDemo });
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
console.log(auditOnly ? "Coordinator audit complete; these clips are not publishable." : "Timed Coordinator capture complete.");
