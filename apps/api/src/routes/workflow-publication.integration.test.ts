import crypto from "node:crypto";
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  "optional organizational Phases through authenticated publication HTTP",
  () => {
    const marker = `publication-${crypto.randomUUID().slice(0, 8)}`;
    const fixture = createIntegrationFixtureScope(marker);
    const cohortIds: string[] = [],
      workspaceIds: string[] = [];
    let server: http.Server,
      base: string,
      collegeId: string,
      programId: string,
      yearId: string,
      typeId: string,
      owner: string,
      student: string,
      roleId: string,
      ordinal = 0;
    async function api(
      path: string,
      method = "GET",
      body?: unknown,
      actor = owner,
    ) {
      const response = await fetch(`${base}/api${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${generateToken(actor)}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: (await response.json()) as any };
    }
    async function draft() {
      const result = await api("/workflows", "POST", {
        name: `${marker} ${++ordinal}`,
        researchTypeId: typeId,
      });
      expect(result.status).toBe(201);
      fixture.workflowIds.push(result.body.workflow.id);
      return result.body.workflow.id as string;
    }
    async function phase(workflowId: string, title = "Proposal") {
      const result = await api(`/workflows/${workflowId}/topics`, "POST", {
        title,
      });
      expect(result.status).toBe(201);
      return result.body.topic.id as string;
    }
    async function requirement(
      workflowId: string,
      values: Record<string, unknown> = {},
    ) {
      const result = await api(`/workflows/${workflowId}/stages`, "POST", {
        name: `Requirement ${++ordinal}`,
        requiresDocument: false,
        ...values,
      });
      expect(result.status).toBe(201);
      return result.body.stage;
    }
    const publish = (id: string) => api(`/workflows/${id}/publish`, "POST", {});
    const stages = (workflowId: string) =>
      prisma.workflowStage.findMany({
        where: { workflowId },
        orderBy: { sequence: "asc" },
      });
    beforeAll(async () => {
      await assertIsolatedIntegrationDatabase(prisma);
      fixture.databaseVerified = true;
      const college = await prisma.college.create({
        data: { code: marker.slice(-8), name: marker },
      });
      collegeId = college.id;
      fixture.collegeIds.push(collegeId);
      const program = await prisma.program.create({
        data: { code: marker.slice(-8), name: marker, collegeId },
      });
      programId = program.id;
      fixture.programIds.push(programId);
      const year = await prisma.academicYear.create({
        data: {
          name: marker,
          startDate: new Date("2098-06-01"),
          endDate: new Date("2099-05-31"),
        },
      });
      yearId = year.id;
      fixture.academicYearIds.push(yearId);
      const type = await prisma.researchType.create({
        data: { code: marker.slice(-8), name: marker, programId },
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
            universityId: `${marker}-${name}`,
            email: `${marker}-${name}@isolated.test`,
            firstName: name,
            lastName: marker,
            collegeId,
            programId,
            status: "ACTIVE",
            roles: { create: { roleId: role.id } },
          },
        });
        fixture.userIds.push(user.id);
        if (name === "RESEARCH_COORDINATOR") owner = user.id;
        else {
          student = user.id;
          roleId = role.id;
        }
      }
      server = http.createServer(app);
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      base = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
    }, 30000);
    afterAll(async () => {
      if (server) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
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
    }, 30000);

    it("saves empty drafts, but rejects empty and Archived-only publication", async () => {
      const id = await draft();
      expect(
        await prisma.workflowTopic.count({ where: { workflowId: id } }),
      ).toBe(0);
      const empty = await publish(id);
      expect(empty.status).toBe(409);
      expect(empty.body.details.issues).toEqual([
        "Add at least one active requirement before publishing this process.",
      ]);
      await prisma.workflowStage.create({
        data: {
          workflowId: id,
          name: "Archived",
          category: "Archived",
          sequence: -1,
          responsibleRoleId: roleId,
        },
      });
      expect((await publish(id)).status).toBe(409);
      expect(
        (await prisma.workflow.findUniqueOrThrow({ where: { id } })).status,
      ).toBe("DRAFT");
    });
    it("creates and publishes a non-document Requirement with no Phase or child item", async () => {
      const id = await draft();
      const stage = await requirement(id);
      expect(stage.topicId).toBeNull();
      expect(
        await prisma.workflowTask.count({ where: { stageId: stage.id } }),
      ).toBe(0);
      expect((await publish(id)).status).toBe(200);
      expect(
        await prisma.workflowTopic.count({ where: { workflowId: id } }),
      ).toBe(0);
    });
    it("preserves interleaved sequence when creating, unassigning, organizing Phases and publishing", async () => {
      const id = await draft(),
        phaseA = await phase(id),
        phaseB = await phase(id, "Defense");
      const first = await requirement(id, { topicId: null });
      const second = await requirement(id, {
        topicId: phaseA,
        requiredMilestoneId: first.id,
      });
      const third = await requirement(id, { topicId: null });
      const fourth = await requirement(id, { topicId: phaseB });
      const before = await stages(id);
      expect(before.map((item) => item.id)).toEqual([
        first.id,
        second.id,
        third.id,
        fourth.id,
      ]);
      expect(
        (
          await api(`/workflows/stages/${fourth.id}`, "PATCH", {
            topicId: null,
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await api(`/workflows/${id}/topics/reorder`, "PATCH", {
            topicIds: [phaseB, phaseA],
          })
        ).status,
      ).toBe(200);
      expect(
        (await stages(id)).map((item) => [item.id, item.sequence]),
      ).toEqual(before.map((item) => [item.id, item.sequence]));
      const configured = await stages(id);
      const result = await publish(id);
      expect(result.status).toBe(200);
      expect(result.body.workflow.stages.map((item: any) => item.id)).toEqual([
        first.id,
        second.id,
        third.id,
        fourth.id,
      ]);
      expect(await stages(id)).toEqual(configured);
    });
    it("retains supplied Phase validation and researcher publication restrictions", async () => {
      const id = await draft(),
        foreign = await phase(await draft());
      for (const topicId of [foreign, "invalid", ""]) {
        expect(
          (
            await api(`/workflows/${id}/stages`, "POST", {
              name: "Invalid phase",
              topicId,
            })
          ).status,
        ).toBe(400);
      }
      const stage = await requirement(id);
      expect(
        (
          await api(`/workflows/stages/${stage.id}`, "PATCH", {
            topicId: foreign,
          })
        ).status,
      ).toBe(400);
      expect(
        (await api(`/workflows/${id}/publish`, "POST", {}, student)).status,
      ).toBe(403);
      expect(
        (
          await prisma.workflowStage.findUniqueOrThrow({
            where: { id: stage.id },
          })
        ).topicId,
      ).toBeNull();
    });
    it("still publishes fully phased definitions without modifying assignments", async () => {
      const id = await draft(),
        topicId = await phase(id);
      await requirement(id, { topicId });
      const before = await stages(id);
      expect((await publish(id)).status).toBe(200);
      expect(await stages(id)).toEqual(before);
      const read = await api("/workflows");
      expect(read.status).toBe(200);
      expect(
        read.body.workflows.find((item: any) => item.id === id).stages[0]
          .topicId,
      ).toBe(topicId);
    });
    it("allows incomplete document drafts but requires a usable required item at publication", async () => {
      const id = await draft();
      const stage = await requirement(id, { requiresDocument: true });
      const task = await prisma.workflowTask.findFirstOrThrow({
        where: { stageId: stage.id },
      });
      await prisma.workflowTask.delete({ where: { id: task.id } });
      const read = await api("/workflows");
      expect(read.status).toBe(200);
      expect(
        read.body.workflows.find((item: any) => item.id === id).status,
      ).toBe("DRAFT");
      expect((await publish(id)).status).toBe(409);
      const item = await prisma.workflowTask.create({
        data: {
          stageId: stage.id,
          title: "Proposal manuscript",
          sequence: 1,
          isRequired: false,
          allowedFileTypes: "PDF",
        },
      });
      expect((await publish(id)).status).toBe(409);
      await prisma.workflowTask.update({
        where: { id: item.id },
        data: { isRequired: true, allowedFileTypes: "ZIP" },
      });
      expect((await publish(id)).status).toBe(409);
      await prisma.workflowTask.update({
        where: { id: item.id },
        data: { allowedFileTypes: "application/pdf" },
      });
      expect((await publish(id)).status).toBe(200);
    });
    it("retains special adviser and defense settings without mandatory Phases", async () => {
      const id = await draft();
      const adviser = await requirement(id, {
        milestoneType: "ADVISER_SELECTION",
        requiresDocument: true,
        submissionMode: "INDIVIDUAL",
      });
      expect(adviser).toMatchObject({
        topicId: null,
        requiresApproval: true,
        requiresDocument: false,
        submissionMode: "GROUP",
      });
      expect(
        (
          await api(`/workflows/${id}/stages`, "POST", {
            name: "Duplicate adviser",
            milestoneType: "ADVISER_SELECTION",
          })
        ).status,
      ).toBe(409);
      const defense = await requirement(id, {
        milestoneType: "DEFENSE_ELIGIBILITY",
        requiresApproval: false,
        submissionMode: "INDIVIDUAL",
      });
      expect(defense).toMatchObject({
        topicId: null,
        requiresApproval: true,
        submissionMode: "GROUP",
      });
      expect((await publish(id)).status).toBe(200);
    });
    it("does not change existing published definitions, cohort assignment, legacy case pinning or revoked enrollment", async () => {
      const oldId = await draft(),
        topicId = await phase(oldId);
      const first = await requirement(oldId, { topicId });
      await requirement(oldId, { topicId });
      expect((await publish(oldId)).status).toBe(200);
      const cohort = await prisma.researchCohort.create({
        data: {
          name: marker,
          collegeId,
          programId,
          academicYearId: yearId,
          researchTypeId: typeId,
          workflowId: oldId,
          createdBy: owner,
        },
      });
      cohortIds.push(cohort.id);
      await prisma.researchType.update({
        where: { id: typeId },
        data: { workflowId: oldId },
      });
      const project = await prisma.researchProject.create({
        data: {
          title: marker,
          collegeId,
          programId,
          academicYearId: yearId,
          researchTypeId: typeId,
          createdBy: student,
          members: { create: { userId: student, projectRole: "LEADER" } },
        },
      });
      fixture.projectIds.push(project.id);
      const instance = await prisma.workflowInstance.create({
        data: {
          researchId: project.id,
          workflowId: oldId,
          workflowVersion: 1,
          currentStageId: first.id,
        },
      });
      await prisma.researchProject.update({
        where: { id: project.id },
        data: { workflowInstanceId: instance.id },
      });
      const enrollment = await prisma.workflowEnrollment.create({
        data: { workflowId: oldId, userId: student, status: "REVOKED" },
      });
      const before = await prisma.workflow.findUniqueOrThrow({
        where: { id: oldId },
        include: { topics: true, stages: true },
      });
      const nextId = await draft();
      await requirement(nextId);
      expect((await publish(nextId)).status).toBe(200);
      expect((await publish(oldId)).body.alreadyPublished).toBe(true);
      expect(
        await prisma.workflow.findUniqueOrThrow({
          where: { id: oldId },
          include: { topics: true, stages: true },
        }),
      ).toEqual(before);
      expect(
        await prisma.workflowInstance.findUniqueOrThrow({
          where: { id: instance.id },
        }),
      ).toEqual(instance);
      expect(
        (
          await prisma.researchProject.findUniqueOrThrow({
            where: { id: project.id },
          })
        ).workflowInstanceId,
      ).toBe(instance.id);
      expect(
        (
          await prisma.researchCohort.findUniqueOrThrow({
            where: { id: cohort.id },
          })
        ).workflowId,
      ).toBe(oldId);
      expect(
        (await prisma.researchType.findUniqueOrThrow({ where: { id: typeId } }))
          .workflowId,
      ).toBe(oldId);
      expect(
        await prisma.workflowEnrollment.findUniqueOrThrow({
          where: { id: enrollment.id },
        }),
      ).toEqual(enrollment);
      const read = await api("/workflows");
      expect(read.status).toBe(200);
      expect(
        read.body.workflows.find((item: any) => item.id === oldId).stages[0]
          .topicId,
      ).toBe(topicId);
    });
    it("starts a new cohort case at sequence one and transitions across unphased Requirements with the existing engine", async () => {
      const id = await draft(),
        topicId = await phase(id);
      const first = await requirement(id),
        second = await requirement(id, { topicId }),
        third = await requirement(id);
      expect((await publish(id)).status).toBe(200);
      const created = await api("/cohorts", "POST", {
        name: `${marker} start`,
        collegeId,
        programId,
        academicYearId: yearId,
        researchTypeId: typeId,
      });
      expect(created.status).toBe(201);
      const cohortId = created.body.cohort.id;
      cohortIds.push(cohortId);
      expect(
        (await api(`/cohorts/${cohortId}/workflow`, "PUT", { workflowId: id }))
          .status,
      ).toBe(200);
      expect(
        (
          await api(`/cohorts/${cohortId}/members`, "POST", {
            userIds: [student],
          })
        ).status,
      ).toBe(201);
      expect(
        (await api(`/cohorts/${cohortId}`, "PATCH", { status: "ACTIVE" }))
          .status,
      ).toBe(200);
      const workspace = await api(
        "/workspaces",
        "POST",
        { name: "Ready research team", participationMode: "SOLO", cohortId },
        student,
      );
      expect(workspace.status).toBe(201);
      workspaceIds.push(workspace.body.workspace.id);
      const start = await api(
        `/workspaces/${workspace.body.workspace.id}/start-research`,
        "POST",
        {},
        student,
      );
      expect(start.status).toBe(201);
      fixture.projectIds.push(start.body.project.id);
      expect(start.body.workflowInstance).toMatchObject({
        workflowId: id,
        workflowVersion: 1,
        currentStageId: first.id,
      });
      for (const stage of [second, third]) {
        const moved = await api(
          `/workflows/instances/${start.body.workflowInstance.id}/transition`,
          "POST",
          {
            workflowInstanceId: start.body.workflowInstance.id,
            toStageId: stage.id,
          },
        );
        expect(moved.status).toBe(200);
        expect(moved.body.workflowInstance.currentStageId).toBe(stage.id);
      }
      expect(
        (await stages(id)).map((item) => [item.sequence, item.topicId]),
      ).toEqual([
        [1, null],
        [2, topicId],
        [3, null],
      ]);
    });
  },
);
