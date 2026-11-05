import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import type { PrismaClient } from "@prisma/client";
import { createClient } from "../lib/prisma.js";
import { evaluationConfig, isLive, schemaName } from "./config.js";
import {
  evaluationDatabaseErrorCode,
  retryEvaluationDatabase,
} from "./database-retry.js";
import {
  EVALUATION_COURSES,
  EVALUATION_ROLES,
  ROLE_TASKS,
  type EvaluationRole,
} from "./catalog.js";
import {
  seedWorkspace,
  type WorkspaceAccounts,
  type WorkspaceScenario,
} from "./seed.js";
import { DEMO_SIGNING_PASSWORD, scenarioTasks } from "./scenarios.js";
import { evaluationSurveyUrl } from "./survey.js";
import { EvaluationRequestSlots } from "./request-slots.js";

export const COOKIE = "advisio_evaluation";
export const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type Session = {
  id: string;
  token_hash: string | null;
  role: EvaluationRole;
  course: string;
  user_id: string;
  project_id: string;
  defense_id: string;
  created_at: Date;
  touched_at: Date;
  state: string;
  accounts?: WorkspaceAccounts | null;
  scenario?: string | null;
};
type OpenClient = { prisma: PrismaClient; users: number; ended: boolean };
type CapacityRow = { course: string; state: string; count: number };

export class EvaluationRuntime {
  readonly config = evaluationConfig();
  readonly pool = new Pool({
    connectionString: this.config.databaseUrl,
    max: 4,
    connectionTimeoutMillis: 5000,
  });
  // Provisioning can occupy every registry connection with schema DDL. The
  // provider's liveness probe must still check the DB within its five-second
  // deadline instead of waiting behind workspace setup queries.
  readonly healthPool = new Pool({
    connectionString: this.config.databaseUrl,
    max: 1,
    connectionTimeoutMillis: 2500,
    query_timeout: 3000,
    idleTimeoutMillis: 10_000,
  });
  private clients = new Map<string, OpenClient>();
  private removals = new Map<string, Promise<void>>();
  private revokers = new Map<string, Set<() => void>>();
  private ddl = "";
  private timer?: NodeJS.Timeout;
  private maintenance?: Promise<void>;
  private closing = false;
  private readonly warmOwner = randomBytes(16).toString("hex");
  private readonly requestSlots = new EvaluationRequestSlots();
  // Admissions already serialize on a PostgreSQL lock. Queue prepared joins
  // before checkout so waiting joins leave registry connections available.
  private readonly preparedAdmissions = new EvaluationRequestSlots(1, 30_000);

  constructor() {
    for (const pool of [this.pool, this.healthPool]) {
      pool.on("error", (error) => {
        console.warn(
          "Evaluation database dropped an idle connection:",
          evaluationDatabaseErrorCode(error),
        );
      });
    }
  }
  async health() {
    await this.healthPool.query("SELECT 1");
    await fs.access(this.config.root);
  }

  async init() {
    const sql = await fs.readFile(this.config.schemaFile, "utf8");
    if (
      !sql.includes('CREATE TABLE "users"') ||
      !sql.includes('CREATE TYPE "InstitutionalRole"')
    )
      throw new Error(
        "Run npm run evaluation:prepare before starting the evaluation API.",
      );
    // The generated baseline has no function bodies; extensions live once in public.
    this.ddl = sql
      .replace(/CREATE SCHEMA IF NOT EXISTS "public";/g, "")
      .replace(/CREATE EXTENSION IF NOT EXISTS "[a-z]+";/g, "");
    await retryEvaluationDatabase(() => this.initializeRegistry());
    this.timer = setInterval(() => this.scheduleMaintenance(), 60_000);
    this.timer.unref();
    if (this.config.prewarm.size) this.scheduleMaintenance();
  }

