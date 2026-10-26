import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";
import { startWorkflowParticipation } from "./workflow-participation.service.js";
import {
  submitTitleProposals,
  reviewTitleProposals,
} from "./title-proposal.service.js";
import { synchronizeAdviserMilestone } from "./adviser-milestone.service.js";
import {
  advanceMilestoneIfSatisfied,
  getMilestoneProgress,
} from "./research-workflow-integration.service.js";
import { authorizeTaskSubmission } from "./submission.service.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
databaseDescribe("untitled workflow participation integration", () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const fixture = createIntegrationFixtureScope(
    `workflow-participation-${suffix}`,
  );
  let researcher: AuthenticatedUser;
  let member: AuthenticatedUser;
  let professorId: string;
  let adviserId: string;
  let researcherRoleId: string;
  let workspaceId: string;
  let version = 0;
  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    fixture.databaseVerified = true;
    const college = await prisma.college.create({
      data: {
        code: `WP${suffix}`,
        name: `Workflow Participation College ${suffix}`,
      },
    });
    fixture.collegeIds.push(college.id);
    const program = await prisma.program.create({
      data: {
        collegeId: college.id,
        code: `WP${suffix}`,
        name: `Workflow Participation Program ${suffix}`,
      },
    });
    fixture.programIds.push(program.id);
    const year = await prisma.academicYear.create({
      data: {
        name: `WP-${suffix}`,
        startDate: new Date("2098-06-01"),
        endDate: new Date("2099-05-31"),
        isCurrent: true,
      },
    });
    fixture.academicYearIds.push(year.id);
    await prisma.role.createMany({
      data: [
        { name: "RESEARCHER" },
        { name: "ADVISER" },
        { name: "RESEARCH_COORDINATOR" },
      ],
      skipDuplicates: true,
    });
    const roles = await prisma.role.findMany();
    researcherRoleId = roles.find((role) => role.name === "RESEARCHER")!.id;
    const createUser = async (
      label: string,
      role: "RESEARCHER" | "ADVISER" | "RESEARCH_COORDINATOR",
    ) => {
      const user = await prisma.user.create({
        data: {
          universityId: `WP-${suffix}-${label}`,
          email: `wp-${suffix}-${label}@isolated.test`,
          firstName: label,
          lastName: "Fixture",
          collegeId: college.id,
          programId: program.id,
          status: "ACTIVE",
          roles: {
            create: { roleId: roles.find((item) => item.name === role)!.id },
          },
        },
      });
      fixture.userIds.push(user.id);
      return {
        id: user.id,
        email: user.email,
        universityId: user.universityId,
        roles: [role],
        permissions: [],
        collegeId: college.id,
        programId: program.id,
      } as AuthenticatedUser;
    };
    researcher = await createUser("leader", "RESEARCHER");
    member = await createUser("member", "RESEARCHER");
    professorId = (await createUser("professor", "RESEARCH_COORDINATOR")).id;
    adviserId = (await createUser("adviser", "ADVISER")).id;
    const workspace = await prisma.researchWorkspace.create({
      data: {
        name: "Untitled research group",
        participationMode: "GROUP",
        inviteCode: `WP${suffix}`,
        programId: program.id,
        collegeId: college.id,
        createdBy: researcher.id,
        members: {
          create: [
            { userId: researcher.id, role: "LEADER" },
            { userId: member.id, role: "MEMBER" },
          ],
        },
      },
    });
    workspaceId = workspace.id;
  });
  afterAll(async () => {
    if (fixture.databaseVerified && workspaceId)
      await prisma.researchWorkspace.deleteMany({ where: { id: workspaceId } });
    await cleanupIntegrationFixture(prisma, fixture);
  });
  const createWorkflow = async (
    order: Array<"ADVISER_SELECTION" | "TITLE_PROPOSAL" | "STANDARD">,
  ) => {
    version += 1;
    const researchType = await prisma.researchType.create({
      data: {
        name: `Workflow Participation Research ${suffix}-${version}`,
        code: `WP${suffix}-${version}`,
        programId: researcher.programId!,
      },
    });
    fixture.researchTypeIds.push(researchType.id);
    const workflow = await prisma.workflow.create({
      data: {
        researchTypeId: researchType.id,
        name: `Workflow Participation ${suffix}-${version}`,
        createdBy: professorId,
        status: "PUBLISHED",
        stages: {
          create: order.map((milestoneType, index) => ({
            name: milestoneType,
            milestoneType,
            sequence: index + 1,
            responsibleRoleId: researcherRoleId,
            requiresDocument: milestoneType === "STANDARD",
            requiresApproval: true,
            submissionMode: "GROUP",
            titleProposalCount: 3,
          })),
        },
      },
      include: { stages: { orderBy: { sequence: "asc" } } },
    });
    fixture.workflowIds.push(workflow.id);
    await prisma.researchType.update({
      where: { id: researchType.id },
      data: { workflowId: workflow.id },
    });
    await prisma.workflowEnrollment.createMany({
      data: [researcher.id, member.id].map((userId) => ({
        userId,
        workflowId: workflow.id,
        status: "ACTIVE",
      })),
    });
    return workflow;
  };
  it.each(["adviser-first", "title-first", "document-first"] as const)(
    "preserves work through title registration in %s departments",
    async (order) => {
      const types =
        order === "adviser-first"
          ? (["ADVISER_SELECTION", "TITLE_PROPOSAL", "STANDARD"] as const)
          : order === "title-first"
            ? (["TITLE_PROPOSAL", "ADVISER_SELECTION", "STANDARD"] as const)
            : (["STANDARD", "TITLE_PROPOSAL", "ADVISER_SELECTION"] as const);
      const workflow = await createWorkflow([...types]);
      const [working, same] = await Promise.all([
        startWorkflowParticipation({
          user: researcher,
          workflowId: workflow.id,
          workspaceId,
        }),
        startWorkflowParticipation({
          user: member,
          workflowId: workflow.id,
          workspaceId,
        }),
      ]);
      fixture.projectIds.push(working.id);
      expect(same.id).toBe(working.id);
      expect(working).toMatchObject({
        workflowDraft: true,
        registeredAt: null,
        title: "",
        status: "DRAFT",
      });
      expect(
        await prisma.researchProject.count({
          where: {
            workspaceId,
            workflowInstance: { is: { workflowId: workflow.id } },
          },
        }),
      ).toBe(1);
      const first = workflow.stages[0];
      let documentId: string | undefined;
      if (order === "adviser-first") {
        await prisma.adviserRequest.create({
          data: {
            researchId: working.id,
            adviserId,
            requestedById: researcher.id,
            workflowStageId: first.id,
            status: "ACCEPTED",
            respondedAt: new Date(),
          },
        });
        await prisma.researchMember.create({
          data: {
            researchId: working.id,
            userId: adviserId,
            projectRole: "ADVISER",
          },
        });
        await prisma.$transaction((tx) =>
          synchronizeAdviserMilestone(tx, {
            researchId: working.id,
            actorId: adviserId,
            workflowStageId: first.id,
          }),
        );
      }
      if (order === "document-first") {
        const task = await prisma.workflowTask.create({
          data: { stageId: first.id, title: "Initial activity", sequence: 1 },
        });
        await expect(
          authorizeTaskSubmission({
            user: researcher,
            researchId: working.id,
            taskId: task.id,
          }),
        ).resolves.toMatchObject({
          project: { workflowDraft: true, registeredAt: null },
        });
        const document = await prisma.document.create({
          data: {
            researchId: working.id,
            title: "Pre-title work",
            documentType: "MANUSCRIPT",
            createdBy: researcher.id,
            milestoneId: first.id,
          },
        });
        documentId = document.id;
        await prisma.taskSubmission.create({
          data: {
            researchId: working.id,
            taskId: task.id,
            documentId: document.id,
            submittedBy: researcher.id,
            status: "APPROVED",
          },
        });
        await prisma.$transaction((tx) =>
          advanceMilestoneIfSatisfied(tx, {
            researchId: working.id,
            milestoneId: first.id,
            actorId: professorId,
          }),
        );
      }
      const titleStage = workflow.stages.find(
        (stage) => stage.milestoneType === "TITLE_PROPOSAL",
      )!;
      const titles = [
        "First proposed research title",
        "Second proposed research title",
        "Third proposed research title",
      ];
      const submitted = await submitTitleProposals({
        researchId: working.id,
        stageId: titleStage.id,
        userId: researcher.id,
        titles,
      });
      await reviewTitleProposals({
        researchId: working.id,
        stageId: titleStage.id,
        reviewerId: professorId,
        status: "APPROVED",
        selectedIndex: 1,
        version: submitted.version,
      });
      const registered = await prisma.researchProject.findUniqueOrThrow({
        where: { id: working.id },
        include: { members: true, adviserRequests: true, documents: true },
      });
      expect(registered).toMatchObject({
        id: working.id,
        workflowDraft: false,
        title: titles[1],
        registeredAt: expect.any(Date),
      });
      expect(
        registered.members.filter((item) =>
          ["LEADER", "MEMBER"].includes(item.projectRole),
        ),
      ).toHaveLength(2);
      if (order === "adviser-first") {
        expect(registered.adviserRequests).toHaveLength(1);
        expect(
          registered.members.some(
            (item) =>
              item.userId === adviserId && item.projectRole === "ADVISER",
          ),
        ).toBe(true);
      }
      if (documentId)
        expect(
          registered.documents.some((item) => item.id === documentId),
        ).toBe(true);
      const projection = await getMilestoneProgress(prisma, working.id);
      expect(
        projection.find((stage) => stage.id === titleStage.id)?.completed,
      ).toBe(true);
    },
  );
  it("keeps an adviser-only untitled participation open for later title registration", async () => {
    const workflow = await createWorkflow(["ADVISER_SELECTION"]);
    const working = await startWorkflowParticipation({
      user: researcher,
      workflowId: workflow.id,
      workspaceId,
    });
    fixture.projectIds.push(working.id);
    await prisma.researchMember.create({
      data: {
        researchId: working.id,
        userId: adviserId,
        projectRole: "ADVISER",
      },
    });
    await prisma.$transaction((tx) =>
      synchronizeAdviserMilestone(tx, {
        researchId: working.id,
        actorId: adviserId,
      }),
    );
    const stillUntitled = await prisma.researchProject.findUniqueOrThrow({
      where: { id: working.id },
    });
    expect(stillUntitled).toMatchObject({
      workflowDraft: true,
      status: "DRAFT",
      completedAt: null,
    });
  });
});
