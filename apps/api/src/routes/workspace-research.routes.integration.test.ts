import crypto from "node:crypto";
import http from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { generateToken } from "../middleware/auth.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
databaseDescribe(
  "explicit cohort research start through authenticated workspace HTTP",
  () => {
    const suffix = crypto.randomUUID().slice(0, 8),
      code = `RS${suffix}`;
    const fixture = createIntegrationFixtureScope(`research-start-${suffix}`);
    const cohortIds: string[] = [],
      workspaceIds: string[] = [];
    let server: http.Server, base: string;
    let collegeId: string,
      programId: string,
      yearId: string,
      typeId: string,
      workflowId: string,
      stageId: string,
      cohortId: string,
      researcherRoleId: string,
      coordinatorId: string;
    let leaderId: string,
      memberId: string,
      cohortOnlyId: string,
      outsiderId: string,
      workspaceId: string,
      inviteCode: string;
    let iteration = 0;
    async function api(
      actorId: string | null,
      path: string,
      method = "GET",
      body?: unknown,
    ) {
      const response = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(actorId
            ? { Authorization: `Bearer ${generateToken(actorId)}` }
            : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: (await response.json()) as any };
    }
    const start = (actorId: string | null = leaderId, body?: unknown) =>
      api(
        actorId,
        `/api/workspaces/${workspaceId}/start-research`,
        "POST",
        body,
      );
    async function counts() {
      return {
        projects: await prisma.researchProject.count({
          where: { workspaceId },
        }),
        instances: await prisma.workflowInstance.count({
          where: {
            researchId: {
              in: (
                await prisma.researchProject.findMany({
                  where: { workspaceId },
                  select: { id: true },
                })
              ).map((project) => project.id),
            },
          },
        }),
        members: await prisma.researchMember.count({
          where: { research: { workspaceId } },
        }),
        enrollments: await prisma.workflowEnrollment.count({
          where: {
            workflowId,
            userId: { in: [leaderId, memberId, cohortOnlyId] },
          },
        }),
        audits: await prisma.auditLog.count({
          where: {
            userId: leaderId,
            newValues: {
              path: ["operation"],
              equals: "RESEARCH_CASE_PROVISIONED",
            },
          },
        }),
      };
    }
    async function makeUser(label: string, roleId: string) {
      const row = await prisma.user.create({
        data: {
          universityId: `${code}-${label}`,
          email: `${code}-${label}@isolated.test`,
          firstName: label,
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
    beforeAll(async () => {
      await assertIsolatedIntegrationDatabase(prisma);
      fixture.databaseVerified = true;
      const college = await prisma.college.create({
        data: { code, name: `Research Start ${suffix}` },
      });
      collegeId = college.id;
      fixture.collegeIds.push(collegeId);
      const program = await prisma.program.create({
        data: { code, name: `Research Start ${suffix}`, collegeId },
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
        data: { name: code, code, programId },
      });
      typeId = type.id;
      fixture.researchTypeIds.push(typeId);
      const researcher = await prisma.role.upsert({
        where: { name: "RESEARCHER" },
        update: {},
        create: { name: "RESEARCHER" },
      });
      researcherRoleId = researcher.id;
      const coordinator = await prisma.role.upsert({
        where: { name: "RESEARCH_COORDINATOR" },
        update: {},
        create: { name: "RESEARCH_COORDINATOR" },
      });
      coordinatorId = await makeUser("coordinator", coordinator.id);
      const workflow = await prisma.workflow.create({
        data: {
          name: `${code} process`,
          researchTypeId: typeId,
          createdBy: coordinatorId,
          status: "PUBLISHED",
          version: 7,
          stages: {
            create: {
              name: "First requirement",
              sequence: 1,
              responsibleRoleId: researcherRoleId,
            },
          },
        },
        include: { stages: true },
      });
      workflowId = workflow.id;
      stageId = workflow.stages[0].id;
      fixture.workflowIds.push(workflowId);
      server = app.listen(0, "127.0.0.1");
      await new Promise<void>((resolve) => server.once("listening", resolve));
      base = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
      const cohort = await api(coordinatorId, "/api/cohorts", "POST", {
        name: code,
        collegeId,
        programId,
        academicYearId: yearId,
        researchTypeId: typeId,
      });
      expect(cohort.status).toBe(201);
      cohortId = cohort.body.cohort.id;
      cohortIds.push(cohortId);
      expect(
        (
          await api(coordinatorId, `/api/cohorts/${cohortId}/workflow`, "PUT", {
            workflowId,
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await api(coordinatorId, `/api/cohorts/${cohortId}`, "PATCH", {
            status: "ACTIVE",
          })
        ).status,
      ).toBe(200);
    });
    beforeEach(async () => {
      // Each test owns a fresh team; restore deliberate lifecycle/configuration test mutations.
      await prisma.workflow.update({
        where: { id: workflowId },
        data: { status: "PUBLISHED" },
      });
      await prisma.researchCohort.update({
        where: { id: cohortId },
        data: { status: "ACTIVE", workflowId },
      });
      const label = ++iteration;
      leaderId = await makeUser(`${label}-leader`, researcherRoleId);
      memberId = await makeUser(`${label}-member`, researcherRoleId);
      cohortOnlyId = await makeUser(`${label}-cohort-only`, researcherRoleId);
      outsiderId = await makeUser(`${label}-outsider`, researcherRoleId);
      expect(
        (
          await api(coordinatorId, `/api/cohorts/${cohortId}/members`, "POST", {
            userIds: [leaderId, memberId, cohortOnlyId],
          })
        ).status,
      ).toBe(201);
      const created = await api(leaderId, "/api/workspaces", "POST", {
        name: `Ready team ${label}`,
        participationMode: "GROUP",
        cohortId,
      });
      expect(created.status).toBe(201);
      workspaceId = created.body.workspace.id;
      inviteCode = created.body.workspace.inviteCode;
      workspaceIds.push(workspaceId);
      expect(
        (await api(memberId, `/api/workspaces/join/${inviteCode}`, "POST"))
          .status,
      ).toBe(200);
    });
    afterAll(async () => {
      if (server)
        await new Promise<void>((resolve) => server.close(() => resolve()));
      if (!fixture.databaseVerified) return;
      const projects = await prisma.researchProject.findMany({
        where: { createdBy: { in: fixture.userIds } },
        select: { id: true },
      });
      fixture.projectIds.push(...projects.map((project) => project.id));
      await prisma.researchWorkspace.deleteMany({
        where: { id: { in: workspaceIds } },
      });
      await prisma.researchCohort.deleteMany({
        where: { id: { in: cohortIds } },
      });
      await cleanupIntegrationFixture(prisma, fixture);
      expect(
        await prisma.researchWorkspace.count({
          where: { id: { in: workspaceIds } },
        }),
      ).toBe(0);
    }, 30000);

    it("creates no case or workflow access during team creation, invitation or code acceptance", async () => {
      expect(await counts()).toEqual({
        projects: 0,
        instances: 0,
        members: 0,
        enrollments: 0,
        audits: 0,
      });
      const recipient = await prisma.user.findUniqueOrThrow({
        where: { id: cohortOnlyId },
      });
      expect(
        (
          await api(
            leaderId,
            `/api/workspaces/${workspaceId}/invitations`,
            "POST",
            { email: recipient.email },
          )
        ).status,
      ).toBe(201);
      expect(await counts()).toEqual({
        projects: 0,
        instances: 0,
        members: 0,
        enrollments: 0,
        audits: 0,
      });
      expect(
        (await api(cohortOnlyId, `/api/workspaces/join/${inviteCode}`, "POST"))
          .status,
      ).toBe(200);
      expect(await counts()).toEqual({
        projects: 0,
        instances: 0,
        members: 0,
        enrollments: 0,
        audits: 0,
      });
      const result = await start();
      expect(result.status).toBe(201);
      expect((await counts()).members).toBe(3);
    });
    it("lets the leader explicitly start the configured process with a provisional title and exact members", async () => {
      const notifications = await prisma.notification.count({
        where: { recipientId: { in: [leaderId, memberId] } },
      });
      const result = await start();
      expect(result.status).toBe(201);
      expect(result.body).toMatchObject({
        created: true,
        project: {
          cohortId,
          workspaceId,
          collegeId,
          programId,
          researchTypeId: typeId,
          academicYearId: yearId,
          isTitleProvisional: true,
          workflowDraft: true,
          title: `Ready team ${iteration} Research Study`,
          createdBy: leaderId,
        },
        workflowInstance: {
          workflowId,
          workflowVersion: 7,
          currentStageId: stageId,
          researchId: result.body.project.id,
        },
      });
      expect(result.body.project.workflowInstanceId).toBe(
        result.body.workflowInstance.id,
      );
      expect(await counts()).toEqual({
        projects: 1,
        instances: 1,
        members: 2,
        enrollments: 2,
        audits: 1,
      });
      expect(
        await prisma.researchMember.findMany({
          where: { researchId: result.body.project.id },
          select: { userId: true, projectRole: true },
        }),
      ).toEqual(
        expect.arrayContaining([
          { userId: leaderId, projectRole: "LEADER" },
          { userId: memberId, projectRole: "MEMBER" },
        ]),
      );
      expect(
        await prisma.notification.count({
          where: { recipientId: { in: [leaderId, memberId] } },
        }),
      ).toBe(notifications);
    });
    it("returns the same case and pinned instance with 200 on a repeat", async () => {
      const first = await start();
      const second = await start(leaderId, {});
      expect(second.status).toBe(200);
      expect(second.body).toEqual({ ...first.body, created: false });
      expect(await counts()).toEqual({
        projects: 1,
        instances: 1,
        members: 2,
        enrollments: 2,
        audits: 1,
      });
    });
    it("handles two simultaneous HTTP starts without duplicate research records", async () => {
      const results = await Promise.all([start(), start()]);
      expect(results.map((result) => result.status).sort()).toEqual([200, 201]);
      expect(results[0].body.project.id).toBe(results[1].body.project.id);
      expect(results[0].body.workflowInstance.id).toBe(
        results[1].body.workflowInstance.id,
      );
      expect(await counts()).toEqual({
        projects: 1,
        instances: 1,
        members: 2,
        enrollments: 2,
        audits: 1,
      });
    });
    it("requires authentication, researcher role, active workspace leadership and current membership", async () => {
      expect((await start(null)).status).toBe(401);
      for (const actor of [outsiderId, cohortOnlyId, memberId, coordinatorId])
        expect((await start(actor)).status).toBe(403);
      await prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: leaderId } },
        data: { leftAt: new Date() },
      });
      expect((await start()).status).toBe(403);
      expect((await counts()).projects).toBe(0);
    });
    it("rejects invalid identifiers and all caller-supplied registration metadata", async () => {
      expect(
        (
          await api(
            leaderId,
            "/api/workspaces/not-a-uuid/start-research",
            "POST",
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await api(
            leaderId,
            `/api/workspaces/${crypto.randomUUID()}/start-research`,
            "POST",
          )
        ).status,
      ).toBe(404);
      for (const key of [
        "title",
        "workflowId",
        "researchTypeId",
        "programId",
        "collegeId",
        "academicYearId",
        "cohortId",
        "actorId",
      ]) {
        expect(
          (await start(leaderId, { [key]: crypto.randomUUID() })).status,
        ).toBe(400);
      }
      expect(
        (
          await api(
            leaderId,
            `/api/workspaces/${workspaceId}/start-research?cohortId=${cohortId}`,
            "POST",
          )
        ).status,
      ).toBe(400);
      expect(await counts()).toEqual({
        projects: 0,
        instances: 0,
        members: 0,
        enrollments: 0,
        audits: 0,
      });
    });
    it("does not attach a legacy cohort-null workspace during start", async () => {
      await prisma.researchWorkspace.update({
        where: { id: workspaceId },
        data: { cohortId: null },
      });
      expect((await start()).status).toBe(409);
      expect(
        (
          await prisma.researchWorkspace.findUniqueOrThrow({
            where: { id: workspaceId },
          })
        ).cohortId,
      ).toBeNull();
      expect((await counts()).projects).toBe(0);
    });
    it("rejects an actor removed from the cohort even if still workspace leader", async () => {
      await prisma.researchCohortMember.update({
        where: { cohortId_userId: { cohortId, userId: leaderId } },
        data: { status: "REMOVED" },
      });
      expect((await start()).status).toBe(403);
      expect((await counts()).projects).toBe(0);
    });
    it("blocks the entire start when an existing team member leaves the cohort", async () => {
      await prisma.researchCohortMember.update({
        where: { cohortId_userId: { cohortId, userId: memberId } },
        data: { status: "REMOVED" },
      });
      const response = await start();
      expect(response.status).toBe(409);
      expect(response.body.error).toContain("Every active team participant");
      expect(await counts()).toEqual({
        projects: 0,
        instances: 0,
        members: 0,
        enrollments: 0,
        audits: 0,
      });
    });
    it.each(["DRAFT", "CLOSED", "ARCHIVED"] as const)(
      "blocks start in a %s cohort",
      async (status) => {
        await prisma.researchCohort.update({
          where: { id: cohortId },
          data: { status },
        });
        expect((await start()).status).toBe(409);
        expect((await counts()).projects).toBe(0);
      },
    );
    it("blocks missing or unpublished process assignments", async () => {
      await prisma.researchCohort.update({
        where: { id: cohortId },
        data: { workflowId: null },
      });
      expect((await start()).status).toBe(409);
      await prisma.researchCohort.update({
        where: { id: cohortId },
        data: { workflowId },
      });
      await prisma.workflow.update({
        where: { id: workflowId },
        data: { status: "DRAFT" },
      });
      expect((await start()).status).toBe(409);
      expect((await counts()).projects).toBe(0);
    });
    it.each(["REVOKED", "INACTIVE"])(
      "never restores %s member process access",
      async (status) => {
        const enrollment = await prisma.workflowEnrollment.create({
          data: { workflowId, userId: memberId, status },
        });
        const response = await start();
        expect(response.status).toBe(409);
        expect(response.body.error).toContain("coordinator");
        expect(
          await prisma.workflowEnrollment.findUnique({
            where: { id: enrollment.id },
          }),
        ).toEqual(enrollment);
        expect(await counts()).toEqual({
          projects: 0,
          instances: 0,
          members: 0,
          enrollments: 1,
          audits: 0,
        });
      },
    );
    it("preserves existing ACTIVE enrollment timestamps", async () => {
      const enrollment = await prisma.workflowEnrollment.create({
        data: {
          workflowId,
          userId: memberId,
          joinedAt: new Date("2020-01-01"),
        },
      });
      expect((await start()).status).toBe(201);
      expect(
        await prisma.workflowEnrollment.findUnique({
          where: { id: enrollment.id },
        }),
      ).toEqual(enrollment);
    });
    it("allows current team members to access the started case while submission and resource access still respect enrollment revocation", async () => {
      const result = await start();
      expect(result.status).toBe(201);
      const projectId = result.body.project.id;
      expect((await api(memberId, `/api/research/${projectId}`)).status).toBe(
        200,
      );
      expect((await api(outsiderId, `/api/research/${projectId}`)).status).toBe(
        404,
      );
      const task = await prisma.workflowTask.create({
        data: { stageId, title: `Activity ${iteration}`, sequence: iteration },
      });
      const options = `/api/workflows/tasks/${task.id}/submission-options?researchId=${projectId}`;
      expect((await api(memberId, options)).status).toBe(200);
      expect(
        (await api(memberId, `/api/workflows/${workflowId}/resources`)).status,
      ).toBe(200);
      await prisma.workflowEnrollment.update({
        where: { workflowId_userId: { workflowId, userId: memberId } },
        data: { status: "REVOKED" },
      });
      expect((await api(memberId, options)).status).toBe(403);
      expect(
        (await api(memberId, `/api/workflows/${workflowId}/resources`)).status,
      ).toBe(404);
      expect((await start()).status).toBe(409);
      expect(
        (
          await prisma.researchMember.findFirst({
            where: { researchId: projectId, userId: memberId },
          })
        )?.leftAt,
      ).toBeNull();
    });
    it("keeps post-start team joins on the existing project invitation path", async () => {
      expect((await start()).status).toBe(201);
      expect(
        (await api(cohortOnlyId, `/api/workspaces/join/${inviteCode}`, "POST"))
          .status,
      ).toBe(409);
      expect((await counts()).members).toBe(2);
    });
    it("supports an explicitly created valid solo workspace without auto-creating another", async () => {
      const created = await api(leaderId, "/api/workspaces", "POST", {
        name: "Individual workspace",
        participationMode: "SOLO",
        cohortId,
      });
      expect(created.status).toBe(201);
      const soloId = created.body.workspace.id;
      workspaceIds.push(soloId);
      expect(
        await prisma.researchProject.count({ where: { workspaceId: soloId } }),
      ).toBe(0);
      const path = `/api/workspaces/${soloId}/start-research`;
      const first = await api(leaderId, path, "POST"),
        second = await api(leaderId, path, "POST");
      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(first.body.project).toMatchObject({
        participationMode: "SOLO",
        isTitleProvisional: true,
        cohortId,
        workspaceId: soloId,
      });
      expect(second.body.project.id).toBe(first.body.project.id);
      expect(
        await prisma.researchProject.count({ where: { workspaceId: soloId } }),
      ).toBe(1);
      expect(
        await prisma.researchWorkspace.count({ where: { id: soloId } }),
      ).toBe(1);
    });
    it("validates optional cohort linkage on team creation and cohort-linked join without changing legacy formation", async () => {
      expect(
        (
          await api(outsiderId, "/api/workspaces", "POST", {
            name: "Invalid cohort team",
            participationMode: "GROUP",
            cohortId,
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await api(leaderId, "/api/workspaces", "POST", {
            name: "Invalid identifier",
            participationMode: "GROUP",
            cohortId: "invalid",
          })
        ).status,
      ).toBe(400);
      expect(
        (await api(outsiderId, `/api/workspaces/join/${inviteCode}`, "POST"))
          .status,
      ).toBe(403);
      const created = await api(outsiderId, "/api/workspaces", "POST", {
        name: "Legacy team",
        participationMode: "GROUP",
      });
      expect(created.status).toBe(201);
      workspaceIds.push(created.body.workspace.id);
      expect(created.body.workspace.cohortId).toBeNull();
      expect(
        (
          await api(
            cohortOnlyId,
            `/api/workspaces/join/${created.body.workspace.inviteCode}`,
            "POST",
          )
        ).status,
      ).toBe(200);
      expect(
        await prisma.researchProject.count({
          where: { workspaceId: created.body.workspace.id },
        }),
      ).toBe(0);
      expect((await counts()).enrollments).toBe(0);
    });
  },
);
