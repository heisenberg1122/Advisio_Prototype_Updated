import type { RequestHandler } from "express";

const attempts = new Map<string, { count: number; expires: number }>();
export const recoveryRateLimit: RequestHandler = (req, res, next) => {
  const now = Date.now();
  for (const [key, value] of attempts)
    if (value.expires <= now) attempts.delete(key);
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
