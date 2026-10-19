import assert from "node:assert/strict";
import { verifyPanelDemoTarget } from "../dist/panel-demo.js";

const marker = "PANEL-DEMO-UNIT-20261020";
const url = new URL("postgresql://127.0.0.1:5432/advisio_staging");
url.username = "panel_demo";
url.password = "test-only";
url.searchParams.set("schema", "public");
url.searchParams.set("application_name", "advisio-panel-demo");

function environment(overrides = {}) {
  return {
    NODE_ENV: "staging",
    PANEL_DEMO_EXECUTION: "1",
    PANEL_DEMO_RUN_ID: marker,
    PANEL_DEMO_DATABASE_NAME: "advisio_staging",
    PANEL_DEMO_DATABASE_HOST: "127.0.0.1",
    PANEL_DEMO_DATABASE_URL: url.toString(),
    DATABASE_URL: url.toString(),
    DIRECT_URL: url.toString(),
    PANEL_DEMO_ADMIN_EMAIL: "staging-admin@example.invalid",
    ALLOW_DEMO_ACCOUNT_PROVISIONING: "false",
    ALLOW_THEME_DEMO_ACCOUNTS: "false",
    ...overrides,
  };
}

function client(overrides = {}) {
  const users = overrides.users || [
    {
      id: "admin-id",
      email: "staging-admin@example.invalid",
      universityId: "STAGING-ADMIN-001",
      roles: [{ role: { name: "SYSTEM_ADMIN" } }],
    },
  ];
  return {
    $queryRawUnsafe: async () => [
      {
        databaseName: "advisio_staging",
        databaseUser: "panel_demo",
        schemaName: "public",
        applicationName: "advisio-panel-demo",
        isReplica: false,
      },
    ],
    role: {
      findMany: async () =>
        [
          "RESEARCHER",
          "ADVISER",
          "RESEARCH_COORDINATOR",
          "PANELIST",
          "RPO",
          "SYSTEM_ADMIN",
        ].map((name) => ({ id: name, name })),
    },
    college: {
      findMany: async () =>
        ["COA", "CEA", "CHTM", "CNP", "SAS", "SBPA", "SOE", "SHS", "CIT"].map(
          (code) => ({ id: code, code }),
        ),
    },
    program: {
      findMany: async () =>
        Array.from({ length: 20 }, (_, index) => ({
          id: `program-${index}`,
          code: index === 0 ? "BSIT" : `PROGRAM-${index}`,
          collegeId: index === 0 ? "CIT" : "COA",
          college: { code: index === 0 ? "CIT" : "COA" },
        })),
    },
    academicYear: {
      findMany: async () =>
        overrides.years ?? [{ id: "ay-id", name: "2026-2027" }],
    },
    user: { findMany: async () => users },
    researchProject: { findMany: async () => overrides.projects ?? [] },
    workflow: { findMany: async () => overrides.workflows ?? [] },
    researchType: { findMany: async () => overrides.researchTypes ?? [] },
  };
}

const accepted = await verifyPanelDemoTarget(client(), environment());
assert.equal(accepted.academicYear.name, "2026-2027");

await assert.rejects(
  () =>
    verifyPanelDemoTarget(client(), environment({ NODE_ENV: "production" })),
  /NODE_ENV=staging/,
);
await assert.rejects(
  () => verifyPanelDemoTarget(client({ years: [] }), environment()),
  /Academic Year/,
);
await assert.rejects(
  () =>
    verifyPanelDemoTarget(
      client({
        users: [
          {
            id: "admin-id",
            email: "staging-admin@example.invalid",
            universityId: "STAGING-ADMIN-001",
            roles: [{ role: { name: "SYSTEM_ADMIN" } }],
          },
          {
            id: "unexpected",
            email: "person@example.invalid",
            universityId: "OTHER",
            roles: [],
          },
        ],
      }),
      environment(),
    ),
  /Unexpected user/,
);

console.log("Panel-demo safety guard unit checks passed.");
