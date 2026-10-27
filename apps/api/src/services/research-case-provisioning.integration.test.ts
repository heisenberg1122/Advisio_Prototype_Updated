import crypto from "node:crypto";
import http from "node:http";
import { readFileSync } from "node:fs";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import app from "../app.js";
import { Prisma, prisma } from "../lib/prisma.js";
import { generateToken } from "../middleware/auth.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";
import { provisionResearchCase } from "./research-case-provisioning.service.js";
import { advanceMilestoneIfSatisfied } from "./research-workflow-integration.service.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
databaseDescribe(
  "canonical research case provisioning with isolated PostgreSQL",
  () => {
    const marker = `case-provision-${crypto.randomUUID().slice(0, 8)}`;
    const code = `CP${marker.slice(-8)}`;
    const fixture = createIntegrationFixtureScope(marker);
    const cohortIds: string[] = [],
      workspaceIds: string[] = [];
    let collegeId: string,
      programId: string,
      typeId: string,
      yearId: string,
      roleId: string;
    let leaderId: string,
      memberId: string,
      cohortId: string,
      workspaceId: string,
      workflowId: string,
      firstStageId: string,
      nextStageId: string;
    let server: http.Server, base: string;
    let counter = 0;
    const run = () =>
      provisionResearchCase({ cohortId, workspaceId, actorId: leaderId });
    async function api(
      path: string,
      method = "GET",
      body?: unknown,
      actorId = leaderId,
    ) {
      const response = await fetch(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${generateToken(actorId)}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: (await response.json()) as any };
    }
    async function counts() {
      return {
        projects: await prisma.researchProject.count({
          where: { cohortId, workspaceId },
        }),
        instances: await prisma.workflowInstance.count({
          where: { workflowId },
        }),
        members: await prisma.researchMember.count({
          where: { research: { cohortId, workspaceId } },
        }),
        enrollments: await prisma.workflowEnrollment.count({
          where: { workflowId },
        }),
        audits: await prisma.auditLog.count({
          where: {
            userId: leaderId,
            entityType: "ResearchProject",
            newValues: {
              path: ["operation"],
              equals: "RESEARCH_CASE_PROVISIONED",
            },
          },
        }),
      };
    }
    async function expectRejected(code: string) {
      const before = await counts();
      await expect(run()).rejects.toMatchObject({ code });
      expect(await counts()).toEqual(before);
    }
    beforeAll(async () => {
      await assertIsolatedIntegrationDatabase(prisma);
      fixture.databaseVerified = true;
      const college = await prisma.college.create({
        data: { code, name: marker },
      });
      collegeId = college.id;
      fixture.collegeIds.push(collegeId);
      const program = await prisma.program.create({
        data: { code, name: marker, collegeId },
      });
      programId = program.id;
      fixture.programIds.push(programId);
      const year = await prisma.academicYear.create({
        data: {
          name: code,
          startDate: new Date("2098-06-01"),
          endDate: new Date("2099-05-31"),
          isCurrent: true,
        },
      });
      yearId = year.id;
      fixture.academicYearIds.push(yearId);
      const type = await prisma.researchType.create({
        data: { name: marker, code, programId },
      });
      typeId = type.id;
      fixture.researchTypeIds.push(typeId);
      const role = await prisma.role.upsert({
        where: { name: "RESEARCHER" },
        update: {},
        create: { name: "RESEARCHER" },
      });
      roleId = role.id;
      server = app.listen(0, "127.0.0.1");
      await new Promise<void>((resolve) => server.once("listening", resolve));
      base = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
    });
    beforeEach(async () => {
      const label = `${marker}-${++counter}`;
      async function user(name: string) {
        const row = await prisma.user.create({
          data: {
            universityId: `${label}-${name}`,
            email: `${label}-${name}@isolated.test`,
            firstName: name,
            lastName: "Fixture",
            collegeId,
            programId,
            status: "ACTIVE",
            roles: { create: { roleId } },
          },
        });
        fixture.userIds.push(row.id);
        return row.id;
      }
      leaderId = await user("leader");
      memberId = await user("member");
      const workflow = await prisma.workflow.create({
        data: {
          name: label,
          researchTypeId: typeId,
          createdBy: leaderId,
          status: "PUBLISHED",
          version: 7,
          stages: {
            create: [
              {
                name: "Archived first",
                sequence: 1,
                category: "Archived",
                responsibleRoleId: roleId,
              },
              {
                name: "Later requirement",
                sequence: 3,
                responsibleRoleId: roleId,
              },
              {
                name: "First active requirement",
                sequence: 2,
                requiresDocument: false,
                responsibleRoleId: roleId,
              },
            ],
          },
        },
        include: { stages: true },
      });
      workflowId = workflow.id;
      fixture.workflowIds.push(workflowId);
      firstStageId = workflow.stages.find((stage) => stage.sequence === 2)!.id;
      nextStageId = workflow.stages.find((stage) => stage.sequence === 3)!.id;
      const cohort = await prisma.researchCohort.create({
        data: {
          name: label,
          collegeId,
          programId,
          researchTypeId: typeId,
          academicYearId: yearId,
          workflowId,
          status: "ACTIVE",
          createdBy: leaderId,
          members: {
            create: [leaderId, memberId].map((userId) => ({ userId })),
          },
        },
      });
      cohortId = cohort.id;
      cohortIds.push(cohortId);
      const workspace = await prisma.researchWorkspace.create({
        data: {
          name: label,
          participationMode: "GROUP",
          accessMode: "INVITE_ONLY",
          inviteCode: crypto.randomUUID().replaceAll("-", ""),
          collegeId,
          programId,
          cohortId,
          createdBy: leaderId,
          members: {
            create: [
              { userId: leaderId, role: "LEADER" },
              { userId: memberId, role: "MEMBER" },
            ],
          },
        },
      });
      workspaceId = workspace.id;
      workspaceIds.push(workspaceId);
    });
    afterAll(async () => {
      vi.restoreAllMocks();
      if (server)
        await new Promise<void>((resolve) => server.close(() => resolve()));
      if (!fixture.databaseVerified) return;
      // Track all cases, including any unexpectedly surviving failed attempt.
      const projects = await prisma.researchProject.findMany({
        where: { createdBy: { in: fixture.userIds } },
        select: { id: true },
      });
      fixture.projectIds.push(...projects.map((project) => project.id));
      await prisma.researchCohort.deleteMany({
        where: { id: { in: cohortIds } },
      });
      await prisma.researchWorkspace.deleteMany({
        where: { id: { in: workspaceIds } },
      });
      await cleanupIntegrationFixture(prisma, fixture);
      expect(
        await prisma.researchCohort.count({ where: { id: { in: cohortIds } } }),
      ).toBe(0);
      expect(
        await prisma.researchWorkspace.count({
          where: { id: { in: workspaceIds } },
        }),
      ).toBe(0);
    }, 30000);

    it("atomically creates the provisional case, exact roles, compatibility access and both instance links without notifications", async () => {
      const beforeNotifications = await prisma.notification.count({
        where: { recipientId: { in: [leaderId, memberId] } },
      });
      const result = await run();
      const workspace = await prisma.researchWorkspace.findUniqueOrThrow({
        where: { id: workspaceId },
      });
      expect(result.created).toBe(true);
      expect(result.project).toMatchObject({
        collegeId,
        programId,
        researchTypeId: typeId,
        academicYearId: yearId,
        cohortId,
        workspaceId,
        title: `${workspace.name} Research Study`,
        isTitleProvisional: true,
        workflowDraft: true,
        registeredAt: null,
        status: "DRAFT",
        createdBy: leaderId,
        workflowInstanceId: result.workflowInstance.id,
      });
      expect(result.workflowInstance).toMatchObject({
        researchId: result.project.id,
        workflowId,
        workflowVersion: 7,
        currentStageId: firstStageId,
      });
      expect(
        await prisma.researchMember.findMany({
          where: { researchId: result.project.id },
          select: { userId: true, projectRole: true },
        }),
      ).toEqual(
        expect.arrayContaining([
          { userId: leaderId, projectRole: "LEADER" },
          { userId: memberId, projectRole: "MEMBER" },
        ]),
      );
      expect(await counts()).toEqual({
        projects: 1,
        instances: 1,
        members: 2,
        enrollments: 2,
        audits: 1,
      });
      expect(
        await prisma.workflowTransition.count({
          where: { workflowInstanceId: result.workflowInstance.id },
        }),
      ).toBe(0);
      expect(
        await prisma.notification.count({
          where: { recipientId: { in: [leaderId, memberId] } },
        }),
      ).toBe(beforeNotifications);
    });
    it("returns an unchanged case on repeat and pins its original workflow version", async () => {
      const first = await run();
      await prisma.workflow.update({
        where: { id: workflowId },
        data: { version: 99 },
      });
      const second = await run();
      expect(second).toEqual({ ...first, created: false });
      expect(await counts()).toEqual({
        projects: 1,
        instances: 1,
        members: 2,
        enrollments: 2,
        audits: 1,
      });
    });
    it("serializes simultaneous calls into one case and one set of related records", async () => {
      const results = await Promise.all([run(), run()]);
      expect(results.map((result) => result.created).sort()).toEqual([
        false,
        true,
      ]);
      expect(results[0].project.id).toBe(results[1].project.id);
      expect(results[0].workflowInstance.id).toBe(
        results[1].workflowInstance.id,
      );
      expect(await counts()).toEqual({
        projects: 1,
        instances: 1,
        members: 2,
        enrollments: 2,
        audits: 1,
      });
    });
    it("ignores the deprecated global workflow pointer even when it points to another published process", async () => {
      const other = await prisma.workflow.create({
        data: {
          name: `${marker}-legacy-default`,
          researchTypeId: typeId,
          createdBy: leaderId,
          status: "PUBLISHED",
        },
      });
      fixture.workflowIds.push(other.id);
      await prisma.researchType.update({
        where: { id: typeId },
        data: { workflowId: other.id },
      });
      expect((await run()).workflowInstance.workflowId).toBe(workflowId);
      expect(
        (await prisma.researchType.findUniqueOrThrow({ where: { id: typeId } }))
          .workflowId,
      ).toBe(other.id);
    });
    it("preserves active enrollment IDs and join timestamps while creating only missing access", async () => {
      const active = await prisma.workflowEnrollment.create({
        data: {
          workflowId,
          userId: leaderId,
          joinedAt: new Date("2020-01-01"),
        },
      });
      await run();
      expect(
        await prisma.workflowEnrollment.findUnique({
          where: { id: active.id },
        }),
      ).toEqual(active);
      expect(
        await prisma.workflowEnrollment.count({
          where: { workflowId, status: "ACTIVE" },
        }),
      ).toBe(2);
    });
    it.each(["REVOKED", "REMOVED", "INACTIVE"])(
      "rejects %s team access without restoring or partially provisioning",
      async (status) => {
        const row = await prisma.workflowEnrollment.create({
          data: { workflowId, userId: memberId, status },
        });
        await expectRejected("WORKFLOW_ACCESS_REVOKED");
        expect(
          await prisma.workflowEnrollment.findUnique({ where: { id: row.id } }),
        ).toEqual(row);
        expect(await counts()).toEqual({
          projects: 0,
          instances: 0,
          members: 0,
          enrollments: 1,
          audits: 0,
        });
      },
    );
    it("never restores revoked access on an idempotent call to an existing case", async () => {
      await run();
      await prisma.workflowEnrollment.update({
        where: { workflowId_userId: { workflowId, userId: leaderId } },
        data: { status: "REVOKED" },
      });
      await expectRejected("WORKFLOW_ACCESS_REVOKED");
    });
    it.each(["DRAFT", "CLOSED", "ARCHIVED"] as const)(
      "rejects a %s cohort",
      async (status) => {
        await prisma.researchCohort.update({
          where: { id: cohortId },
          data: { status },
        });
        await expectRejected("COHORT_NOT_ACTIVE");
      },
    );
    it("rejects a cohort without an assigned process", async () => {
      await prisma.researchCohort.update({
        where: { id: cohortId },
        data: { workflowId: null },
      });
      await expectRejected("COHORT_PROCESS_NOT_ASSIGNED");
    });
    it.each(["DRAFT", "ARCHIVED"] as const)(
      "rejects a %s process",
      async (status) => {
        await prisma.workflow.update({
          where: { id: workflowId },
          data: { status },
        });
        await expectRejected("COHORT_PROCESS_NOT_PUBLISHED");
      },
    );
    it("rejects mismatched process research type even though the independent foreign keys are valid", async () => {
      const otherType = await prisma.researchType.create({
        data: { name: `${marker}-other`, code: `${code}-other`, programId },
      });
      fixture.researchTypeIds.push(otherType.id);
      await prisma.workflow.update({
        where: { id: workflowId },
        data: { researchTypeId: otherType.id },
      });
      await expectRejected("INVALID_ACADEMIC_SCOPE");
    });
    it("rejects inconsistent workspace academic scope", async () => {
      const otherProgram = await prisma.program.create({
        data: { collegeId, code: `${code}-other`, name: `${marker}-other` },
      });
      fixture.programIds.push(otherProgram.id);
      await prisma.researchWorkspace.update({
        where: { id: workspaceId },
        data: { programId: otherProgram.id },
      });
      await expectRejected("INVALID_ACADEMIC_SCOPE");
    });
    it.each(["null", "different"])(
      "rejects a workspace linked to %s cohort",
      async (mode) => {
        const other =
          mode === "different"
            ? await prisma.researchCohort.create({
                data: {
                  name: "Other cohort",
                  collegeId,
                  programId,
                  researchTypeId: typeId,
                  academicYearId: yearId,
                  createdBy: leaderId,
                },
              })
            : null;
        if (other) cohortIds.push(other.id);
        await prisma.researchWorkspace.update({
          where: { id: workspaceId },
          data: { cohortId: other?.id ?? null },
        });
        await expectRejected("WORKSPACE_COHORT_MISMATCH");
      },
    );
    it("requires the actor to have active cohort membership", async () => {
      await prisma.researchCohortMember.update({
        where: { cohortId_userId: { cohortId, userId: leaderId } },
        data: { status: "REMOVED" },
      });
      await expectRejected("ACTOR_NOT_COHORT_MEMBER");
    });
    it("requires active workspace membership independently of cohort membership", async () => {
      await prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: leaderId } },
        data: { leftAt: new Date() },
      });
      await expectRejected("ACTOR_NOT_WORKSPACE_MEMBER");
    });
    it("does not let an ordinary cohort/workspace member provision as leader", async () => {
      await expect(
        provisionResearchCase({ cohortId, workspaceId, actorId: memberId }),
      ).rejects.toMatchObject({ code: "ACTOR_NOT_WORKSPACE_LEADER" });
      expect((await counts()).projects).toBe(0);
    });
    it("rejects the entire team when an active workspace participant is not an active cohort member", async () => {
      await prisma.researchCohortMember.update({
        where: { cohortId_userId: { cohortId, userId: memberId } },
        data: { status: "REMOVED" },
      });
      await expectRejected("TEAM_MEMBER_NOT_IN_COHORT");
    });
    it("copies no departed workspace participants and supports a solo case", async () => {
      await prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: memberId } },
        data: { leftAt: new Date() },
      });
      await prisma.researchWorkspace.update({
        where: { id: workspaceId },
        data: { participationMode: "SOLO", name: " " },
      });
      const result = await run();
      expect(result.project).toMatchObject({
        title: "Untitled Research Study",
        participationMode: "SOLO",
        groupName: null,
        accessMode: "INVITE_ONLY",
      });
      expect(await counts()).toEqual({
        projects: 1,
        instances: 1,
        members: 1,
        enrollments: 1,
        audits: 1,
      });
    });
    it("rejects when the assigned process has no active stage", async () => {
      await prisma.workflowStage.updateMany({
        where: { workflowId },
        data: { category: "Archived" },
      });
      await expectRejected("NO_ACTIVE_WORKFLOW_STAGE");
    });
    it.each(["researchMember", "workflowInstance", "auditLog"] as const)(
      "rolls back every write when %s fails",
      async (delegate) => {
        const original = prisma.$transaction.bind(prisma);
        const spy = vi.spyOn(prisma, "$transaction").mockImplementation(((
          callback: any,
          options: any,
        ) =>
          original(async (tx) => {
            // Inject only at a real persistence boundary; PostgreSQL performs rollback.
            const wrapped = new Proxy(tx, {
              get(target, key, receiver) {
                if (key === delegate)
                  return new Proxy(Reflect.get(target, key, receiver), {
                    get(model, operation) {
                      if (
                        operation ===
                        (delegate === "researchMember"
                          ? "createMany"
                          : "create")
                      )
                        return async () => {
                          throw new Error("forced persistence failure");
                        };
                      return Reflect.get(model, operation);
                    },
                  });
                return Reflect.get(target, key, receiver);
              },
            });
            return callback(wrapped);
          }, options)) as any);
        try {
          await expect(run()).rejects.toThrow("forced persistence failure");
        } finally {
          spy.mockRestore();
        }
        expect(await counts()).toEqual({
          projects: 0,
          instances: 0,
          members: 0,
          enrollments: 0,
          audits: 0,
        });
      },
    );
    it("retries a real rolled-back serialization failure without duplicating the audit or enrollments", async () => {
      const original = prisma.$transaction.bind(prisma);
      let attempts = 0;
      const spy = vi.spyOn(prisma, "$transaction").mockImplementation(((
        callback: any,
        options: any,
      ) =>
        original(async (tx) => {
          const result = await callback(tx);
          if (++attempts === 1)
            throw new Prisma.PrismaClientKnownRequestError(
              "forced serialization",
              { code: "P2034", clientVersion: Prisma.prismaVersion.client },
            );
          return result;
        }, options)) as any);
      try {
        expect((await run()).created).toBe(true);
      } finally {
        spy.mockRestore();
      }
      expect(attempts).toBe(2);
      expect(await counts()).toEqual({
        projects: 1,
        instances: 1,
        members: 2,
        enrollments: 2,
        audits: 1,
      });
    });
    it("applies the actual migration SQL to existing rows with false defaults in an isolated temporary table", async () => {
      const sql = readFileSync(
        new URL(
          "../../../../packages/database/prisma/migrations/20261027000500_provisional_research_title/migration.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "CREATE TEMPORARY TABLE research_projects (id int PRIMARY KEY, title text NOT NULL) ON COMMIT DROP",
        );
        await tx.$executeRaw`INSERT INTO research_projects (id, title) VALUES (1, 'Existing registered study')`;
        await tx.$executeRawUnsafe(sql);
        await tx.$executeRaw`INSERT INTO research_projects (id, title) VALUES (2, 'Manual study')`;
        await tx.$executeRaw`INSERT INTO research_projects (id, title, is_title_provisional) VALUES (3, 'New case', true)`;
        expect(
          await tx.$queryRaw`SELECT id, title, is_title_provisional FROM research_projects ORDER BY id`,
        ).toEqual([
          {
            id: 1,
            title: "Existing registered study",
            is_title_provisional: false,
          },
          { id: 2, title: "Manual study", is_title_provisional: false },
          { id: 3, title: "New case", is_title_provisional: true },
        ]);
      });
    });
    it("preserves the full manual registration transaction, legacy null cohort, title, dual linkage and workflow progression", async () => {
      await prisma.workflowEnrollment.create({
        data: { workflowId, userId: leaderId },
      });
      const response = await api("/api/research", "POST", {
        title: "Existing manual registration remains supported",
        researchTypeId: typeId,
        collegeId,
        programId,
        academicYearId: yearId,
        workflowId,
      });
      expect(response.status).toBe(201);
      const project = response.body.project;
      expect(project).toMatchObject({
        cohortId: null,
        workspaceId: null,
        isTitleProvisional: false,
        workflowDraft: false,
        title: "Existing manual registration remains supported",
        workflowInstance: {
          workflowId,
          researchId: project.id,
          workflowVersion: 7,
          currentStageId: firstStageId,
        },
      });
      expect(project.workflowInstanceId).toBe(project.workflowInstance.id);
      expect(await api(`/api/research/${project.id}`)).toMatchObject({
        status: 200,
        body: { project: { id: project.id, isTitleProvisional: false } },
      });
      const task = await prisma.workflowTask.create({
        data: {
          stageId: firstStageId,
          title: "Existing mandatory activity",
          sequence: 1,
        },
      });
      const document = await prisma.document.create({
        data: {
          researchId: project.id,
          title: "Legacy approved activity",
          documentType: "MANUSCRIPT",
          createdBy: leaderId,
        },
      });
      await prisma.taskSubmission.create({
        data: {
          researchId: project.id,
          taskId: task.id,
          documentId: document.id,
          submittedBy: leaderId,
          status: "APPROVED",
        },
      });
      await prisma.workflow.update({
        where: { id: workflowId },
        data: { version: 99 },
      });
      expect(
        await prisma.$transaction((tx) =>
          advanceMilestoneIfSatisfied(tx, {
            researchId: project.id,
            milestoneId: firstStageId,
            actorId: leaderId,
          }),
        ),
      ).toMatchObject({ advanced: true });
      expect(
        await prisma.workflowInstance.findUniqueOrThrow({
          where: { id: project.workflowInstanceId },
        }),
      ).toMatchObject({
        workflowId,
        workflowVersion: 7,
        currentStageId: nextStageId,
      });
      expect(
        await prisma.workflowTransition.count({
          where: { workflowInstanceId: project.workflowInstanceId },
        }),
      ).toBe(1);
      expect(
        (
          await prisma.researchProject.findUniqueOrThrow({
            where: { id: project.id },
          })
        ).isTitleProvisional,
      ).toBe(false);
    });
    it("preserves member-triggered legacy participation and cohort-null workspace behavior", async () => {
      await prisma.workflowEnrollment.createMany({
        data: [leaderId, memberId].map((userId) => ({ workflowId, userId })),
      });
      await prisma.researchWorkspace.update({
        where: { id: workspaceId },
        data: { cohortId: null },
      });
      const response = await api(
        `/api/workflows/${workflowId}/participation`,
        "POST",
        { workspaceId },
        memberId,
      );
      expect(response.status).toBe(200);
      const project = response.body.project;
      expect(project).toMatchObject({
        cohortId: null,
        workspaceId,
        title: "",
        isTitleProvisional: false,
        workflowDraft: true,
        createdBy: leaderId,
      });
      const before = await prisma.workflowInstance.findUniqueOrThrow({
        where: { id: project.workflowInstanceId },
      });
      await prisma.researchCohortMember.updateMany({
        where: { cohortId },
        data: { status: "REMOVED" },
      });
      expect(
        await api(
          `/api/workflows/${workflowId}/participation`,
          "POST",
          { workspaceId },
          memberId,
        ),
      ).toMatchObject({ status: 200, body: { project: { id: project.id } } });
      expect(
        await prisma.workflowInstance.findUnique({ where: { id: before.id } }),
      ).toEqual(before);
    });
  },
);
