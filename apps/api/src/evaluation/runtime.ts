import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import type { PrismaClient } from "@prisma/client";
import { createClient } from "../lib/prisma.js";
import { evaluationConfig, isLive, schemaName } from "./config.js";
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

export class EvaluationRuntime {
  readonly config = evaluationConfig();
  readonly pool = new Pool({
    connectionString: this.config.databaseUrl,
    max: 4,
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
    // Free hosting loses local files on sleep/restart. Revoke those temporary
    // sessions before serving traffic so nobody resumes missing manuscripts.
    if (this.config.ephemeralStorage)
      await this.pool.query(
        "UPDATE public.advisio_evaluation_sessions SET state='EXPIRED',token_hash=NULL WHERE state IN ('ACTIVE','PROVISIONING')",
      );
    await this.cleanup();
    this.timer = setInterval(
      () =>
        void this.cleanup().catch(() =>
          console.error("Evaluation cleanup will retry."),
        ),
      60_000,
    );
    this.timer.unref();
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
  async begin(token: string, role: EvaluationRole, courseId: string) {
    await this.cleanup();
    const course = EVALUATION_COURSES.find((c) => c.id === courseId)!;
    const connection = await this.pool.connect();
    const id = randomBytes(16).toString("hex");
    try {
      await connection.query("BEGIN");
      await connection.query("SELECT pg_advisory_xact_lock(481202)");
      const {
        rows: [existing],
      } = await connection.query<Session>(
        "SELECT * FROM public.advisio_evaluation_sessions WHERE token_hash=$1",
        [tokenHash(token)],
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
      await connection.query(
        "INSERT INTO public.advisio_evaluation_sessions (id,token_hash,role,course) VALUES ($1,$2,$3,$4)",
        [id, tokenHash(token), role, courseId],
      );
      await connection.query("COMMIT");
    } catch (e) {
      await connection.query("ROLLBACK");
      throw e;
    } finally {
      connection.release();
    }
    let db: PrismaClient | undefined;
    try {
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
      const {
        rows: [session],
      } = await this.pool.query<Session>(
        "UPDATE public.advisio_evaluation_sessions SET user_id=$2,project_id=$3,defense_id=$4,accounts=$5,scenario=$6,state='ACTIVE',touched_at=now(),created_at=now() WHERE id=$1 RETURNING *",
        [
          id,
          seeded.userId,
          seeded.projectId,
          seeded.defenseId || null,
          JSON.stringify(seeded.accounts),
          seeded.accounts[role].scenarios?.[0]?.id || null,
        ],
      );
      this.clients.set(id, { prisma: db, users: 0, ended: false });
      return session;
    } catch (e) {
      await db?.$disconnect();
      await this.pool.query(
        "UPDATE public.advisio_evaluation_sessions SET state='FAILED',token_hash=NULL WHERE id=$1",
        [id],
      );
      await this.removeData(id);
      throw e;
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
  acquire(session: Session, revoke: () => void = () => {}) {
    let item = this.clients.get(session.id);
    if (!item) {
      item = { prisma: this.makeClient(session.id), users: 0, ended: false };
      this.clients.set(session.id, item);
    }
    item.users++;
    const revokers = this.revokers.get(session.id) || new Set<() => void>();
    revokers.add(revoke);
    this.revokers.set(session.id, revokers);
    let released = false;
    return {
      scope: {
        id: session.id,
        prisma: item.prisma,
        storageRoot: this.storageRoot(session.id),
        projectIds:
          this.selectedScenario(session)?.projectIds ||
          session.accounts?.[session.role]?.projectIds,
      },
      release: () => {
        if (released) return;
        released = true;
        revokers.delete(revoke);
        if (!revokers.size) this.revokers.delete(session.id);
        item!.users--;
        if (item!.ended && item!.users === 0)
          void this.removeData(session.id).catch(() => {});
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
    await this.removeData(session.id);
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
      "UPDATE public.advisio_evaluation_sessions SET state='EXPIRED',token_hash=NULL WHERE (state='ACTIVE' AND (touched_at<now()-interval '20 minutes' OR created_at<now()-interval '60 minutes')) OR (state='PROVISIONING' AND created_at<now()-interval '10 minutes') RETURNING *",
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
    clearInterval(this.timer);
    await Promise.all(
      [...this.clients.values()].map((x) => x.prisma.$disconnect()),
    );
    await Promise.all([this.pool.end(), this.healthPool.end()]);
  }
}
