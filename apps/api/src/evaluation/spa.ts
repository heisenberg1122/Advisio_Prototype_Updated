import { Router, static as serveStatic } from "express";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

function htmlPolicy(html: string) {
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => !/\bsrc\s*=/i.test(match[1]) && match[2].trim())
    .map(
      (match) =>
        // HTML parsing normalizes CRLF/CR to LF before CSP hashes are checked.
        `'sha256-${createHash("sha256").update(match[2].replace(/\r\n?/g, "\n")).digest("base64")}'`,
    );
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    "object-src 'self' blob:",
    "media-src 'self' blob:",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// One HTTPS origin serves the portals and API, so mobile browsers keep the
// private, first-party evaluation cookie without cross-site cookie exceptions.
export function evaluationSpa(directory: string) {
  const root = path.resolve(directory);
  const index = path.join(root, "index.html");
  const policy = htmlPolicy(readFileSync(index, "utf8"));
  const staticPolicies = new Map<string, string>();
  const router = Router();
  router.use((req, res, next) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(req.path);
    } catch {
      return void res.status(400).end();
    }
    if (decoded.split("/").some((segment) => segment.startsWith(".")))
      return void res.status(404).end();
    if (/^\/api(?:\/|$)/.test(req.path))
      return void res.status(404).json({ error: "API route not found." });
    res.setHeader("Content-Security-Policy", policy);
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    next();
  });
  router.use(
    serveStatic(root, {
      index: false,
      dotfiles: "deny",
      maxAge: 0,
      fallthrough: true,
      setHeaders(res, file) {
        if (path.extname(file) !== ".html") return;
        // serveStatic supplies only an actual file inside the public root.
        // Standalone players need hashes for their own chapter controls.
        let pagePolicy = staticPolicies.get(file);
        if (!pagePolicy) {
          pagePolicy = htmlPolicy(readFileSync(file, "utf8"));
          staticPolicies.set(file, pagePolicy);
        }
        res.setHeader("Content-Security-Policy", pagePolicy);
      },
    }),
  );
  router.get("*", (req, res, next) => {
    if (path.extname(req.path)) return next();
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(index);
  });
  return router;
}