  private async initializeRegistry() {
    const {
      rows: [identity],
    } = await this.pool.query("SELECT current_database() AS name");
    if (identity.name !== "advisio_evaluation")
      throw new Error("Refusing to initialize a non-evaluation database.");
    await this.pool
      .query(`CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE TABLE IF NOT EXISTS public.advisio_evaluation_sessions (
      id varchar(32) PRIMARY KEY, token_hash varchar(64) UNIQUE, role varchar(20) NOT NULL,
      course varchar(20) NOT NULL, user_id uuid, project_id uuid, defense_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(), touched_at timestamptz NOT NULL DEFAULT now(),
      state varchar(20) NOT NULL DEFAULT 'PROVISIONING', cleaned_at timestamptz);
      ALTER TABLE public.advisio_evaluation_sessions ADD COLUMN IF NOT EXISTS cleaned_at timestamptz;`);
    await this.pool.query(
      "ALTER TABLE public.advisio_evaluation_sessions ADD COLUMN IF NOT EXISTS accounts jsonb",
    );
    await this.pool.query(
      "ALTER TABLE public.advisio_evaluation_sessions ADD COLUMN IF NOT EXISTS scenario varchar(40)",
    );
    await this.pool.query(
      "ALTER TABLE public.advisio_evaluation_sessions ADD COLUMN IF NOT EXISTS warm_owner varchar(32)",
    );
    // Ephemeral hosting loses files on restart. Revoke claimed and unclaimed workspaces.
    if (this.config.ephemeralStorage)
      await this.pool.query(
        "UPDATE public.advisio_evaluation_sessions SET state='EXPIRED',token_hash=NULL WHERE state IN ('ACTIVE','PROVISIONING','READY','WARMING')",
      );
    await this.cleanup();
  }

  private scheduleMaintenance() {
    if (this.closing || this.maintenance) return;
    this.maintenance = this.maintainWorkspaces()
      .catch((error: unknown) => {
        console.warn(
          "Evaluation workspace maintenance will retry:",
          evaluationDatabaseErrorCode(error),
        );
      })
      .finally(() => {
        this.maintenance = undefined;
      });
  }

  private async readCapacity() {
    const { rows } = await this.pool.query<CapacityRow>(
      `SELECT course, CASE WHEN state IN ('READY','WARMING') AND warm_owner IS DISTINCT FROM $1
        THEN 'UNAVAILABLE' ELSE state END AS state, count(*)::int AS count
       FROM public.advisio_evaluation_sessions WHERE cleaned_at IS NULL GROUP BY 1, 2`,
      [this.warmOwner],
    );
    return rows;
  }

  async capacity() {
    if (!this.config.prewarm.size) return { enabled: false };
    const rows = await this.readCapacity();
    return {
      enabled: true,
      maxActive: this.config.maxActive,
      active: rows
        .filter(({ state }) => state === "ACTIVE")
        .reduce((total, { count }) => total + count, 0),
      courses: [...this.config.prewarm].map(([course, target]) => ({
        course,
        target,
        ready:
          rows.find((row) => row.course === course && row.state === "READY")
            ?.count || 0,
      })),
    };
  }

  private async maintainWorkspaces() {
    await this.cleanup();
    if (!this.config.prewarm.size) return;
    while (!this.closing) {
      const rows = await this.readCapacity();
      if (
        rows.reduce((total, { count }) => total + count, 0) >=
        this.config.maxActive
      )
        return;
      const next = [...this.config.prewarm].find(
        ([course, target]) =>
          rows
            .filter(
              (row) =>
                row.course === course &&
                ["READY", "WARMING", "ACTIVE", "PROVISIONING"].includes(
                  row.state,
                ),
            )
            .reduce((total, { count }) => total + count, 0) < target,
      );
      if (!next || this.closing) return;
      const id = randomBytes(16).toString("hex");
      await this.pool.query(
        "INSERT INTO public.advisio_evaluation_sessions (id,role,course,state,warm_owner) VALUES ($1,'student',$2,'WARMING',$3)",
        [id, next[0], this.warmOwner],
      );
      await this.buildWorkspace(id, "student", next[0], true);
    }
  }
  storageRoot(id: string) {
    schemaName(id);
    return path.join(this.config.root, "workspaces", id);
  }
  async find(token: unknown): Promise<Session | null> {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
    const { rows } = await this.pool.query<Session>(
      "SELECT * FROM public.advisio_evaluation_sessions WHERE token_hash=$1",
      [tokenHash(token)],
    );
    const session = rows[0];
    if (
      !session ||
      !isLive(session, Date.now(), this.config.idleMs, this.config.lifetimeMs)
    )
      return null;
    const { rowCount } = await this.pool.query(
      "UPDATE public.advisio_evaluation_sessions SET touched_at=now() WHERE id=$1 AND state='ACTIVE' AND touched_at > now()-interval '20 minutes' AND created_at > now()-interval '60 minutes'",
      [session.id],
    );
    return rowCount ? session : null;
  }
  async begin(
    token: string,
    role: EvaluationRole,
    courseId: string,
    signal?: AbortSignal,
  ) {
    if (!this.config.prewarm.size) {
      await this.cleanup();
      return this.startWorkspace(token, role, courseId);
    }
    const release = await this.preparedAdmissions.acquire(signal);
    try {
      // A committed claim can be recovered by the same token if the commit
      // acknowledgement is lost. On-demand provisioning isn't replayed here.
      return await retryEvaluationDatabase(
        () => {
          signal?.throwIfAborted();
          return this.startWorkspace(token, role, courseId);
        },
        undefined,
        [150, 350, 750],
      );
    } finally {
      release();
    }
  }

