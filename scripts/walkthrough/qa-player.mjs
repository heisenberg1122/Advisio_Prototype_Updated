import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { output, readScript, encode } from "./common.mjs";
import { scriptHash } from "../../walkthrough/shared/timing.mjs";

// Synthetic media is ONLY intercepted inside this test browser, never published
// as product footage or represented as completed narration.
const script = await readScript();
await fs.mkdir(output, { recursive: true });
const fixture = path.join(output, "player-test-only.mp4");
await encode([
  "-f",
  "lavfi",
  "-i",
  "color=c=0x173f63:s=1280x720:d=7:r=30",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  fixture,
]);
const bytes = await fs.readFile(fixture);
const browser = await chromium.launch();
try {
  for (const [label, width, height] of [
    ["desktop", 1920, 1080],
    ["laptop", 1366, 768],
    ["tablet", 768, 1024],
    ["mobile", 390, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route('**/walkthroughs/researcher/media.json', (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto("http://localhost:3100/walkthrough/research-dashboard");
    await page
      .getByRole("heading", {
        name: "ADVISIO Researcher Walkthrough",
        exact: true,
      })
      .waitFor();
    await page.getByRole("button", { name: "Watch Quick Walkthrough" }).click();
    await page
      .getByText("The narrated video is not available yet.", { exact: false })
      .waitFor();
    await page
      .getByRole("link", { name: "Read Written Guide", exact: true })
      .click();
    assert.equal(
      await page
        .locator("#researcher-written-guide")
        .evaluate((element) => element.open),
      true,
    );
    assert.equal(
      await page
        .getByRole("link", { name: "Explore ADVISIO", exact: true })
        .getAttribute("href"),
      "/student/dashboard",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${label}: horizontal overflow`,
    );
    // Validate the ready-media player separately from the unavailable-media path.
    await page.route("**/walkthroughs/researcher/media.json", (route) =>
      route.fulfill({
        json: {
          version: 1,
          scriptHash: scriptHash(script),
          duration: 7,
          video: "researcher-web.mp4",
          poster: "poster.jpg",
          captions: "subtitles.vtt",
          chapters: script.chapters.map((chapter, index) => ({
            id: chapter.id,
            title: chapter.title,
            start: index * 0.5,
            end: (index + 1) * 0.5,
          })),
        },
      }),
    );
    await page.route(
      "**/walkthroughs/researcher/researcher-web.mp4",
      (route) => {
        const range = route.request().headers().range;
        if (!range)
          return route.fulfill({
            body: bytes,
            contentType: "video/mp4",
            headers: {
              "Accept-Ranges": "bytes",
              "Content-Length": String(bytes.length),
            },
          });
        const [startText, endText] = range.replace("bytes=", "").split("-");
        const start = Number(startText),
          end = endText
            ? Math.min(Number(endText), bytes.length - 1)
            : bytes.length - 1;
        return route.fulfill({
          status: 206,
          body: bytes.subarray(start, end + 1),
          contentType: "video/mp4",
          headers: {
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
            "Content-Length": String(end - start + 1),
          },
        });
      },
    );
    await page.route("**/walkthroughs/researcher/subtitles.vtt", (route) =>
      route.fulfill({
        body: "WEBVTT\n\n00:00:00.000 --> 00:00:06.900\nPlayer test caption.\n",
        contentType: "text/vtt",
      }),
    );
    await page.reload();
    await page.getByRole("button", { name: "Watch Quick Walkthrough" }).click();
    const video = page.locator("video");
    await video.waitFor();
    await page.waitForFunction(
      () => document.querySelector("video")?.readyState >= 1,
    );
    assert.equal(await video.getAttribute("autoplay"), null);
    assert.equal(await video.evaluate((element) => element.paused), true);
    await page
      .getByRole("navigation", { name: "Walkthrough chapters" })
      .getByRole("button")
      .nth(2)
      .click();
    await page.waitForFunction(
      () => Math.abs(document.querySelector("video").currentTime - 1) < 0.2,
    );
    assert.equal(await video.evaluate((element) => element.paused), true);
    await page.getByRole("button", { name: "Restart from beginning" }).focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () => document.querySelector("video").currentTime < 0.1,
    );
    await video.evaluate((element) => element.play());
    await page.waitForFunction(
      () => document.querySelector("video").currentTime > 0.1,
    );
    await video.evaluate((element) => element.pause());
    assert.equal(
      await video.evaluate((element) => element.textTracks.length),
      1,
    );
    await page.waitForFunction(
      () =>
        document.querySelector("video track")?.readyState === 2 &&
        document.querySelector("video").textTracks[0]?.cues?.length > 0,
    );
    await video.evaluate((element) => {
      element.currentTime = 6.8;
    });
    await video.evaluate((element) => element.play());
    const handoff = page.getByRole("region", {
      name: "Researcher walkthrough complete",
      exact: true,
    });
    await handoff.waitFor();
    assert.equal(
      await handoff
        .getByRole("link", { name: "Explore ADVISIO", exact: true })
        .getAttribute("href"),
      "/student/dashboard",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${label}: player overflow`,
    );
    await page.screenshot({
      path: path.join(output, `player-${label}.png`),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `${label}: optional guide, continue link, no autoplay, chapters, keyboard restart, playback, captions and layout passed.`,
    );
  }
} finally {
  await browser.close();
}
