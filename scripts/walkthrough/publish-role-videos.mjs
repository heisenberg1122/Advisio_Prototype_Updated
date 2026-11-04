import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { root, readJson, writeJson } from "./common.mjs";
import { scriptHash, validateScript } from "../../walkthrough/shared/timing.mjs";

const roles = ["dean", "coordinator", "adviser", "panelist-structured", "panelist-pdf", "panelist-preparation"];
const destination = path.join(root, "apps/web/public/walkthroughs");
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const stamp = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const styles = `*{box-sizing:border-box}body{margin:0;background:#f1f5f8;color:#123752;font:16px/1.5 system-ui,sans-serif}header,main{max-width:1440px;margin:auto;padding:24px}h1{font-size:26px;margin:0}h2{font-size:19px;margin:0 0 12px}p{color:#486073}.layout{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:24px}section,nav{min-width:0}video{display:block;width:100%;aspect-ratio:16/9;background:#102d45;border-radius:12px}nav,.card{background:white;border:1px solid #d3dfe7;border-radius:12px;padding:18px}button{display:block;width:100%;padding:10px;text-align:left;border:0;border-radius:6px;background:transparent;color:#123752;font:inherit;cursor:pointer}button:hover,button:focus-visible{background:#e8f0f5;outline:2px solid #b99b50}a{color:#123752;font-weight:600}a:focus-visible{outline:2px solid #b99b50}.downloads{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:20px}.time{font-size:12px;color:#587082;margin-right:8px}@media(max-width:850px){header,main{padding:16px}.layout{grid-template-columns:1fr}h1{font-size:22px}}`;
const document = (title, body) => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${styles}</style>${body}</html>`;
const catalog = [];
for (const role of roles) {
  const source = path.join(root, ".walkthrough", role, "export");
  const script = await readJson(path.join(root, "walkthrough", role, `${role}-script.json`));
  validateScript(script);
  const media = await readJson(path.join(source, "media.json"));
  const verified = await readJson(path.join(root, ".walkthrough", role, "qa/verification.json"));
  assert.equal(media.scriptHash, scriptHash(script));
  assert.equal(verified.scriptHash, media.scriptHash);
  const target = path.join(destination, role);
  const names = ["master-1080p.mp4", `${role}-web.mp4`, `${role}-captioned.mp4`, "subtitles.vtt", "subtitles.srt", "poster.jpg", "transcript.txt", "chapters.json", "media.json"];
  names.push(...verified.files.filter((file) => file.name.startsWith("chapters/")).map((file) => file.name));
  const files = [];
  for (const name of names) {
    assert.ok(/^[a-z0-9./-]+$/.test(name) && !name.includes(".."));
    const bytes = await fs.readFile(path.join(source, name));
    assert.ok(bytes.length > 0 && bytes.length < 95 * 1024 * 1024, `Invalid release file size: ${role}/${name}`);
    if (name.endsWith(".mp4")) assert.equal(bytes.length, verified.files.find((file) => file.name === name)?.bytes, `Verification differs: ${role}/${name}`);
    const file = path.join(target, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    assert.equal(createHash("sha256").update(await fs.readFile(file)).digest("hex"), sha256);
    files.push({ name, bytes: bytes.length, sha256 });
  }
  const chapterDownloads = media.chapters.filter((chapter) => names.includes(`chapters/${chapter.id}.mp4`)).map((chapter) => `<a href="chapters/${chapter.id}.mp4" download>${escape(chapter.title)}</a>`).join("");
  await fs.writeFile(path.join(target, "index.html"), document(media.title, `<header><a href="../index.html">All walkthroughs</a><h1>${escape(media.title)}</h1><p>${stamp(media.duration)} · ${media.chapters.length} chapters</p></header><main><div class="layout"><section><video controls preload="metadata" poster="poster.jpg" aria-label="${escape(media.title)}"><source src="${role}-web.mp4" type="video/mp4"><track default kind="captions" src="subtitles.vtt" srclang="en" label="English"></video><p>Choose a chapter to jump to a feature. Captions, volume, playback speed, and full screen are available in the video controls.</p><div class="downloads"><a href="master-1080p.mp4" download>1080p master</a><a href="${role}-captioned.mp4" download>Captioned copy</a><a href="transcript.txt">Transcript</a><a href="subtitles.srt" download>Subtitles</a>${chapterDownloads}</div></section><nav aria-label="Walkthrough chapters"><h2>Chapters</h2>${media.chapters.map((chapter, index) => `<button data-time="${chapter.start}"><span class="time">${stamp(chapter.start)}</span>${index + 1}. ${escape(chapter.title)}</button>`).join("")}</nav></div></main><script>const video=document.querySelector('video');for(const button of document.querySelectorAll('[data-time]'))button.addEventListener('click',()=>{video.currentTime=Number(button.dataset.time);video.play().catch(()=>{});});</script>`));
  await writeJson(path.join(target, "release.json"), { version: 1, role, scriptHash: media.scriptHash, duration: media.duration, captionCount: verified.captionCount, files });
  catalog.push({ role, title: media.title, duration: media.duration, chapters: media.chapters.length, page: `${role}/index.html`, bytes: files.reduce((sum, file) => sum + file.bytes, 0) });
}
await writeJson(path.join(destination, "catalog.json"), catalog);
await fs.writeFile(path.join(destination, "index.html"), document("ADVISIO walkthroughs", `<header><h1>ADVISIO walkthroughs</h1><p>Choose your workspace for a narrated tour of its tools and academic responsibilities.</p></header><main><div class="cards"><article class="card"><h2>Researcher</h2><p>Research tasks, documents, and project progress.</p><a href="/walkthrough/research-dashboard">Watch Researcher walkthrough</a></article>${catalog.map((item) => `<article class="card"><h2>${escape(item.title.replace(/^ADVISIO\s+/, ""))}</h2><p>${stamp(item.duration)} · ${item.chapters} chapters</p><a href="${item.page}">Watch walkthrough</a></article>`).join("")}</div></main>`));
console.log(`Published ${catalog.length} verified role bundles (${(catalog.reduce((sum, item) => sum + item.bytes, 0) / 1024 / 1024).toFixed(1)} MiB). No raw captures, account manifests, or voice caches were copied.`);
