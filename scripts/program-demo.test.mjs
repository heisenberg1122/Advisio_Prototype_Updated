import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NURSING_STAGES,
  nursingGuideParagraphs,
} from "./program-demo-nursing.mjs";
import {
  DATASET,
  PROGRAMS,
  accounts,
  milestones,
  validateTarget,
  assertOwnedRoots,
  demoPassword,
  facultyMembership,
  accountName,
} from "./program-demo-catalog.mjs";

test("four programs have 56 distinct role-specific logins and two disjoint four-student groups", () => {
  const rows = accounts();
  assert.equal(rows.length, 56);
  assert.equal(new Set(rows.map((a) => a.email)).size, 56);
  assert.equal(new Set(rows.map((a) => a.universityId)).size, 56);
  for (const program of PROGRAMS) {
    const a = rows.filter((a) => a.program === program.code);
    assert.equal(a.length, 14);
    assert.equal(a.filter((a) => a.role === "RESEARCHER").length, 8);
    assert.equal(a.filter((a) => a.role === "PANELIST").length, 3);
    for (const role of ["DEAN", "ADVISER", "RESEARCH_COORDINATOR"])
      assert.equal(a.filter((a) => a.role === role).length, 1);
    assert.ok(
      a.every(
        (a) =>
          a.email.endsWith("@demo.advisio.invalid") &&
          !Object.hasOwn(a, "password"),
      ),
    );
  }
});

test("department workflows preserve their defense sequence, adviser and title steps, and final submission", () => {
  for (const program of PROGRAMS) {
    const stages = milestones(program);
    assert.equal(stages.length, 10);
    assert.deepEqual(
      stages.filter((s) => s.type === "DEFENSE_ELIGIBILITY").map((s) => s.name),
      program.code === "BEED"
        ? ["Final defense eligibility and manuscript approval"]
        : [
            "Proposal defense eligibility and manuscript approval",
            "Final defense eligibility and manuscript approval",
          ],
    );
    if (program.code !== "BEED")
      assert.equal(stages[3].type, "DEFENSE_ELIGIBILITY");
    assert.equal(stages[7].type, "DEFENSE_ELIGIBILITY");
    assert.equal(stages.at(-1).role, "DEAN");
    assert.equal(
      stages.filter((s) => s.type === "ADVISER_SELECTION").length,
      1,
    );
    assert.equal(stages.filter((s) => s.type === "TITLE_PROPOSAL").length, 1);
  }
  assert.equal(
    milestones(PROGRAMS.find((p) => p.code === "BEED"))[0].type,
    "TITLE_PROPOSAL",
  );
  assert.match(
    milestones(PROGRAMS.find((p) => p.code === "BEED"))[3].name,
    /UAREB/,
  );
});

test("provisioning rejects undeclared/mismatched targets, evaluation sessions and unverified remote connections", () => {
  const env = {
    PROGRAM_DEMO_DATABASE_URL:
      "postgresql://demo:password@db.example.invalid/live?sslmode=require&sslaccept=strict",
    PROGRAM_DEMO_EXPECTED_HOST: "db.example.invalid",
    PROGRAM_DEMO_EXPECTED_DATABASE: "live",
    PROGRAM_DEMO_LIVE_CONFIRMATION: `CREATE:${DATASET}`,
  };
  assert.equal(validateTarget(env).database, "live");
  for (const override of [
    { PROGRAM_DEMO_DATABASE_URL: "" },
    { PROGRAM_DEMO_EXPECTED_HOST: "other.invalid" },
    { PROGRAM_DEMO_EXPECTED_DATABASE: "other" },
    { PROGRAM_DEMO_LIVE_CONFIRMATION: "" },
    { ADVISIO_EVALUATION: "1" },
    {
      PROGRAM_DEMO_DATABASE_URL:
        "postgresql://demo:password@db.example.invalid/live?sslmode=require",
    },
    {
      PROGRAM_DEMO_DATABASE_URL:
        "postgresql://demo:password@db.example.invalid/live?schema=other&sslmode=verify-full",
    },
  ])
    assert.throws(() => validateTarget({ ...env, ...override }));
  const local = {
    PROGRAM_DEMO_DATABASE_URL: "postgresql://demo:password@127.0.0.1/test",
    PROGRAM_DEMO_EXPECTED_HOST: "127.0.0.1",
    PROGRAM_DEMO_EXPECTED_DATABASE: "test",
  };
  assert.equal(validateTarget(local).local, true);
  assert.throws(() =>
    validateTarget({ DATABASE_URL: local.PROGRAM_DEMO_DATABASE_URL }),
  );
});

