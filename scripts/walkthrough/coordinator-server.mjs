// Loopback-only recording fixture. Native app authentication and permissions remain in force.
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { root, writeJson, readJson } from "./common.mjs";

const directory = path.join(root, ".walkthrough/coordinator");
await fs.mkdir(directory, { recursive: true });
const config = dotenv.parse(await fs.readFile(path.join(root, ".env.evaluation.local")));
const registryUrl = new URL(config.EVALUATION_DATABASE_URL);
if (registryUrl.hostname !== "127.0.0.1" || registryUrl.port !== "5436" || registryUrl.pathname !== "/advisio_evaluation" || registryUrl.searchParams.get("application_name") !== "advisio-evaluation") throw new Error("Recording requires the dedicated local demo cluster.");
const manifestFile = path.join(directory, "demo.json");
let demo = await readJson(manifestFile).catch(() => null);
if (process.argv.includes("--fresh")) demo = null; // A new schema; never deletes an existing fixture.
const schema = demo?.schema || `walkthrough_coordinator_${randomBytes(8).toString("hex")}`;
if (!/^walkthrough_coordinator_[a-f0-9]{16}$/.test(schema)) throw new Error("Invalid recording schema.");
registryUrl.searchParams.set("schema", schema);
const databaseUrl = registryUrl.toString();
// Populate empty values before imports so dotenv cannot load real service credentials.
for (const file of [".env", "apps/api/.env", "packages/database/.env"])
  for (const name of Object.keys(dotenv.parse(await fs.readFile(path.join(root, file)).catch(() => "")))) process.env[name] = "";
for (const name of Object.keys(process.env)) if (/^(GOOGLE_|VITE_GOOGLE_|GMAIL_|SUPABASE_|RESEND_|SMTP_|ALLOW_DEMO_|ALLOW_THEME_DEMO_)/.test(name)) process.env[name] = "";
Object.assign(process.env, {
  NODE_ENV: "development", ADVISIO_EVALUATION: "0", ADVISIO_LOCAL_DEMO: "0",
  DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl, JWT_SECRET: demo?.jwt || randomBytes(48).toString("hex"),
  STORAGE_PROVIDER: "LOCAL", EMAIL_PROVIDER: "disabled", NOTIFICATION_EMAILS_ENABLED: "false", DEADLINE_EMAILS_ENABLED: "false",
  WEB_URL: "http://localhost:3300", CORS_ORIGIN: "http://localhost:3300", PORT: "5300",
  VITE_API_URL: "", VITE_API_PROXY: "http://127.0.0.1:5300", VITE_GOOGLE_SIGN_IN_CLIENT_ID: "",
});
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
if (!demo) {
  const pool = new pg.Pool({ connectionString: config.EVALUATION_DATABASE_URL });
  const sql = (await fs.readFile(path.join(root, ".evaluation/schema.sql"), "utf8")).replace(/CREATE SCHEMA IF NOT EXISTS "public";/g, "").replace(/CREATE EXTENSION IF NOT EXISTS "[a-z]+";/g, "");
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query(`CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}", public`);
    await connection.query(sql); await connection.query("COMMIT");
  } catch (error) { await connection.query("ROLLBACK"); throw error; }
  finally { connection.release(); await pool.end(); }
  const { seedCoordinator } = await import("./seed-coordinator.mjs");
  const storageRoot = path.join(root, "uploads/local", schema);
  const fixture = await seedCoordinator(db, storageRoot);
  demo = { ...fixture, schema, jwt: process.env.JWT_SECRET, url: "http://localhost:3300", createdAt: new Date().toISOString() };
  await writeJson(manifestFile, demo);
  console.log("Prepared isolated coordinator scenarios.");
}
await db.$disconnect();
if (process.argv.includes("--prepare-only")) process.exit(0);
const { default: app } = await import("../../apps/api/src/app.ts");
const server = app.listen(5300, "127.0.0.1", () => console.log("Coordinator recording API: http://127.0.0.1:5300"));
const vite = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "3300", "--strictPort", "--open", "false"], { cwd: path.join(root, "apps/web"), env: process.env, windowsHide: true, stdio: "inherit" });
const stop = () => { vite.kill(); server.close(() => process.exit()); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
