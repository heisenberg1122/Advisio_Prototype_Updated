import path from "node:path";

export function evaluationConfig(env: NodeJS.ProcessEnv = process.env) {
  const value = env.EVALUATION_DATABASE_URL;
  if (!value) throw new Error("EVALUATION_DATABASE_URL is required.");
  const database = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    decodeURIComponent(database.pathname) !== "/advisio_evaluation" ||
    database.searchParams.get("application_name") !== "advisio-evaluation"
  ) {
    throw new Error(
      "Evaluation mode requires the dedicated advisio_evaluation database and advisio-evaluation application name.",
    );
  }
  if (
    env.DATABASE_URL !== value ||
    env.DIRECT_URL !== value ||
    database.searchParams.get("schema") !== "public"
  ) {
    throw new Error(
      "Evaluation database URLs must be identical and use the public registry schema.",
    );
  }
  if (
    env.ADVISIO_LOCAL_DEMO === "1" ||
    env.ALLOW_DEMO_ACCOUNT_PROVISIONING === "true" ||
    env.ALLOW_THEME_DEMO_ACCOUNTS === "true"
  )
    throw new Error("Evaluation mode cannot enable other demo provisioners.");
  if (
    env.STORAGE_PROVIDER !== "LOCAL" ||
    env.EMAIL_PROVIDER !== "disabled" ||
    env.NOTIFICATION_EMAILS_ENABLED !== "false"
  )
    throw new Error(
      "Evaluation mode requires local storage and disabled email delivery.",
    );
  const forbidden = Object.keys(env).filter(
    (key) =>
      /^(GOOGLE_|VITE_GOOGLE_|GMAIL_|SUPABASE_|RESEND_API_KEY$)/.test(key) &&
      env[key]?.trim(),
  );
  if (forbidden.length)
    throw new Error(
      "External integration credentials must be absent in evaluation mode.",
    );
  const origin = new URL(env.EVALUATION_WEB_URL || "http://localhost:3100");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (
    local &&
    env.EVALUATION_BIND_HOST &&
    env.EVALUATION_BIND_HOST !== "127.0.0.1"
  )
    throw new Error("Local evaluation mode must bind only to loopback.");
  if (origin.protocol !== "https:" && !(local && origin.protocol === "http:"))
    throw new Error("Network evaluation access requires HTTPS.");
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error(
      "EVALUATION_WEB_URL must be an origin without credentials or a path.",
    );
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32)
    throw new Error(
      "Set a private evaluation JWT_SECRET of at least 32 characters.",
    );
  const maxActive = Number(env.EVALUATION_MAX_ACTIVE || 20);
  if (!Number.isInteger(maxActive) || maxActive < 1 || maxActive > 50)
    throw new Error("EVALUATION_MAX_ACTIVE must be between 1 and 50.");
  const root = path.resolve(env.EVALUATION_DATA_DIR || ".evaluation");
  return {
    databaseUrl: value,
    origin: origin.origin,
    secure: origin.protocol === "https:",
    root,
    schemaFile: path.resolve(
      env.EVALUATION_SCHEMA_FILE || path.join(root, "schema.sql"),
    ),
    maxActive,
    ephemeralStorage: env.EVALUATION_EPHEMERAL_STORAGE === "1",
    idleMs: 20 * 60_000,
    lifetimeMs: 60 * 60_000,
  };
}

export function schemaName(id: string) {
  if (!/^[a-f0-9]{32}$/.test(id))
    throw new Error("Invalid evaluation workspace identity.");
  return `eval_${id}`;
}

export function isLive(
  session: { created_at: Date; touched_at: Date; state: string },
  now: number,
  idleMs: number,
  lifetimeMs: number,
) {
  return (
    session.state === "ACTIVE" &&
    now - +session.created_at < lifetimeMs &&
    now - +session.touched_at < idleMs
  );
}
