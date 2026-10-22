import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const apiRoot = fileURLToPath(new URL("../", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const vitestEntry = fileURLToPath(
  new URL("../../../node_modules/vitest/vitest.mjs", import.meta.url),
);
const prismaEntry = fileURLToPath(
  new URL("../../../node_modules/prisma/build/index.js", import.meta.url),
);
const tsxEntry = fileURLToPath(
  new URL("../../../node_modules/tsx/dist/cli.mjs", import.meta.url),
);
const prismaSchema = fileURLToPath(
  new URL("../../../packages/database/prisma/schema.prisma", import.meta.url),
);
const verifier = fileURLToPath(
  new URL("../src/test/verify-integration-database.ts", import.meta.url),
);

if (
  process.env.RUN_DATABASE_INTEGRATION_TESTS !== "1" ||
  process.env.NODE_ENV !== "test"
) {
  console.error(
    "Integration tests require the explicit environment flags RUN_DATABASE_INTEGRATION_TESTS=1 and NODE_ENV=test.",
  );
  process.exit(1);
}

const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;
if (!integrationDatabaseUrl) {
  console.error(
    "INTEGRATION_DATABASE_URL is required and must point to the dedicated advisio_test PostgreSQL database.",
  );
  process.exit(1);
}

let parsedDatabaseUrl;
try {
  parsedDatabaseUrl = new URL(integrationDatabaseUrl);
} catch {
  console.error("INTEGRATION_DATABASE_URL is not a valid URL.");
  process.exit(1);
}

const databaseName = decodeURIComponent(
  parsedDatabaseUrl.pathname.replace(/^\//, ""),
);
const expectedDatabaseName =
  process.env.INTEGRATION_DATABASE_EXPECTED_NAME || "advisio_test";
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);

if (!["postgres:", "postgresql:"].includes(parsedDatabaseUrl.protocol)) {
  console.error("Integration tests require a PostgreSQL database URL.");
  process.exit(1);
}
if (databaseName !== expectedDatabaseName) {
  console.error(
    `Refusing integration target "${databaseName || "unknown"}"; expected "${expectedDatabaseName}".`,
  );
  process.exit(1);
}
if (
  !localHosts.has(parsedDatabaseUrl.hostname.toLowerCase()) &&
  process.env.ALLOW_REMOTE_INTEGRATION_DATABASE !== "1"
) {
  console.error(
    "Refusing to use a remote integration database without ALLOW_REMOTE_INTEGRATION_DATABASE=1.",
  );
  process.exit(1);
}
if (
  parsedDatabaseUrl.searchParams.get("application_name") !==
  "advisio-integration-tests"
) {
  console.error(
    "INTEGRATION_DATABASE_URL must set application_name=advisio-integration-tests.",
  );
  process.exit(1);
}

const integrationEnvironment = {
  ...process.env,
  NODE_ENV: "test",
  RUN_DATABASE_INTEGRATION_TESTS: "1",
  INTEGRATION_TEST_RUN_ID:
    process.env.INTEGRATION_TEST_RUN_ID || crypto.randomUUID(),
  INTEGRATION_DATABASE_EXPECTED_NAME: expectedDatabaseName,
  DATABASE_URL: integrationDatabaseUrl,
  DIRECT_URL: integrationDatabaseUrl,
};

function runNode(entry, args = []) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd: repositoryRoot,
    env: integrationEnvironment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

console.log(
  `Verifying isolated integration database "${databaseName}" on ${parsedDatabaseUrl.hostname}.`,
);
if (runNode(tsxEntry, [verifier]) !== 0) process.exit(1);

console.log("Applying migrations only to the verified integration database.");
if (
  runNode(prismaEntry, ["migrate", "deploy", "--schema", prismaSchema]) !== 0
) {
  process.exit(1);
}

if (runNode(tsxEntry, [verifier, "--assert-clean"]) !== 0) process.exit(1);

console.log(
  "Running database integration suites sequentially to avoid cross-file PostgreSQL contention.",
);
const tests = spawnSync(
  process.execPath,
  [
    vitestEntry,
    "run",
    "src/services/manuscript-lifecycle.integration.test.ts",
    "src/services/reviewer-assignment.integration.test.ts",
    "src/routes/faculty-profile-integration.test.ts",
    "src/routes/defense-workflow.integration.test.ts",
    "src/routes/mail-workspace.integration.test.ts",
    "src/services/audit-remediation.integration.test.ts",
    "--no-file-parallelism",
    "--pool=threads",
  ],
  {
    cwd: apiRoot,
    env: integrationEnvironment,
    stdio: "inherit",
  },
);
if (tests.error) throw tests.error;

console.log("Rechecking the integration database after test teardown.");
const cleanupStatus = runNode(tsxEntry, [verifier, "--assert-clean"]);
if (tests.status !== 0 || cleanupStatus !== 0) {
  process.exitCode = tests.status || cleanupStatus || 1;
}
