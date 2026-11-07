import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

vi.mock("../lib/prisma.js", () => ({ createClient: vi.fn() }));
vi.mock("./seed.js", () => ({ seedWorkspace: vi.fn() }));
vi.mock("@research-management/database", () => ({
  seedReferenceData: vi.fn(),
}));
vi.mock("./fresh-accounts.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./fresh-accounts.js")>()),
  seedFreshAccounts: vi.fn(),
}));
import { EvaluationRuntime, tokenHash, type Session } from "./runtime.js";
import { createClient } from "../lib/prisma.js";
import { seedWorkspace, type WorkspaceAccounts } from "./seed.js";
import {
  freshWorkspaceId,
  seedFreshAccounts,
  workspaceDatasetIds,
} from "./fresh-accounts.js";
import { EVALUATION_ROLES, type EvaluationRole } from "./catalog.js";
import { schemaName } from "./config.js";

const id = "a".repeat(32);
let service: EvaluationRuntime | undefined, directory: string | undefined;
afterEach(async () => {
  await service?.close();
  if (directory) await fs.rm(directory, { recursive: true, force: true });
  service = undefined;
  directory = undefined;
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
async function prepare() {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "advisio-fresh-test-"));
  const url =
    "postgresql://test:test@127.0.0.1:5436/advisio_evaluation?schema=public&application_name=advisio-evaluation";
  for (const [key, value] of Object.entries({
    DATABASE_URL: url,
    DIRECT_URL: url,
    EVALUATION_DATABASE_URL: url,
    STORAGE_PROVIDER: "LOCAL",
    EMAIL_PROVIDER: "disabled",
    NOTIFICATION_EMAILS_ENABLED: "false",
    JWT_SECRET: "x".repeat(48),
    EVALUATION_WEB_URL: "https://evaluation.example.org",
    EVALUATION_DATA_DIR: directory,
    ADVISIO_LOCAL_DEMO: "0",
    ALLOW_DEMO_ACCOUNT_PROVISIONING: "false",
    ALLOW_THEME_DEMO_ACCOUNTS: "false",
  }))
    vi.stubEnv(key, value);
  for (const key of Object.keys(process.env))
    if (/^(GOOGLE_|VITE_GOOGLE_|GMAIL_|SUPABASE_|RESEND_API_KEY$)/.test(key))
      vi.stubEnv(key, undefined);
  service = new EvaluationRuntime();
  return service;
}
function accounts(): WorkspaceAccounts {
  return Object.fromEntries(
    EVALUATION_ROLES.map((role) => [
      role.id,
      {
        userId: role.id,
        projectId: "project-" + role.id,
        title: "Existing sample",
        defenseId: null,
        projectIds: ["project-" + role.id],
        scenarios: [
          {
            id: "original",
            label: "Original sample",
            userId: role.id,
            projectId: "project-" + role.id,
            title: "Existing sample",
            defenseId: null,
            projectIds: ["project-" + role.id],
            home: role.home,
          },
          {
            id: "fresh-account",
            label: "Fresh account",
            userId: "fresh-" + role.id,
            projectId: null,
            title: "Fresh account",
            defenseId: null,
            home: role.home,
          },
        ],
      },
    ]),
  ) as WorkspaceAccounts;
}
function session(role: EvaluationRole = "student", fresh = false): Session {
  return {
    id,
    role,
    course: "BSIT",
    state: "ACTIVE",
    token_hash: "old-token",
    created_at: new Date(),
    touched_at: new Date(),
    user_id: fresh ? "fresh-" + role : role,
    project_id: fresh ? null : "project-" + role,
    defense_id: null,
    scenario: fresh ? "fresh-account" : "original",
    accounts: accounts(),
  };
}

