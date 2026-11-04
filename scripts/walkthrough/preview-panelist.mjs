import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { root } from "./common.mjs";
const variants = ["structured", "pdf", "preparation"];
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const stamp = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const style = `*{box-sizing:border-box}body{margin:0;background:#f1f5f8;color:#123752;font:16px/1.5 system-ui,sans-serif}header,main{max-width:1440px;margin:auto;padding:24px}h1{font-size:25px;margin:0}h2{font-size:19px}p{color:#486073}a{color:#123752;font-weight:600}.layout{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:24px}section,nav{min-width:0}nav,.card{background:white;border:1px solid #d3dfe7;border-radius:12px;padding:18px}video{display:block;width:100%;aspect-ratio:16/9;background:#102d45;border-radius:12px}button{display:block;width:100%;padding:10px;text-align:left;border:0;border-radius:6px;background:transparent;color:#123752;font:inherit;cursor:pointer}button:hover,button:focus-visible{background:#e8f0f5;outline:2px solid #b99b50}.downloads,.choices{display:flex;flex-wrap:wrap;gap:14px;margin-top:20px}.card{flex:1;min-width:min(100%,260px)}@media(max-width:850px){header,main{padding:16px}.layout{grid-template-columns:1fr}h1{font-size:22px}}`;
const doc = (title, body) => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${style}</style>${body}</html>`;
const directory = (variant) => path.join(root, ".walkthrough", `panelist-${variant}`, "export");
const metadata = async (variant) => JSON.parse(await fsp.readFile(path.join(directory(variant), "media.json"), "utf8").catch((e) => { if (e.code !== "ENOENT") throw e; return fsp.readFile(path.join(directory(variant), "early-media.json"), "utf8"); }));
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/") {
      const cards = await Promise.all(variants.map(async (v) => { const m = await metadata(v).catch(() => null); return `<article class="card"><h2>${v === "structured" ? "Structured Evaluation" : v === "pdf" ? "PDF Evaluation" : "Defense Preparation"}</h2>${m ? `<p>${stamp(m.duration)} · ${m.chapters.length} chapters</p><a href="/${v}/">Watch video</a>` : `<p>Export is still finishing.</p>`}</article>`; }));
      res.writeHead(200, { "Content-Type": "text/html;charset=utf-8", "Cache-Control": "no-store" }); return res.end(doc("ADVISIO Panelist walkthroughs", `<header><h1>ADVISIO · Panelist walkthroughs</h1><p>Choose the evaluation method configured for your defense.</p></header><main><div class="choices">${cards.join("")}</div></main>`));
    }
    const match = /^\/(structured|pdf|preparation)\/(.*)$/.exec(pathname);
    if (!match) { res.writeHead(404); return res.end(); }
    const [, variant, name] = match, role = `panelist-${variant}`, dir = directory(variant);
    const complete = fs.existsSync(path.join(dir, "media.json"));
    if (!name) {
      const m = await metadata(variant);
      const more = complete ? `<a href="master-1080p.mp4" download>1080p master</a><a href="${role}-captioned.mp4" download>Captioned copy</a>${m.chapters.map((c) => `<a href="chapters/${c.id}.mp4" download>${escape(c.title)}</a>`).join("")}` : `<p>Additional downloads are finishing.</p>`;
      res.writeHead(200, { "Content-Type": "text/html;charset=utf-8", "Cache-Control": "no-store" }); return res.end(doc(m.title, `<header><a href="/">All Panelist videos</a><h1>${escape(m.title)}</h1><p>${stamp(m.duration)} · ${m.chapters.length} chapters · Local preview</p></header><main><div class="layout"><section><video controls preload="metadata" poster="poster.jpg" aria-label="${escape(m.title)}"><source src="${role}-web.mp4" type="video/mp4"><track default kind="captions" src="subtitles.vtt" srclang="en" label="English"></video><div class="downloads"><a href="${role}-web.mp4" download>Full video</a><a href="transcript.txt">Transcript</a><a href="subtitles.srt" download>Subtitles</a>${more}</div></section><nav aria-label="Walkthrough chapters"><h2>Chapters</h2>${m.chapters.map((c, i) => `<button data-time="${c.start}">${stamp(c.start)} · ${i + 1}. ${escape(c.title)}</button>`).join("")}</nav></div></main><script>const v=document.querySelector('video');for(const b of document.querySelectorAll('[data-time]'))b.addEventListener('click',()=>{v.currentTime=Number(b.dataset.time);v.play().catch(()=>{});});</script>`));
    }
    const allowed = [role + "-web.mp4", role + "-captioned.mp4", "master-1080p.mp4", "poster.jpg", "subtitles.srt", "subtitles.vtt", "transcript.txt", "media.json", "chapters.json"];
    if (!allowed.includes(name) && !/^chapters\/[a-z-]+\.mp4$/.test(name)) { res.writeHead(404); return res.end(); }
    if (!complete && ![role + "-web.mp4", "poster.jpg", "subtitles.srt", "subtitles.vtt", "transcript.txt"].includes(name)) { res.writeHead(404); return res.end(); }
    const file = path.join(dir, name), stat = await fsp.stat(file).catch(() => null); if (!stat) { res.writeHead(404); return res.end(); }
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || ""), start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    if (start >= stat.size || end < start) { res.writeHead(416); return res.end(); }
    const type = name.endsWith(".mp4") ? "video/mp4" : name.endsWith(".vtt") ? "text/vtt;charset=utf-8" : name.endsWith(".jpg") ? "image/jpeg" : "text/plain;charset=utf-8";
    res.writeHead(range ? 206 : 200, { "Content-Type": type, "Content-Length": end - start + 1, "Accept-Ranges": "bytes", ...(range ? { "Content-Range": `bytes ${start}-${end}/${stat.size}` } : {}) }); if (req.method === "HEAD") return res.end(); fs.createReadStream(file, { start, end }).pipe(res);
  } catch (error) { res.writeHead(503); res.end("This export is still finishing. Please refresh shortly."); }
});
server.listen(3510, "127.0.0.1", () => console.log("Panelist walkthroughs: http://localhost:3510"));
