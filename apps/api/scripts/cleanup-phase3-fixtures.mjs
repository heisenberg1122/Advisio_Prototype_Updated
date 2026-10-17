import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});

const phase4 = process.argv.includes("--phase4");
const fixture = phase4
  ? Object.freeze({
      label: "Phase 4",
      key: "phase4",
      expectedCounts: Object.freeze({
        colleges: 10,
        programs: 10,
        academicYears: 10,
        users: 70,
        researchTypes: 10,
        workflows: 10,
        projects: 10,
      }),
      confirmationVariable: "CONFIRM_PHASE4_FIXTURE_CLEANUP",
      executionConfirmation: "DELETE_CONFIRMED_PHASE4_TEST_FIXTURES",
      collegeName: "Phase 4 Isolated College",
      programName: "Phase 4 Isolated Program",
      academicYearPrefix: "P4-",
      emailPrefix: "phase4-",
      researchTypePrefix: "P4-MANUSCRIPT-",
      workflowName: "Phase 4 Verification Workflow",
      collegeCodePattern: /^P4[A-F0-9]{8}$/,
      programCodePattern: /^P4IT[A-F0-9]{8}$/,
      academicYearPattern: /^P4-[A-F0-9]{8}$/,
      researchTypePattern: /^P4-MANUSCRIPT-[A-F0-9]{8}$/,
      universityIdPattern:
        /^P4-[A-F0-9]{8}-(Student|Adviser|Professor|Panelist|ReplacementPanelist|Outsider|Administrator)$/,
      emailPattern:
        /^phase4-[a-f0-9]{8}-(student|adviser|professor|panelist|replacementpanelist|outsider|administrator)@isolated\.test$/,
      projectIdentity: ({ title, groupName }) =>
        title === "Phase 4 isolated review verification" &&
        groupName === "Phase 4 Group",
    })
  : Object.freeze({
      label: "Phase 3",
      key: "phase3",
      expectedCounts: Object.freeze({
        colleges: 10,
        programs: 10,
        academicYears: 10,
        users: 40,
        researchTypes: 10,
        workflows: 10,
        projects: 15,
      }),
      confirmationVariable: "CONFIRM_PHASE3_FIXTURE_CLEANUP",
      executionConfirmation: "DELETE_CONFIRMED_PHASE3_TEST_FIXTURES",
      collegeName: "Phase 3 Isolated College",
      programName: "Phase 3 Isolated Program",
      academicYearPrefix: "P3-",
      emailPrefix: "phase3-",
      researchTypePrefix: "P3-MANUSCRIPT-",
      workflowName: "Phase 3 Verification Workflow",
      collegeCodePattern: /^P3[A-F0-9]{8}$/,
      programCodePattern: /^P3IT[A-F0-9]{8}$/,
      academicYearPattern: /^P3-[A-F0-9]{8}$/,
      researchTypePattern: /^P3-MANUSCRIPT-[A-F0-9]{8}$/,
      universityIdPattern:
        /^P3-[A-F0-9]{8}-(Student|Outsider|Adviser|Professor)$/,
      emailPattern:
        /^phase3-[a-f0-9]{8}-(student|outsider|adviser|professor)@isolated\.test$/,
      projectIdentity: ({ title, groupName }) =>
        (title === "Isolated immutable manuscript verification" &&
          groupName === "Phase 3 Fixture Group") ||
        (title === "Separate project eligibility boundary" &&
          groupName === "Phase 1.5 Foreign Fixture Group"),
    });
const EXPECTED_COUNTS = fixture.expectedCounts;
const execute = process.argv.includes("--execute");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

let target;
try {
  target = new URL(connectionString);
} catch {
  console.error("DATABASE_URL is invalid.");
  process.exit(1);
}

const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ""));
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
if (
  !["postgres:", "postgresql:"].includes(target.protocol) ||
  !localHosts.has(target.hostname.toLowerCase()) ||
  databaseName !== "advisio_local"
) {
  console.error(
    "Legacy fixture cleanup is restricted to the local advisio_local database.",
  );
  process.exit(1);
}
if (
  execute &&
  process.env[fixture.confirmationVariable] !== fixture.executionConfirmation
) {
  console.error(
    `Execution additionally requires ${fixture.confirmationVariable}=${fixture.executionConfirmation}.`,
  );
  process.exit(1);
}