describe("fresh-account switching", () => {
  it("describes empty accounts with accurate activities and no prepared artifacts for all five roles", async () => {
    const runtime = await prepare();
    for (const role of EVALUATION_ROLES) {
      const description = runtime.describe(session(role.id, true));
      expect(description).toMatchObject({
        role: role.id,
        scenario: "fresh-account",
        scenarioLabel: "Fresh account",
        projectId: null,
        title: "Fresh account",
        home: role.home,
        revisionAvailable: false,
        requestLetterAvailable: false,
      });
      expect(description.defenseId).toBeFalsy();
      expect(description.signingPassword).toBeUndefined();
      expect(description.tasks).toHaveLength(6);
      expect(description.progressKey).toBe(`${id}:${role.id}:fresh-account`);
      expect(description.scenarios.map((item) => item.id)).toEqual([
        "original",
        "fresh-account",
      ]);
    }
    expect(runtime.describe(session("dean")).signingPassword).toBeTruthy();
    expect(runtime.describe(session("professor")).requestLetterAvailable).toBe(
      true,
    );
  });

  it("preserves fresh mode across role changes, rotates tokens, and returns to the original scenario without overwriting it", async () => {
    const runtime = await prepare();
    let current = session("student", true);
    const query = vi.spyOn(runtime.pool, "query").mockImplementation((async (
      sql: string,
      values: any[],
    ) => {
      if (
        sql.startsWith("UPDATE public.advisio_evaluation_sessions SET role=")
      ) {
        current = {
          ...current,
          role: values[1],
          user_id: values[2],
          project_id: values[3],
          defense_id: values[4],
          token_hash: values[5],
          scenario: values[7],
        };
        return { rows: [current] };
      }
      return { rows: [] };
    }) as any);
    const before = JSON.stringify(current.accounts);
    for (const role of EVALUATION_ROLES) {
      current = await runtime.switchRole(current, role.id, "token-" + role.id);
      expect(current).toMatchObject({
        role: role.id,
        user_id: "fresh-" + role.id,
        project_id: null,
        scenario: "fresh-account",
        token_hash: tokenHash("token-" + role.id),
      });
    }
    current = await runtime.switchScenario(current, "original", "sample-token");
    expect(current).toMatchObject({
      user_id: "dean",
      project_id: "project-dean",
      scenario: "original",
    });
    current = await runtime.switchScenario(
      current,
      "fresh-account",
      "fresh-token",
    );
    expect(current).toMatchObject({
      user_id: "fresh-dean",
      project_id: null,
      scenario: "fresh-account",
    });
    expect(JSON.stringify(current.accounts)).toBe(before);
    const calls = query.mock.calls.length;
    await expect(
      runtime.switchScenario(current, "unavailable", "bad"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(query.mock.calls).toHaveLength(calls);
  });

  it("never reuses a normal dataset connection for a simultaneous fresh request", async () => {
    const runtime = await prepare();
    let current = session();
    vi.spyOn(runtime.pool, "query").mockImplementation((async () => ({
      rows: [current],
    })) as any);
    const instances: any[] = [];
    vi.mocked(createClient).mockImplementation(() => {
      const client = { $disconnect: vi.fn(async () => undefined) };
      instances.push(client);
      return client as any;
    });
    const original = await runtime.acquire(current);
    current = session("student", true);
    const fresh = await runtime.acquire(current);
    expect(original.scope.prisma).not.toBe(fresh.scope.prisma);
    expect(original.scope.projectIds).toEqual(["project-student"]);
    expect(fresh.scope.projectIds).toBeUndefined();
    expect(
      new URL(vi.mocked(createClient).mock.calls[0][0]!).searchParams.get(
        "schema",
      ),
    ).toBe(schemaName(id));
    expect(
      new URL(vi.mocked(createClient).mock.calls[1][0]!).searchParams.get(
        "schema",
      ),
    ).toBe(schemaName(freshWorkspaceId(id)));
    await original.release();
    const stillFresh = await runtime.acquire(current);
    expect(stillFresh.scope.prisma).toBe(fresh.scope.prisma);
    expect(createClient).toHaveBeenCalledTimes(2);
    await fresh.release();
    await stillFresh.release();
    expect(
      instances.every((client) => client.$disconnect.mock.calls.length === 1),
    ).toBe(true);
  });

  it("keeps older sessions usable without adding unseeded fresh identities", async () => {
    const runtime = await prepare(),
      old = session();
    for (const account of Object.values(old.accounts!))
      account.scenarios = account.scenarios!.slice(0, 1);
    const query = vi.spyOn(runtime.pool, "query");
    expect(runtime.describe(old).scenarios).toHaveLength(1);
    await expect(
      runtime.switchScenario(old, "fresh-account", "new-token"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("private dataset lifecycle", () => {
  it("rolls back both-schema provisioning and never seeds after a schema failure", async () => {
    const runtime = await prepare();
    const provision = vi.fn(async (sql: string) => {
      if (sql.startsWith(`CREATE SCHEMA "${schemaName(freshWorkspaceId(id))}"`))
        throw new Error("fresh schema failed");
      return {};
    });
    const release = vi.fn();
    vi.spyOn(runtime.pool, "connect").mockResolvedValue({
      query: provision,
      release,
    } as never);
    const query = vi
      .spyOn(runtime.pool, "query")
      .mockResolvedValue({ rows: [] } as never);
    (runtime as any).ddl = "-- isolated test schema";
    await expect(
      (runtime as any).buildWorkspace(id, "student", "BSIT", false),
    ).rejects.toThrow("fresh schema failed");
    expect(provision.mock.calls.map(([sql]) => sql)).toContain("ROLLBACK");
    expect(provision.mock.calls.map(([sql]) => sql)).not.toContain("COMMIT");
    expect(release).toHaveBeenCalledOnce();
    expect(seedWorkspace).not.toHaveBeenCalled();
    expect(seedFreshAccounts).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(
      query.mock.calls
        .filter(([sql]) => String(sql).startsWith("DROP SCHEMA"))
        .map(([sql]) => sql),
    ).toEqual(
      workspaceDatasetIds(id).map(
        (key) => `DROP SCHEMA IF EXISTS "${schemaName(key)}" CASCADE`,
      ),
    );
  });

  it("provisions both schemas transactionally, keeps default scenarios, and attaches all fresh identities", async () => {
    const runtime = await prepare();
    const all = accounts();
    const fresh = Object.fromEntries(
      EVALUATION_ROLES.map((role) => [role.id, all[role.id].scenarios!.pop()!]),
    );
    vi.mocked(seedWorkspace).mockResolvedValue({
      ...all.student,
      accounts: all,
      revisionPath: "sample.pdf",
    });
    vi.mocked(seedFreshAccounts).mockResolvedValue(fresh as any);
    const disconnect = vi.fn(async () => undefined);
    vi.mocked(createClient).mockImplementation(
      () => ({ $disconnect: disconnect }) as any,
    );
    const provision = vi.fn(async (_sql: string) => ({}));
    vi.spyOn(runtime.pool, "connect").mockResolvedValue({
      query: provision,
      release: vi.fn(),
    } as never);
    const update = vi
      .spyOn(runtime.pool, "query")
      .mockResolvedValue({ rows: [session()] } as never);
    (runtime as any).ddl = "-- isolated test schema";
    await (runtime as any).buildWorkspace(id, "student", "BSIT", false);
    expect(provision.mock.calls.map((args) => args[0])).toEqual([
      "BEGIN",
      `CREATE SCHEMA "${schemaName(id)}"; SET LOCAL search_path TO "${schemaName(id)}", public;`,
      "-- isolated test schema",
      `CREATE SCHEMA "${schemaName(freshWorkspaceId(id))}"; SET LOCAL search_path TO "${schemaName(freshWorkspaceId(id))}", public;`,
      "-- isolated test schema",
      "COMMIT",
    ]);
    expect(seedWorkspace).toHaveBeenCalledOnce();
    expect(seedFreshAccounts).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledTimes(2);
    const values = update.mock.calls[0][1] as any[];
    const stored = JSON.parse(values[4]);
    expect(values[1]).toBe("student");
    expect(values[2]).toBe("project-student");
    expect(values[5]).toBe("original");
    for (const role of EVALUATION_ROLES) {
      expect(stored[role.id].scenarios.map((item: any) => item.id)).toEqual([
        "original",
        "fresh-account",
      ]);
      expect(stored[role.id].scenarios[1].projectId).toBeNull();
    }
  });

  it("does not clean either dataset while a fresh request still uses it", async () => {
    const runtime = await prepare(),
      current = session("student", true);
    const query = vi.spyOn(runtime.pool, "query").mockImplementation((async (
      sql: string,
    ) => ({
      rows: sql.startsWith("SELECT *") ? [current] : [],
    })) as any);
    vi.mocked(createClient).mockReturnValue({
      $disconnect: vi.fn(async () => undefined),
    } as any);
    const active = await runtime.acquire(current);
    await runtime.end(current);
    expect(
      query.mock.calls.some(([sql]) => String(sql).startsWith("DROP SCHEMA")),
    ).toBe(false);
    await active.release();
    await runtime.cleanup();
    expect(
      query.mock.calls
        .filter(([sql]) => String(sql).startsWith("DROP SCHEMA"))
        .map(([sql]) => sql),
    ).toEqual(
      workspaceDatasetIds(id).map(
        (key) => `DROP SCHEMA IF EXISTS "${schemaName(key)}" CASCADE`,
      ),
    );
  });
});
