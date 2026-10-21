import assert from "node:assert/strict";
import {
  LOCAL_DEMO_ACCOUNTS,
  LOCAL_DEMO_APPLICATION_NAME,
  LOCAL_DEMO_DATABASE_NAME,
  LOCAL_DEMO_DATASET_ID,
  validateLocalDemoEnvironment,
  verifyLocalDemoTarget,
} from "../dist/local-demo.js";

const approvedUrl = `postgresql://advisio_demo_local:test-only@127.0.0.1:5435/${LOCAL_DEMO_DATABASE_NAME}?schema=public&application_name=${LOCAL_DEMO_APPLICATION_NAME}`;

function environment(overrides = {}) {
  return {
    NODE_ENV: "development",
    ADVISIO_LOCAL_DEMO: "1",
    LOCAL_DEMO_EXECUTION: "1",
    LOCAL_DEMO_DATASET_ID,
    LOCAL_DEMO_DATABASE_NAME,
    LOCAL_DEMO_DATABASE_HOST: "127.0.0.1",
    LOCAL_DEMO_DATABASE_PORT: "5435",
    LOCAL_DEMO_CREDENTIALS_FILE: ".demo-local/unit-test.json",
    DATABASE_URL: approvedUrl,
    DIRECT_URL: approvedUrl,
    STORAGE_PROVIDER: "LOCAL",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    GOOGLE_REFRESH_TOKEN: "",
    GOOGLE_REDIRECT_URI: "",
    GOOGLE_DRIVE_FOLDER_ID: "",
    GOOGLE_CALENDAR_ID: "",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "",
    GOOGLE_PRIVATE_KEY: "",
    GOOGLE_SIGN_IN_CLIENT_ID: "",
    VITE_GOOGLE_SIGN_IN_CLIENT_ID: "",
    ...overrides,
  };
}

function client(overrides = {}) {
  return {
    $queryRawUnsafe: async () => [
      {
        databaseName: LOCAL_DEMO_DATABASE_NAME,
        databaseUser: "advisio_demo_local",
        schemaName: "public",
        applicationName: LOCAL_DEMO_APPLICATION_NAME,
        isReplica: false,
        ...overrides,
      },
    ],
  };
}

assert.equal(
  validateLocalDemoEnvironment(environment()).database,
  LOCAL_DEMO_DATABASE_NAME,
);
assert.equal(
  (await verifyLocalDemoTarget(client(), environment())).applicationName,
  LOCAL_DEMO_APPLICATION_NAME,
);
assert.equal(
  LOCAL_DEMO_ACCOUNTS.filter((account) => account.cohort === "role").length,
  10,
);
assert.equal(
  LOCAL_DEMO_ACCOUNTS.filter((account) => account.cohort === "program").length,
  20,
);
assert.deepEqual(
  LOCAL_DEMO_ACCOUNTS.filter((account) => account.cohort === "onboarding")
    .map((account) => account.programCode)
    .sort(),
  ["BSHM", "BSIT", "BSTM"],
);

for (const [name, value, pattern] of [
  ["production", { NODE_ENV: "production" }, /production/],
  [
    "development database",
    {
      DATABASE_URL: approvedUrl.replaceAll(
        "advisio_demo_local",
        "advisio_local",
      ),
    },
    /exactly/,
  ],
  [
    "test port",
    { DATABASE_URL: approvedUrl.replace(":5435/", ":5434/") },
    /exactly/,
  ],
  [
    "remote host",
    {
      DATABASE_URL: approvedUrl.replace("127.0.0.1", "staging.example.invalid"),
    },
    /exactly/,
  ],
  [
    "wrong application",
    {
      DATABASE_URL: approvedUrl.replace(
        LOCAL_DEMO_APPLICATION_NAME,
        "advisio-panel-demo",
      ),
    },
    /approved application name/,
  ],
  [
    "drive credential",
    { GOOGLE_REFRESH_TOKEN: "must-not-be-used" },
    /must be empty/,
  ],
  [
    "drive provider",
    { STORAGE_PROVIDER: "GOOGLE_DRIVE" },
    /STORAGE_PROVIDER=LOCAL/,
  ],
]) {
  assert.throws(
    () => validateLocalDemoEnvironment(environment(value)),
    pattern,
    name,
  );
}

await assert.rejects(
  () =>
    verifyLocalDemoTarget(
      client({ databaseName: "advisio_local" }),
      environment(),
    ),
  /live PostgreSQL identity/,
);
await assert.rejects(
  () => verifyLocalDemoTarget(client({ applicationName: "" }), environment()),
  /live PostgreSQL identity/,
);
await assert.rejects(
  () => verifyLocalDemoTarget(client({ isReplica: true }), environment()),
  /live PostgreSQL identity/,
);

console.log(
  "Local demo target, account coverage, and external-storage safety checks passed.",
);
