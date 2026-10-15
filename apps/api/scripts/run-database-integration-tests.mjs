import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const apiRoot = fileURLToPath(new URL("../", import.meta.url));
const vitestEntry = fileURLToPath(
  new URL("../../../node_modules/vitest/vitest.mjs", import.meta.url),
);

console.log(
  "Running database integration suites sequentially to avoid cross-file contention between serializable PostgreSQL transactions.",
);

const result = spawnSync(
  process.execPath,
  [
    vitestEntry,
    "run",
    "src/services/manuscript-lifecycle.integration.test.ts",
    "src/services/reviewer-assignment.integration.test.ts",
    "--no-file-parallelism",
  ],
  {
    cwd: apiRoot,
    env: {
      ...process.env,
      RUN_DATABASE_INTEGRATION_TESTS: "1",
    },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
