import { Prisma, type PrismaClient } from "@prisma/client";
import {
  planLegacyCohortBackfill,
  stableHash,
  type BackfillPlan,
  type BackfillSnapshot,
} from "./legacy-cohort-planner.js";

type Db = Prisma.TransactionClient;
export * from "./legacy-cohort-planner.js";
export type BackfillOptions = {
  apply: boolean;
  createSafeCohorts: boolean;
  json: boolean;
  output?: string;
  help: boolean;
};
export function parseBackfillOptions(args: string[]): BackfillOptions {
  const options: BackfillOptions = {
    apply: false,
    createSafeCohorts: false,
    json: false,
    help: false,
  };
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (seen.has(arg)) throw new Error(`Duplicate option: ${arg}`);
    seen.add(arg);
    if (arg === "--apply") options.apply = true;
    else if (arg === "--dry-run") options.apply = false;
    else if (arg === "--create-safe-cohorts") options.createSafeCohorts = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--help") options.help = true;
    else if (arg === "--output") {
      const value = args[++index];
      if (!value || value.startsWith("--"))
        throw new Error("--output requires a file path");
      options.output = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (seen.has("--apply") && seen.has("--dry-run"))
    throw new Error("Choose --dry-run or --apply, never both.");
  return options;
}

/** No implicit environment files or fallback to DATABASE_URL. */
export function backfillTarget(environment: NodeJS.ProcessEnv, apply: boolean) {
  if (!environment.BACKFILL_DATABASE_URL)
    throw new Error(
      "Set BACKFILL_DATABASE_URL explicitly; no default database is used.",
    );
  const url = new URL(environment.BACKFILL_DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("Backfill requires PostgreSQL.");
  if (
    apply &&
    (environment.NODE_ENV !== "test" ||
      environment.RUN_DATABASE_INTEGRATION_TESTS !== "1" ||
      !environment.INTEGRATION_TEST_RUN_ID ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      decodeURIComponent(url.pathname.slice(1)) !== "advisio_test" ||
      (url.searchParams.get("schema") || "public") !== "public" ||
      url.searchParams.get("application_name") !== "advisio-integration-tests")
  )
    throw new Error(
      "Apply is restricted to the explicitly marked isolated advisio_test database. Production/shared/preview application requires separate target-policy review.",
    );
  return url;
}
export async function verifyBackfillTarget(
  db: Db,
  environment: NodeJS.ProcessEnv,
  apply: boolean,
) {
  const target = backfillTarget(environment, apply);
  const rows = await db.$queryRaw<
    Array<{
      databaseName: string;
      databaseUser: string;
      schemaName: string;
      applicationName: string;
      isReplica: boolean;
    }>
  >`SELECT current_database() AS "databaseName", current_user AS "databaseUser", current_schema() AS "schemaName", current_setting('application_name') AS "applicationName", pg_is_in_recovery() AS "isReplica"`;
  const identity = rows[0];
  if (
    !identity ||
    identity.databaseName !== decodeURIComponent(target.pathname.slice(1)) ||
    identity.databaseUser !== decodeURIComponent(target.username) ||
    identity.schemaName !== (target.searchParams.get("schema") || "public") ||
    identity.applicationName !==
      (target.searchParams.get("application_name") || "") ||
    (apply && identity.isReplica)
  )
    throw new Error(
      "Live database identity does not match the explicit backfill target.",
    );
  return {
    database: identity.databaseName,
    schema: identity.schemaName,
    host: target.hostname,
    port: target.port || "5432",
  };
}

/** Full relevant evidence, ordered by IDs. No type.workflowId, display-string matching or PII output. */
export async function readBackfillSnapshot(db: Db): Promise<BackfillSnapshot> {
  const orderBy = { id: "asc" as const };
  const [
    projects,
    workspaces,
    instances,
    workflows,
    stages,
    cohorts,
    cohortMembers,
    researchMembers,
    workspaceMembers,
    enrollments,
    people,
    programs,
    researchTypes,
    years,
  ] = await Promise.all([
    db.researchProject.findMany({ orderBy }),
    db.researchWorkspace.findMany({ orderBy }),
    db.workflowInstance.findMany({ orderBy }),
    db.workflow.findMany({ orderBy }),
    db.workflowStage.findMany({
      orderBy,
      select: { id: true, workflowId: true },
    }),
    db.researchCohort.findMany({ orderBy }),
    db.researchCohortMember.findMany({ orderBy }),
    db.researchMember.findMany({ orderBy }),
    db.workspaceMember.findMany({ orderBy }),
    db.workflowEnrollment.findMany({ orderBy }),
    db.user.findMany({
      orderBy,
      select: {
        id: true,
        collegeId: true,
        programId: true,
        status: true,
        updatedAt: true,
        roles: { select: { role: { select: { name: true } } } },
        researcherProfile: { select: { academicYearId: true } },
      },
    }),
    db.program.findMany({ orderBy, select: { id: true, collegeId: true } }),
    db.researchType.findMany({
      orderBy,
      select: { id: true, programId: true },
    }),
    db.academicYear.findMany({ orderBy, select: { id: true, name: true } }),
  ]);
  const users = people.map(({ roles, researcherProfile, ...user }) => ({
    ...user,
    roles: roles.map(({ role }) => role.name).sort(),
    academicYearId: researcherProfile?.academicYearId || null,
  }));
  return {
    projects,
    workspaces,
    instances,
    workflows,
    stages,
    cohorts,
    cohortMembers,
    researchMembers,
    workspaceMembers,
    enrollments,
    users,
    programs,
    researchTypes,
    years,
  };
}
export async function prepareBackfill(
  db: PrismaClient,
  environment = process.env,
) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const target = await verifyBackfillTarget(tx, environment, false);
      const snapshot = await readBackfillSnapshot(tx);
      return { target, plan: planLegacyCohortBackfill(snapshot) };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 60000,
    },
  );
}
export type ApplyResult = {
  mode: "APPLY";
  migration: "LEGACY_COHORT_BACKFILL";
  completedAt: string;
  writesPerformed: number;
  written: Record<string, number>;
  groups: Array<{
    id: string;
    status:
      | "APPLIED"
      | "STALE_PLAN"
      | "APPLY_FAILED"
      | "CREATION_NOT_AUTHORIZED";
    writes: number;
    createdCohorts?: Array<{ target: string; cohortId: string }>;
  }>;
  plan: BackfillPlan;
};

