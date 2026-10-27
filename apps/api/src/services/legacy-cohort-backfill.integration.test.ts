import crypto from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  applyBackfill,
  prepareBackfill,
} from "@research-management/database/legacy-cohort-backfill";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { generateToken } from "../middleware/auth.js";
import {
  advanceMilestoneIfSatisfied,
  getMilestoneProgress,
} from "./research-workflow-integration.service.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
  type IntegrationFixtureScope,
} from "../test/database-integration.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
databaseDescribe("conservative legacy backfill in isolated PostgreSQL", () => {
  let fixture: IntegrationFixtureScope, server: http.Server, base: string;
  let collegeId: string,
    programId: string,
    yearId: string,
    typeId: string,
    owner: string,
    student: string,
    roleId: string,
    workflowId: string,
    workspaceId: string,
    projectId: string,
    cohortId: string;
  let templateIds: string[], workspaceIds: string[];
  const environment = () => ({
    ...process.env,
    BACKFILL_DATABASE_URL: process.env.INTEGRATION_DATABASE_URL!,
  });
  const prepare = () => prepareBackfill(prisma, environment());
  const apply = async (createSafeCohorts = false) =>
    applyBackfill(prisma, (await prepare()).plan, {
      createSafeCohorts,
      environment: environment(),
    });
  async function makeCohort(wf = workflowId) {
    return prisma.researchCohort.create({
      data: {
        name: fixture.marker,
        collegeId,
        programId,
        researchTypeId: typeId,
        academicYearId: yearId,
        workflowId: wf,
        createdBy: owner,
        status: "ARCHIVED",
      },
    });
  }
  async function makeProject(
    wf = workflowId,
    workspace: string | null = workspaceId,
  ) {
    const project = await prisma.researchProject.create({
      data: {
        title: "Persisted legacy title",
        isTitleProvisional: false,
        status: "UNDER_REVIEW",
        collegeId,
        programId,
        academicYearId: yearId,
        researchTypeId: typeId,
        workspaceId: workspace,
        createdBy: student,
        members: { create: { userId: student, projectRole: "LEADER" } },
      },
    });
    fixture.projectIds.push(project.id);
    const first = await prisma.workflowStage.findFirstOrThrow({
      where: { workflowId: wf },
      orderBy: { sequence: "asc" },
    });
    const instance = await prisma.workflowInstance.create({
      data: {
        researchId: project.id,
        workflowId: wf,
        workflowVersion: 1,
        currentStageId: first.id,
      },
    });
    await prisma.researchProject.update({
      where: { id: project.id },
      data: { workflowInstanceId: instance.id },
    });
    return project;
  }
  async function makeWorkflow() {
    const wf = await prisma.workflow.create({
      data: {
        name: `${fixture.marker}-${fixture.workflowIds.length}`,
        researchTypeId: typeId,
        createdBy: owner,
        status: "PUBLISHED",
        stages: {
          create: [
            {
              name: "Legacy proposal",
              sequence: 1,
              requiresDocument: true,
              responsibleRoleId: roleId,
              tasks: { create: { title: "Proposal", sequence: 1 } },
            },
            {
              name: "Next requirement",
              sequence: 2,
              requiresDocument: false,
              responsibleRoleId: roleId,
              isFinal: true,
            },
          ],
        },
      },
    });
    fixture.workflowIds.push(wf.id);
    return wf;
  }
  async function api(actor: string, url: string) {
    const r = await fetch(base + url, {
      headers: { Authorization: `Bearer ${generateToken(actor)}` },
    });
    return { status: r.status, body: (await r.json()) as any };
  }
  // Complete row snapshots from every table; identifiers are catalog-derived and validated.
  async function databaseRows() {
    const tables = await prisma.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
    const result: Record<string, unknown> = {};
    for (const { tablename } of tables) {
      if (!/^[a-z_][a-z0-9_]*$/.test(tablename))
        throw new Error("Unexpected test table identifier");
      result[tablename] = await prisma.$queryRawUnsafe(
        `SELECT row_to_json(t) AS row FROM public."${tablename}" t ORDER BY row_to_json(t)::text`,
      );
    }
    return result;
  }
  function protectedRows(rows: Record<string, unknown>) {
    const copy = structuredClone(rows);
    delete copy.research_cohorts;
    delete copy.research_cohort_members;
    for (const table of ["research_projects", "research_workspaces"])
      copy[table] = (
        copy[table] as Array<{ row: Record<string, unknown> }>
      ).map(({ row }) => {
        const { cohort_id: _cohort, updated_at: _updated, ...rest } = row;
        return { row: rest };
      });
    return copy;
  }
  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    server = http.createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    base = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
  });
  afterAll(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  beforeEach(async () => {
    fixture = createIntegrationFixtureScope(
      `legacy-backfill-${crypto.randomUUID().slice(0, 8)}`,
    );
    fixture.databaseVerified = true;
    templateIds = [];
    workspaceIds = [];
    const code = `LB${fixture.marker.slice(-8)}`;
    const college = await prisma.college.create({
      data: { name: fixture.marker, code },
    });
    collegeId = college.id;
    fixture.collegeIds.push(collegeId);
    const program = await prisma.program.create({
      data: { name: fixture.marker, code, collegeId },
    });
    programId = program.id;
    fixture.programIds.push(programId);
    const year = await prisma.academicYear.create({
      data: {
        name: code,
        startDate: new Date("2098-06-01"),
        endDate: new Date("2099-05-31"),
      },
    });
    yearId = year.id;
    fixture.academicYearIds.push(yearId);
    const type = await prisma.researchType.create({
      data: { code, name: fixture.marker, programId },
    });
    typeId = type.id;
    fixture.researchTypeIds.push(typeId);
    for (const name of ["RESEARCH_COORDINATOR", "RESEARCHER"] as const) {
      const role = await prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      const user = await prisma.user.create({
        data: {
          universityId: `${code}-${name}`,
          email: `${code}-${name}@isolated.test`,
          firstName: name,
          lastName: "Fixture",
          collegeId,
          programId,
          status: "ACTIVE",
          roles: { create: { roleId: role.id } },
        },
      });
      fixture.userIds.push(user.id);
      if (name === "RESEARCHER") {
        student = user.id;
        roleId = role.id;
      } else owner = user.id;
    }
    workflowId = (await makeWorkflow()).id;
    const workspace = await prisma.researchWorkspace.create({
      data: {
        name: "Existing legacy team",
        collegeId,
        programId,
        createdBy: student,
        participationMode: "SOLO",
        inviteCode: crypto.randomBytes(12).toString("hex"),
        members: { create: { userId: student, role: "LEADER" } },
      },
    });
    workspaceId = workspace.id;
    workspaceIds.push(workspaceId);
    projectId = (await makeProject()).id;
    cohortId = (await makeCohort()).id;
    await prisma.workflowEnrollment.create({
      data: { workflowId, userId: student, status: "ACTIVE" },
    });
  }, 30000);
  afterEach(async () => {
    if (!fixture?.databaseVerified) return;
    await prisma.researchCohort.deleteMany({
      where: { createdBy: { in: fixture.userIds } },
    });
    await prisma.researchWorkspace.deleteMany({
      where: { id: { in: workspaceIds } },
    });
    await prisma.evaluation.deleteMany({
      where: { researchId: { in: fixture.projectIds } },
    });
    await cleanupIntegrationFixture(prisma, fixture);
    await prisma.evaluationTemplate.deleteMany({
      where: { id: { in: templateIds } },
    });
  }, 30000);

  it("dry-run is repeatable and performs zero changes to any table", async () => {
    const before = await databaseRows(),
      first = await prepare(),
      second = await prepare();
    expect(first.plan).toEqual(second.plan);
    expect(first.plan.counts).toMatchObject({
      PROJECT_LINK_UPDATE: 1,
      WORKSPACE_LINK_UPDATE: 1,
      MEMBERSHIP_CREATE: 1,
    });
    expect(await databaseRows()).toEqual(before);
  });
  it("CLI defaults to dry-run with machine-readable output and no database changes", async () => {
    const before = await databaseRows();
    const executable = path.resolve(
      "../../packages/database/dist/legacy-cohort-backfill-cli.js",
    );
    const result = await new Promise<{ code: number | null; stdout: string }>(
      (resolve, reject) => {
        const child = spawn(process.execPath, [executable, "--json"], {
          env: environment(),
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
        });
        child.stderr.resume();
        child.on("error", reject);
        child.on("close", (code) => resolve({ code, stdout }));
      },
    );
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      mode: "DRY RUN",
      writesPerformed: 0,
    });
    expect(await databaseRows()).toEqual(before);
  });
  it("applies unique links/membership once and is idempotent without changing the archived cohort", async () => {
    const cohortBefore = await prisma.researchCohort.findUniqueOrThrow({
      where: { id: cohortId },
    });
    const first = await apply();
    expect(first.writesPerformed).toBe(3);
    const after = await databaseRows(),
      second = await apply();
    expect(second.writesPerformed).toBe(0);
    expect(second.plan.counts).toMatchObject({
      ALREADY_MIGRATED: 1,
      MEMBERSHIP_ALREADY_EXISTS: 1,
    });
    expect(await databaseRows()).toEqual(after);
    expect(
      await prisma.researchCohort.findUniqueOrThrow({
        where: { id: cohortId },
      }),
    ).toEqual(cohortBefore);
  });
  it("skips ambiguity without blocking a separate safe case cluster", async () => {
    await makeCohort();
    const other = await makeWorkflow();
    const co = await makeCohort(other.id),
      p = await makeProject(other.id, null);
    const result = await apply();
    expect(
      result.plan.findings.some((f) => f.code === "AMBIGUOUS_EXISTING_COHORT"),
    ).toBe(true);
    expect(
      (
        await prisma.researchProject.findUniqueOrThrow({
          where: { id: projectId },
        })
      ).cohortId,
    ).toBeNull();
    expect(
      (await prisma.researchProject.findUniqueOrThrow({ where: { id: p.id } }))
        .cohortId,
    ).toBe(co.id);
  });
  it("does not guess a missing pinned process from ResearchType.workflowId", async () => {
    await prisma.researchProject.update({
      where: { id: projectId },
      data: { workflowInstanceId: null },
    });
    await prisma.researchType.update({
      where: { id: typeId },
      data: { workflowId },
    });
    const before = await databaseRows(),
      result = await apply();
    expect(result.writesPerformed).toBe(0);
    expect(
      result.plan.findings.some((f) => f.code === "NO_PINNED_WORKFLOW"),
    ).toBe(true);
    expect(await databaseRows()).toEqual(before);
  });
  it("plans safe creation but requires its separate policy flag; creates one DRAFT once", async () => {
    await prisma.researchCohort.delete({ where: { id: cohortId } });
    const before = await databaseRows(),
      plan = await prepare();
    expect(plan.plan.counts.SAFE_COHORT_CREATION_CANDIDATE).toBe(1);
    expect((await apply()).groups[0].status).toBe("CREATION_NOT_AUTHORIZED");
    expect(await databaseRows()).toEqual(before);
    const result = await apply(true);
    expect(result.written).toMatchObject({
      CREATE_COHORT: 1,
      PROJECT_LINK_UPDATE: 1,
      WORKSPACE_LINK_UPDATE: 1,
      MEMBERSHIP_CREATE: 1,
    });
    const created = await prisma.researchCohort.findFirstOrThrow({
      where: { createdBy: owner },
    });
    expect(created).toMatchObject({
      status: "DRAFT",
      createdBy: owner,
      workflowId,
    });
    expect(created.name).toContain("Migrated");
    const after = await databaseRows();
    expect((await apply(true)).writesPerformed).toBe(0);
    expect(await databaseRows()).toEqual(after);
  });
  it("fills partial links but never overwrites contradictory project/workspace cohorts", async () => {
    await prisma.researchProject.update({
      where: { id: projectId },
      data: { cohortId },
    });
    expect((await apply()).written.WORKSPACE_LINK_UPDATE).toBe(1);
    const other = await makeCohort();
    await prisma.researchWorkspace.update({
      where: { id: workspaceId },
      data: { cohortId: other.id },
    });
    const before = await databaseRows(),
      result = await apply();
    expect(result.writesPerformed).toBe(0);
    expect(
      result.plan.findings.some(
        (f) => f.code === "PROJECT_WORKSPACE_COHORT_CONFLICT",
      ),
    ).toBe(true);
    expect(await databaseRows()).toEqual(before);
  });
  it("links same-cohort multi-case workspace once", async () => {
    await makeProject();
    const result = await apply();
    expect(result.written).toMatchObject({
      PROJECT_LINK_UPDATE: 2,
      WORKSPACE_LINK_UPDATE: 1,
      MEMBERSHIP_CREATE: 1,
    });
  });
  it("preserves a multi-cohort workspace while linking safe individual cases", async () => {
    const wf = await makeWorkflow(),
      co = await makeCohort(wf.id),
      p = await makeProject(wf.id);
    const result = await apply();
    expect(
      result.plan.findings.some(
        (f) => f.code === "WORKSPACE_MULTI_COHORT_CONFLICT",
      ),
    ).toBe(true);
    expect(result.written.WORKSPACE_LINK_UPDATE).toBe(0);
    expect(
      (await prisma.researchProject.findUniqueOrThrow({ where: { id: p.id } }))
        .cohortId,
    ).toBe(co.id);
    expect(
      (
        await prisma.researchProject.findUniqueOrThrow({
          where: { id: projectId },
        })
      ).cohortId,
    ).toBe(cohortId);
  });
  it("preserves REMOVED membership and its history", async () => {
    const member = await prisma.researchCohortMember.create({
      data: {
        cohortId,
        userId: student,
        status: "REMOVED",
        removedAt: new Date(),
      },
    });
    const result = await apply();
    expect(result.written.MEMBERSHIP_CREATE).toBe(0);
    expect(
      result.plan.findings.some(
        (f) => f.code === "REMOVED_MEMBERSHIP_CONFLICT",
      ),
    ).toBe(true);
    expect(
      await prisma.researchCohortMember.findUniqueOrThrow({
        where: { id: member.id },
      }),
    ).toEqual(member);
  });
  it("revoked enrollment alone grants nothing; independent active case participation may create membership", async () => {
    const enrollment = await prisma.workflowEnrollment.update({
      where: { workflowId_userId: { workflowId, userId: student } },
      data: { status: "REVOKED" },
    });
    await prisma.researchMember.updateMany({
      where: { researchId: projectId },
      data: { leftAt: new Date() },
    });
    await prisma.workspaceMember.updateMany({
      where: { workspaceId },
      data: { leftAt: new Date() },
    });
    expect((await apply()).written.MEMBERSHIP_CREATE).toBe(0);
    await prisma.researchMember.updateMany({
      where: { researchId: projectId },
      data: { leftAt: null },
    });
    const result = await apply();
    expect(result.written.MEMBERSHIP_CREATE).toBe(1);
    expect(
      await prisma.workflowEnrollment.findUniqueOrThrow({
        where: { id: enrollment.id },
      }),
    ).toEqual(enrollment);
    expect(
      (await api(student, `/api/research/${projectId}/manuscript-workflow`))
        .status,
    ).toBe(403);
  });
  it("uses enrollment-only evidence only with deterministic persisted profile year", async () => {
    await prisma.researchMember.updateMany({
      where: { researchId: projectId },
      data: { leftAt: new Date() },
    });
    await prisma.workspaceMember.updateMany({
      where: { workspaceId },
      data: { leftAt: new Date() },
    });
    // A removed relationship is contradictory evidence, even if the profile year matches.
    await prisma.researcherProfile.create({
      data: {
        userId: student,
        academicYearId: yearId,
        degreeLevel: "UNDERGRADUATE",
        academicTerm: "First semester",
      },
    });
    expect((await apply()).written.MEMBERSHIP_CREATE).toBe(0);
    const independent = await prisma.user.create({
      data: {
        universityId: `${fixture.marker}-enrolled`,
        email: `${fixture.marker}-enrolled@isolated.test`,
        firstName: "Enrolled",
        lastName: "Fixture",
        collegeId,
        programId,
        status: "ACTIVE",
        roles: { create: { roleId } },
        researcherProfile: {
          create: {
            academicYearId: yearId,
            degreeLevel: "UNDERGRADUATE",
            academicTerm: "First semester",
          },
        },
      },
    });
    fixture.userIds.push(independent.id);
    await prisma.workflowEnrollment.create({
      data: { userId: independent.id, workflowId },
    });
    const result = await apply();
    expect(result.written.MEMBERSHIP_CREATE).toBe(1);
    expect(
      result.plan.groups
        .flatMap((g) => g.actions)
        .find((a) => a.kind === "MEMBERSHIP_CREATE")?.evidence[0],
    ).toContain("ACTIVE_ENROLLMENT_WITH_PROFILE_YEAR:");
  });
  it("rejects stale plans after a coordinator removes a member", async () => {
    const plan = (await prepare()).plan;
    const removed = await prisma.researchCohortMember.create({
      data: {
        cohortId,
        userId: student,
        status: "REMOVED",
        removedAt: new Date(),
      },
    });
    const before = await databaseRows(),
      result = await applyBackfill(prisma, plan, {
        createSafeCohorts: false,
        environment: environment(),
      });
    expect(result.groups[0].status).toBe("STALE_PLAN");
    expect(result.writesPerformed).toBe(0);
    expect(await databaseRows()).toEqual(before);
    expect(
      (
        await prisma.researchCohortMember.findUniqueOrThrow({
          where: { id: removed.id },
        })
      ).status,
    ).toBe("REMOVED");
  });
  it("rolls back a failed case cluster including newly created cohort", async () => {
    await prisma.researchCohort.delete({ where: { id: cohortId } });
    const plan = (await prepare()).plan,
      before = await databaseRows();
    const failing = {
      $transaction: (callback: (tx: unknown) => unknown, options: unknown) =>
        prisma.$transaction(
          async (tx) =>
            callback(
              new Proxy(tx, {
                get(target, key) {
                  if (key === "researchProject")
                    return new Proxy(target.researchProject, {
                      get(delegate, method) {
                        return method === "updateMany"
                          ? async () => {
                              throw new Error(
                                "Injected fixture failure after cohort/member creation",
                              );
                            }
                          : Reflect.get(delegate, method);
                      },
                    });
                  return Reflect.get(target, key);
                },
              }),
            ) as Promise<any>,
          options as any,
        ),
    } as unknown as PrismaClient;
    const result = await applyBackfill(failing, plan, {
      createSafeCohorts: true,
      environment: environment(),
    });
    expect(result.groups[0].status).toBe("APPLY_FAILED");
    expect(result.writesPerformed).toBe(0);
    expect(await databaseRows()).toEqual(before);
  });
  it("concurrent application cannot duplicate links or cohort members", async () => {
    const plan = (await prepare()).plan;
    const results = await Promise.all([
      applyBackfill(prisma, plan, {
        createSafeCohorts: false,
        environment: environment(),
      }),
      applyBackfill(prisma, plan, {
        createSafeCohorts: false,
        environment: environment(),
      }),
    ]);
    expect(results.reduce((sum, r) => sum + r.writesPerformed, 0)).toBe(3);
    expect(
      await prisma.researchCohortMember.count({
        where: { cohortId, userId: student },
      }),
    ).toBe(1);
    expect((await apply()).writesPerformed).toBe(0);
  });
  it("concurrent safe-creation apply creates only one cohort and stable links", async () => {
    await prisma.researchCohort.delete({ where: { id: cohortId } });
    const plan = (await prepare()).plan;
    const results = await Promise.all([
      applyBackfill(prisma, plan, {
        createSafeCohorts: true,
        environment: environment(),
      }),
      applyBackfill(prisma, plan, {
        createSafeCohorts: true,
        environment: environment(),
      }),
    ]);
    expect(results.reduce((sum, r) => sum + r.written.CREATE_COHORT, 0)).toBe(
      1,
    );
    const created = await prisma.researchCohort.findMany({
      where: { createdBy: owner },
    });
    expect(created).toHaveLength(1);
    expect(
      (
        await prisma.researchProject.findUniqueOrThrow({
          where: { id: projectId },
        })
      ).cohortId,
    ).toBe(created[0].id);
    const after = await databaseRows();
    expect((await apply(true)).writesPerformed).toBe(0);
    expect(await databaseRows()).toEqual(after);
  });
  it("skips a stale plan when another compatible cohort appears after planning", async () => {
    const plan = (await prepare()).plan;
    await makeCohort();
    const before = await databaseRows();
    const result = await applyBackfill(prisma, plan, {
      createSafeCohorts: false,
      environment: environment(),
    });
    expect(result.writesPerformed).toBe(0);
    expect(result.groups[0].status).toBe("STALE_PLAN");
    expect(await databaseRows()).toEqual(before);
  });
  it("preserves every academic/history row and legacy read/progression after safe association", async () => {
    const phase = await prisma.workflowTopic.create({
      data: { workflowId, title: "Persisted legacy Phase", sequence: 1 },
    });
    await prisma.workflowStage.updateMany({
      where: { workflowId, sequence: 1 },
      data: { topicId: phase.id },
    });
    const adviserRole = await prisma.role.upsert({
      where: { name: "ADVISER" },
      update: {},
      create: { name: "ADVISER" },
    });
    await prisma.userRole.create({
      data: { userId: owner, roleId: adviserRole.id },
    });
    await prisma.researchMember.create({
      data: { researchId: projectId, userId: owner, projectRole: "ADVISER" },
    });
    await prisma.adviserRequest.create({
      data: {
        researchId: projectId,
        adviserId: owner,
        requestedById: student,
        status: "ACCEPTED",
        respondedAt: new Date(),
      },
    });
    const instance = await prisma.workflowInstance.findUniqueOrThrow({
      where: { researchId: projectId },
    });
    const task = await prisma.workflowTask.findFirstOrThrow({
      where: { stageId: instance.currentStageId! },
    });
    const document = await prisma.document.create({
      data: {
        researchId: projectId,
        title: "Recorded manuscript",
        documentType: "MANUSCRIPT",
        milestoneId: instance.currentStageId,
        createdBy: student,
      },
    });
    await prisma.taskSubmission.create({
      data: {
        researchId: projectId,
        taskId: task.id,
        documentId: document.id,
        submittedBy: student,
        status: "APPROVED",
      },
    });
    await prisma.consultation.create({
      data: {
        researchId: projectId,
        createdBy: owner,
        title: "Recorded consultation",
        scheduledStart: new Date("2098-07-01T09:00:00Z"),
        scheduledEnd: new Date("2098-07-01T10:00:00Z"),
      },
    });
    const session = await prisma.defenseSession.create({
      data: {
        researchId: projectId,
        createdBy: owner,
        decision: "APPROVED",
        releasedAt: new Date(),
      },
    });
    await prisma.defenseInvitation.create({
      data: {
        defenseSessionId: session.id,
        inviteeId: owner,
        role: "PANELIST",
        status: "ACCEPTED",
      },
    });
    const template = await prisma.evaluationTemplate.create({
      data: { name: fixture.marker, researchTypeId: typeId, totalScore: 100 },
    });
    templateIds.push(template.id);
    await prisma.evaluation.create({
      data: {
        researchId: projectId,
        templateId: template.id,
        evaluatorId: owner,
        defenseSessionId: session.id,
        totalScore: 90,
      },
    });
    const before = await databaseRows(),
      read = await api(student, `/api/research/${projectId}`),
      progress = await getMilestoneProgress(prisma, projectId);
    expect(read.status).toBe(200);
    expect((await apply()).writesPerformed).toBe(3);
    expect(protectedRows(await databaseRows())).toEqual(protectedRows(before));
    const afterRead = await api(student, `/api/research/${projectId}`);
    expect(afterRead.status).toBe(200);
    expect(afterRead.body.project).toMatchObject({
      id: projectId,
      title: "Persisted legacy title",
      status: "UNDER_REVIEW",
      cohortId,
      workflowInstanceId: instance.id,
    });
    expect(await getMilestoneProgress(prisma, projectId)).toEqual(progress);
    const managed = await api(owner, `/api/cohorts/${cohortId}`);
    expect(managed.status).toBe(200);
    expect(managed.body.cohort._count).toMatchObject({
      members: 1,
      researchProjects: 1,
      workspaces: 1,
    });
    const advanced = await prisma.$transaction((tx) =>
      advanceMilestoneIfSatisfied(tx, {
        researchId: projectId,
        milestoneId: instance.currentStageId!,
        actorId: owner,
      }),
    );
    expect(advanced.advanced).toBe(true);
    expect(
      (
        await prisma.workflowInstance.findUniqueOrThrow({
          where: { id: instance.id },
        })
      ).currentStageId,
    ).not.toBe(instance.currentStageId);
  });
});
