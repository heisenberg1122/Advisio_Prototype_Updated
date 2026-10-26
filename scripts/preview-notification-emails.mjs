import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { notificationTemplates, renderNotificationEmail } from "../packages/email/dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps/api/package.json"));
require("dotenv").config({ path: path.join(root, ".env") });
const webUrl = process.env.EMAIL_PREVIEW_WEB_URL || process.env.WEB_URL;
if (!webUrl || !["http:", "https:"].includes(new URL(webUrl).protocol)) {
  throw new Error("Set EMAIL_PREVIEW_WEB_URL or WEB_URL to the application URL before generating previews.");
}
const previewLogoUrl = new URL("/advisio-email-logo.png", webUrl).href;
const out = path.join(root, ".local", "email-previews");
await mkdir(out, { recursive: true });
await copyFile(path.join(root, "apps/web/public/advisio-email-logo.png"), path.join(out, "advisio-email-logo.png"));
const data = { firstName: "Maria", actorName: "Prof. Ana Reyes", title: "Chapter 1: Introduction", workflowName: "Research Methods · BS Information Technology", scope: "BS Information Technology", message: "Please review the feedback and supporting details inside your Advisio workspace.", dueDate: "October 30, 2026, 11:59 PM (Asia/Manila)", teamName: "Research Team Alpha", researchTitle: "Smart Campus Resource Management", result: "Approved" };
for (const key of Object.keys(notificationTemplates)) {
  const rendered = renderNotificationEmail(key, data, { webUrl, logoUrl: previewLogoUrl, actionUrl: "/student/dashboard" });
  // Relative image path also lets the standalone HTML open from disk.
  await writeFile(path.join(out, `${key}.html`), rendered.html.replaceAll(previewLogoUrl, "./advisio-email-logo.png"));
}
await writeFile(path.join(out, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Advisio notification templates</title><style>body{margin:32px;background:#f1f5f9;color:#102c54;font:16px Arial}main{max-width:1100px;margin:auto}a{color:#1261c9}li{margin:14px 0}iframe{border:1px solid #cbd5e1;max-width:100%;height:900px;background:white}section{display:flex;gap:20px;flex-wrap:wrap}</style></head><body><main><h1>Advisio notification emails</h1><p>Shared branding · Dynamic content · Desktop and mobile layout</p><ol>${Object.entries(notificationTemplates).map(([key, template]) => `<li><a href="${key}.html">${template.heading.replace(/\{\w+\}/g, "Announcement")}</a> <small>(${key})</small></li>`).join("")}</ol><h2>Layout preview</h2><section><iframe title="Desktop preview" src="submission_revision.html" width="640"></iframe><iframe title="Mobile preview" src="team_invitation.html" width="375"></iframe></section></main></body></html>`);
console.log(`Generated ${Object.keys(notificationTemplates).length} templates: ${path.join(out, "index.html")}`);