  private async startWorkspace(
    token: string,
    role: EvaluationRole,
    courseId: string,
  ) {
    const hash = tokenHash(token);
    const connection = await this.pool.connect();
    const id = randomBytes(16).toString("hex");
    let discardConnection = false;
    try {
      await connection.query("BEGIN");
      await connection.query("SELECT pg_advisory_xact_lock(481202)");
      const {
        rows: [existing],
      } = await connection.query<Session>(
        "SELECT * FROM public.advisio_evaluation_sessions WHERE token_hash=$1",
        [hash],
      );
      if (
        existing &&
        isLive(existing, Date.now(), this.config.idleMs, this.config.lifetimeMs)
      ) {
        if (existing.role !== role || existing.course !== courseId)
          throw Object.assign(
            new Error(
              "End the current session before choosing another role or program.",
            ),
            { statusCode: 409 },
          );
        await connection.query("COMMIT");
        return existing;
      }
      if (existing?.state === "PROVISIONING")
        throw Object.assign(
          new Error(
            "Your workspace is being prepared. Please wait and try Resume.",
          ),
          { statusCode: 409 },
        );
      const {
        rows: [count],
      } = await connection.query(
        "SELECT count(*)::int AS total FROM public.advisio_evaluation_sessions WHERE state IN ('ACTIVE','PROVISIONING')",
      );
      if (count.total >= this.config.maxActive)
        throw Object.assign(
          new Error(
            "All practice workspaces are currently in use. Please try again after a few minutes.",
          ),
          { statusCode: 429 },
        );
      if (existing)
        await connection.query(
          "UPDATE public.advisio_evaluation_sessions SET token_hash=NULL WHERE id=$1",
          [existing.id],
        );
      if (this.config.prewarm.size) {
        const session = await this.claimPrepared(
          connection,
          hash,
          role,
          courseId,
        );
        await connection.query("COMMIT");
        return session;
      }
      await connection.query(
        "INSERT INTO public.advisio_evaluation_sessions (id,token_hash,role,course) VALUES ($1,$2,$3,$4)",
        [id, hash, role, courseId],
      );
      await connection.query("COMMIT");
    } catch (e) {
      try {
        await connection.query("ROLLBACK");
      } catch {
        discardConnection = true;
      }
      throw e;
    } finally {
      connection.release(discardConnection);
    }
    return this.buildWorkspace(id, role, courseId, false);
  }

