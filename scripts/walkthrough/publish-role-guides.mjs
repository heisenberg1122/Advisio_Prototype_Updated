import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { root, readJson, writeJson } from "./common.mjs";

const destination = path.join(root, "apps/web/public/walkthroughs");
const roles = [
  "dean",
  "coordinator",
  "adviser",
  "panelist-structured",
  "panelist-pdf",
  "panelist-preparation",
];
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

const styles = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #f1f5f8; color: #123752; font: 16px/1.6 system-ui, sans-serif; }
  header, main { max-width: 1040px; margin: auto; padding: 24px; }
  h1 { margin-block: 12px; }
  a { color: inherit; font-weight: 600; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 20px; }
  .card { background: white; border: 1px solid #d3dfe7; border-radius: 12px; padding: 18px; }
  pre { font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
  .resources { display: flex; flex-wrap: wrap; gap: 16px; }
`;

function document(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <style>${styles}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

const catalog = [];
for (const role of [...roles, "researcher"]) {
  const directory = path.join(destination, role);
  const metadataPath = path.join(directory, "media.json");
  const {
    version,
    title,
    scriptHash,
    duration,
    poster,
    captions,
    subtitles,
    chapters,
  } = await readJson(metadataPath);
  await writeJson(metadataPath, {
    version,
    title,
    scriptHash,
    duration,
    poster,
    captions,
    subtitles,
    chapters,
  });
  if (role === "researcher") continue;

  const transcript = await fs.readFile(
    path.join(directory, "transcript.txt"),
    "utf8",
  );
  await fs.writeFile(
    path.join(directory, "index.html"),
    document(
      title,
      `
<header>
  <a href="../index.html">All walkthroughs</a>
  <h1>${escape(title)}</h1>
  <p>Review the chapters and read the walkthrough transcript at your own pace.</p>
</header>
<main>
  <section class="card" aria-labelledby="chapters">
    <h2 id="chapters">Chapters</h2>
    <ol>
      ${chapters.map((chapter) => `<li>${escape(chapter.title)}</li>`).join("\n      ")}
    </ol>
    <div class="resources">
      <a href="transcript.txt">Open plain-text transcript</a>
      <a href="subtitles.srt" download>Download captions (SRT)</a>
    </div>
    <h2>Walkthrough transcript</h2>
    <pre>${escape(transcript)}</pre>
  </section>
</main>`,
    ),
  );

  const files = [];
  for (const name of [
    "subtitles.vtt",
    "subtitles.srt",
    "poster.jpg",
    "transcript.txt",
    "chapters.json",
    "media.json",
  ]) {
    const bytes = await fs.readFile(path.join(directory, name));
    files.push({
      name,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const releasePath = path.join(directory, "release.json");
  const { captionCount } = await readJson(releasePath);
  await writeJson(releasePath, {
    version,
    role,
    scriptHash,
    duration,
    captionCount,
    files,
  });
  catalog.push({
    role,
    title,
    duration,
    chapters: chapters.length,
    page: `${role}/index.html`,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
  });
}

await writeJson(path.join(destination, "catalog.json"), catalog);
await fs.writeFile(
  path.join(destination, "index.html"),
  document(
    "ADVISIO walkthroughs",
    `
<header>
  <h1>ADVISIO walkthroughs</h1>
  <p>Choose your workspace to read its written guide and transcript.</p>
</header>
<main class="cards">
  <article class="card">
    <h2>Researcher</h2>
    <p>Research tasks, documents, and project progress.</p>
    <a href="/walkthrough/research-dashboard">Read Researcher walkthrough</a>
  </article>
  ${catalog
    .map(
      (item) => `<article class="card">
    <h2>${escape(item.title.replace(/^ADVISIO\s+/, ""))}</h2>
    <p>${item.chapters} chapters</p>
    <a href="${item.page}">Read walkthrough</a>
  </article>`,
    )
    .join("\n  ")}
</main>`,
  ),
);
console.log(`Published ${catalog.length} written role walkthroughs.`);