test("demo passwords are private, explicitly supplied and do not change login rules", () => {
  assert.throws(() => demoPassword(PROGRAMS[0], {}));
  assert.throws(() =>
    demoPassword(PROGRAMS[0], { PROGRAM_DEMO_BSN_PASSWORD: "123" }),
  );
  assert.equal(
    demoPassword(PROGRAMS[0], { PROGRAM_DEMO_BSN_PASSWORD: "Sample123?" }),
    "Sample123?",
  );
});

test("student accounts use academic fields and only faculty receive college memberships", () => {
  const rows = accounts();
  assert.equal(
    rows.filter((a) => facultyMembership(a, "college-id")).length,
    24,
  );
  for (const account of rows) {
    const membership = facultyMembership(account, "college-id");
    if (account.role === "RESEARCHER") assert.equal(membership, undefined);
    else
      assert.deepEqual(membership, {
        create: { collegeId: "college-id", roleNames: [account.role] },
      });
  }
});

function owned() {
  const a = accounts()[0];
  return {
    users: [
      {
        id: "u",
        email: a.email,
        universityId: a.universityId,
        firstName: "Demo",
        googleSubject: null,
        roles: [{ role: { name: a.role } }],
      },
    ],
    types: [{ id: "t", code: "DEMO4-BSN", workflowId: "w" }],
    workflows: [
      { id: "w", name: `${DATASET} BSN`, createdBy: "u", researchTypeId: "t" },
    ],
    projects: [
      {
        id: "p",
        createdBy: "u",
        researchTypeId: "t",
        groupName: `${DATASET}:BSN:A`,
        workflowInstance: { workflowId: "w" },
        members: [{ userId: "u" }],
        officialCopies: [],
      },
    ],
    workspaces: [
      { createdBy: "u", members: [{ userId: "u" }], projects: [{ id: "p" }] },
    ],
  };
}

test("cleanup refuses changed identities, real group members, unrelated ownership, archive records and linked workspaces", () => {
  assert.doesNotThrow(() => assertOwnedRoots(owned()));
  for (const mutate of [
    (r) => (r.users[0].universityId = "REAL-USER"),
    (r) => (r.users[0].googleSubject = "real-google-identity"),
    (r) => r.users[0].roles.push({ role: { name: "SYSTEM_ADMIN" } }),
    (r) => r.projects[0].members.push({ userId: "real-student" }),
    (r) => r.projects[0].officialCopies.push({ id: "official" }),
    (r) => (r.projects[0].createdBy = "real-user"),
    (r) => (r.workflows[0].createdBy = "real-professor"),
    (r) => r.workspaces[0].projects.push({ id: "real-project" }),
    (r) => (r.types[0].workflowId = "real-workflow"),
  ]) {
    const data = owned();
    mutate(data);
    assert.throws(() => assertOwnedRoots(data));
  }
});

test("named dean and student demos preserve exact cleanup identity checks", () => {
  for (const account of accounts().filter((a) => a.role === "DEAN")) {
    const roots = {
      users: [
        {
          id: "dean",
          ...account,
          ...accountName(account),
          roles: [{ role: { name: "DEAN" } }],
        },
      ],
      types: [],
      workflows: [],
      projects: [],
      workspaces: [],
    };
    assert.doesNotThrow(() => assertOwnedRoots(roots));
    roots.users[0].lastName = "Unrelated";
    assert.throws(() => assertOwnedRoots(roots));
  }
  const roots = owned();
  const name = { firstName: "Sample", middleName: null, lastName: "Student" };
  Object.assign(roots.users[0], name);
  assert.throws(() => assertOwnedRoots(roots));
  roots.users[0].approvedDemoName = name;
  assert.doesNotThrow(() => assertOwnedRoots(roots));
  roots.users[0].firstName = "Changed";
  assert.throws(() => assertOwnedRoots(roots));
});

test("Nursing interview separates mock proposal, data gathering, defense, execution and implementation", () => {
  assert.deepEqual(
    NURSING_STAGES.map((s) => s.name),
    [
      "Adviser selection and acceptance",
      "Research title proposal",
      "Mock proposal",
      "Proposal",
      "Data gathering",
      "Final defense eligibility and manuscript approval",
      "Defense result and required corrections",
      "Project execution / research colloquium",
      "Research implementation",
      "Final manuscript approval and archive submission",
    ],
  );
  assert.equal(
    NURSING_STAGES.filter((s) => s.type === "DEFENSE_ELIGIBILITY").length,
    1,
  );
  assert.deepEqual(
    NURSING_STAGES.filter((s) => !s.legacy).map((s) => s.name),
    [
      "Mock proposal",
      "Project execution / research colloquium",
      "Research implementation",
    ],
  );
  assert.match(nursingGuideParagraphs().join(" "), /exactly four members/);
  assert.match(nursingGuideParagraphs().join(" "), /not an official UA manual/);
});