  private async claimPrepared(
    connection: PoolClient,
    hash: string,
    role: EvaluationRole,
    courseId: string,
  ) {
    const {
      rows: [prepared],
    } = await connection.query<Session>(
      `SELECT * FROM public.advisio_evaluation_sessions
       WHERE course=$1 AND state='READY' AND token_hash IS NULL AND warm_owner=$2
       ORDER BY created_at LIMIT 1 FOR UPDATE`,
      [courseId, this.warmOwner],
    );
    if (!prepared)
      throw Object.assign(
        new Error(
          "No prepared workspace is available for this selection yet. Please wait and try again.",
        ),
        { statusCode: 503 },
      );
    const account = prepared.accounts?.[role];
    if (!account)
      throw new Error("Prepared workspace is missing its role accounts.");
    const {
      rows: [session],
    } = await connection.query<Session>(
      `UPDATE public.advisio_evaluation_sessions SET state='ACTIVE',token_hash=$2,role=$3,
       user_id=$4,project_id=$5,defense_id=$6,scenario=$7,touched_at=now(),created_at=now()
       WHERE id=$1 RETURNING *`,
      [
        prepared.id,
        hash,
        role,
        account.userId,
        account.projectId,
        account.defenseId,
        account.scenarios?.[0]?.id || null,
      ],
    );
    return session;
  }

