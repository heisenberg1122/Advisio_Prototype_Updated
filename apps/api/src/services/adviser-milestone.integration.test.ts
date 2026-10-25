import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";
import { synchronizeAdviserMilestone } from "./adviser-milestone.service.js";
import { getMilestoneProgress } from "./research-workflow-integration.service.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

databaseDescribe("adviser milestone integration", () => {
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  const fixture = createIntegrationFixtureScope(
    `adviser-milestone-${suffix.toLowerCase()}`,
  );
  let studentId: string;
  let adviserId: string;
  let professorId: string;
  let projectId: string;
  let adviserStageId: string;
  let nextStageId: string;

  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    fixture.databaseVerified = true;

    const college = await prisma.college.create({
      data: { code: `AM${suffix}`, name: "Adviser Milestone Test College" },
    });
    fixture.collegeIds.push(college.id);
    const program = await prisma.program.create({
      data: {
        collegeId: college.id,
        code: `AM${suffix}`,
        name: "Adviser Milestone Test Program",
      },
    });
    fixture.programIds.push(program.id);
    const academicYear = await prisma.academicYear.create({
      data: {
        name: `AM-${suffix}`,
        startDate: new Date("2096-06-01T00:00:00.000Z"),
        endDate: new Date("2097-05-31T00:00:00.000Z"),
      },
    });
    fixture.academicYearIds.push(academicYear.id);

    await prisma.role.createMany({
      data: [
        { name: "RESEARCHER" },
        { name: "ADVISER" },
        { name: "RESEARCH_COORDINATOR" },
      ],
      skipDuplicates: true,
    });
    const roles = new Map(
      (
        await prisma.role.findMany({
          where: {
            name: {
              in: ["RESEARCHER", "ADVISER", "RESEARCH_COORDINATOR"],
            },
          },
        })
      ).map((role) => [role.name, role.id]),
    );
    const createUser = async (
      label: string,
      roleName: "RESEARCHER" | "ADVISER" | "RESEARCH_COORDINATOR",
    ) => {
      const user = await prisma.user.create({
        data: {
          universityId: `AM-${suffix}-${label}`,
          email: `adviser-milestone-${suffix.toLowerCase()}-${label.toLowerCase()}@isolated.test`,
          firstName: label,
          lastName: "Fixture",
          status: "ACTIVE",
          collegeId: college.id,
          programId: program.id,
        },
      });
      fixture.userIds.push(user.id);
      await prisma.userRole.create({
        data: { userId: user.id, roleId: roles.get(roleName)! },
      });
      return user.id;
    };
    studentId = await createUser("Student", "RESEARCHER");
    adviserId = await createUser("Adviser", "ADVISER");
    professorId = await createUser("Professor", "RESEARCH_COORDINATOR");

    const researchType = await prisma.researchType.create({
      data: {
        programId: program.id,
        name: "Adviser Milestone Research",
        code: `AM-${suffix}`,
      },
    });
    fixture.researchTypeIds.push(researchType.id);
    const workflow = await prisma.workflow.create({
      data: {
        researchTypeId: researchType.id,
        name: "Adviser Milestone Workflow",
        status: "PUBLISHED",
        createdBy: professorId,
      },
    });
    fixture.workflowIds.push(workflow.id);
    await prisma.researchType.update({
      where: { id: researchType.id },
      data: { workflowId: workflow.id },
    });
    const adviserStage = await prisma.workflowStage.create({
      data: {
        workflowId: workflow.id,
        name: "Select an official adviser",
        sequence: 1,
        responsibleRoleId: roles.get("ADVISER")!,
        requiresApproval: true,
        requiresDocument: false,
        submissionMode: "GROUP",
        milestoneType: "ADVISER_SELECTION",
      },
    });
    adviserStageId = adviserStage.id;
    const nextStage = await prisma.workflowStage.create({
      data: {
        workflowId: workflow.id,
        name: "Proposal manuscript",
        sequence: 2,
        responsibleRoleId: roles.get("RESEARCH_COORDINATOR")!,
        requiresApproval: true,
        requiresDocument: true,
      },
    });
    nextStageId = nextStage.id;

    const project = await prisma.researchProject.create({
      data: {
        researchTypeId: researchType.id,
        programId: program.id,
        collegeId: college.id,
        academicYearId: academicYear.id,
        title: "Adviser Milestone Integration Project",
        participationMode: "GROUP",
        createdBy: studentId,
      },
    });
    projectId = project.id;
    fixture.projectIds.push(project.id);
    await prisma.researchMember.create({
      data: {
        researchId: project.id,
        userId: studentId,
        projectRole: "LEADER",
      },
    });
    const instance = await prisma.workflowInstance.create({
      data: {
        researchId: project.id,
        workflowId: workflow.id,
        workflowVersion: workflow.version,
        currentStageId: adviserStage.id,
      },
    });
    await prisma.researchProject.update({
      where: { id: project.id },
      data: { workflowInstanceId: instance.id },
    });
  });

  afterAll(async () => {
    await cleanupIntegrationFixture(prisma, fixture);
  });

  it("enforces one adviser milestone per workflow", async () => {
    const stage = await prisma.workflowStage.findUniqueOrThrow({
      where: { id: adviserStageId },
    });
    await expect(
      prisma.workflowStage.create({
        data: {
          workflowId: stage.workflowId,
          name: "Duplicate adviser selection",
          sequence: 3,
          responsibleRoleId: stage.responsibleRoleId,
          milestoneType: "ADVISER_SELECTION",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("projects request states and advances exactly once after acceptance", async () => {
    expect((await getMilestoneProgress(prisma, projectId))[0]).toMatchObject({
      id: adviserStageId,
      status: "NOT_STARTED",
      completed: false,
    });

    const request = await prisma.adviserRequest.create({
      data: {
        researchId: projectId,
        adviserId,
        requestedById: studentId,
        workflowStageId: adviserStageId,
        status: "PENDING",
      },
    });
    expect((await getMilestoneProgress(prisma, projectId))[0].status).toBe(
      "PENDING_ADVISER",
    );
    await prisma.adviserRequest.update({
      where: { id: request.id },
      data: { status: "REJECTED", respondedAt: new Date() },
    });
    expect((await getMilestoneProgress(prisma, projectId))[0].status).toBe(
      "DECLINED",
    );

    await prisma.$transaction(async (tx) => {
      await tx.adviserRequest.update({
        where: { id: request.id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      await tx.researchMember.create({
        data: {
          researchId: projectId,
          userId: adviserId,
          projectRole: "ADVISER",
        },
      });
      const result = await synchronizeAdviserMilestone(tx, {
        researchId: projectId,
        actorId: adviserId,
        workflowStageId: adviserStageId,
      });
      expect(result.synchronized).toBe(true);
      expect(result.progression?.advanced).toBe(true);
    });

    const progress = await getMilestoneProgress(prisma, projectId);
    expect(progress[0]).toMatchObject({
      status: "APPROVED",
      completed: true,
      completionPercent: 100,
      adviserMilestone: {
        status: "APPROVED",
        adviser: { id: adviserId },
      },
    });
    expect(
      await prisma.workflowInstance.findUniqueOrThrow({
        where: { researchId: projectId },
      }),
    ).toMatchObject({ currentStageId: nextStageId, completedAt: null });

    const notificationCount = await prisma.notification.count({
      where: {
        entityId: adviserStageId,
        deduplicationKey: { startsWith: `adviser-milestone:${projectId}` },
      },
    });
    const second = await prisma.$transaction((tx) =>
      synchronizeAdviserMilestone(tx, {
        researchId: projectId,
        actorId: adviserId,
        workflowStageId: adviserStageId,
      }),
    );
    expect(second.progression?.advanced).toBe(false);
    expect(
      await prisma.notification.count({
        where: {
          entityId: adviserStageId,
          deduplicationKey: { startsWith: `adviser-milestone:${projectId}` },
        },
      }),
    ).toBe(notificationCount);
  });
});