const prisma = new PrismaClient();

function assertCount(name, actual) {
  const expected = EXPECTED_COUNTS[name];
  if (actual !== expected) {
    throw new Error(
      `${fixture.label} cleanup preflight changed: expected ${expected} ${name}, found ${actual}. No deletion was performed.`,
    );
  }
}

function assertEvery(records, predicate, description) {
  if (!records.every(predicate)) {
    throw new Error(
      `${fixture.label} cleanup preflight found an unexpected ${description}. No deletion was performed.`,
    );
  }
}

async function verifyLiveLocalDatabase(client) {
  const rows = await client.$queryRawUnsafe(`
    SELECT
      current_database() AS "databaseName",
      current_schema() AS "schemaName",
      pg_is_in_recovery() AS "isReplica"
  `);
  const identity = rows[0];
  if (
    !identity ||
    identity.databaseName !== "advisio_local" ||
    identity.schemaName !== "public" ||
    identity.isReplica
  ) {
    throw new Error(
      "The live PostgreSQL connection is not the expected writable local Advisio database.",
    );
  }
}

async function collectCandidates(tx) {
  const [colleges, academicYears, users, researchTypes] = await Promise.all([
    tx.college.findMany({
      where: { name: fixture.collegeName },
      select: { id: true, code: true, name: true },
    }),
    tx.academicYear.findMany({
      where: { name: { startsWith: fixture.academicYearPrefix } },
      select: { id: true, name: true },
    }),
    tx.user.findMany({
      where: {
        email: { startsWith: fixture.emailPrefix, endsWith: "@isolated.test" },
      },
      select: {
        id: true,
        universityId: true,
        email: true,
        collegeId: true,
        programId: true,
      },
    }),
    tx.researchType.findMany({
      where: { code: { startsWith: fixture.researchTypePrefix } },
      select: { id: true, code: true, programId: true, workflowId: true },
    }),
  ]);
  const collegeIds = colleges.map(({ id }) => id);
  const programs = await tx.program.findMany({
    where: {
      collegeId: { in: collegeIds },
      name: fixture.programName,
    },
    select: { id: true, collegeId: true, code: true, name: true },
  });
  const researchTypeIds = researchTypes.map(({ id }) => id);
  const workflows = await tx.workflow.findMany({
    where: {
      researchTypeId: { in: researchTypeIds },
      name: fixture.workflowName,
    },
    select: { id: true, researchTypeId: true, name: true, createdBy: true },
  });
  const projects = await tx.researchProject.findMany({
    where: { researchTypeId: { in: researchTypeIds } },
    select: {
      id: true,
      title: true,
      groupName: true,
      researchTypeId: true,
      programId: true,
      collegeId: true,
      academicYearId: true,
      createdBy: true,
      workflowInstanceId: true,
    },
  });

  assertCount("colleges", colleges.length);
  assertCount("programs", programs.length);
  assertCount("academicYears", academicYears.length);
  assertCount("users", users.length);
  assertCount("researchTypes", researchTypes.length);
  assertCount("workflows", workflows.length);
  assertCount("projects", projects.length);
  assertEvery(
    colleges,
    ({ code }) => fixture.collegeCodePattern.test(code),
    "college code",
  );
  assertEvery(
    programs,
    ({ code }) => fixture.programCodePattern.test(code),
    "program code",
  );
  assertEvery(
    academicYears,
    ({ name }) => fixture.academicYearPattern.test(name),
    "academic-year name",
  );
  assertEvery(
    researchTypes,
    ({ code }) => fixture.researchTypePattern.test(code),
    "research-type code",
  );
  assertEvery(
    users,
    ({ universityId, email }) =>
      fixture.universityIdPattern.test(universityId) &&
      fixture.emailPattern.test(email),
    "user identity",
  );
  assertEvery(
    projects,
    fixture.projectIdentity,
    "project identity",
  );

  const projectIds = projects.map(({ id }) => id);
  const workflowIds = workflows.map(({ id }) => id);
  const userIds = users.map(({ id }) => id);
  const programIds = programs.map(({ id }) => id);
  const academicYearIds = academicYears.map(({ id }) => id);
  const unexpectedProjectCount = await tx.researchProject.count({
    where: {
      id: { notIn: projectIds },
      OR: [
        { researchTypeId: { in: researchTypeIds } },
        { collegeId: { in: collegeIds } },
        { programId: { in: programIds } },
        { academicYearId: { in: academicYearIds } },
        { createdBy: { in: userIds } },
      ],
    },
  });
  if (unexpectedProjectCount > 0) {
    throw new Error(
      `Found ${unexpectedProjectCount} project(s) outside the confirmed fixture set sharing ${fixture.label} roots. No deletion was performed.`,
    );
  }

  const documents = await tx.document.findMany({
    where: { researchId: { in: projectIds } },
    select: {
      id: true,
      researchId: true,
      versions: { select: { id: true } },
    },
  });
  const documentIds = documents.map(({ id }) => id);
  const versionIds = documents.flatMap(({ versions }) =>
    versions.map(({ id }) => id),
  );
  const [
    officialCopies,
    documentSignatures,
    externalOfficialCopies,
    workspaces,
    mailThreads,
    announcements,
    storageIntegrations,
  ] = await Promise.all([
    tx.officialCopy.count({ where: { researchId: { in: projectIds } } }),
    tx.documentSignature.count({
      where: {
        OR: [
          { sourceVersionId: { in: versionIds } },
          { signedVersionId: { in: versionIds } },
        ],
      },
    }),
    tx.officialCopy.count({
      where: {
        OR: [
          { finalizedById: { in: userIds } },
          { revokedById: { in: userIds } },
        ],
      },
    }),
    tx.researchWorkspace.count({ where: { createdBy: { in: userIds } } }),
    tx.mailThread.count({ where: { createdById: { in: userIds } } }),
    tx.systemAnnouncement.count({ where: { createdBy: { in: userIds } } }),
    tx.storageIntegration.count({ where: { connectedBy: { in: userIds } } }),
  ]);
  const protectedRelationships = {
    officialCopies,
    documentSignatures,
    externalOfficialCopies,
    workspaces,
    mailThreads,
    announcements,
    storageIntegrations,
  };
  if (Object.values(protectedRelationships).some((count) => count > 0)) {
    throw new Error(
      `Protected or unexpected relationships were found: ${JSON.stringify(protectedRelationships)}. No deletion was performed.`,
    );
  }

  const [
    workflowInstances,
    workflowStages,
    workflowTasks,
    taskSubmissions,
    taskSubmissionAttempts,
    reviewerAssignments,
    reviews,
    notifications,
    auditLogs,
  ] = await Promise.all([
    tx.workflowInstance.findMany({
      where: { researchId: { in: projectIds } },
      select: { id: true },
    }),
    tx.workflowStage.findMany({
      where: { workflowId: { in: workflowIds } },
      select: { id: true },
    }),
    tx.workflowTask.findMany({
      where: { stage: { workflowId: { in: workflowIds } } },
      select: { id: true },
    }),
    tx.taskSubmission.findMany({
      where: { researchId: { in: projectIds } },
      select: { id: true },
    }),
    tx.taskSubmissionAttempt.findMany({
      where: { researchId: { in: projectIds } },
      select: { id: true },
    }),
    tx.reviewerAssignment.findMany({
      where: { researchId: { in: projectIds } },
      select: { id: true },
    }),
    tx.review.findMany({
      where: { documentId: { in: documentIds } },
      select: { id: true },
    }),
    tx.notification.findMany({
      where: { recipientId: { in: userIds } },
      select: { id: true },
    }),
    tx.auditLog.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    }),
  ]);
  const entityIds = [
    ...collegeIds,
    ...programIds,
    ...academicYearIds,
    ...userIds,
    ...researchTypeIds,
    ...workflowIds,
    ...projectIds,
    ...documents.map(({ id }) => id),
    ...versionIds,
    ...workflowInstances.map(({ id }) => id),
    ...workflowStages.map(({ id }) => id),
    ...workflowTasks.map(({ id }) => id),
    ...taskSubmissions.map(({ id }) => id),
    ...taskSubmissionAttempts.map(({ id }) => id),
    ...reviewerAssignments.map(({ id }) => id),
    ...reviews.map(({ id }) => id),
    ...notifications.map(({ id }) => id),
  ];

  return {
    roots: {
      colleges,
      programs,
      academicYears,
      users,
      researchTypes,
      workflows,
      projects,
    },
    ids: {
      collegeIds,
      programIds,
      academicYearIds,
      userIds,
      researchTypeIds,
      workflowIds,
      projectIds,
      entityIds,
    },
    counts: {
      ...EXPECTED_COUNTS,
      workflowInstances: workflowInstances.length,
      workflowStages: workflowStages.length,
      workflowTasks: workflowTasks.length,
      documents: documents.length,
      documentVersions: versionIds.length,
      taskSubmissions: taskSubmissions.length,
      taskSubmissionAttempts: taskSubmissionAttempts.length,
      reviewerAssignments: reviewerAssignments.length,
      reviews: reviews.length,
      notifications: notifications.length,
      auditLogs: auditLogs.length,
      officialCopies,
    },
    protectedRelationships,
  };
}

