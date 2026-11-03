import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import {
  assets,
  output,
  root,
  readJson,
  readScript,
  writeJson,
  encode,
  duration,
  renderBinaries,
  probe,
  prepareBrandAssets,
} from "./common.mjs";
import {
  buildTimeline,
  subtitleText,
  subtitleAss,
} from "../../walkthrough/shared/timing.mjs";

const script = await readScript();
await prepareBrandAssets();
const voice = await readJson(path.join(output, "voice.json"));
try {
  process.loadEnvFile?.(path.join(root, ".env.walkthrough.local"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (
  process.env.ELEVENLABS_VOICE_ID &&
  process.env.ELEVENLABS_VOICE_ID !== voice.voiceId
)
  throw new Error(
    "Selected narrator differs from generated narration. Regenerate in the selected voice.",
  );
const captures = await readJson(path.join(output, "captures.json"));
const timeline = buildTimeline(script, voice, captures);
for (const capture of Object.values(captures.beats)) {
  const metadata = await probe(path.join(assets, capture.clip));
  const video = metadata.streams.find(
    (stream) => stream.codec_type === "video",
  );
  if (
    !video ||
    video.width !== captures.viewport?.width ||
    video.height !== captures.viewport?.height
  )
    throw new Error(
      "Capture dimensions differ from the declared fixed viewport. Recapture all chapters.",
    );
}
await writeJson(path.join(output, "timeline.json"), timeline);
await fs.mkdir(path.join(output, "export"), { recursive: true });
const exported = path.join(output, "export");
await fs.writeFile(
  path.join(exported, "subtitles.srt"),
  subtitleText(timeline),
);
await fs.writeFile(
  path.join(exported, "subtitles.vtt"),
  subtitleText(timeline, true),
);
await fs.writeFile(path.join(exported, "captions.ass"), subtitleAss(timeline));
const serveUrl = await bundle({
  entryPoint: path.join(root, "walkthrough/video/index.tsx"),
  publicDir: assets,
  outDir: path.join(output, "bundle"),
});
const cleanProps = { timeline, burnCaptions: false };
const composition = await selectComposition({
  serveUrl,
  id: "RoleWalkthrough",
  inputProps: cleanProps,
});
const binariesDirectory = await renderBinaries();
const common = {
  serveUrl,
  composition,
  binariesDirectory,
  codec: "h264",
  audioCodec: "mp3",
  audioBitrate: "320k",
  pixelFormat: "yuv420p",
  concurrency: 3,
  chromiumOptions: { gl: "angle" },
};
const clean = path.join(output, "clean.mp4");
let reported = -1;
await renderMedia({
  ...common,
  inputProps: cleanProps,
  outputLocation: clean,
  crf: 16,
  onProgress: ({ progress }) => {
    const step = Math.floor(progress * 20);
    if (step > reported) {
      reported = step;
      console.log(`Composing walkthrough: ${Math.round(progress * 100)}%`);
    }
  },
});
// Two-pass EBU R128 normalization preserves measured narrator dynamics and caps peaks.
// Loudnorm's measurement JSON is captured privately; it never contains credentials.
const { default: ffmpeg } = await import("ffmpeg-static");
const { spawn } = await import("node:child_process");
const measurement = await new Promise((resolve, reject) => {
  const child = spawn(
    ffmpeg,
    [
      "-hide_banner",
      "-i",
      clean,
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
      "-f",
      "null",
      "-",
    ],
    { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
  );
  let data = "";
  child.stderr.on("data", (chunk) => (data += chunk));
  child.on("error", reject);
  child.on("exit", (code) =>
    code === 0
      ? resolve(
          JSON.parse(
            data.slice(data.lastIndexOf("{"), data.lastIndexOf("}") + 1),
          ),
        )
      : reject(new Error("Audio loudness measurement failed.")),
  );
});
const filter = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${measurement.input_i}:measured_TP=${measurement.input_tp}:measured_LRA=${measurement.input_lra}:measured_thresh=${measurement.input_thresh}:offset=${measurement.target_offset}:linear=true`;
const assPath = path
  .relative(root, path.join(exported, "captions.ass"))
  .split(path.sep)
  .join("/");
for (const [name, width, crf, burned] of [
  ["master-1080p.mp4", 1920, 17, true],
  ["researcher-web.mp4", 1280, 22, false],
  ["researcher-captioned.mp4", 1280, 22, true],
]) {
  console.log(`Encoding ${name}`);
  await encode([
    "-i",
    clean,
    "-vf",
    `scale=${width}:-2${burned ? `,ass=${assPath}` : ""}`,
    "-af",
    filter,
    "-ar",
    "48000",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    String(crf),
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    "-metadata",
    `title=${script.title}`,
    path.join(exported, name),
  ]);
}
await renderStill({
  serveUrl,
  composition,
  inputProps: cleanProps,
  output: path.join(exported, "poster.jpg"),
  frame: 15,
  imageFormat: "jpeg",
});
const measured = await duration(path.join(exported, "researcher-web.mp4"));
if (Math.abs(measured - timeline.durationInFrames / timeline.fps) > 0.3)
  throw new Error("Encoded runtime differs from timeline.");
const chapters = timeline.chapters.map((chapter) => ({
  id: chapter.id,
  title: chapter.title,
  start: chapter.from / timeline.fps,
  end: (chapter.from + chapter.durationInFrames) / timeline.fps,
}));
await writeJson(path.join(exported, "chapters.json"), chapters);
await writeJson(path.join(exported, "media.json"), {
  version: 1,
  title: script.title,
  scriptHash: timeline.scriptHash,
  duration: measured,
  video: "researcher-web.mp4",
  captionedVideo: "researcher-captioned.mp4",
  poster: "poster.jpg",
  captions: "subtitles.vtt",
  subtitles: "subtitles.srt",
  chapters,
});
await fs.writeFile(
  path.join(exported, "transcript.txt"),
  timeline.chapters
    .map(
      (chapter) =>
        `${chapter.index}. ${chapter.title}\n\n${chapter.beats.map((beat) => beat.narration).join("\n\n")}`,
    )
    .join("\n\n"),
);
console.log(
  `Rendered ${(measured / 60).toFixed(2)} minutes. Master, web, captioned video, subtitles, poster and chapter data: ${exported}`,
);
if (process.argv.includes("--publish")) {
  const target = path.join(root, "apps/web/public/walkthroughs/researcher");
  await fs.mkdir(target, { recursive: true });
  // Metadata is copied last: visitors never see a partially published bundle.
  for (const name of [
    "researcher-web.mp4",
    "researcher-captioned.mp4",
    "poster.jpg",
    "subtitles.vtt",
    "subtitles.srt",
    "chapters.json",
    "transcript.txt",
    "media.json",
  ])
    await fs.copyFile(path.join(exported, name), path.join(target, name));
  // The web build was already validated. Include media in that artifact without
  // rerunning the compiler/build just to copy static files.
  const built = path.join(root, "apps/web/dist");
  if (
    await fs.access(path.join(built, "index.html")).then(
      () => true,
      () => false,
    )
  ) {
    const builtMedia = path.join(built, "walkthroughs/researcher");
    await fs.mkdir(builtMedia, { recursive: true });
    for (const name of [
      "researcher-web.mp4",
      "researcher-captioned.mp4",
      "poster.jpg",
      "subtitles.vtt",
      "subtitles.srt",
      "chapters.json",
      "transcript.txt",
      "media.json",
    ])
      await fs.copyFile(path.join(exported, name), path.join(builtMedia, name));
  }
  console.log(
    "Static Researcher media bundle published to the web public folder.",
  );
}
