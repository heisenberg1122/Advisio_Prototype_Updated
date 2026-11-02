import type { RequestHandler } from "express";
import { sharedLoginLimit, clearSharedLoginLimit } from "../services/security-audit.service.js";

const attempts = new Map<string, { count: number; expires: number }>();
const loginAttempts = new Map<string, { count: number; expires: number }>();

function pruneExpired(
  entries: Map<string, { count: number; expires: number }>,
  now: number,
) {
  for (const [key, value] of entries)
    if (value.expires <= now) entries.delete(key);
}

export const loginRateLimit: RequestHandler = async (req, res, next) => {
  const now = Date.now();
  pruneExpired(loginAttempts, now);
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "unknown";
  try {
    const shared = await sharedLoginLimit(email, req.ip || "unknown");
    if (shared) {
      if (!shared.allowed) {
        res.setHeader("Retry-After", String(shared.retryAfter));
        res.status(429).json({ error: "Too many sign-in attempts. Please try again later." });
        return;
      }
      res.once("finish", () => {
        if (res.statusCode >= 200 && res.statusCode < 400) void clearSharedLoginLimit(shared.pairKey);
      });
      next();
      return;
    }
  } catch {
    // A failed shared store must never remove protection or create per-attempt SQL writes.
    res.setHeader("Retry-After", "30");
    res.status(503).json({ error: "Sign-in protection is temporarily unavailable. Please try again shortly." });
    return;
  }
  const key = `${req.ip || "unknown"}:${email}`;
  const entry = loginAttempts.get(key) || {
    count: 0,
    expires: now + 15 * 60_000,
  };

  if (
    entry.count >= 10 ||
    (loginAttempts.size >= 10_000 && !loginAttempts.has(key))
  ) {
    const retryAfter = Math.max(1, Math.ceil((entry.expires - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    res
      .status(429)
      .json({ error: "Too many sign-in attempts. Please try again later." });
    return;
  }

  entry.count += 1;
  loginAttempts.set(key, entry);
  res.once("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 400)
      loginAttempts.delete(key);
  });
  next();
};

export const recoveryRateLimit: RequestHandler = (req, res, next) => {
  const now = Date.now();
  pruneExpired(attempts, now);
  const key = req.ip || "unknown";
  const entry = attempts.get(key) || { count: 0, expires: now + 15 * 60_000 };
  if (entry.count >= 10 || (attempts.size >= 10000 && !attempts.has(key))) {
    res.setHeader("Retry-After", "900");
    res
      .status(429)
      .json({ error: "Too many recovery attempts. Please try again later." });
    return;
  }
  entry.count += 1;
  attempts.set(key, entry);
  next();
};
