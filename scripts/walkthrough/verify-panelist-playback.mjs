import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { root, writeJson } from "./common.mjs";

const variant = process.argv.find((a) => a.startsWith("--variant="))?.slice(10) || "structured";
if (!["structured", "pdf", "preparation"].includes(variant)) throw Error("Invalid variant");
const directory = path.join(root, ".walkthrough", `panelist-${variant}`);
const media = JSON.parse(await fs.readFile(path.join(directory, process.argv.includes("--video-only") ? "export/early-media.json" : "export/media.json"), "utf8"));
const timeline = JSON.parse(await fs.readFile(path.join(directory, "timeline.json"), "utf8"));
const expectedCaptions = timeline.chapters.flatMap((c) => c.beats).reduce((sum, b) => sum + b.captions.length, 0);
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [name, width, height] of [["desktop", 1366, 900], ["mobile", 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage(); const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://localhost:3510/${variant}/`);
    const video = page.locator("video");
    await page.waitForFunction(() => { const video = document.querySelector("video"); return video.readyState >= 2 && video.textTracks[0]?.cues?.length > 0; });
    const info = await video.evaluate((v) => ({ duration: v.duration, width: v.videoWidth, height: v.videoHeight, captions: v.textTracks[0].cues.length, controls: v.controls }));
    assert.ok(Math.abs(info.duration - media.duration) < .3); assert.equal(info.width, 1280); assert.equal(info.height, 720); assert.ok(info.controls);
    assert.equal(info.captions, expectedCaptions);
    assert.equal(await page.locator("nav button").count(), media.chapters.length);
    if (!process.argv.includes("--video-only")) {
    const downloads = await page.locator('.downloads a[href^="chapters/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    assert.equal(downloads.length, media.chapters.length);
    for (const chapter of media.chapters) {
      assert.ok(downloads.includes(`chapters/${chapter.id}.mp4`));
      const response = await context.request.head(`http://localhost:3510/${variant}/chapters/${chapter.id}.mp4`);
      assert.equal(response.status(), 200);
      assert.ok(Number(response.headers()["content-length"]) > 0);
    }
    }
    for (const chapter of media.chapters.slice(1)) {
      await page.locator(`button[data-time="${chapter.start}"]`).click();
      await page.waitForFunction((target) => { const v = document.querySelector("video"); return !v.seeking && v.readyState >= 2 && Math.abs(v.currentTime - target) < 3; }, chapter.start);
      await video.evaluate((v) => v.pause());
    }
    await video.evaluate((v) => { v.volume = .3; v.currentTime = 65; });
    await page.waitForFunction(() => { const v = document.querySelector("video"); return !v.seeking && v.readyState >= 2; });
    assert.equal(await video.evaluate((v) => v.volume), .3);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(directory, "qa", `panelist-player-${name}.png`), fullPage: true });
    assert.deepEqual(errors, []); results.push({ name, ...info, chapterSeeking: true, horizontalOverflow: false, errors }); await context.close();
  }
} finally { await browser.close(); }
await writeJson(path.join(directory, "qa", process.argv.includes("--video-only") ? "early-playback-verification.json" : "playback-verification.json"), results);
console.log(`Panelist ${variant} export playback, captions, chapter seeking, volume, and responsive layout passed at desktop and mobile sizes.`);
