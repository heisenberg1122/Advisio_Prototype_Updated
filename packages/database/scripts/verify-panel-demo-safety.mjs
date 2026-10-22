import assert from "node:assert/strict";
import {
  assertPanelDemoCleanupEligible,
  validateReviewedExistingUsers,
  verifyPanelDemoTarget,
} from "../dist/panel-demo.js";

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

const reviewedTarget = {
  databaseName: "advisio_staging",
  host: "staging.example.invalid",
  schema: "public",
};
const reviewedStudents = [
  {
    id: "4ddc0668-d7c7-4baf-a69d-1a0a1be3c9fa",
    email: "student-1846@example.invalid",
    universityId: "2023001846",
    status: "PENDING",
    roles: [{ role: { name: "RESEARCHER" } }],
  },
  {
    id: "7d6d3061-5c2a-4cf4-9917-02dd36248247",
    email: "student-1847@example.invalid",
    universityId: "2023001847",
    status: "PENDING",
    roles: [{ role: { name: "RESEARCHER" } }],
  },
];
const reviewedAllowlist = {
  format: "advisio-panel-demo-existing-users-v1",
  target: reviewedTarget,
  users: reviewedStudents.map((user) => ({
    id: user.id,
    email: user.email,
    universityId: user.universityId,
    status: user.status,
    roles: ["RESEARCHER"],
  })),
};
validateReviewedExistingUsers(
  reviewedStudents,
  reviewedAllowlist,
  reviewedTarget,
);
await assert.rejects(
  async () =>
    validateReviewedExistingUsers(
      [
        ...reviewedStudents,
        {
          id: "f05ef4f1-2114-40fb-8a0a-64894ee87ba0",
          email: "unreviewed@example.invalid",
          universityId: "2023999999",
          status: "PENDING",
          roles: [{ role: { name: "RESEARCHER" } }],
        },
      ],
      reviewedAllowlist,
      reviewedTarget,
    ),
  /Unexpected user records/,
);
await assert.rejects(
  async () =>
    validateReviewedExistingUsers(
      [
        {
          ...reviewedStudents[0],
          status: "ACTIVE",
        },
        reviewedStudents[1],
      ],
      reviewedAllowlist,
      reviewedTarget,
    ),
  /Unexpected user records/,
);
assert.throws(
  () =>
    assertPanelDemoCleanupEligible(
      { groupName: marker, documents: [], officialCopies: [{}] },
      marker,
    ),
  /official archive/,
);
assert.throws(
  () =>
    assertPanelDemoCleanupEligible(
      { groupName: "PANEL-DEMO-OTHER", documents: [], officialCopies: [] },
      marker,
    ),
  /marker does not match/,
);
assert.doesNotThrow(() =>
  assertPanelDemoCleanupEligible(
    { groupName: marker, documents: [], officialCopies: [] },
    marker,
  ),
);

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
  /PANEL_DEMO_EXISTING_USER_ALLOWLIST_FILE is required/,
);

console.log("Panel-demo safety guard unit checks passed.");
