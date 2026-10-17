import type { PrismaClient } from "@prisma/client";

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const REQUIRED_APPLICATION_NAME = "advisio-integration-tests";
const DEFAULT_TEST_DATABASE_NAME = "advisio_test";

type IntegrationDatabaseClient = Pick<PrismaClient, "$queryRawUnsafe">;

interface DatabaseIdentityRow {
  databaseName: string;
  databaseUser: string;
  schemaName: string;
  applicationName: string;
  serverAddress: string | null;
  serverPort: number | null;
  isReplica: boolean;
}

export interface IntegrationFixtureScope {
  marker: string;
  databaseVerified: boolean;
  collegeIds: string[];
  programIds: string[];
  academicYearIds: string[];
  userIds: string[];
  researchTypeIds: string[];
  workflowIds: string[];
  projectIds: string[];
}

function parsePostgresUrl(value: string, variableName: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `${variableName} is not a valid PostgreSQL connection string.`,
    );
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error(`${variableName} must use PostgreSQL.`);
  }

  return parsed;
}

function databaseNameFromUrl(parsed: URL): string {
  return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
}

function normalizedConnectionTarget(parsed: URL): string {
  const copy = new URL(parsed.toString());
  copy.searchParams.sort();
  return copy.toString();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function createIntegrationFixtureScope(
  marker: string,
): IntegrationFixtureScope {
  if (!/^[a-z0-9][a-z0-9-]{7,100}$/i.test(marker)) {
    throw new Error("Integration fixture markers must be explicit and unique.");
  }

  return {
    marker,
    databaseVerified: false,
    collegeIds: [],
    programIds: [],
    academicYearIds: [],
    userIds: [],
    researchTypeIds: [],
    workflowIds: [],
    projectIds: [],
  };
}

export async function assertIsolatedIntegrationDatabase(
  client: IntegrationDatabaseClient,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<DatabaseIdentityRow> {
  if (environment.RUN_DATABASE_INTEGRATION_TESTS !== "1") {
    throw new Error(
      "Database integration tests require RUN_DATABASE_INTEGRATION_TESTS=1.",
    );
  }
  if (environment.NODE_ENV !== "test") {
    throw new Error("Database integration tests require NODE_ENV=test.");
  }
  if (!environment.INTEGRATION_TEST_RUN_ID) {
    throw new Error(
      "Database integration tests require INTEGRATION_TEST_RUN_ID.",
    );
  }

  const integrationUrlValue = environment.INTEGRATION_DATABASE_URL;
  const databaseUrlValue = environment.DATABASE_URL;
  const directUrlValue = environment.DIRECT_URL;
  if (!integrationUrlValue || !databaseUrlValue || !directUrlValue) {
    throw new Error(
      "INTEGRATION_DATABASE_URL, DATABASE_URL, and DIRECT_URL are all required for database integration tests.",
    );
  }

  const integrationUrl = parsePostgresUrl(
    integrationUrlValue,
    "INTEGRATION_DATABASE_URL",
  );
  const databaseUrl = parsePostgresUrl(databaseUrlValue, "DATABASE_URL");
  const directUrl = parsePostgresUrl(directUrlValue, "DIRECT_URL");
  const integrationTarget = normalizedConnectionTarget(integrationUrl);
  if (
    normalizedConnectionTarget(databaseUrl) !== integrationTarget ||
    normalizedConnectionTarget(directUrl) !== integrationTarget
  ) {
    throw new Error(
      "DATABASE_URL and DIRECT_URL must point to the exact INTEGRATION_DATABASE_URL target.",
    );
  }

  const expectedDatabaseName =
    environment.INTEGRATION_DATABASE_EXPECTED_NAME ||
    DEFAULT_TEST_DATABASE_NAME;
  const configuredDatabaseName = databaseNameFromUrl(integrationUrl);
  if (configuredDatabaseName !== expectedDatabaseName) {
    throw new Error(
      `Refusing integration target "${configuredDatabaseName || "unknown"}"; expected the dedicated database "${expectedDatabaseName}".`,
    );
  }
  if (
    !LOCAL_DATABASE_HOSTS.has(integrationUrl.hostname.toLowerCase()) &&
    environment.ALLOW_REMOTE_INTEGRATION_DATABASE !== "1"
  ) {
    throw new Error(
      "Refusing a remote integration database without ALLOW_REMOTE_INTEGRATION_DATABASE=1.",
    );
  }
  if (
    integrationUrl.searchParams.get("application_name") !==
    REQUIRED_APPLICATION_NAME
  ) {
    throw new Error(
      `The integration database URL must set application_name=${REQUIRED_APPLICATION_NAME}.`,
    );
  }

  const rows = await client.$queryRawUnsafe<DatabaseIdentityRow[]>(`
    SELECT
      current_database() AS "databaseName",
      current_user AS "databaseUser",
      current_schema() AS "schemaName",
      current_setting('application_name') AS "applicationName",
      inet_server_addr()::text AS "serverAddress",
      inet_server_port() AS "serverPort",
      pg_is_in_recovery() AS "isReplica"
  `);
  const identity = rows[0];
  if (!identity) {
    throw new Error("Could not verify the live integration database identity.");
  }

  const expectedUser = decodeURIComponent(integrationUrl.username);
  if (
    identity.databaseName !== expectedDatabaseName ||
    identity.databaseUser !== expectedUser ||
    identity.schemaName !== "public" ||
    identity.applicationName !== REQUIRED_APPLICATION_NAME ||
    identity.isReplica
  ) {
    throw new Error(
      "The live PostgreSQL connection does not match the verified writable Advisio integration-test identity.",
    );
  }

  return identity;
}

export async function cleanupIntegrationFixture(
  client: PrismaClient,
  fixture: IntegrationFixtureScope,
): Promise<void> {
  const rootIds = [
    ...fixture.collegeIds,
    ...fixture.programIds,
    ...fixture.academicYearIds,
    ...fixture.userIds,
    ...fixture.researchTypeIds,
    ...fixture.workflowIds,
    ...fixture.projectIds,
  ];
  if (rootIds.length === 0) return;
  if (!fixture.databaseVerified) {
    throw new Error(
      `Refusing cleanup for ${fixture.marker}: the live test database was not verified.`,
    );
  }

  await assertIsolatedIntegrationDatabase(client);
  const projectIds = unique(fixture.projectIds);
  const officialCopyCount = projectIds.length
    ? await client.officialCopy.count({
        where: { researchId: { in: projectIds } },
      })
    : 0;
  if (officialCopyCount > 0) {
    throw new Error(
      `Refusing cleanup for ${fixture.marker}: it unexpectedly owns ${officialCopyCount} official archive record(s).`,
    );
  }

  const userIds = unique(fixture.userIds);
  const workflowIds = unique(fixture.workflowIds);
  const researchTypeIds = unique(fixture.researchTypeIds);
  const entityIds = unique(rootIds);

  await client.$transaction(async (tx) => {
    if (userIds.length || entityIds.length) {
      await tx.auditLog.deleteMany({
        where: {
          OR: [
            ...(userIds.length ? [{ userId: { in: userIds } }] : []),
            ...(entityIds.length ? [{ entityId: { in: entityIds } }] : []),
          ],
        },
      });
    }
    if (projectIds.length) {
      await tx.researchProject.updateMany({
        where: { id: { in: projectIds } },
        data: { workflowInstanceId: null },
      });
      await tx.workflowInstance.deleteMany({
        where: { researchId: { in: projectIds } },
      });
      await tx.researchProject.deleteMany({
        where: { id: { in: projectIds } },
      });
    }
    if (researchTypeIds.length) {
      await tx.researchType.updateMany({
        where: { id: { in: researchTypeIds } },
        data: { workflowId: null },
      });
    }
    if (workflowIds.length) {
      await tx.workflow.deleteMany({ where: { id: { in: workflowIds } } });
    }
    if (researchTypeIds.length) {
      await tx.researchType.deleteMany({
        where: { id: { in: researchTypeIds } },
      });
    }
    if (userIds.length) {
      await tx.facultyProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await tx.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const academicYearIds = unique(fixture.academicYearIds);
    if (academicYearIds.length) {
      await tx.academicYear.deleteMany({
        where: { id: { in: academicYearIds } },
      });
    }
    const programIds = unique(fixture.programIds);
    if (programIds.length) {
      await tx.program.deleteMany({ where: { id: { in: programIds } } });
    }
    const collegeIds = unique(fixture.collegeIds);
    if (collegeIds.length) {
      await tx.college.deleteMany({ where: { id: { in: collegeIds } } });
    }
  });

  const remainingRootCount =
    (fixture.collegeIds.length
      ? await client.college.count({
          where: { id: { in: unique(fixture.collegeIds) } },
        })
      : 0) +
    (fixture.programIds.length
      ? await client.program.count({
          where: { id: { in: unique(fixture.programIds) } },
        })
      : 0) +
    (fixture.academicYearIds.length
      ? await client.academicYear.count({
          where: { id: { in: unique(fixture.academicYearIds) } },
        })
      : 0) +
    (fixture.userIds.length
      ? await client.user.count({
          where: { id: { in: unique(fixture.userIds) } },
        })
      : 0) +
    (fixture.researchTypeIds.length
      ? await client.researchType.count({
          where: { id: { in: unique(fixture.researchTypeIds) } },
        })
      : 0) +
    (fixture.workflowIds.length
      ? await client.workflow.count({
          where: { id: { in: unique(fixture.workflowIds) } },
        })
      : 0) +
    (fixture.projectIds.length
      ? await client.researchProject.count({
          where: { id: { in: unique(fixture.projectIds) } },
        })
      : 0);

  if (remainingRootCount > 0) {
    throw new Error(
      `Integration fixture cleanup for ${fixture.marker} left ${remainingRootCount} tracked root record(s).`,
    );
  }
}
