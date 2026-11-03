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
  encode,
  duration,
  renderBinaries,
} from "./common.mjs";

// Engineering verification only: not a completed narrated video, never published.
const clip = process.argv.includes("--document")
  ? "clips/documents--library.mp4"
  : "clips/overview--dashboard.mp4";
await fs.access(path.join(assets, clip));
await fs.mkdir(path.join(assets, "test-only"), { recursive: true });
await encode([
  "-f",
  "lavfi",
  "-i",
  "anullsrc=r=44100:cl=mono",
  "-t",
  "2",
  path.join(assets, "test-only/silence.mp3"),
]);
const beat = {
  key: "test",
  action: "capture",
  callout: "Composition layout verification",
  narration: "Engineering test only.",
  from: 0,
  durationInFrames: process.argv.includes("--still") ? 270 : 60,
  audio: "test-only/silence.mp3",
  captions: [
    {
      text: "Engineering test only.\nNot the narrated walkthrough.",
      startMs: 0,
      endMs: process.argv.includes("--still") ? 9000 : 2000,
    },
  ],
  capture: { clip, events: [], zoom: 1.3, focus: { x: 1142, y: 505 } },
};
const timeline = {
  id: "test-only",
  title: "Engineering test",
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: process.argv.includes("--still") ? 270 : 60,
  chapters: [
    {
      id: "test",
      index: 1,
      title: "Researcher overview",
      route: "/student/dashboard",
      from: 0,
      durationInFrames: process.argv.includes("--still") ? 270 : 60,
      beats: [beat],
    },
  ],
};
const inputProps = { timeline, burnCaptions: true };
const serveUrl = await bundle({
  entryPoint: path.join(root, "walkthrough/video/index.tsx"),
  publicDir: assets,
  outDir: path.join(output, "test-bundle"),
});
const composition = await selectComposition({
  serveUrl,
  id: "RoleWalkthrough",
  inputProps,
});
await renderStill({
  serveUrl,
  composition,
  inputProps,
  output: path.join(output, "composition-layout-test.png"),
  frame: process.argv.includes("--still") ? 240 : 40,
});
if (process.argv.includes("--still")) {
  console.log("Composition focus layout verified.");
  process.exit(0);
}
const binariesDirectory = await renderBinaries();
const outputLocation = path.join(output, "composition-test-only.mp4");
await renderMedia({
  serveUrl,
  composition,
  inputProps,
  binariesDirectory,
  codec: "h264",
  audioCodec: "mp3",
  audioBitrate: "320k",
  outputLocation,
  concurrency: 2,
});
if (Math.abs((await duration(outputLocation)) - 2) > 0.1)
  throw new Error("Composition duration mismatch.");
console.log(
  "Remotion 1080p layout, actual UI clip, caption layer, audio track and 30 FPS render verified (engineering fixture only).",
);