  private async buildWorkspace(
    id: string,
    role: EvaluationRole,
    courseId: string,
    warm: boolean,
  ) {
    const course = EVALUATION_COURSES.find(
      (candidate) => candidate.id === courseId,
    )!;
    let db: PrismaClient | undefined;
    let releaseSlot: (() => void) | undefined;
    try {
      releaseSlot = await this.requestSlots.acquire();
      const provisioner = await this.pool.connect();
      try {
        await provisioner.query("BEGIN");
        await provisioner.query(
          `CREATE SCHEMA "${schemaName(id)}"; SET LOCAL search_path TO "${schemaName(id)}", public;`,
        );
        await provisioner.query(this.ddl);
        await provisioner.query("COMMIT");
      } catch (e) {
        await provisioner.query("ROLLBACK");
        throw e;
      } finally {
        provisioner.release();
      }
      db = this.makeClient(id);
      const seeded = await seedWorkspace(
        db,
        course,
        role,
        this.storageRoot(id),
      );
      await db.$disconnect();
      db = undefined;
      const {
        rows: [session],
      } = await this.pool.query<Session>(
        "UPDATE public.advisio_evaluation_sessions SET user_id=$2,project_id=$3,defense_id=$4,accounts=$5,scenario=$6,state=$7,touched_at=now(),created_at=now() WHERE id=$1 AND state=$8 RETURNING *",
        [
          id,
          seeded.userId,
          seeded.projectId,
          seeded.defenseId || null,
          JSON.stringify(seeded.accounts),
          seeded.accounts[role].scenarios?.[0]?.id || null,
          warm ? "READY" : "ACTIVE",
          warm ? "WARMING" : "PROVISIONING",
        ],
      );
      if (!session)
        throw new Error(
          "Evaluation workspace reservation expired during setup.",
        );
      return session;
    } catch (e) {
      await db?.$disconnect();
      await this.pool.query(
        "UPDATE public.advisio_evaluation_sessions SET state='FAILED',token_hash=NULL WHERE id=$1",
        [id],
      );
      if (!warm) await this.removeData(id);
      throw e;
    } finally {
      releaseSlot?.();
    }
  }
  private makeClient(id: string) {
    const url = new URL(this.config.databaseUrl);
    url.searchParams.set("schema", schemaName(id));
    url.searchParams.set("connection_limit", "1");
    return createClient(url.toString());
  }
  private selectedScenario(session: Session) {
    return session.accounts?.[session.role]?.scenarios?.find(
      (item) => item.id === session.scenario,
    );
  }
  async switchRole(session: Session, role: EvaluationRole, nextToken: string) {
    if (!EVALUATION_ROLES.some((r) => r.id === role))
      throw Object.assign(new Error("Choose an evaluation role."), {
        statusCode: 400,
      });
    const base = session.accounts?.[role];
    if (!base)
      throw Object.assign(
        new Error(
          "End this older workspace and begin again to use role switching.",
        ),
        { statusCode: 409 },
      );
    const account = base.scenarios?.[0] || base;
    return this.switchIdentity(
      session,
      role,
      account,
      base.scenarios?.[0]?.id || null,
      nextToken,
    );
  }
  async switchScenario(session: Session, scenario: string, nextToken: string) {
    const account = session.accounts?.[session.role]?.scenarios?.find(
      (item) => item.id === scenario,
    );
    if (!account)
      throw Object.assign(
        new Error("Choose a scenario available for your current role."),
        { statusCode: 400 },
      );
    return this.switchIdentity(
      session,
      session.role,
      account,
      account.id,
      nextToken,
    );
  }
  private async switchIdentity(
    session: Session,
    role: EvaluationRole,
    account: Pick<WorkspaceScenario, "userId" | "projectId" | "defenseId">,
    scenario: string | null,
    nextToken: string,
  ) {
    const {
      rows: [updated],
    } = await this.pool.query<Session>(
      "UPDATE public.advisio_evaluation_sessions SET role=$2,user_id=$3,project_id=$4,defense_id=$5,token_hash=$6,scenario=$8,touched_at=now() WHERE id=$1 AND state='ACTIVE' AND token_hash=$7 AND touched_at > now()-interval '20 minutes' AND created_at > now()-interval '60 minutes' RETURNING *",
      [
        session.id,
        role,
        account.userId,
        account.projectId,
        account.defenseId,
        tokenHash(nextToken),
        session.token_hash,
        scenario,
      ],
    );
    if (!updated)
      throw Object.assign(
        new Error("Your session changed or expired. Reload the evaluation."),
        { statusCode: 401 },
      );
    for (const revoke of this.revokers.get(session.id) || []) revoke();
    return updated;
  }
  async acquire(
    session: Session,
    revoke: () => void = () => {},
    signal?: AbortSignal,
  ) {
    const cancelled = new AbortController();
    const cancel = () => {
      cancelled.abort();
      revoke();
    };
    const revokers = this.revokers.get(session.id) || new Set<() => void>();
    revokers.add(cancel);
    this.revokers.set(session.id, revokers);
    let watching = true;
    const unwatch = () => {
      if (!watching) return;
      watching = false;
      revokers.delete(cancel);
      if (!revokers.size) this.revokers.delete(session.id);
    };
    let releaseSlot: (() => void) | undefined;
    try {
      releaseSlot = await this.requestSlots.acquire(
        signal ? AbortSignal.any([signal, cancelled.signal]) : cancelled.signal,
      );
      const {
        rows: [current],
      } = await this.pool.query<Session>(
        "SELECT * FROM public.advisio_evaluation_sessions WHERE id=$1 AND token_hash=$2",
        [session.id, session.token_hash],
      );
      if (
        cancelled.signal.aborted ||
        signal?.aborted ||
        !current ||
        !isLive(
          current,
          Date.now(),
          this.config.idleMs,
          this.config.lifetimeMs,
        ) ||
        current.user_id !== session.user_id ||
        current.scenario !== session.scenario
      )
        throw Object.assign(
          new Error("Your session changed or expired. Reload the evaluation."),
          { statusCode: 401 },
        );
    } catch (error) {
      unwatch();
      releaseSlot?.();
      throw error;
    }
    let item = this.clients.get(session.id);
    if (!item) {
      try {
        item = { prisma: this.makeClient(session.id), users: 0, ended: false };
        this.clients.set(session.id, item);
      } catch (error) {
        unwatch();
        releaseSlot();
        throw error;
      }
    }
    item.users++;
    let disconnecting: Promise<void> | undefined;
    const releaseDatabase = () => {
      if (disconnecting) return disconnecting;
      item!.users--;
      if (item!.users === 0) this.clients.delete(session.id);
      disconnecting = (async () => {
        try {
          if (item!.users === 0) await item!.prisma.$disconnect();
        } catch (error) {
          console.warn(
            "Evaluation connection close failed:",
            evaluationDatabaseErrorCode(error),
          );
        } finally {
          releaseSlot!();
        }
      })();
      return disconnecting;
    };
    return {
      scope: {
        id: session.id,
        prisma: item.prisma,
        storageRoot: this.storageRoot(session.id),
        projectIds:
          this.selectedScenario(session)?.projectIds ||
          session.accounts?.[session.role]?.projectIds,
      },
      releaseDatabase,
      release: () => {
        unwatch();
        return releaseDatabase();
      },
    };
  }
  describe(session: Session) {
    const role = EVALUATION_ROLES.find((r) => r.id === session.role)!;
    const course = EVALUATION_COURSES.find((c) => c.id === session.course)!;
    const selected = this.selectedScenario(session);
    return {
      role: role.id,
      roleLabel: role.label,
      course: course.id,
      courseLabel: course.label,
      college: course.college,
      collegeCode: course.collegeCode,
      title:
        selected?.title ||
        session.accounts?.[session.role]?.title ||
        course.title,
      home: selected?.home || role.home,
      scenario: selected?.id || null,
      scenarioLabel: selected?.label || null,
      scenarios:
        session.accounts?.[session.role]?.scenarios?.map(({ id, label }) => ({
          id,
          label,
        })) || [],
      signingPassword:
        role.id === "dean" && selected ? DEMO_SIGNING_PASSWORD : undefined,
      revisionAvailable:
        role.id === "student" && (!selected || selected.id === "in-progress"),
      projectId: session.project_id,
      progressKey: `${session.id}:${role.id}:${selected?.id || "default"}`,
      roles: session.accounts
        ? EVALUATION_ROLES.map(({ id, label }) => ({ id, label }))
        : [],
      defenseId: session.defense_id,
      tasks: scenarioTasks(
        session.role,
        selected?.id || "",
        ROLE_TASKS[session.role],
      ),
      revisionName: `${course.short}_Proposal_v3.pdf`,
      expiresAt: new Date(
        +session.created_at + this.config.lifetimeMs,
      ).toISOString(),
      surveyUrl: evaluationSurveyUrl(session),
    };
  }
  surveyUrl() {
    return evaluationSurveyUrl();
  }