async function executeCleanup(tx, candidates) {
  await tx.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(hashtext('advisio-${fixture.key}-fixture-cleanup'))`,
  );
  const { ids } = candidates;
  await tx.auditLog.deleteMany({
    where: {
      OR: [
        { userId: { in: ids.userIds } },
        { entityId: { in: ids.entityIds } },
      ],
    },
  });
  await tx.researchProject.updateMany({
    where: { id: { in: ids.projectIds } },
    data: { workflowInstanceId: null },
  });
  await tx.workflowInstance.deleteMany({
    where: { researchId: { in: ids.projectIds } },
  });
  await tx.researchProject.deleteMany({
    where: { id: { in: ids.projectIds } },
  });
  await tx.researchType.updateMany({
    where: { id: { in: ids.researchTypeIds } },
    data: { workflowId: null },
  });
  await tx.workflow.deleteMany({ where: { id: { in: ids.workflowIds } } });
  await tx.researchType.deleteMany({
    where: { id: { in: ids.researchTypeIds } },
  });
  await tx.facultyProfile.deleteMany({
    where: { userId: { in: ids.userIds } },
  });
  await tx.userRole.deleteMany({ where: { userId: { in: ids.userIds } } });
  await tx.user.deleteMany({ where: { id: { in: ids.userIds } } });
  await tx.academicYear.deleteMany({
    where: { id: { in: ids.academicYearIds } },
  });
  await tx.program.deleteMany({ where: { id: { in: ids.programIds } } });
  await tx.college.deleteMany({ where: { id: { in: ids.collegeIds } } });

  const remaining = await Promise.all([
    tx.college.count({ where: { id: { in: ids.collegeIds } } }),
    tx.program.count({ where: { id: { in: ids.programIds } } }),
    tx.academicYear.count({ where: { id: { in: ids.academicYearIds } } }),
    tx.user.count({ where: { id: { in: ids.userIds } } }),
    tx.researchType.count({ where: { id: { in: ids.researchTypeIds } } }),
    tx.workflow.count({ where: { id: { in: ids.workflowIds } } }),
    tx.researchProject.count({ where: { id: { in: ids.projectIds } } }),
    tx.auditLog.count({
      where: {
        OR: [
          { userId: { in: ids.userIds } },
          { entityId: { in: ids.entityIds } },
        ],
      },
    }),
  ]);
  const remainingCount = remaining.reduce((sum, count) => sum + count, 0);
  if (remainingCount > 0) {
    throw new Error(
      `Cleanup verification found ${remainingCount} tracked record(s); the transaction will be rolled back.`,
    );
  }
}

async function main() {
  await verifyLiveLocalDatabase(prisma);

  if (!execute) {
    const report = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      return collectCandidates(tx);
    });
    console.log(
      JSON.stringify(
        {
          mode: "DRY RUN",
          target: { databaseName, host: target.hostname, port: target.port },
          counts: report.counts,
          protectedRelationships: report.protectedRelationships,
          projectIds: report.ids.projectIds,
          warning: "No records were changed.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const deletedCounts = await prisma.$transaction(
    async (tx) => {
      const candidates = await collectCandidates(tx);
      await executeCleanup(tx, candidates);
      return candidates.counts;
    },
    { timeout: 120_000 },
  );
  console.log(
    JSON.stringify(
      {
        mode: "EXECUTED",
        target: { databaseName, host: target.hostname, port: target.port },
        deletedFixtureCounts: deletedCounts,
        verification:
          `All tracked ${fixture.label} fixture roots and audit links are absent.`,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
