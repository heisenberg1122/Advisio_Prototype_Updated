// Explicitly opt-in lifecycle test. Only the named loopback test database is accepted.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DATASET, DATASET_ID } from "./program-demo-catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".demo-local/four-programs-test/env.json");
const env = JSON.parse(await fs.readFile(envFile, "utf8"));
const url = new URL(env.PROGRAM_DEMO_DATABASE_URL);
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "5435");
assert.equal(url.pathname, "/advisio_program_demo_test");
Object.assign(process.env, env, {
  DATABASE_URL: url.href,
  DIRECT_URL: url.href,
});
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
function run(command, extra = {}, expected = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/program-demo.mjs", command],
      { cwd: root, env: { ...process.env, ...extra }, windowsHide: true },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== expected)
        reject(new Error(`${command} exited ${code}: ${output}`));
      else resolve(output);
    });
  });
}
try {
  const [identity] = await db.$queryRaw`SELECT current_database() AS name`;
  assert.equal(identity.name, "advisio_program_demo_test");
  const { seedReferenceData } =
    await import("../packages/database/src/reference-data.ts");
  await seedReferenceData(db);
  await db.academicYear.upsert({
    where: { name: "2026-2027" },
    update: {},
    create: {
      name: "2026-2027",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2027-06-30"),
      isCurrent: true,
    },
  });
  // Install the real database history protections, without disabling any trigger.
  const guards = [
    ["20261015040000_restore_immutable_workflow_triggers", ""],
    [
      "20261030090000_evaluation_integrity_ledger",
      "CREATE FUNCTION reject_evaluation_ledger_mutation()",
    ],
    ["20261101090000_audit_trails", "CREATE FUNCTION protect_audit_history()"],
  ];
  const { createRequire } = await import("node:module");
  const require = createRequire(path.join(root, "apps/api/package.json"));
  const { Client } = require("pg");
  const pg = new Client({ connectionString: url.href });
  await pg.connect();
  // CHECK constraints are not represented by Prisma db push. Install this one
  // from its migration so students can never be seeded as faculty memberships.
  if (
    !(
      await pg.query(
        "SELECT 1 FROM pg_constraint WHERE conname = 'college_memberships_faculty_roles'",
      )
    ).rowCount
  ) {
    const membershipSql = await fs.readFile(
      path.join(
        root,
        "packages/database/prisma/migrations/20261101010000_college_memberships/migration.sql",
      ),
      "utf8",
    );
    const check = membershipSql.match(
      /CONSTRAINT "college_memberships_faculty_roles" CHECK \([\s\S]*?\n  \)/,
    )?.[0];
    assert.ok(
      check,
      "Faculty membership constraint must be present in the real migration.",
    );
    await pg.query('ALTER TABLE "college_memberships" ADD ' + check);
  }
  for (const [migration, marker] of guards) {
    let sql = await fs.readFile(
      path.join(
        root,
        "packages/database/prisma/migrations",
        migration,
        "migration.sql",
      ),
      "utf8",
    );
    if (marker) sql = sql.slice(sql.indexOf(marker));
    if (
      marker &&
      (
        await pg.query("SELECT 1 FROM pg_proc WHERE proname=$1", [
          marker.includes("audit")
            ? "protect_audit_history"
            : "reject_evaluation_ledger_mutation",
        ])
      ).rowCount
    )
      continue;
    await pg.query(sql);
  }
  await pg.end();
  const sentinel = await db.user.upsert({
    where: { email: "sentinel@program-demo-test.invalid" },
    update: {},
    create: {
      email: "sentinel@program-demo-test.invalid",
      universityId: "PROGRAM-DEMO-TEST-SENTINEL",
      firstName: "Existing",
      lastName: "Sentinel",
      status: "ACTIVE",
    },
  });
  const oldLedgerCount = await db.evaluationLedgerEvent.count();
  const oldCreatedCount = await db.auditLog.count({
    where: { entityId: DATASET_ID, eventType: "PROGRAM_DEMO_CREATED" },
  });
  const oldRemovedCount = await db.auditLog.count({
    where: { entityId: DATASET_ID, eventType: "PROGRAM_DEMO_REMOVED" },
  });
  assert.equal(
    await db.user.count({ where: { universityId: { startsWith: "DEMO4-" } } }),
    0,
    "Test dataset already exists; inspect it before another run.",
  );
  console.log(
    "Testing seed, storage reads, passwords, group progression, and evaluation integrity...",
  );
  console.log(await run("seed"));
  const snapshot = await db.user.findUniqueOrThrow({
    where: { id: sentinel.id },
  });
  await assert.rejects(
    db.$executeRaw`DELETE FROM evaluation_ledger_events WHERE false`,
  );
  const ledgerCount = await db.evaluationLedgerEvent.count();
  assert.equal(ledgerCount, oldLedgerCount + 15);
  assert.match(await run("seed", {}, 1), /already exist/);
  const project = await db.researchProject.findFirstOrThrow({
    where: { groupName: `${DATASET}:BSN:A` },
  });
  await db.researchMember.create({
    data: {
      researchId: project.id,
      userId: sentinel.id,
      projectRole: "MEMBER",
    },
  });
  assert.match(await run("cleanup-preview", {}, 1), /non-demo user/);
  await db.researchMember.deleteMany({
    where: { researchId: project.id, userId: sentinel.id },
  });
  const preview = JSON.parse(await run("cleanup-preview"));
  console.log("Testing exact removal and immutable-history preservation...");
  console.log(
    await run("cleanup", {
      PROGRAM_DEMO_CLEANUP_CONFIRMATION: `DELETE:${DATASET}`,
      PROGRAM_DEMO_CLEANUP_PREVIEW_HASH: preview.previewHash,
    }),
  );
  assert.equal(
    await db.user.count({ where: { universityId: { startsWith: "DEMO4-" } } }),
    0,
  );
  assert.equal(await db.researchProject.count(), 0);
  assert.equal(await db.workflow.count(), 0);
  assert.equal(await db.researchWorkspace.count(), 0);
  assert.equal(await db.researchType.count(), 0);
  assert.equal(await db.evaluationLedgerEvent.count(), ledgerCount);
  assert.deepEqual(
    await db.user.findUniqueOrThrow({ where: { id: sentinel.id } }),
    snapshot,
  );
  assert.equal(
    await db.auditLog.count({
      where: { entityId: DATASET_ID, eventType: "PROGRAM_DEMO_CREATED" },
    }),
    oldCreatedCount + 1,
  );
  assert.equal(
    await db.auditLog.count({
      where: { entityId: DATASET_ID, eventType: "PROGRAM_DEMO_REMOVED" },
    }),
    oldRemovedCount + 1,
  );
  console.log(
    "PASS: demo setup/removal, real-user protection, local PDFs, credentials, sequential progress, and immutable evaluation/audit history.",
  );
} finally {
  await db.$disconnect();
}
