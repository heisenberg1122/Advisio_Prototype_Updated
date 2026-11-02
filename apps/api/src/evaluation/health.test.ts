import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

vi.mock("../lib/prisma.js", () => ({ createClient: vi.fn() }));
import { EvaluationRuntime } from "./runtime.js";

let runtime: EvaluationRuntime | undefined;
let directory: string | undefined;
afterEach(async () => {
  await runtime?.close();
  if (directory) await fs.rm(directory, { recursive: true, force: true });
  runtime = undefined;
  directory = undefined;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function prepare() {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "advisio-health-"));
  const url =
    "postgresql://test:test@127.0.0.1:5436/advisio_evaluation?schema=public&application_name=advisio-evaluation";
  for (const [key, value] of Object.entries({
    EVALUATION_DATABASE_URL: url,
    DATABASE_URL: url,
    DIRECT_URL: url,
    STORAGE_PROVIDER: "LOCAL",
    EMAIL_PROVIDER: "disabled",
    NOTIFICATION_EMAILS_ENABLED: "false",
    JWT_SECRET: "x".repeat(48),
    EVALUATION_WEB_URL: "https://evaluation.example.org",
    EVALUATION_DATA_DIR: directory,
  }))
    vi.stubEnv(key, value);
  // Other API suites provide fake integration settings in their shared setup.
  // This fixture must have exactly the environment allowed by evaluation mode.
  for (const key of Object.keys(process.env))
    if (/^(GOOGLE_|VITE_GOOGLE_|GMAIL_|SUPABASE_|RESEND_API_KEY$)/.test(key))
      vi.stubEnv(key, undefined);
  vi.stubEnv("ADVISIO_LOCAL_DEMO", "0");
  vi.stubEnv("ALLOW_DEMO_ACCOUNT_PROVISIONING", "false");
  vi.stubEnv("ALLOW_THEME_DEMO_ACCOUNTS", "false");
  runtime = new EvaluationRuntime();
  return runtime;
}
describe("evaluation liveness during workspace provisioning", () => {
  it("does not wait for a saturated workspace registry pool", async () => {
    const service = await prepare();
    const blocked = vi
      .spyOn(service.pool, "query")
      .mockImplementation(() => new Promise(() => {}) as any);
    const healthQuery = vi
      .spyOn(service.healthPool, "query")
      .mockResolvedValue({ rows: [{ value: 1 }] } as never);
    await expect(service.health()).resolves.toBeUndefined();
    expect(blocked).not.toHaveBeenCalled();
    expect(healthQuery).toHaveBeenCalledWith("SELECT 1");
  }, 1000);
  it("still fails when the database health query fails", async () => {
    const service = await prepare();
    vi.spyOn(service.healthPool, "query").mockRejectedValue(
      new Error("database unavailable") as never,
    );
    await expect(service.health()).rejects.toThrow("database unavailable");
  });
});