  async end(session: Session) {
    await this.pool.query(
      "UPDATE public.advisio_evaluation_sessions SET state='ENDED',token_hash=NULL WHERE id=$1",
      [session.id],
    );
    for (const revoke of this.revokers.get(session.id) || []) revoke();
    const item = this.clients.get(session.id);
    if (item) {
      item.ended = true;
      if (item.users) return;
    }
    if (!this.config.prewarm.size) await this.removeData(session.id);
  }
  private removeData(id: string) {
    const running = this.removals.get(id);
    if (running) return running;
    const removal = this.removeDataOnce(id).finally(() =>
      this.removals.delete(id),
    );
    this.removals.set(id, removal);
    return removal;
  }
  private async removeDataOnce(id: string) {
    const item = this.clients.get(id);
    if (item?.users) return;
    await item?.prisma.$disconnect();
    this.clients.delete(id);
    // Only a validated server-generated ID can ever become a schema or directory.
    await this.pool.query(`DROP SCHEMA IF EXISTS "${schemaName(id)}" CASCADE`);
    await fs.rm(this.storageRoot(id), { recursive: true, force: true });
    await this.pool.query(
      "UPDATE public.advisio_evaluation_sessions SET cleaned_at=now() WHERE id=$1",
      [id],
    );
  }
  async cleanup() {
    const { rows } = await this.pool.query<Session>(
      "UPDATE public.advisio_evaluation_sessions SET state='EXPIRED',token_hash=NULL WHERE (state='ACTIVE' AND (touched_at<now()-interval '20 minutes' OR created_at<now()-interval '60 minutes')) OR (state IN ('PROVISIONING','WARMING') AND created_at<now()-interval '10 minutes') RETURNING *",
    );
    for (const session of rows) {
      const item = this.clients.get(session.id);
      if (item) item.ended = true;
      for (const revoke of this.revokers.get(session.id) || []) revoke();
      await this.removeData(session.id);
    }
    const { rows: stale } = await this.pool.query<Session>(
      "SELECT * FROM public.advisio_evaluation_sessions WHERE state IN ('ENDED','FAILED','EXPIRED') AND cleaned_at IS NULL",
    );
    for (const session of stale) await this.removeData(session.id);
  }
  async close() {
    this.closing = true;
    clearInterval(this.timer);
    await this.maintenance;
    await Promise.all(
      [...this.clients.values()].map((x) => x.prisma.$disconnect()),
    );
    await Promise.all([this.pool.end(), this.healthPool.end()]);
  }
}
