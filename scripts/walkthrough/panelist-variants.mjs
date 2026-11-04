import fs from "node:fs/promises";
import path from "node:path";
import { root, readJson, writeJson } from "./common.mjs";
import { scriptHash, validateScript, buildTimeline } from "../../walkthrough/shared/timing.mjs";

const source = await readJson(path.join(root, "walkthrough/panelist/panelist-script.json"));
const definitions = [
  ["structured", "Structured Evaluation", ["workspace", "preparation", "live", "structured", "results", "support"]],
  ["pdf", "PDF Evaluation", ["workspace", "preparation", "live", "pdf", "results", "support"]],
  ["preparation", "Defense Preparation", ["workspace", "preparation"]],
];
for (const [variant, label, included] of definitions) {
  const id = `panelist-${variant}`;
  const script = { ...source, id, title: `ADVISIO Panelist ${label} Walkthrough`, maximumSeconds: 480, chapters: structuredClone(source.chapters.filter((chapter) => included.includes(chapter.id))) };
  if (variant === "preparation") {
    const closing = structuredClone(source.chapters.find((c) => c.id === "support"));
    closing.title = "Closing";
    closing.beats = closing.beats.filter((beat) => beat.action === "outro");
    script.chapters.push(closing);
  }
  validateScript(script);
  await writeJson(path.join(root, "walkthrough", id, `${id}-script.json`), script);
  if (process.argv.includes("--scripts-only")) continue;
  const from = path.join(root, ".walkthrough/panelist"), to = path.join(root, ".walkthrough", id);
  const voice = await readJson(path.join(from, "voice.json")), captures = await readJson(path.join(from, "captures.json"));
  if (captures.auditOnly || captures.errors.length || captures.scriptHash !== scriptHash(source) || voice.scriptHash !== scriptHash(source)) throw Error("Only matching, successful production footage and narration may become variants.");
  const keys = script.chapters.flatMap((c) => c.beats.map((b) => `${c.id}--${b.id}`));
  const variantVoice = { ...voice, scriptHash: scriptHash(script), beats: Object.fromEntries(keys.map((key) => [key, voice.beats[key]])) };
  const variantCaptures = { ...captures, role: id, scriptHash: scriptHash(script), beats: Object.fromEntries(keys.filter((key) => captures.beats[key]).map((key) => [key, captures.beats[key]])) };
  buildTimeline(script, variantVoice, variantCaptures);
  for (const key of keys) {
    for (const relative of [voice.beats[key]?.audio, captures.beats[key]?.clip].filter(Boolean)) {
      const file = path.join(to, "assets", relative); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.copyFile(path.join(from, "assets", relative), file);
    }
  }
  await writeJson(path.join(to, "voice.json"), variantVoice);
  await writeJson(path.join(to, "captures.json"), variantCaptures);
  console.log(`Prepared ${id}; shared narration and footage reused without speech generation.`);
}
