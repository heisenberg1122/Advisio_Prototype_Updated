import crypto from "node:crypto";
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { generateToken, type AuthenticatedUser } from "../middleware/auth.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";
import {
  assertMilestoneAvailable,
  getGroupMilestones,
  setMilestonePrerequisites,
} from "./milestone-eligibility.service.js";
import {
  advanceMilestoneIfSatisfied,
  recordTaskSubmissionAttempt,
} from "./research-workflow-integration.service.js";
import { startWorkflowProject } from "./workflow-project-start.service.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
databaseDescribe(
  "Milestone prerequisites, group revision cycles and workflow start",
  () => {
    const marker = `milestone-${crypto.randomUUID().slice(0, 8)}`;
    const fixture = createIntegrationFixtureScope(marker);
    let server: http.Server,
      base: string,
      owner: string,
      other: string,
      student: string,
      peer: string,
      extra: string,
      partner: string;
    let collegeId: string,
      programId: string,
      yearId: string,
      typeId: string,
      workflowId: string,
      titleId: string,
      defenseId: string,
      independentId: string,
      taskId: string,
      projectA: string,
      projectB: string,
      workspaceId: string;
    const api = async (
      user: string,
      path: string,
      method = "GET",
      body?: unknown,
    ) => {
      const response = await fetch(`${base}/api/workflows${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${generateToken(user)}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return {
        status: response.status,
        body: await response.json().catch(() => ({})),
      };
    };
    const decision = (user: string, stageId: string, action: string) =>
      api(
        user,
        `/projects/${projectA}/milestones/${stageId}/decision`,
        "POST",
        { action, reason: "Panel requested a different research direction." },
      );
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
          startDate: new Date("2098-01-01"),
          endDate: new Date("2099-01-01"),
          isCurrent: true,
        },
      });
      yearId = year.id;
      fixture.academicYearIds.push(yearId);
      const account = async (
        suffix: string,
        roleName: "RESEARCHER" | "RESEARCH_COORDINATOR",
      ) => {
        const role = await prisma.role.upsert({
          where: { name: roleName },
          create: { name: roleName },
          update: {},
        });
        const user = await prisma.user.create({
          data: {
            universityId: `${marker}-${suffix}`,
            email: `${marker}-${suffix}@isolated.test`,
            firstName: suffix,
            lastName: "Fixture",
            collegeId,
            programId,
            status: "ACTIVE",
            roles: { create: { roleId: role.id } },
          },
        });
        fixture.userIds.push(user.id);
        return user.id;
      };
      owner = await account("owner", "RESEARCH_COORDINATOR");
      other = await account("other", "RESEARCH_COORDINATOR");
      student = await account("student", "RESEARCHER");
      peer = await account("peer", "RESEARCHER");
      extra = await account("extra", "RESEARCHER");
      partner = await account("partner", "RESEARCHER");
      const type = await prisma.researchType.create({
        data: { code: marker.slice(-8), name: marker, programId },
      });
      typeId = type.id;
      fixture.researchTypeIds.push(typeId);
      const workflow = await prisma.workflow.create({
        data: {
          name: marker,
          researchTypeId: typeId,
          createdBy: owner,
          status: "PUBLISHED",
          availabilityMode: "PREREQUISITES",
        },
      });
      workflowId = workflow.id;
      fixture.workflowIds.push(workflowId);
      const role = await prisma.role.findUniqueOrThrow({
        where: { name: "RESEARCHER" },
      });
      const requirements = await prisma.workflowTopic.create({
        data: { workflowId, title: "Requirements", sequence: 1 },
      });
      const capstone = await prisma.workflowTopic.create({
        data: { workflowId, title: "Capstone 1", sequence: 2 },
      });
      const title = await prisma.workflowStage.create({
        data: {
          workflowId,
          topicId: requirements.id,
          name: "Title Research",
          sequence: 1,
          responsibleRoleId: role.id,
          capturesResearchTitle: true,
        },
      });
      titleId = title.id;
      const defense = await prisma.workflowStage.create({
        data: {
          workflowId,
          topicId: capstone.id,
          name: "Title Defense",
          sequence: 2,
          responsibleRoleId: role.id,
          requiresDocument: false,
        },
      });
      defenseId = defense.id;
      const independent = await prisma.workflowStage.create({
        data: {
          workflowId,
          topicId: capstone.id,
          name: "Independent orientation",
          sequence: 3,
          responsibleRoleId: role.id,
          requiresDocument: false,
          isFinal: true,
        },
      });
      independentId = independent.id;
      const task = await prisma.workflowTask.create({
        data: { stageId: titleId, title: "Submit title research", sequence: 1 },
      });
      taskId = task.id;
      await prisma.$transaction((tx) =>
        setMilestonePrerequisites(tx, workflowId, defenseId, [titleId]),
      );
      await prisma.workflowEnrollment.createMany({
        data: [student, peer, extra, partner].map((userId) => ({
          workflowId,
          userId,
        })),
      });
      const project = async (userId: string) => {
        const project = await prisma.researchProject.create({
          data: {
            title: "",
            collegeId,
            programId,
            academicYearId: yearId,
            researchTypeId: typeId,
            createdBy: userId,
            members: { create: { userId, projectRole: "LEADER" } },
          },
        });
        fixture.projectIds.push(project.id);
        const instance = await prisma.workflowInstance.create({
          data: {
            researchId: project.id,
            workflowId,
            workflowVersion: 1,
            currentStageId: titleId,
          },
        });
        await prisma.researchProject.update({
          where: { id: project.id },
          data: { workflowInstanceId: instance.id },
        });
        return project.id;
      };
      projectA = await project(student);
      projectB = await project(peer);
      server = http.createServer(app);
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      base = `http://127.0.0.1:${(server.address() as any).port}`;
    }, 30000);
    afterAll(async () => {
      if (server) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      if (fixture.databaseVerified) {
        await prisma.milestonePrerequisite.deleteMany({
          where: { stage: { workflowId: { in: fixture.workflowIds } } },
        });
        if (workspaceId)
          await prisma.researchWorkspace.deleteMany({
            where: { id: workspaceId },
          });
        await cleanupIntegrationFixture(prisma, fixture);
      }
    }, 30000);
    async function approveFreshTitle(title: string) {
      const saved = await api(
        student,
        `/projects/${projectA}/milestones/${titleId}/proposed-title`,
        "PUT",
        { title },
      );
      expect(saved.status).toBe(200);
      const document = await prisma.document.create({
        data: {
          researchId: projectA,
          milestoneId: titleId,
          title,
          documentType: "PROPOSAL",
          createdBy: student,
          lifecycleStatus: "APPROVED",
        },
      });
      const submittedAt = new Date();
      const version = await prisma.documentVersion.create({
        data: {
          documentId: document.id,
          milestoneId: titleId,
          versionNumber: 1,
          fileName: "title.pdf",
          mimeType: "application/pdf",
          fileSize: 32,
          storagePath: `test://${marker}/title.pdf`,
          uploadedBy: student,
          isImmutable: true,
          manuscriptStatus: "APPROVED",
          submittedAt,
          submittedBy: student,
          snapshotCreatedAt: submittedAt,
          contentChecksum: "a".repeat(64),
          submissionKey: crypto.randomUUID(),
        },
      });
      await prisma.$transaction(async (tx) => {
        await recordTaskSubmissionAttempt(tx, {
          researchId: projectA,
          milestoneId: titleId,
          taskId,
          documentId: document.id,
          documentVersionId: version.id,
          submittedBy: student,
          submittedAt,
          lifecycleStatus: "APPROVED",
        });
        await advanceMilestoneIfSatisfied(tx, {
          researchId: projectA,
          milestoneId: titleId,
          actorId: owner,
        });
      });
      return version;
    }
    it("starts Independent work in later topics and checks the current group's approval only", async () => {
      const a = await getGroupMilestones(prisma, projectA);
      expect(a.find((stage) => stage.id === independentId)).toMatchObject({
        independent: true,
        locked: false,
      });
      await expect(
        assertMilestoneAvailable(prisma, projectA, defenseId),
      ).rejects.toMatchObject({ statusCode: 409 });
      await approveFreshTitle("First accepted research title");
      expect(
        (await getGroupMilestones(prisma, projectA)).find(
          (stage) => stage.id === defenseId,
        )?.locked,
      ).toBe(false);
      expect(
        (await getGroupMilestones(prisma, projectB)).find(
          (stage) => stage.id === defenseId,
        )?.locked,
      ).toBe(true);
      expect(
        (await getGroupMilestones(prisma, projectB)).find(
          (stage) => stage.id === titleId,
        )?.documentRequirementSatisfied,
      ).toBe(false);
      expect(
        (
          await prisma.researchProject.findUniqueOrThrow({
            where: { id: projectA },
          })
        ).title,
      ).toBe("First accepted research title");
    });
    it("enforces decision scope, graph validation and referenced-stage deletion", async () => {
      expect((await decision(other, titleId, "REQUEST_REVISION")).status).toBe(
        403,
      );
      expect(
        (await decision(student, titleId, "REQUEST_REVISION")).status,
      ).toBe(403);
      expect(
        (
          await api(
            owner,
            `/projects/${projectA}/milestones/${titleId}/decision`,
            "POST",
            { action: "REQUEST_REVISION", reason: "" },
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await api(owner, `/stages/${titleId}`, "PATCH", {
            prerequisiteIds: [defenseId],
          })
        ).status,
      ).toBe(400);
      expect((await api(owner, `/stages/${titleId}`, "DELETE")).status).toBe(
        409,
      );
    });
    it("reopens a completed group milestone, preserves immutable history and requires downstream reconfirmation", async () => {
      expect((await decision(owner, defenseId, "APPROVE")).status).toBe(200);
      expect((await decision(owner, independentId, "APPROVE")).status).toBe(
        200,
      );
      expect(
        (
          await prisma.workflowInstance.findUniqueOrThrow({
            where: { researchId: projectA },
          })
        ).completedAt,
      ).not.toBeNull();
      const oldAttempt = await prisma.taskSubmissionAttempt.findFirstOrThrow({
        where: { researchId: projectA, taskId },
      });
      const reopened = await decision(owner, titleId, "REQUEST_REVISION");
      expect(reopened.status).toBe(200);
      expect((await decision(owner, titleId, "REQUEST_REVISION")).status).toBe(
        409,
      );
      const progress = await getGroupMilestones(prisma, projectA);
      expect(progress.find((stage) => stage.id === titleId)).toMatchObject({
        status: "REVISION_REQUIRED",
        completed: false,
      });
      expect(progress.find((stage) => stage.id === defenseId)).toMatchObject({
        locked: true,
        needsRevalidation: true,
      });
      expect(
        progress.find((stage) => stage.id === independentId)?.completed,
      ).toBe(true);
      expect(
        (
          await prisma.workflowInstance.findUniqueOrThrow({
            where: { researchId: projectA },
          })
        ).completedAt,
      ).toBeNull();
      expect(
        (
          await prisma.taskSubmissionAttempt.findUniqueOrThrow({
            where: { id: oldAttempt.id },
          })
        ).status,
      ).toBe("APPROVED");
      expect(
        (
          await prisma.documentVersion.findUniqueOrThrow({
            where: { id: oldAttempt.documentVersionId },
          })
        ).manuscriptStatus,
      ).toBe("APPROVED");
      expect((await decision(owner, defenseId, "RECONFIRM")).status).toBe(409);
      await approveFreshTitle("Replacement accepted research title");
      const after = (await getGroupMilestones(prisma, projectA)).find(
        (stage) => stage.id === defenseId,
      );
      expect(after).toMatchObject({
        locked: false,
        needsRevalidation: true,
        completed: false,
      });
      expect((await decision(owner, defenseId, "RECONFIRM")).status).toBe(200);
      expect(
        (await getGroupMilestones(prisma, projectA)).find(
          (stage) => stage.id === defenseId,
        )?.completed,
      ).toBe(true);
      expect(
        await prisma.taskSubmissionAttempt.count({
          where: { researchId: projectA, taskId },
        }),
      ).toBe(2);
      expect(
        await prisma.researchTitleRevision.count({
          where: { researchId: projectA, status: "ACCEPTED" },
        }),
      ).toBe(2);
      const event = await prisma.milestoneDecisionEvent.findFirstOrThrow({
        where: { researchId: projectA, decision: "APPROVED" },
      });
      await expect(
        prisma.milestoneDecisionEvent.update({
          where: { id: event.id },
          data: { reason: "rewrite" },
        }),
      ).rejects.toThrow();
    });
    it("serializes concurrent revision requests and rejects direct dependent starts", async () => {
      const responses = await Promise.all([
        decision(owner, titleId, "REQUEST_REVISION"),
        decision(owner, titleId, "REQUEST_REVISION"),
      ]);
      expect(responses.map((result) => result.status).sort()).toEqual([
        200, 409,
      ]);
      expect(
        await prisma.milestoneDecisionEvent.count({
          where: {
            researchId: projectA,
            stageId: titleId,
            decision: "REVISION_REQUIRED",
            generation: 2,
          },
        }),
      ).toBe(1);
      expect(
        (
          await api(student, `/stages/${defenseId}/start`, "POST", {
            researchId: projectA,
          })
        ).status,
      ).toBe(409);
      expect((await decision(owner, defenseId, "APPROVE")).status).toBe(409);
      expect(
        (await getGroupMilestones(prisma, projectB)).find(
          (stage) => stage.id === titleId,
        )?.status,
      ).toBe("NOT_STARTED");
    });
    it("serializes simultaneous workflow starts by group members into one project", async () => {
      const workspace = await prisma.researchWorkspace.create({
        data: {
          name: marker,
          participationMode: "GROUP",
          inviteCode: crypto.randomBytes(6).toString("hex"),
          createdBy: extra,
          collegeId,
          programId,
          members: {
            create: [
              { userId: extra, role: "LEADER" },
              { userId: partner, role: "MEMBER" },
            ],
          },
        },
      });
      workspaceId = workspace.id;
      const user = (id: string) =>
        ({
          id,
          roles: ["RESEARCHER"],
          permissions: [],
          email: `${id}@isolated.test`,
          universityId: id,
          collegeId,
          programId,
        }) as AuthenticatedUser;
      const results = await Promise.all([
        startWorkflowProject(user(extra), { workflowId, workspaceId }),
        startWorkflowProject(user(partner), { workflowId, workspaceId }),
      ]);
      fixture.projectIds.push(results[0].projectId);
      expect(results[0].projectId).toBe(results[1].projectId);
      const record = await prisma.researchProject.findUniqueOrThrow({
        where: { id: results[0].projectId },
        include: { members: true },
      });
      expect(record.title).toBe("");
      expect(record.createdBy).toBe(extra);
      expect(record.members).toHaveLength(2);
      await expect(
        startWorkflowProject(user(extra), {
          workflowId,
          participationMode: "SOLO",
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  },
);
