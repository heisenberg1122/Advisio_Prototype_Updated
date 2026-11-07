import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import {
  output,
  root,
  readJson,
  readScript,
  probe,
  encode,
  writeJson,
  role,
} from "./common.mjs";
import {
  scriptHash,
  validateScript,
} from "../../walkthrough/shared/timing.mjs";

const script = await readScript();
validateScript(script);
const directory = path.join(output, "export");
const timeline = await readJson(path.join(output, "timeline.json"));
const media = await readJson(path.join(directory, "media.json"));
assert.equal(media.scriptHash, scriptHash(script));
assert.equal(media.chapters.length, script.chapters.length);
const files = [];
for (const [name, width, height] of [
  ["master-1080p.mp4", 1920, 1080],
  [`${role}-web.mp4`, 1280, 720],
  [`${role}-captioned.mp4`, 1280, 720],
]) {
  const metadata = await probe(path.join(directory, name));
  const video = metadata.streams.find(
    (stream) => stream.codec_type === "video",
  );
  const audio = metadata.streams.find(
    (stream) => stream.codec_type === "audio",
  );
  assert.equal(video.codec_name, "h264");
  assert.equal(video.width, width);
  assert.equal(video.height, height);
  assert.equal(video.r_frame_rate, "30/1");
  assert.equal(audio.codec_name, "aac");
  assert.ok(
    Math.abs(
      Number(metadata.format.duration) -
        timeline.durationInFrames / timeline.fps,
    ) < 0.3,
  );
  files.push({
    name,
    width,
    height,
    seconds: Number(metadata.format.duration),
    bytes: Number(metadata.format.size),
  });
}
if (["coordinator", "adviser"].includes(role) || await fs.access(path.join(directory, "chapters")).then(() => true, () => false)) {
  for (const chapter of media.chapters) {
    const name = `chapters/${chapter.id}.mp4`;
    const metadata = await probe(path.join(directory, name));
    const video = metadata.streams.find((stream) => stream.codec_type === "video");
    const audio = metadata.streams.find((stream) => stream.codec_type === "audio");
    assert.equal(video?.codec_name, "h264");
    assert.equal(video.width, 1920);
    assert.equal(video.height, 1080);
    assert.equal(video.r_frame_rate, "30/1");
    assert.equal(audio?.codec_name, "aac");
    const seconds = Number(metadata.format.duration);
    assert.ok(Math.abs(seconds - (chapter.end - chapter.start)) < .3, `Chapter runtime differs: ${chapter.id}`);
    files.push({ name, width: video.width, height: video.height, seconds, bytes: Number(metadata.format.size) });
  }
}
const vtt = await fs.readFile(path.join(directory, "subtitles.vtt"), "utf8");
assert.ok(vtt.startsWith("WEBVTT\n\n"));
const captionCount = timeline.chapters
  .flatMap((chapter) => chapter.beats)
  .reduce((count, beat) => count + beat.captions.length, 0);
assert.equal((vtt.match(/ --> /g) || []).length, captionCount);
await fs.access(path.join(directory, "poster.jpg"));
await fs.access(path.join(directory, "transcript.txt"));
const qa = path.join(output, "qa");
await fs.mkdir(qa, { recursive: true });
for (const [index, chapter] of media.chapters.entries()) {
  const time = chapter.start + Math.min(8, (chapter.end - chapter.start) / 2);
  await encode([
    "-ss",
    String(time),
    "-i",
    path.join(directory, "master-1080p.mp4"),
    "-frames:v",
    "1",
    "-vf",
    "scale=960:-2",
    path.join(qa, `chapter-${String(index).padStart(2, "0")}.jpg`),
  ]);
}
await encode([
  "-framerate",
  "1",
  "-i",
  path.join(qa, "chapter-%02d.jpg"),
  "-vf",
  "scale=480:270,tile=4x4:padding=8:margin=8:color=white",
  "-frames:v",
  "1",
  path.join(qa, "chapter-contact-sheet.jpg"),
]);
const results = {
  scriptHash: media.scriptHash,
  duration: media.duration,
  chapters: script.chapters.length,
  captionCount,
  files,
};
if (process.argv.includes("--browser")) {
  const browser = await chromium.launch();
  try {
    const evaluation = await browser.newContext({
      baseURL: "http://localhost:3100",
    });
    let session;
    try {
      const headers = { Origin: "http://localhost:3100" };
      const health = await evaluation.request.get("/api/health", { headers });
      assert.equal((await health.json()).mode, "evaluation");
      await evaluation.request.get("/api/evaluation/config", { headers });
      const response = await evaluation.request.post(
        "/api/evaluation/session",
        {
          headers,
          data: { role: "student", course: "BSIT", acknowledged: true },
        },
      );
      assert.equal(response.status(), 201);
      session = await response.json();
      const page = await evaluation.newPage();
      await page.goto("/evaluate/guide");
      const continueButton = page.getByRole("button", {
        name: "Continue to ADVISIO",
        exact: true,
      });
      await continueButton.waitFor();
      await continueButton.click();
      await page.waitForURL(/\/student\/dashboard/);
      await page.getByText(session.title, { exact: true }).first().waitFor();
      const progress = await page.evaluate(
        (id) =>
          JSON.parse(localStorage.getItem(`advisio_evaluation_guide:${id}`)),
        session.projectId,
      );
      assert.equal(progress.phase, "activities");
      await page
        .getByRole("button", {
          name: "Open Researcher walkthrough",
          exact: true,
        })
        .click();
      await page.waitForURL(/\/evaluate\/guide/);
      await page
        .getByRole("button", { name: "Continue to ADVISIO", exact: true })
        .waitFor();
      results.dashboardWalkthroughEntry = true;
      results.optionalContinuation = true;
      console.log(
        "Prepared Researcher workspace can be entered without completing the written guide.",
      );
    } finally {
      if (session)
        await evaluation.request.post("/api/evaluation/end", {
          headers: { Origin: "http://localhost:3100" },
        });
      await evaluation.close();
    }
  } finally {
    await browser.close();
  }
}
await writeJson(path.join(qa, "verification.json"), results);
console.log(
  `Verified exported media: ${media.duration.toFixed(2)} seconds, ${captionCount} caption phrases, ${script.chapters.length} chapters.`,
);
