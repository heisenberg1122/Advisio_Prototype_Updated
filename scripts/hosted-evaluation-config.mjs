import path from "node:path";

export function hostedEvaluationEnvironment(source, root) {
  if (source.ADVISIO_EVALUATION !== "1")
    throw new Error("Hosted startup requires explicit ADVISIO_EVALUATION=1.");
  const raw = source.EVALUATION_DATABASE_URL;
  if (!raw) throw new Error("A dedicated EVALUATION_DATABASE_URL is required.");
  const database = new URL(raw);
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    decodeURIComponent(database.pathname) !== "/advisio_evaluation"
  )
    throw new Error(
      "Hosted evaluation must use the dedicated advisio_evaluation database.",
    );
  database.searchParams.set("schema", "public");
  database.searchParams.set("application_name", "advisio-evaluation");
  const origin = new URL(
    source.EVALUATION_WEB_URL || source.RENDER_EXTERNAL_URL || "",
  );
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
  )
    throw new Error("Hosted evaluation requires a public HTTPS origin.");
  if (!source.JWT_SECRET || source.JWT_SECRET.length < 32)
    throw new Error(
      "A private JWT_SECRET of at least 32 characters is required.",
    );
  if (
    !source.EVALUATION_DATA_DIR ||
    !path.isAbsolute(source.EVALUATION_DATA_DIR)
  )
    throw new Error(
      "Set an absolute EVALUATION_DATA_DIR on the persistent disk.",
    );
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    if (
      source[key] &&
      source[key] !== raw &&
      source[key] !== database.toString()
    )
      throw new Error(
        `${key} conflicts with the dedicated evaluation database.`,
      );
  }
  const env = {
    ...source,
    NODE_ENV: "production",
    DATABASE_URL: database.toString(),
    DIRECT_URL: database.toString(),
    EVALUATION_DATABASE_URL: database.toString(),
    EVALUATION_WEB_URL: origin.origin,
    WEB_URL: origin.origin,
    CORS_ORIGIN: origin.origin,
    EVALUATION_BIND_HOST: "0.0.0.0",
    EVALUATION_WEB_DIST: path.resolve(root, "apps/web/dist"),
    EVALUATION_SCHEMA_FILE: path.resolve(root, "evaluation-schema.sql"),
    PORT: source.PORT || "10000",
  };
  if (
    env.STORAGE_PROVIDER !== "LOCAL" ||
    env.EMAIL_PROVIDER !== "disabled" ||
    env.NOTIFICATION_EMAILS_ENABLED !== "false"
  )
    throw new Error(
      "Hosted evaluation requires local storage and disabled email delivery.",
    );
  if (
    Object.keys(env).some(
      (key) =>
        /^(GOOGLE_|VITE_GOOGLE_|GMAIL_|SUPABASE_|RESEND_)/.test(key) &&
        env[key]?.trim(),
    )
  )
    throw new Error(
      "Hosted evaluation must not inherit external integration credentials.",
    );
  return env;
}
