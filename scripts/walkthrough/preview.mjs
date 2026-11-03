import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import {
  root,
  output,
  assets,
  readJson,
  readScript,
  writeJson,
  renderBinaries,
  prepareBrandAssets,
} from "./common.mjs";
import { buildTimeline, scriptHash } from "../../walkthrough/shared/timing.mjs";

// Render only requested chapter/range at draft resolution. Never publish previews.
const ids = (
  process.argv.find((arg) => arg.startsWith("--chapters="))?.slice(11) ||
  "documents,timeline"
).split(",");
await prepareBrandAssets();
const script = await readScript(),
  voice = await readJson(path.join(output, "voice.json")),
  captures = await readJson(path.join(output, "captures.json"));
const selected = {
  ...script,
  chapters: script.chapters.filter((chapter) => ids.includes(chapter.id)),
};
if (voice.scriptHash !== scriptHash(script))
  throw new Error("Narration is stale.");
const needsCapture = selected.chapters.some((chapter) =>
  chapter.beats.some((beat) => !["intro", "outro"].includes(beat.action)),
);
if (needsCapture && captures.scriptHash !== scriptHash(script))
  throw new Error("Capture is stale.");
const hash = scriptHash(selected);
const timeline = buildTimeline(
  selected,
  { ...voice, scriptHash: hash },
  {
    ...captures,
    scriptHash: hash,
    auditOnly: needsCapture ? captures.auditOnly : false,
  },
);
for (const chapter of timeline.chapters)
  chapter.index = script.chapters.findIndex((item) => item.id === chapter.id);
const serveUrl = await bundle({
  entryPoint: path.join(root, "walkthrough/video/index.tsx"),
  publicDir: assets,
  outDir: path.join(output, "preview-bundle"),
});
const inputProps = { timeline, burnCaptions: true };
const composition = await selectComposition({
  serveUrl,
  id: "RoleWalkthrough",
  inputProps,
});
const binariesDirectory = await renderBinaries();
const directory = path.join(output, "previews");
await fs.mkdir(directory, { recursive: true });
for (const id of ids) {
  const chapter = timeline.chapters.find((chapter) => chapter.id === id);
  if (!chapter) throw new Error(`Unknown preview chapter: ${id}`);
  const rangeStart =
    chapter.id === "documents"
      ? chapter.beats.find((beat) => beat.action === "revision").from
      : chapter.from;
  const length = Math.min(
    chapter.from + chapter.durationInFrames - rangeStart,
    timeline.fps * 12,
  );
  if (!process.argv.includes("--stills-only"))
    await renderMedia({
      serveUrl,
      composition,
      inputProps,
      binariesDirectory,
      codec: "h264",
      audioCodec: "mp3",
      scale: 2 / 3,
      crf: 28,
      x264Preset: "veryfast",
      concurrency: 2,
      frameRange: [rangeStart, rangeStart + length - 1],
      outputLocation: path.join(directory, `${id}-draft.mp4`),
    });
  await renderStill({
    serveUrl,
    composition,
    inputProps,
    frame: rangeStart + Math.min(length - 1, timeline.fps * 9),
    scale: 2 / 3,
    output: path.join(directory, `${id}.png`),
  });
  console.log(`Targeted 720p preview: ${id} (${length / timeline.fps}s)`);
}