/** Executes exactly the shared planner's actions. Each cluster is atomic; failed clusters roll back. */
export async function applyBackfill(
  db: PrismaClient,
  plan: BackfillPlan,
  options: { createSafeCohorts: boolean; environment?: NodeJS.ProcessEnv },
): Promise<ApplyResult> {
  const environment = options.environment || process.env;
  backfillTarget(environment, true); // Refuse unsafe target before opening a transaction.
  let expectedHash = plan.sourceHash;
  const result: ApplyResult = {
    mode: "APPLY",
    migration: "LEGACY_COHORT_BACKFILL",
    completedAt: "",
    writesPerformed: 0,
    written: {
      CREATE_COHORT: 0,
      PROJECT_LINK_UPDATE: 0,
      WORKSPACE_LINK_UPDATE: 0,
      MEMBERSHIP_CREATE: 0,
    },
    groups: [],
    plan,
  };
  for (const group of plan.groups) {
    if (
      !options.createSafeCohorts &&
      group.actions.some((action) => action.kind === "CREATE_COHORT")
    ) {
      result.groups.push({
        id: group.id,
        status: "CREATION_NOT_AUTHORIZED",
        writes: 0,
      });
      continue;
    }
    try {
      const outcome = await db.$transaction(
        async (tx) => {
          await verifyBackfillTarget(tx, environment, true);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('advisio:legacy-cohort-backfill:v1'))`;
          const snapshot = await readBackfillSnapshot(tx);
          if (stableHash(snapshot) !== expectedHash) return null;
          const freshGroup = planLegacyCohortBackfill(snapshot).groups.find(
            (item) => item.id === group.id,
          );
          if (!freshGroup || stableHash(freshGroup) !== stableHash(group))
            return null;
          const ids = new Map<string, string>(),
            written: Record<string, number> = {};
          for (const action of group.actions.filter(
            (action) => action.kind === "CREATE_COHORT",
          )) {
            if (action.kind !== "CREATE_COHORT") continue;
            if (!action.identity.academicYearId)
              throw new Error("Creation requires an academic year.");
            const cohort = await tx.researchCohort.create({
              data: {
                ...action.identity,
                academicYearId: action.identity.academicYearId,
                name: action.name,
                description:
                  "Created by LEGACY_COHORT_BACKFILL from a proven legacy process container; lifecycle requires review.",
                createdBy: action.createdBy,
                status: "DRAFT",
              },
            });
            ids.set(action.target, cohort.id);
            written.CREATE_COHORT = (written.CREATE_COHORT || 0) + 1;
          }
          for (const action of group.actions) {
            const cohortId = ids.get(action.target) || action.target;
            if (action.kind === "CREATE_COHORT") continue;
            if (action.kind === "PROJECT_LINK_UPDATE") {
              const update = await tx.researchProject.updateMany({
                where: { id: action.id, cohortId: null },
                data: { cohortId },
              });
              if (update.count !== 1) throw new Error("STALE_PLAN");
            } else if (action.kind === "WORKSPACE_LINK_UPDATE") {
              const update = await tx.researchWorkspace.updateMany({
                where: { id: action.id, cohortId: null },
                data: { cohortId },
              });
              if (update.count !== 1) throw new Error("STALE_PLAN");
            } else if (action.kind === "MEMBERSHIP_CREATE")
              await tx.researchCohortMember.create({
                data: { cohortId, userId: action.userId, status: "ACTIVE" },
              });
            written[action.kind] = (written[action.kind] || 0) + 1;
          }
          return {
            sourceHash: stableHash(await readBackfillSnapshot(tx)),
            written,
            createdCohorts: [...ids].map(([target, cohortId]) => ({
              target,
              cohortId,
            })),
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 60000,
        },
      );
      if (!outcome) {
        result.groups.push({ id: group.id, status: "STALE_PLAN", writes: 0 });
        continue;
      }
      expectedHash = outcome.sourceHash;
      const writes = Object.values(outcome.written).reduce(
        (sum, count) => sum + count,
        0,
      );
      result.writesPerformed += writes;
      for (const [kind, count] of Object.entries(outcome.written))
        result.written[kind] += count;
      result.groups.push({
        id: group.id,
        status: "APPLIED",
        writes,
        createdCohorts: outcome.createdCohorts,
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      result.groups.push({
        id: group.id,
        status:
          code === "P2034" || (error as Error).message === "STALE_PLAN"
            ? "STALE_PLAN"
            : "APPLY_FAILED",
        writes: 0,
      });
    }
  }
  result.completedAt = new Date().toISOString();
  return result;
}

export function formatBackfillSummary(
  plan: BackfillPlan,
  apply = false,
  createSafeCohorts = false,
) {
  return [
    `Legacy Backfill Plan`,
    `MODE: ${apply ? "APPLY" : "DRY RUN"}`,
    `Projects inspected: ${plan.projectsInspected}`,
    ...Object.entries(plan.counts).map(([key, value]) => `${key}: ${value}`),
    ...plan.findings.map(
      (finding) =>
        `SKIP ${finding.code}: ${finding.entityType}:${finding.entityId}${finding.userId ? ` user:${finding.userId}` : ""}`,
    ),
    `New cohort creation authorized: ${apply && createSafeCohorts ? "YES" : "NO (candidates are report-only)"}`,
    "No projects, workspaces, instances, enrollments, process definitions or academic history will be deleted or repinned.",
    "Only validated cohort links, explicitly authorized cohorts and cohort memberships can be written.",
  ].join("\n");
}
