import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";

const root = fileURLToPath(new URL("..", import.meta.url));
const dataRoot = path.join(root, ".evaluation");
const envFile = path.join(root, ".env.evaluation.local");
function run(command, args, env = process.env, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: "inherit",
      windowsHide: true,
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(`${path.basename(command)} exited with code ${code}.`),
          ),
    );
  });
}
async function environment() {
  const loaded = dotenv.parse(await fs.readFile(envFile));
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (
      /^(GOOGLE_|VITE_GOOGLE_|SUPABASE_|RESEND_|DATABASE_URL$|DIRECT_URL$|JWT_SECRET$|AUTH_SECRET$|ADVISIO_LOCAL_DEMO$|ALLOW_DEMO_|ALLOW_THEME_DEMO_)/.test(
        key,
      )
    )
      delete env[key];
  Object.assign(env, loaded, {
    EVALUATION_DATA_DIR: dataRoot,
    VITE_API_URL: "",
    VITE_API_PROXY: "http://127.0.0.1:5100",
  });
  // Prisma can load its package .env on first construction. Explicit empty
  // values prevent credentials from that unrelated environment being inherited.
  for (const relative of [".env", "apps/api/.env", "packages/database/.env"]) {
    let values = {};
    try {
      values = dotenv.parse(await fs.readFile(path.join(root, relative)));
    } catch {}
    for (const key of Object.keys(values))
      if (
        !(key in env) ||
        /^(GOOGLE_|VITE_GOOGLE_|GMAIL_|SUPABASE_|RESEND_)/.test(key)
      )
        env[key] = "";
  }
  for (const key of Object.keys(env))
    if (/^(GOOGLE_|VITE_GOOGLE_|GMAIL_|SUPABASE_|RESEND_)/.test(key))
      env[key] = "";
  const url = new URL(env.EVALUATION_DATABASE_URL || "");
  if (
    url.pathname !== "/advisio_evaluation" ||
    url.searchParams.get("application_name") !== "advisio-evaluation" ||
    env.DATABASE_URL !== env.EVALUATION_DATABASE_URL ||
    env.DIRECT_URL !== env.EVALUATION_DATABASE_URL ||
    env.ADVISIO_EVALUATION !== "1"
  )
    throw new Error(
      "The evaluation environment must use only its dedicated database.",
    );
  return env;
}
async function prepare(env) {
  await fs.mkdir(dataRoot, { recursive: true });
  await run(
    process.execPath,
    [
      path.join(root, "node_modules/prisma/build/index.js"),
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      path.join(root, "packages/database/prisma/schema.prisma"),
      "--script",
      "--output",
      path.join(dataRoot, "schema.sql"),
    ],
    env,
  );
  await run(
    process.execPath,
    [
      path.join(root, "node_modules/typescript/bin/tsc"),
      "-p",
      "packages/database/tsconfig.json",
    ],
    env,
  );
  await run(
    process.execPath,
    [
      process.env.npm_execpath,
      "--workspace=@research-management/email",
      "run",
      "build",
    ],
    env,
  );
}
async function initLocal() {
  await fs.mkdir(dataRoot, { recursive: true });
  try {
    await fs.access(envFile);
  } catch {
    const password = randomBytes(32).toString("hex");
    const jwt = randomBytes(48).toString("hex");
    const url = `postgresql://advisio_eval:${password}@127.0.0.1:5436/advisio_evaluation?schema=public&application_name=advisio-evaluation`;
    await fs.writeFile(
      envFile,
      `ADVISIO_EVALUATION=1\nNODE_ENV=development\nEVALUATION_DATABASE_URL=${url}\nDATABASE_URL=${url}\nDIRECT_URL=${url}\nJWT_SECRET=${jwt}\nSTORAGE_PROVIDER=LOCAL\nEMAIL_PROVIDER=disabled\nNOTIFICATION_EMAILS_ENABLED=false\nDEADLINE_EMAILS_ENABLED=false\nEVALUATION_WEB_URL=http://localhost:3100\nWEB_URL=http://localhost:3100\nCORS_ORIGIN=http://localhost:3100\nPORT=5100\nEVALUATION_MAX_ACTIVE=20\n`,
      { flag: "wx", mode: 0o600 },
    );
  }
  const env = await environment();
  const url = new URL(env.EVALUATION_DATABASE_URL);
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "5436" ||
    url.username !== "advisio_eval"
  )
    throw new Error(
      "Local initialization is restricted to its own 127.0.0.1:5436 evaluation cluster.",
    );
  const bin =
    process.env.EVALUATION_PG_BIN ||
    (process.platform === "win32"
      ? "C:/Program Files/PostgreSQL/18/bin"
      : "/usr/lib/postgresql/18/bin");
  const executable = (name) =>
    path.join(bin, `${name}${process.platform === "win32" ? ".exe" : ""}`);
  const cluster = path.join(dataRoot, "postgres");
  const pwfile = path.join(dataRoot, "init-password");
  const pgEnv = {
    ...env,
    PGHOST: "127.0.0.1",
    PGPORT: "5436",
    PGUSER: "advisio_eval",
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: "postgres",
  };
  try {
    await fs.access(path.join(cluster, "PG_VERSION"));
  } catch {
    await fs.writeFile(pwfile, decodeURIComponent(url.password), {
      mode: 0o600,
      flag: "wx",
    });
    try {
      await run(
        executable("initdb"),
        [
          "-D",
          cluster,
          "-U",
          "advisio_eval",
          `--pwfile=${pwfile}`,
          "--auth-host=scram-sha-256",
          "--auth-local=scram-sha-256",
          "--encoding=UTF8",
          "--locale=C",
        ],
        pgEnv,
      );
    } finally {
      await fs.rm(pwfile, { force: true });
    }
    await fs.appendFile(
      path.join(cluster, "postgresql.conf"),
      "\nlisten_addresses = '127.0.0.1'\nport = 5436\nmax_connections = 100\nshared_buffers = '64MB'\n",
    );
  }
  let running = false;
  const check = new pg.Client({
    host: "127.0.0.1",
    port: 5436,
    user: "advisio_eval",
    password: decodeURIComponent(url.password),
    database: "postgres",
  });
  try {
    await check.connect();
    running = true;
  } catch {
  } finally {
    await check.end();
  }
  if (!running)
    await run(
      executable("pg_ctl"),
      ["-D", cluster, "-l", path.join(dataRoot, "postgres.log"), "-w", "start"],
      pgEnv,
    );
  const client = new pg.Client({
    host: "127.0.0.1",
    port: 5436,
    user: "advisio_eval",
    password: decodeURIComponent(url.password),
    database: "postgres",
  });
  await client.connect();
  try {
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname='advisio_evaluation'",
    );
    if (!result.rowCount)
      await client.query("CREATE DATABASE advisio_evaluation");
  } finally {
    await client.end();
  }
  await prepare(env);
  console.log(
    "Local evaluation database prepared on port 5436. Start with npm run evaluation:dev.",
  );
}
const command = process.argv[2];
try {
  if (command === "init-local") await initLocal();
  else {
    const env = await environment();
    if (command === "prepare") await prepare(env);
    else if (command === "dev") {
      await prepare(env);
      const children = [];
      let stopping = false;
      const stop = () => {
        if (stopping) return;
        stopping = true;
        for (const child of children) child.kill();
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
      await Promise.all(
        [
          ["--workspace=api", "run", "dev"],
          [
            "--workspace=web",
            "run",
            "dev",
            "--",
            "--port",
            "3100",
            "--host",
            "127.0.0.1",
            "--strictPort",
          ],
        ].map(
          (args) =>
            new Promise((resolve, reject) => {
              const child = spawn(
                process.execPath,
                [process.env.npm_execpath, ...args],
                { cwd: root, env, stdio: "inherit", windowsHide: true },
              );
              children.push(child);
              child.on("error", (e) => {
                stop();
                reject(e);
              });
              child.on("exit", (code) => {
                stop();
                code === 0
                  ? resolve()
                  : reject(new Error("Evaluation server stopped."));
              });
            }),
        ),
      );
    } else throw new Error("Use evaluation.mjs init-local, prepare, or dev.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
