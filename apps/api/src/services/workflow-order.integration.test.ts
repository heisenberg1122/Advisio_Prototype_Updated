import crypto from "node:crypto";
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, prisma } from "../lib/prisma.js";
import app from "../app.js";
import { generateToken } from "../middleware/auth.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";
import {
  reorderWorkflowMilestones,
  reorderWorkflowTopics,
} from "./workflow-order.service.js";
import { assertMilestoneCondition } from "./milestone-condition.service.js";
import { getMilestoneProgress } from "./research-workflow-integration.service.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
databaseDescribe("safe workflow reordering", () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const marker = `workflow-order-${suffix}`;
  const fixture = createIntegrationFixtureScope(marker);
  let collegeId: string,
    programId: string,
    yearId: string,
    actorId: string,
    roleId: string,
    typeId: string;
  let version = 0;
  let server: http.Server;
  let base: string;
  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    fixture.databaseVerified = true;
    const college = await prisma.college.create({
      data: { code: `WO-${suffix}`, name: marker },
    });
    collegeId = college.id;
    fixture.collegeIds.push(collegeId);
    const program = await prisma.program.create({
      data: { collegeId, code: `WO-${suffix}`, name: marker },
    });
    programId = program.id;
    fixture.programIds.push(programId);
    const year = await prisma.academicYear.create({
      data: {
        name: `WO-${suffix}`,
        startDate: new Date("2098-01-01"),
        endDate: new Date("2099-01-01"),
      },
    });
    yearId = year.id;
    fixture.academicYearIds.push(yearId);
    const user = await prisma.user.create({
      data: {
        universityId: marker,
        email: `${marker}@isolated.test`,
        firstName: "Workflow",
        lastName: "Fixture",
        collegeId,
        programId,
        status: "ACTIVE",
      },
    });
    actorId = user.id;
    fixture.userIds.push(actorId);
    const role = await prisma.role.upsert({
      where: { name: "RESEARCH_COORDINATOR" },
      create: { name: "RESEARCH_COORDINATOR" },
      update: {},
    });
    roleId = role.id;
    await prisma.userRole.create({ data: { userId: actorId, roleId } });
    await prisma.collegeMembership.create({
      data: { userId: actorId, collegeId, roleNames: ["RESEARCH_COORDINATOR"] },
    });
    const type = await prisma.researchType.create({
      data: { programId, code: marker, name: marker },
    });
    typeId = type.id;
    fixture.researchTypeIds.push(typeId);
    server = http.createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await cleanupIntegrationFixture(prisma, fixture);
  });

  const setup = async (withProject = false) => {
    const workflow = await prisma.workflow.create({
      data: {
        researchTypeId: typeId,
        name: `${marker}-${++version}`,
        version,
        createdBy: actorId,
        status: "PUBLISHED",
      },
    });
    fixture.workflowIds.push(workflow.id);
    const topics = await Promise.all(
      [1, 2, 3].map((sequence) =>
        prisma.workflowTopic.create({
          data: {
            workflowId: workflow.id,
            title: `Phase ${sequence}`,
            sequence,
          },
        }),
      ),
    );
    const stages: Prisma.WorkflowStageGetPayload<{
      include: { tasks: true };
    }>[] = [];
    for (let index = 0; index < 3; index++)
      stages.push(
        await prisma.workflowStage.create({
          data: {
            workflowId: workflow.id,
            topicId: topics[index === 2 ? 2 : 0].id,
            name: `Milestone ${index + 1}`,
            sequence: index + 1,
            responsibleRoleId: roleId,
            requiresApproval: true,
            requiresDocument: false,
            isFinal: index === 2,
            requiredMilestoneId: index ? stages[index - 1].id : null,
            tasks: {
              create: {
                title: "Required capstone",
                sequence: 1,
                isRequired: true,
              },
            },
          },
          include: { tasks: true },
        }),
      );
    const archived = await prisma.workflowStage.create({
      data: {
        workflowId: workflow.id,
        name: "Archived",
        sequence: -1,
        category: "Archived",
        responsibleRoleId: roleId,
      },
    });
    const positions = stages.map(({ id, topicId }) => ({ id, topicId }));
    let projectId: string | null = null;
    let instanceId: string | null = null;
    const submissions = [];
    if (withProject) {
      const project = await prisma.researchProject.create({
        data: {
          title: marker,
          collegeId,
          programId,
          researchTypeId: typeId,
          academicYearId: yearId,
          createdBy: actorId,
        },
      });
      projectId = project.id;
      fixture.projectIds.push(project.id);
      const instance = await prisma.workflowInstance.create({
        data: {
          researchId: project.id,
          workflowId: workflow.id,
          workflowVersion: workflow.version,
          currentStageId: stages[1].id,
        },
      });
      instanceId = instance.id;
      await prisma.researchProject.update({
        where: { id: project.id },
        data: { workflowInstanceId: instance.id },
      });
      for (const [index, stage] of stages.entries()) {
        const document = await prisma.document.create({
          data: {
            researchId: project.id,
            title: stage.name,
            documentType: "MANUSCRIPT",
            createdBy: actorId,
            milestoneId: stage.id,
          },
        });
        submissions.push(
          await prisma.taskSubmission.create({
            data: {
              researchId: project.id,
              taskId: stage.tasks[0].id,
              documentId: document.id,
              submittedBy: actorId,
              status: index === 0 ? "APPROVED" : "SUBMITTED",
              reviewNote: index === 0 ? "Approved before reordering" : null,
            },
          }),
        );
      }
    }
    const move = (order: typeof positions, expectedStages = positions) =>
      prisma.$transaction(
        (tx) =>
          reorderWorkflowMilestones(
            tx,
            workflow.id,
            { stages: order, expectedStages },
            actorId,
          ),
        { isolationLevel: "Serializable" },
      );
    const read = () =>
      prisma.workflowStage.findMany({
        where: { workflowId: workflow.id, category: { not: "Archived" } },
        orderBy: { sequence: "asc" },
      });
    return {
      workflow,
      topics,
      stages,
      archived,
      positions,
      projectId,
      instanceId,
      submissions,
      move,
      read,
    };
  };
  it("swaps milestones and rewrites the chain without forward dependencies or cycles", async () => {
    const f = await setup();
    await f.move([f.positions[1], f.positions[0], f.positions[2]]);
    expect(
      (await f.read()).map(
        ({ id, sequence, requiredMilestoneId, isFinal }) => ({
          id,
          sequence,
          requiredMilestoneId,
          isFinal,
        }),
      ),
    ).toEqual([
      {
        id: f.stages[1].id,
        sequence: 1,
        requiredMilestoneId: null,
        isFinal: false,
      },
      {
        id: f.stages[0].id,
        sequence: 2,
        requiredMilestoneId: f.stages[1].id,
        isFinal: false,
      },
      {
        id: f.stages[2].id,
        sequence: 3,
        requiredMilestoneId: f.stages[0].id,
        isFinal: true,
      },
    ]);
    expect(
      await prisma.workflowStage.findUnique({ where: { id: f.archived.id } }),
    ).toMatchObject({ sequence: -1, category: "Archived", isFinal: false });
  });
  it("supports moving into an empty phase and moving the former final milestone earlier", async () => {
    const f = await setup();
    await f.move([
      f.positions[0],
      { ...f.positions[2], topicId: f.topics[0].id },
      { ...f.positions[1], topicId: f.topics[1].id },
    ]);
    expect(
      (await f.read()).map((stage) => [
        stage.id,
        stage.topicId,
        stage.requiredMilestoneId,
        stage.isFinal,
      ]),
    ).toEqual([
      [f.stages[0].id, f.topics[0].id, null, false],
      [f.stages[2].id, f.topics[0].id, f.stages[0].id, false],
      [f.stages[1].id, f.topics[1].id, f.stages[2].id, true],
    ]);
  });
  it("reorders entire phases and updates requirements across their boundaries", async () => {
    const f = await setup();
    await prisma.$transaction((tx) =>
      reorderWorkflowTopics(
        tx,
        f.workflow.id,
        [f.topics[2].id, f.topics[1].id, f.topics[0].id],
        actorId,
        f.topics.map((topic) => topic.id),
      ),
    );
    const stages = await f.read();
    expect(stages.map((stage) => stage.id)).toEqual([
      f.stages[2].id,
      f.stages[0].id,
      f.stages[1].id,
    ]);
    expect(stages.map((stage) => stage.requiredMilestoneId)).toEqual([
      null,
      f.stages[2].id,
      f.stages[0].id,
    ]);
    expect(stages.map((stage) => stage.isFinal)).toEqual([false, false, true]);
  });
  it("preserves actual approval records, realigns current progress, and blocks later work until the new prerequisite finishes", async () => {
    const f = await setup(true);
    const before = await prisma.taskSubmission.findMany({
      where: { researchId: f.projectId! },
      orderBy: { id: "asc" },
    });
    await f.move([
      { ...f.positions[2], topicId: f.topics[0].id },
      f.positions[0],
      f.positions[1],
    ]);
    expect(
      await prisma.taskSubmission.findMany({
        where: { researchId: f.projectId! },
        orderBy: { id: "asc" },
      }),
    ).toEqual(before);
    expect(
      await prisma.workflowInstance.findUnique({
        where: { id: f.instanceId! },
      }),
    ).toMatchObject({ currentStageId: f.stages[2].id, completedAt: null });
    await expect(
      assertMilestoneCondition(prisma, f.projectId!, f.stages[0].id),
    ).rejects.toMatchObject({ statusCode: 409 });
    await prisma.taskSubmission.update({
      where: { id: f.submissions[2].id },
      data: { status: "APPROVED" },
    });
    await expect(
      assertMilestoneCondition(prisma, f.projectId!, f.stages[0].id),
    ).resolves.toBeUndefined();
    expect(
      (await getMilestoneProgress(prisma, f.projectId!)).find(
        (stage) => stage.id === f.stages[0].id,
      ),
    ).toMatchObject({ completed: true, isBlocked: false });
  });
  it.each([
    "duplicate",
    "omitted",
    "foreign",
    "archived",
    "foreign phase",
    "mixed phases",
  ])("rejects %s positions with no partial writes", async (invalid) => {
    const f = await setup();
    const before = await f.read();
    const order =
      invalid === "duplicate"
        ? [f.positions[0], f.positions[0], f.positions[2]]
        : invalid === "omitted"
          ? f.positions.slice(1)
          : invalid === "foreign"
            ? [
                { ...f.positions[0], id: crypto.randomUUID() },
                ...f.positions.slice(1),
              ]
            : invalid === "archived"
              ? [
                  { ...f.positions[0], id: f.archived.id },
                  ...f.positions.slice(1),
                ]
              : invalid === "foreign phase"
                ? [
                    { ...f.positions[0], topicId: crypto.randomUUID() },
                    ...f.positions.slice(1),
                  ]
                : [f.positions[0], f.positions[2], f.positions[1]];
    await expect(f.move(order)).rejects.toMatchObject({ statusCode: 400 });
    expect(await f.read()).toEqual(before);
  });
  it("rejects stale tabs, including changed phase assignments", async () => {
    const f = await setup();
    await f.move([f.positions[1], f.positions[0], f.positions[2]]);
    await expect(
      f.move([f.positions[0], f.positions[2], f.positions[1]]),
    ).rejects.toMatchObject({ statusCode: 409 });
    const fresh = (await f.read()).map(({ id, topicId }) => ({ id, topicId }));
    await prisma.workflowStage.update({
      where: { id: fresh[0].id },
      data: { topicId: f.topics[1].id },
    });
    await expect(f.move(fresh, fresh)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
  it("rolls back a change that would revoke a completed project's result", async () => {
    const f = await setup(true);
    const completedAt = new Date();
    await prisma.workflowInstance.update({
      where: { id: f.instanceId! },
      data: { completedAt },
    });
    await prisma.researchProject.update({
      where: { id: f.projectId! },
      data: { status: "COMPLETED", completedAt },
    });
    await expect(
      f.move([f.positions[1], f.positions[0], f.positions[2]]),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await f.read()).map((stage) => stage.id)).toEqual(
      f.positions.map((stage) => stage.id),
    );
    expect(
      await prisma.workflowInstance.findUnique({
        where: { id: f.instanceId! },
      }),
    ).toMatchObject({ completedAt, currentStageId: f.stages[1].id });
  });
  it("retains completed timestamps when all requirements remain satisfied", async () => {
    const f = await setup(true);
    await prisma.taskSubmission.updateMany({
      where: { researchId: f.projectId! },
      data: { status: "APPROVED" },
    });
    const completedAt = new Date();
    await prisma.workflowInstance.update({
      where: { id: f.instanceId! },
      data: { completedAt },
    });
    await prisma.researchProject.update({
      where: { id: f.projectId! },
      data: { status: "COMPLETED", completedAt },
    });
    await f.move([f.positions[1], f.positions[0], f.positions[2]]);
    expect(
      await prisma.workflowInstance.findUnique({
        where: { id: f.instanceId! },
      }),
    ).toMatchObject({ completedAt, currentStageId: f.stages[2].id });
    expect(
      await prisma.researchProject.findUnique({ where: { id: f.projectId! } }),
    ).toMatchObject({ status: "COMPLETED", completedAt });
  });
  it("does not silently change custom conditions on a no-op", async () => {
    const f = await setup();
    await prisma.workflowStage.update({
      where: { id: f.stages[2].id },
      data: { requiredMilestoneId: f.stages[0].id },
    });
    expect(await f.move(f.positions)).toBe(false);
    expect((await f.read())[2].requiredMilestoneId).toBe(f.stages[0].id);
  });
  it("rejects a competing move rather than overwriting another editor", async () => {
    const f = await setup();
    const order = [f.positions[1], f.positions[0], f.positions[2]];
    const results = await Promise.allSettled([f.move(order), f.move(order)]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find(
      (result) => result.status === "rejected",
    ) as PromiseRejectedResult;
    expect(
      rejected.reason.statusCode === 409 || rejected.reason.code === "P2034",
    ).toBe(true);
    expect((await f.read()).map((stage) => stage.id)).toEqual(
      order.map((stage) => stage.id),
    );
  });
  it("saves through the authenticated HTTP endpoint, validates input, and records published changes", async () => {
    const f = await setup();
    const url = `${base}/api/workflows/${f.workflow.id}/stages/reorder`;
    const body = {
      expectedStages: f.positions,
      stages: [f.positions[1], f.positions[0], f.positions[2]],
    };
    expect(
      (
        await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      ).status,
    ).toBe(401);
    const headers = {
      Authorization: `Bearer ${generateToken(actorId)}`,
      "Content-Type": "application/json",
    };
    expect(
      (
        await fetch(url, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ stages: [] }),
        })
      ).status,
    ).toBe(400);
    const response = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect((await f.read())[1].requiredMilestoneId).toBe(f.stages[1].id);
    expect(
      await prisma.auditLog.count({
        where: { userId: actorId, entityId: f.workflow.id },
      }),
    ).toBeGreaterThan(0);
    expect(
      (
        await fetch(url, {
          method: "PATCH",
          headers,
          body: JSON.stringify(body),
        })
      ).status,
    ).toBe(409);
    const topicsResponse = await fetch(
      `${base}/api/workflows/${f.workflow.id}/topics/reorder`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          topicIds: [...f.topics].reverse().map((topic) => topic.id),
          expectedTopicIds: f.topics.map((topic) => topic.id),
        }),
      },
    );
    expect(topicsResponse.status).toBe(200);
    expect((await f.read())[0].id).toBe(f.stages[2].id);
  });
});
