import crypto from "node:crypto";
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { InstitutionalRole } from "@research-management/auth";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { generateToken, type AuthenticatedUser } from "../middleware/auth.js";
import { resolveRegistrationWorkflow } from "../services/registration-workflow.service.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

databaseDescribe("Research cohort management boundaries", () => {
  const marker = `cohort-api-${crypto.randomUUID().slice(0, 8)}`;
  const fixture = createIntegrationFixtureScope(marker);
  const cohortIds: string[] = [];
  let server: http.Server, base: string;
  let college: string,
    otherCollege: string,
    program: string,
    siblingProgram: string,
    foreignProgram: string;
  let type: string,
    siblingType: string,
    foreignType: string,
    year: string,
    inactiveYear: string;
  let coordinator: string,
    siblingCoordinator: string,
    foreignCoordinator: string,
    dean: string,
    admin: string;
  let student: string,
    teammate: string,
    outsideStudent: string,
    inactiveStudent: string,
    adviser: string,
    unassigned: string;
  let workflow: string, draftWorkflow: string, mismatchWorkflow: string;

  async function api(
    actor: string | null,
    path: string,
    method = "GET",
    body?: unknown,
    researcherPanel = false,
  ) {
    const response = await fetch(base + "/api/cohorts" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(actor ? { Authorization: `Bearer ${generateToken(actor)}` } : {}),
        ...(researcherPanel ? { "X-Advisio-Panel": "researcher" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const result = response.headers
      .get("content-type")
      ?.includes("application/json")
      ? await response.json()
      : { text: await response.text() };
    return { status: response.status, body: result as any };
  }
  const payload = () => ({
    name: marker,
    collegeId: college,
    programId: program,
    researchTypeId: type,
    academicYearId: year,
  });
  async function create(actor = coordinator, extra = {}) {
    const result = await api(actor, "", "POST", { ...payload(), ...extra });
    if (result.status === 201) cohortIds.push(result.body.cohort.id);
    return result;
  }

  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    fixture.databaseVerified = true;
    for (const suffix of ["main", "outside"]) {
      const row = await prisma.college.create({
        data: {
          code: `${marker.slice(-8)}-${suffix}`,
          name: `${marker}-${suffix}`,
        },
      });
      fixture.collegeIds.push(row.id);
    }
    [college, otherCollege] = fixture.collegeIds;
    for (const [suffix, collegeId] of [
      ["main", college],
      ["sibling", college],
      ["foreign", otherCollege],
    ]) {
      const row = await prisma.program.create({
        data: { collegeId, code: suffix, name: `${marker}-${suffix}` },
      });
      fixture.programIds.push(row.id);
    }
    [program, siblingProgram, foreignProgram] = fixture.programIds;
    for (const [index, programId] of [
      program,
      siblingProgram,
      foreignProgram,
    ].entries()) {
      const row = await prisma.researchType.create({
        data: { programId, code: marker.slice(-8), name: `${marker}-${index}` },
      });
      fixture.researchTypeIds.push(row.id);
    }
    [type, siblingType, foreignType] = fixture.researchTypeIds;
    for (const isActive of [true, false]) {
      const row = await prisma.academicYear.create({
        data: {
          name: `C2-${marker.slice(-8)}-${isActive ? "A" : "I"}`,
          isActive,
          startDate: new Date("2098-01-01"),
          endDate: new Date("2098-12-31"),
        },
      });
      fixture.academicYearIds.push(row.id);
    }
    [year, inactiveYear] = fixture.academicYearIds;
    async function actor(
      name: string,
      roles: InstitutionalRole[],
      programId: string | null = program,
      collegeId: string | null = college,
      status: "ACTIVE" | "INACTIVE" = "ACTIVE",
    ) {
      const roleIds = [];
      for (const name of roles)
        roleIds.push(
          (
            await prisma.role.upsert({
              where: { name },
              update: {},
              create: { name },
            })
          ).id,
        );
      const row = await prisma.user.create({
        data: {
          universityId: `${marker}-${name}`,
          email: `${marker}-${name}@isolated.test`,
          firstName: name,
          lastName: marker,
          status,
          programId,
          collegeId,
          roles: { create: roleIds.map((roleId) => ({ roleId })) },
        },
      });
      fixture.userIds.push(row.id);
      return row.id;
    }
    coordinator = await actor("coordinator", [
      "RESEARCH_COORDINATOR",
      "RESEARCHER",
    ]);
    siblingCoordinator = await actor(
      "sibling-coordinator",
      ["RESEARCH_COORDINATOR"],
      siblingProgram,
    );
    foreignCoordinator = await actor(
      "foreign-coordinator",
      ["RESEARCH_COORDINATOR"],
      foreignProgram,
      otherCollege,
    );
    dean = await actor("dean", ["DEAN"], siblingProgram);
    admin = await actor("admin", ["SYSTEM_ADMIN"], null, null);
    student = await actor("student", ["RESEARCHER"]);
    teammate = await actor("teammate", ["RESEARCHER"]);
    outsideStudent = await actor(
      "outside-student",
      ["RESEARCHER"],
      siblingProgram,
    );
    inactiveStudent = await actor(
      "inactive",
      ["RESEARCHER"],
      program,
      college,
      "INACTIVE",
    );
    adviser = await actor("adviser", ["ADVISER"]);
    unassigned = await actor(
      "unassigned",
      ["RESEARCH_COORDINATOR"],
      null,
      null,
    );
    async function process(
      status: "DRAFT" | "PUBLISHED",
      researchTypeId: string,
      version: number,
    ) {
      const row = await prisma.workflow.create({
        data: {
          name: marker,
          status,
          researchTypeId,
          version,
          createdBy: coordinator,
        },
      });
      fixture.workflowIds.push(row.id);
      return row.id;
    }
    workflow = await process("PUBLISHED", type, 1);
    draftWorkflow = await process("DRAFT", type, 2);
    mismatchWorkflow = await process("PUBLISHED", siblingType, 1);
    server = http.createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  }, 30000);

  afterAll(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (fixture.databaseVerified) {
      await prisma.researchCohort.deleteMany({
        where: { id: { in: cohortIds } },
      });
      expect(
        await prisma.researchCohortMember.count({
          where: { cohortId: { in: cohortIds } },
        }),
      ).toBe(0);
      await cleanupIntegrationFixture(prisma, fixture);
    }
  }, 30000);

  it("requires authentication, rejects unrelated roles, and validates explicit contracts", async () => {
    expect((await api(null, "")).status).toBe(401);
    expect((await api(adviser, "")).status).toBe(403);
    expect((await create(student)).status).toBe(403);
    expect((await create(coordinator, { workflowId: workflow })).status).toBe(
      400,
    );
    expect((await create(coordinator, { createdBy: admin })).status).toBe(400);
    expect((await api(coordinator, "/not-a-uuid")).status).toBe(400);
    expect((await api(coordinator, "?limit=101")).status).toBe(400);
  });

  it("validates active academic identity and rejects unassigned or cross-scope management", async () => {
    expect((await create(unassigned)).status).toBe(403);
    expect(
      (await create(coordinator, { researchTypeId: siblingType })).status,
    ).toBe(400);
    expect(
      (await create(coordinator, { academicYearId: inactiveYear })).status,
    ).toBe(400);
    expect(
      (
        await create(coordinator, {
          collegeId: otherCollege,
          programId: foreignProgram,
          researchTypeId: foreignType,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await create(dean, {
          collegeId: otherCollege,
          programId: foreignProgram,
          researchTypeId: foreignType,
        })
      ).status,
    ).toBe(403);
  });

  it("intersects listing/detail/roster scope for coordinators, deans, and administrators", async () => {
    const main = (await create()).body.cohort;
    const sibling = (
      await create(siblingCoordinator, {
        programId: siblingProgram,
        researchTypeId: siblingType,
      })
    ).body.cohort;
    const outside = (
      await create(admin, {
        collegeId: otherCollege,
        programId: foreignProgram,
        researchTypeId: foreignType,
      })
    ).body.cohort;
    const ids = (result: Awaited<ReturnType<typeof api>>) =>
      result.body.cohorts.map((row: any) => row.id);
    expect(ids(await api(coordinator, ""))).toContain(main.id);
    expect(ids(await api(coordinator, ""))).not.toContain(sibling.id);
    expect(ids(await api(coordinator, `?collegeId=${otherCollege}`))).toEqual(
      [],
    );
    expect(ids(await api(dean, ""))).toEqual(
      expect.arrayContaining([main.id, sibling.id]),
    );
    expect(ids(await api(dean, ""))).not.toContain(outside.id);
    expect(ids(await api(admin, ""))).toEqual(
      expect.arrayContaining([main.id, sibling.id, outside.id]),
    );
    expect((await api(coordinator, `/${sibling.id}`)).status).toBe(404);
    expect((await api(foreignCoordinator, `/${main.id}/members`)).status).toBe(
      404,
    );
    expect(
      (await api(dean, `/${outside.id}`, "PATCH", { name: "Cross-scope edit" }))
        .status,
    ).toBe(404);
    expect(
      (await api(admin, `/${outside.id}`, "PATCH", { name: "Authorized edit" }))
        .status,
    ).toBe(200);
  });

  it("assigns only a matching published process without touching the research-type default", async () => {
    const id = (await create()).body.cohort.id;
    expect(
      (
        await api(coordinator, `/${id}/workflow`, "PUT", {
          workflowId: draftWorkflow,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await api(coordinator, `/${id}/workflow`, "PUT", {
          workflowId: mismatchWorkflow,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api(coordinator, `/${id}/workflow`, "PUT", {
          workflowId: crypto.randomUUID(),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await api(coordinator, `/${id}/workflow`, "PUT", {
          workflowId: workflow,
        })
      ).body.cohort.workflowId,
    ).toBe(workflow);
    expect(
      (await prisma.researchType.findUniqueOrThrow({ where: { id: type } }))
        .workflowId,
    ).toBeNull();
    expect(
      (await api(coordinator, `/${id}`, "PATCH", { workflowId: workflow }))
        .status,
    ).toBe(400);
    expect(
      (await api(coordinator, `/${id}`, "PATCH", { programId: siblingProgram }))
        .status,
    ).toBe(400);
  });

  it("enforces activation, closure, reopening, and terminal archival without generic deletion", async () => {
    const id = (await create()).body.cohort.id;
    expect(
      (await api(coordinator, `/${id}`, "PATCH", { status: "ACTIVE" })).status,
    ).toBe(409);
    await api(coordinator, `/${id}/workflow`, "PUT", { workflowId: workflow });
    expect(
      (await api(coordinator, `/${id}`, "PATCH", { status: "ACTIVE" })).status,
    ).toBe(200);
    expect(
      (await api(coordinator, `/${id}`, "PATCH", { status: "DRAFT" })).status,
    ).toBe(409);
    expect(
      (await api(coordinator, `/${id}`, "PATCH", { status: "CLOSED" })).status,
    ).toBe(200);
    expect(
      (await api(coordinator, `/${id}/members`, "POST", { userId: student }))
        .status,
    ).toBe(409);
    expect(
      (await api(coordinator, `/${id}`, "PATCH", { status: "ACTIVE" })).status,
    ).toBe(200);
    expect(
      (await api(coordinator, `/${id}`, "PATCH", { status: "ARCHIVED" }))
        .status,
    ).toBe(200);
    expect(
      (await api(coordinator, `/${id}`, "PATCH", { name: "Changed" })).status,
    ).toBe(409);
    expect(
      (
        await api(coordinator, `/${id}/workflow`, "PUT", {
          workflowId: workflow,
        })
      ).status,
    ).toBe(409);
    expect((await api(coordinator, `/${id}`, "DELETE")).status).toBe(404);
  });

  it("keeps cohort candidate lookup manager-only and within cohort academic scope", async () => {
    const id = (await create()).body.cohort.id;
    expect((await api(null, `/${id}/eligible-researchers`)).status).toBe(401);
    expect((await api(student, `/${id}/eligible-researchers`)).status).toBe(
      403,
    );
    expect((await api(adviser, `/${id}/eligible-researchers`)).status).toBe(
      403,
    );
    expect(
      (await api(siblingCoordinator, `/${id}/eligible-researchers`)).status,
    ).toBe(404);
    expect(
      (await api(foreignCoordinator, `/${id}/eligible-researchers`)).status,
    ).toBe(404);
    expect((await api(unassigned, `/${id}/eligible-researchers`)).status).toBe(
      403,
    );
    expect(
      (
        await api(
          coordinator,
          `/${id}/eligible-researchers`,
          "GET",
          undefined,
          true,
        )
      ).status,
    ).toBe(403);
    for (const actor of [coordinator, dean, admin])
      expect((await api(actor, `/${id}/eligible-researchers`)).status).toBe(
        200,
      );
  });
  it("searches eligible cohort researchers by name/email/identifier with pagination and no scope overrides", async () => {
    const id = (await create()).body.cohort.id;
    const all = await api(coordinator, `/${id}/eligible-researchers`);
    const ids = all.body.researchers.map((user: any) => user.id);
    expect(ids).toEqual(expect.arrayContaining([student, teammate]));
    for (const invalid of [
      outsideStudent,
      inactiveStudent,
      adviser,
      siblingCoordinator,
      foreignCoordinator,
    ])
      expect(ids).not.toContain(invalid);
    for (const search of [
      "student",
      "STUDENT@ISOLATED.TEST",
      `${marker}-student`,
    ]) {
      const result = await api(
        coordinator,
        `/${id}/eligible-researchers?search=${encodeURIComponent(search)}`,
      );
      expect(result.status).toBe(200);
      expect(result.body.researchers.map((user: any) => user.id)).toContain(
        student,
      );
    }
    const first = await api(
      coordinator,
      `/${id}/eligible-researchers?limit=1&page=1`,
    );
    const second = await api(
      coordinator,
      `/${id}/eligible-researchers?limit=1&page=2`,
    );
    expect(first.body.researchers).toHaveLength(1);
    expect(second.body.researchers).toHaveLength(1);
    expect(first.body.researchers[0].id).not.toBe(
      second.body.researchers[0].id,
    );
    expect(Object.keys(first.body.researchers[0]).sort()).toEqual([
      "email",
      "firstName",
      "id",
      "lastName",
      "universityId",
    ]);
    expect(
      (
        await api(
          coordinator,
          `/${id}/eligible-researchers?collegeId=${otherCollege}`,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await api(
          coordinator,
          `/${id}/eligible-researchers?programId=${siblingProgram}`,
        )
      ).status,
    ).toBe(400);
    expect(
      (await api(coordinator, `/${id}/eligible-researchers?limit=51`)).status,
    ).toBe(400);
  });
  it("excludes active cohort members, includes eligible removed members, and creates no runtime/access records", async () => {
    const id = (await create()).body.cohort.id;
    await api(coordinator, `/${id}/members`, "POST", {
      userIds: [student, teammate],
    });
    await api(coordinator, `/${id}/members/${teammate}`, "DELETE");
    const counts = async () => ({
      members: await prisma.researchCohortMember.count({
        where: { cohortId: id },
      }),
      workspaces: await prisma.researchWorkspace.count({
        where: { cohortId: id },
      }),
      cases: await prisma.researchProject.count({ where: { cohortId: id } }),
      enrollments: await prisma.workflowEnrollment.count({
        where: { workflowId: { in: fixture.workflowIds } },
      }),
      audits: await prisma.auditLog.count({ where: { entityId: id } }),
    });
    const before = await counts();
    const result = await api(coordinator, `/${id}/eligible-researchers`);
    expect(result.body.researchers.map((user: any) => user.id)).not.toContain(
      student,
    );
    expect(result.body.researchers.map((user: any) => user.id)).toContain(
      teammate,
    );
    expect(await counts()).toEqual(before);
    expect(
      (await api(coordinator, `/${id}/members`)).body.members.find(
        (member: any) => member.userId === teammate,
      ).status,
    ).toBe("REMOVED");
  });
  it("locks researcher lookup for closed and archived cohorts", async () => {
    for (const status of ["CLOSED", "ARCHIVED"] as const) {
      const id = (await create()).body.cohort.id;
      await prisma.researchCohort.update({ where: { id }, data: { status } });
      expect(
        (await api(coordinator, `/${id}/eligible-researchers`)).status,
      ).toBe(409);
    }
  });

  it("adds eligible researchers atomically and keeps historical membership when removing/reactivating", async () => {
    const id = (await create()).body.cohort.id;
    for (const invalid of [
      outsideStudent,
      inactiveStudent,
      adviser,
      crypto.randomUUID(),
    ])
      expect(
        (
          await api(coordinator, `/${id}/members`, "POST", {
            userIds: [student, invalid],
          })
        ).status,
      ).toBe(400);
    expect(
      await prisma.researchCohortMember.count({ where: { cohortId: id } }),
    ).toBe(0);
    expect((await api(student, `/${id}`)).status).toBe(404);
    const added = await api(coordinator, `/${id}/members`, "POST", {
      userIds: [student, teammate, student],
    });
    expect(added.status).toBe(201);
    expect(added.body.members).toHaveLength(2);
    const original = added.body.members.find(
      (member: any) => member.userId === student,
    );
    const repeated = await api(coordinator, `/${id}/members`, "POST", {
      userId: student,
    });
    expect(repeated.body.members[0].joinedAt).toBe(original.joinedAt);
    expect(
      (await api(student, "")).body.cohorts.map((row: any) => row.id),
    ).toContain(id);
    expect((await api(student, `/${id}/members`)).status).toBe(200);
    const removed = await api(
      coordinator,
      `/${id}/members/${student}`,
      "DELETE",
    );
    expect(removed.body.member).toMatchObject({
      id: original.id,
      status: "REMOVED",
    });
    expect(removed.body.member.removedAt).not.toBeNull();
    expect((await api(student, `/${id}`)).status).toBe(404);
    expect((await api(student, `/${id}/members`)).status).toBe(404);
    expect((await api(teammate, `/${id}/members`)).body.members).toHaveLength(
      1,
    );
    expect(
      (await api(coordinator, `/${id}/members`)).body.members,
    ).toHaveLength(2);
    const restored = await api(coordinator, `/${id}/members`, "POST", {
      userId: student,
    });
    expect(restored.body.members[0]).toMatchObject({
      id: original.id,
      status: "ACTIVE",
      removedAt: null,
    });
    expect((await api(student, `/${id}`)).status).toBe(200);
  });

  it("keeps researcher and restricted-panel requests read-only even for multi-role accounts", async () => {
    const id = (await create()).body.cohort.id;
    expect(
      (await api(coordinator, `/${id}`, "GET", undefined, true)).status,
    ).toBe(404);
    await api(coordinator, `/${id}/members`, "POST", {
      userIds: [coordinator, student],
    });
    expect(
      (await api(coordinator, `/${id}`, "GET", undefined, true)).status,
    ).toBe(200);
    expect(
      (
        await api(
          coordinator,
          `/${id}`,
          "PATCH",
          { name: "Panel bypass" },
          true,
        )
      ).status,
    ).toBe(403);
    for (const [path, method, body] of [
      ["", "POST", payload()],
      [`/${id}`, "PATCH", { name: "Student edit" }],
      [`/${id}/workflow`, "PUT", { workflowId: workflow }],
      [`/${id}/members`, "POST", { userId: teammate }],
      [`/${id}/members/${coordinator}`, "DELETE", undefined],
    ] as const)
      expect((await api(student, path, method, body)).status).toBe(403);
  });

  it("deduplicates concurrent membership writes and creates no runtime research records", async () => {
    const id = (await create()).body.cohort.id;
    const results = await Promise.all(
      [1, 2].map(() =>
        api(coordinator, `/${id}/members`, "POST", { userId: student }),
      ),
    );
    expect(results.some((result) => result.status === 201)).toBe(true);
    expect(results.every((result) => [201, 409].includes(result.status))).toBe(
      true,
    );
    expect(
      await prisma.researchCohortMember.count({
        where: { cohortId: id, userId: student },
      }),
    ).toBe(1);
    expect(
      await prisma.researchProject.count({
        where: { createdBy: { in: fixture.userIds } },
      }),
    ).toBe(0);
    expect(
      await prisma.researchWorkspace.count({
        where: { createdBy: { in: fixture.userIds } },
      }),
    ).toBe(0);
    expect(
      await prisma.workflowInstance.count({
        where: { workflowId: { in: fixture.workflowIds } },
      }),
    ).toBe(0);
    expect(
      await prisma.workflowEnrollment.count({
        where: { userId: { in: fixture.userIds } },
      }),
    ).toBe(0);
    const logs = await prisma.auditLog.findMany({
      where: { entityType: "ResearchCohort", entityId: { in: cohortIds } },
    });
    expect(logs.some((log) => log.action === "CREATE")).toBe(true);
    expect(
      logs.some(
        (log) => (log.newValues as any)?.operation === "REMOVE_RESEARCHER",
      ),
    ).toBe(true);
  });
  it("publishes independent version-one processes without globally assigning or switching active cohorts", async () => {
    async function workflowApi(path: string, body: unknown) {
      const response = await fetch(base + "/api/workflows" + path, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${generateToken(coordinator)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: (await response.json()) as any };
    }
    async function process(name: string) {
      const created = await workflowApi("", {
        name: `${marker}-${name}`,
        researchTypeId: type,
        stages: [],
      });
      expect(created.status).toBe(201);
      expect(created.body.workflow.version).toBe(1);
      const id = created.body.workflow.id;
      fixture.workflowIds.push(id);
      const topic = await prisma.workflowTopic.create({
        data: { workflowId: id, title: "Preparation", sequence: 1 },
      });
      const role = await prisma.role.findUniqueOrThrow({
        where: { name: "RESEARCHER" },
      });
      await prisma.workflowStage.create({
        data: {
          workflowId: id,
          topicId: topic.id,
          name: "Read guidelines",
          sequence: 1,
          responsibleRoleId: role.id,
          requiresDocument: false,
          requiresApproval: false,
        },
      });
      return id;
    }
    const a = await process("family-a"),
      b = await process("family-b");
    await prisma.researchType.update({
      where: { id: type },
      data: { workflowId: workflow },
    });
    const publishedA = await workflowApi(`/${a}/publish`, {});
    expect(publishedA.status).toBe(200);
    expect(publishedA.body.workflow).toMatchObject({
      status: "PUBLISHED",
      version: 1,
    });
    expect(publishedA.body.workflow.publishedAt).toBeTruthy();
    expect(
      (await prisma.researchType.findUniqueOrThrow({ where: { id: type } }))
        .workflowId,
    ).toBe(workflow);
    const cohortA = (await create()).body.cohort.id,
      cohortB = (await create()).body.cohort.id;
    await api(coordinator, `/${cohortA}/workflow`, "PUT", { workflowId: a });
    await api(coordinator, `/${cohortB}/workflow`, "PUT", {
      workflowId: workflow,
    });
    await api(coordinator, `/${cohortA}/members`, "POST", { userId: student });
    expect(
      (await api(coordinator, `/${cohortA}`, "PATCH", { status: "ACTIVE" }))
        .status,
    ).toBe(200);
    expect(
      (await api(coordinator, `/${cohortB}`, "PATCH", { status: "ACTIVE" }))
        .status,
    ).toBe(200);
    const before = await prisma.researchCohort.findMany({
      where: { id: { in: [cohortA, cohortB] } },
      orderBy: { id: "asc" },
    });
    expect((await workflowApi(`/${b}/publish`, {})).status).toBe(200);
    expect(
      await prisma.researchCohort.findMany({
        where: { id: { in: [cohortA, cohortB] } },
        orderBy: { id: "asc" },
      }),
    ).toEqual(before);
    expect(
      (await prisma.researchType.findUniqueOrThrow({ where: { id: type } }))
        .workflowId,
    ).toBe(workflow);
    expect(
      await prisma.workflow.count({
        where: {
          id: { in: [a, b] },
          researchTypeId: type,
          version: 1,
          status: "PUBLISHED",
        },
      }),
    ).toBe(2);
    expect(
      await prisma.auditLog.count({
        where: {
          entityType: "Workflow",
          entityId: { in: [a, b] },
          action: "UPDATE",
        },
      }),
    ).toBe(2);
    await prisma.workflowEnrollment.createMany({
      data: [a, b].map((workflowId) => ({ workflowId, userId: student })),
    });
    const actor: AuthenticatedUser = {
      id: student,
      roles: ["RESEARCHER"],
      collegeId: college,
      programId: program,
      permissions: [],
      email: "student@isolated.test",
      universityId: "student",
    };
    await expect(
      resolveRegistrationWorkflow(actor, program, b),
    ).rejects.toThrow("active cohorts");
    expect(
      (await api(coordinator, `/${cohortB}/workflow`, "PUT", { workflowId: b }))
        .status,
    ).toBe(200);
    expect(
      (
        await prisma.researchCohort.findUniqueOrThrow({
          where: { id: cohortA },
        })
      ).workflowId,
    ).toBe(a);
    expect(
      (
        await prisma.researchCohort.findUniqueOrThrow({
          where: { id: cohortB },
        })
      ).workflowId,
    ).toBe(b);
    // Assignment alone does not replace either cohort membership or legacy enrollment authorization.
    await expect(
      resolveRegistrationWorkflow(actor, program, b),
    ).rejects.toThrow("active cohorts");
    expect(
      (
        await resolveRegistrationWorkflow(actor, program, a, type, {
          academicYearId: year,
        })
      ).workflow?.id,
    ).toBe(a);
    await api(coordinator, `/${cohortB}/members`, "POST", { userId: student });
    expect(
      (await resolveRegistrationWorkflow(actor, program, b)).workflow?.id,
    ).toBe(b);
    await expect(resolveRegistrationWorkflow(actor, program)).rejects.toThrow(
      "Select the workflow",
    );
    await api(coordinator, `/${cohortA}/members/${student}`, "DELETE");
    await expect(
      resolveRegistrationWorkflow(actor, program, a),
    ).rejects.toThrow("active cohorts");
    expect(
      (
        await prisma.workflowEnrollment.findUniqueOrThrow({
          where: { workflowId_userId: { workflowId: a, userId: student } },
        })
      ).status,
    ).toBe("ACTIVE");
  });
});
