// Hybrid compositor for stationary product footage: Remotion renders the actual
// framing/brand layers; FFmpeg preserves the recorded video at its original cadence.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { openBrowser, renderStill } from "@remotion/renderer";
import { chromium } from "playwright";
import { assets, output, root, encode, duration, writeJson, readJson } from "./common.mjs";

export async function composeNative({ timeline, serveUrl, composition, clean }) {
  const beats = timeline.chapters.flatMap((chapter) => chapter.beats.map((beat) => ({ chapter, beat })));
  if (beats.some(({ beat }) => (beat.framing && beat.framing !== "overview") || beat.visual)) throw new Error("The hybrid compositor supports stationary overview captures only. Use the full Remotion renderer for camera/diagram sequences.");
  const directory = path.join(output, "native"); await fs.mkdir(directory, { recursive: true });
  const renderSource = await Promise.all(["scripts/walkthrough/compose-native.mjs", "walkthrough/video/WalkthroughComposition.tsx", "walkthrough/video/components.tsx", "walkthrough/video/motion.ts"].map((file) => fs.readFile(path.join(root, file))));
  const sourceHash = createHash("sha256").update(Buffer.concat(renderSource)).digest("hex");
  const cacheKeys = new Map();
  for (const { chapter, beat } of beats) {
    const hash = createHash("sha256").update(JSON.stringify({ sourceHash, title: timeline.title, duration: timeline.durationInFrames, fps: timeline.fps, width: timeline.width, height: timeline.height, chapter: { id: chapter.id, title: chapter.title, index: chapter.index }, beat }));
    hash.update(await fs.readFile(path.join(assets, beat.audio)));
    if (beat.capture?.clip) hash.update(await fs.readFile(path.join(assets, beat.capture.clip)));
    hash.update(await fs.readFile(path.join(assets, "branding/advisio-logo.png")));
    cacheKeys.set(beat.key, hash.digest("hex"));
  }
  const inputProps = { timeline, burnCaptions: false, templateOnly: true };
  const browser = await openBrowser("chrome");
  try {
    for (const { beat } of beats) {
      const cache = await readJson(path.join(directory, `${beat.key}.cache.json`)).catch(() => null);
      if (cache?.key === cacheKeys.get(beat.key) && await fs.access(path.join(directory, `${beat.key}.png`)).then(() => true, () => false)) continue;
      console.log(`Preparing Remotion frame: ${beat.key}`);
      await renderStill({ serveUrl, composition, inputProps, puppeteerInstance: browser, imageFormat: "png", frame: beat.from + Math.min(30, beat.durationInFrames - 1), output: path.join(directory, `${beat.key}.png`) });
    }
  } finally { await browser.close({ silent: true }); }
  const iconBrowser = await chromium.launch({ headless: true });
  try {
    const page = await iconBrowser.newPage({ viewport: { width: 22, height: 27 }, deviceScaleFactor: 1 });
    await page.setContent('<style>html,body{margin:0;background:transparent}</style><svg width="22" height="27" viewBox="0 0 30 36"><path d="M3 2 L4 29 L11 22 L17 34 L22 31 L16 20 L27 19 Z" fill="white" stroke="#123752" stroke-width="2"/></svg>');
    await page.screenshot({ path: path.join(directory, "cursor.png"), omitBackground: true });
  } finally { await iconBrowser.close(); }
  const composed = [];
  const totalSeconds = timeline.durationInFrames / timeline.fps;
  for (const { chapter, beat } of beats) {
    const seconds = beat.durationInFrames / timeline.fps;
    const destination = path.join(directory, `${beat.key}.mkv`);
    const cache = await readJson(path.join(directory, `${beat.key}.cache.json`)).catch(() => null);
    if (cache?.key === cacheKeys.get(beat.key)) {
      const measured = await duration(destination).catch(() => null);
      if (measured && Math.abs(measured - seconds) <= .08) {
        console.log(`Reusing completed composition: ${beat.key}`);
        composed.push({ key: beat.key, file: destination, seconds: measured }); continue;
      }
    }
    const inputs = ["-loop", "1", "-framerate", String(timeline.fps), "-i", path.join(directory, `${beat.key}.png`)];
    const filters = ["[0:v]format=yuv420p[base]"];
    let current = "base", input = 1;
    if (beat.capture?.clip) {
      inputs.push("-i", path.join(assets, beat.capture.clip)); input++;
      filters.push("[1:v]scale=1440:810:flags=lanczos,setsar=1[footage]", "[base][footage]overlay=x=240:y=130:shortest=1[product]"); current = "product";
      const events = beat.capture.events;
      if (events.length) {
        inputs.push("-loop", "1", "-framerate", String(timeline.fps), "-i", path.join(directory, "cursor.png"));
        const cursorInput = input++;
        const coordinate = (axis) => {
          const transform = (value) => (axis === "x" ? 240 : 130) + .75 * value - 2.25;
          let expression = String(transform(events.at(-1)[axis]));
          for (let i = events.length - 1; i >= 0; i--) {
            const event = events[i], previous = events[i - 1] || { x: event.x - 70, y: event.y + 35 };
            const progress = `clip((t-${event.at})/${Math.max(.15, event.clickAt - event.at)},0,1)`;
            const easing = `(${progress})*(${progress})*(3-2*(${progress}))`;
            expression = `if(lt(t,${event.clickAt}),${transform(previous[axis])}+${.75 * (event[axis] - previous[axis])}*(${easing}),${expression})`;
          }
          return expression;
        };
        filters.push(`[${cursorInput}:v]scale=17:20[cursor]`, `[${current}][cursor]overlay=x='${coordinate("x")}':y='${coordinate("y")}':eval=frame:shortest=1[pointed]`); current = "pointed";
        for (const [i, event] of events.entries()) {
          filters.push(`[${current}]drawbox=x=${240 + .75 * event.box.x - 4}:y=${130 + .75 * event.box.y - 4}:w=${.75 * event.box.width + 8}:h=${.75 * event.box.height + 8}:color=0xe7b454@0.8:t=2:enable='between(t,${event.at},${event.clickAt + .2})'[cue${i}]`); current = `cue${i}`;
        }
      }
    }
    // The source scene is otherwise stationary after its title fade. Moving
    // cursor cues, recorded scrolling, product transitions and progress stay timed.
    filters.push(`[${current}]fade=t=in:st=0:d=${beat.action === "intro" ? .4 : .2}:color=0xf3f6f8,drawbox=x=0:y=1074:w=1920:h=6:color=0xdce5ec:t=fill[framed]`, "color=c=0xe7b454:s=1920x6:r=30[gold]", `[framed][gold]overlay=x='-1920+1920*(${beat.from / timeline.fps}+t)/${totalSeconds}':y=1074:shortest=1[out]`);
    const filterFile = path.join(directory, `${beat.key}.filter`); await fs.writeFile(filterFile, filters.join(";\n"));
    inputs.push("-i", path.join(assets, beat.audio));
    console.log(`Composing recorded chapter: ${chapter.title} / ${beat.id}`);
    await encode([...inputs, "-filter_complex_script", filterFile, "-map", "[out]", "-map", `${input}:a`, "-t", String(seconds), "-r", String(timeline.fps), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-af", `aresample=48000,apad,atrim=end_sample=${beat.durationInFrames * 1600},asetpts=N/SR/TB`, "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", destination]);
    const measured = await duration(destination);
    if (Math.abs(measured - seconds) > .08) throw new Error(`Chapter duration mismatch: ${beat.key}`);
    await writeJson(path.join(directory, `${beat.key}.cache.json`), { key: cacheKeys.get(beat.key), seconds: measured });
    composed.push({ key: beat.key, file: destination, seconds: measured });
  }
  const list = path.join(directory, "segments.txt");
  await fs.writeFile(list, composed.map((item) => `file '${item.file.replaceAll("\\", "/").replaceAll("'", "'\\''")}'`).join("\n") + "\n");
  await encode(["-f", "concat", "-safe", "0", "-i", list, "-c:v", "copy", "-c:a", "libmp3lame", "-b:a", "320k", "-movflags", "+faststart", clean]);
  const measured = await duration(clean);
  if (Math.abs(measured - totalSeconds) > .3) throw new Error("Composed video does not match the measured timeline.");
  await writeJson(path.join(directory, "composition-report.json"), { engine: "Remotion framing with native recorded-video composition", scriptHash: timeline.scriptHash, duration: measured, chapters: composed });
}
