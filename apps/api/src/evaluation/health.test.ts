import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

vi.mock("../lib/prisma.js", () => ({ createClient: vi.fn() }));
import { EvaluationRuntime } from "./runtime.js";
import type { Session } from "./runtime.js";
import { createClient } from "../lib/prisma.js";
import { workspaceDatasetIds } from "./fresh-accounts.js";
import { schemaName } from "./config.js";

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

describe("concurrent expired workspace cleanup", () => {
  it("removes the same expired files and schema once while new sessions arrive together", async () => {
    const service = await prepare();
    const id = "a".repeat(32);
    await fs.mkdir(service.storageRoot(id), { recursive: true });
    await fs.writeFile(
      path.join(service.storageRoot(id), "manuscript.pdf"),
      "fictional test document",
    );
    const expired = { id, state: "EXPIRED" };
    const query = vi.spyOn(service.pool, "query").mockImplementation((async (
      sql: string,
    ) => {
      if (
        sql.startsWith("UPDATE public.advisio_evaluation_sessions SET state=")
      )
        return { rows: [expired] };
      if (sql.startsWith("SELECT *")) return { rows: [] };
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { rows: [] };
    }) as any);
    await Promise.all(Array.from({ length: 20 }, () => service.cleanup()));
    expect(
      query.mock.calls
        .filter(([sql]) => String(sql).startsWith("DROP SCHEMA"))
        .map(([sql]) => sql),
    ).toEqual(
      workspaceDatasetIds(id).map(
        (key) => `DROP SCHEMA IF EXISTS "${schemaName(key)}" CASCADE`,
      ),
    );
    expect(
      query.mock.calls.filter(([sql]) =>
        String(sql).startsWith(
          "UPDATE public.advisio_evaluation_sessions SET cleaned_at",
        ),
      ),
    ).toHaveLength(1);
    await expect(fs.access(service.storageRoot(id))).rejects.toThrow();
  });
});

describe("bounded workspace connections", () => {
  function session(index: number): Session {
    return {
      id: index.toString(16).padStart(32, "0"),
      token_hash: index.toString(16).padStart(64, "0"),
      role: "student",
      course: "BSIT",
      user_id: `user-${index}`,
      project_id: `project-${index}`,
      defense_id: "",
      scenario: null,
      state: "ACTIVE",
      created_at: new Date(),
      touched_at: new Date(),
    };
  }

  it("disconnects workspace clients before admitting more database work", async () => {
    const service = await prepare();
    const sessions = Array.from({ length: 30 }, (_, index) =>
      session(index + 1),
    );
    vi.spyOn(service.pool, "query").mockImplementation((async (
      _sql: string,
      values: string[],
    ) => ({
      rows: [sessions.find(({ id }) => id === values[0])],
    })) as any);
    let open = 0;
    let peak = 0;
    vi.mocked(createClient).mockImplementation(() => {
      open++;
      peak = Math.max(peak, open);
      return {
        $disconnect: vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 2));
          open--;
        }),
      } as any;
    });
    await Promise.all(
      sessions.map(async (current) => {
        const acquired = await service.acquire(current);
        expect(acquired.scope.id).toBe(current.id);
        await new Promise((resolve) => setTimeout(resolve, 1));
        await acquired.release();
        await acquired.release();
      }),
    );
    expect(peak).toBe(3);
    expect(open).toBe(0);
  });

  it("keeps stream revocation registered after releasing its database connection", async () => {
    const service = await prepare();
    const current = session(1);
    vi.spyOn(service.pool, "query").mockImplementation((async (
      sql: string,
    ) => ({
      rows: sql.startsWith("SELECT *") ? [current] : [],
    })) as any);
    const disconnect = vi.fn(async () => undefined);
    vi.mocked(createClient).mockReturnValue({ $disconnect: disconnect } as any);
    const revoked = vi.fn();
    const acquired = await service.acquire(current, revoked);
    await acquired.releaseDatabase();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(revoked).not.toHaveBeenCalled();
    await service.end(current);
    expect(revoked).toHaveBeenCalledOnce();
    await acquired.release();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("rejects an identity changed while its request was queued", async () => {
    const service = await prepare();
    const current = session(1);
    vi.spyOn(service.pool, "query").mockResolvedValue({
      rows: [{ ...current, user_id: "changed" }],
    } as never);
    await expect(service.acquire(current)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("keeps a later request revocable when the previous response closes twice", async () => {
    const service = await prepare();
    const current = session(1);
    vi.spyOn(service.pool, "query").mockImplementation((async (
      sql: string,
    ) => ({
      rows: sql.startsWith("SELECT *") ? [current] : [],
    })) as any);
    vi.mocked(createClient).mockImplementation(
      () => ({ $disconnect: vi.fn(async () => undefined) }) as any,
    );
    const first = await service.acquire(current);
    await first.release();
    const revoked = vi.fn();
    const next = await service.acquire(current, revoked);
    await first.release();
    await service.end(current);
    expect(revoked).toHaveBeenCalledOnce();
    await next.release();
  });
});
