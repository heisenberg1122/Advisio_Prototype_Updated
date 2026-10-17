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
const prismaSchema = fileURLToPath(
  new URL("../../../packages/database/prisma/schema.prisma", import.meta.url),
);

const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;
if (!integrationDatabaseUrl) {
  console.error(
    "INTEGRATION_DATABASE_URL is required. Point it to a dedicated PostgreSQL database whose name contains 'test'.",
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
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);

if (!["postgres:", "postgresql:"].includes(parsedDatabaseUrl.protocol)) {
  console.error("Integration tests require a PostgreSQL database URL.");
  process.exit(1);
}
if (!databaseName.toLowerCase().includes("test")) {
  console.error(
    `Refusing to run integration tests against non-test database "${databaseName || "unknown"}".`,
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

const integrationEnvironment = {
  ...process.env,
  NODE_ENV: "test",
  RUN_DATABASE_INTEGRATION_TESTS: "1",
  DATABASE_URL: integrationDatabaseUrl,
  DIRECT_URL: integrationDatabaseUrl,
};

console.log(
  `Preparing isolated integration database "${databaseName}" on ${parsedDatabaseUrl.hostname}.`,
);
const migration = spawnSync(
  process.execPath,
  [prismaEntry, "migrate", "deploy", "--schema", prismaSchema],
  {
    cwd: repositoryRoot,
    env: integrationEnvironment,
    stdio: "inherit",
  },
);

if (migration.error) throw migration.error;
if (migration.status !== 0) {
  process.exitCode = migration.status ?? 1;
} else {
  console.log(
    "Running database integration suites sequentially to avoid cross-file PostgreSQL contention.",
  );
  const result = spawnSync(
    process.execPath,
    [
      vitestEntry,
      "run",
      "src/services/manuscript-lifecycle.integration.test.ts",
      "src/services/reviewer-assignment.integration.test.ts",
      "src/routes/faculty-profile-integration.test.ts",
      "--no-file-parallelism",
    ],
    {
      cwd: apiRoot,
      env: integrationEnvironment,
      stdio: "inherit",
    },
  );

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
