import { randomBytes } from "node:crypto";

export function resolveJwtSecret(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const secret = environment.JWT_SECRET || environment.AUTH_SECRET;
  if (
    environment.NODE_ENV === "production" &&
    (!secret ||
      secret.length < 32 ||
      /change.in.production|dev.secret|super.secret|ci-secret/i.test(secret))
  ) {
    throw new Error(
      "Production requires a unique JWT_SECRET of at least 32 characters.",
    );
  }
  // An unconfigured development server gets an ephemeral key, never a public key.
  return secret || randomBytes(48).toString("hex");
}

export function isAllowedOrigin(
  origin: string | undefined,
  environment: NodeJS.ProcessEnv = process.env,
) {
  if (!origin) return true;
  const origins = (environment.CORS_ORIGIN || environment.WEB_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (origins.includes(origin)) return true;
  if (environment.NODE_ENV === "production" || origins.length) return false;
  try {
    const url = new URL(origin);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
