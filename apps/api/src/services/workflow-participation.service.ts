import { prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";

function fail(message: string, statusCode = 409): never {
  throw Object.assign(new Error(message), { statusCode });
}

// ResearchProject is also the storage owner for workflow files and adviser requests.
// An untitled workflowDraft is participation, not a registered research project.
// Registration promotes this same record so every pre-title record stays attached.
export async function startWorkflowParticipation(options: {
  user: AuthenticatedUser;
  workflowId: string;
  workspaceId?: string | null;
}) {
  if (!options.user.roles.includes("RESEARCHER"))
    fail("Only researchers can start workflow participation.", 403);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workflow-access:${options.workflowId}`}))`;
    const enrollment = await tx.workflowEnrollment.findFirst({
      where: {
        workflowId: options.workflowId,
        userId: options.user.id,
        status: "ACTIVE",
      },
    });
    if (!enrollment)
      fail("Join this workflow before starting its milestones.", 403);
    const workflow = await tx.workflow.findUnique({
      where: { id: options.workflowId },
      include: {
        stages: {
          where: { category: { not: "Archived" } },
          orderBy: { sequence: "asc" },
          take: 1,
        },
      },
    });
    if (!workflow || workflow.status !== "PUBLISHED")
      fail("This workflow is not available to start.", 404);
    const researchType = await tx.researchType.findUnique({
      where: { id: workflow.researchTypeId },
      include: { program: { include: { college: true } } },
    });
    if (!researchType)
      fail("This workflow has no configured research type.", 404);
    const program = researchType.program;
    if (
      !researchType.isActive ||
      !program.isActive ||
      !program.college.isActive ||
      options.user.programId !== program.id ||
      options.user.collegeId !== program.collegeId
    )
      fail("This workflow is outside your assigned program.", 403);
    if (!workflow.stages.length)
      fail("Your professor has not added any active milestones yet.");
    const existing = await tx.researchProject.findFirst({
      where: {
        status: { not: "ARCHIVED" },
        workflowInstance: { is: { workflowId: workflow.id } },
        members: {
          some: {
            userId: options.user.id,
            leftAt: null,
            projectRole: { in: ["LEADER", "MEMBER"] },
          },
        },
      },
    });
    if (existing) {
      if (
        options.workspaceId !== undefined &&
        (existing.workspaceId || null) !== options.workspaceId
      )
        fail(
          "You already started this workflow in another workspace. Continue that participation.",
        );
      return existing;
    }
    let workspaceId = options.workspaceId;
    if (workspaceId === undefined) {
      const choices = await tx.researchWorkspace.findMany({
        where: {
          programId: program.id,
          collegeId: program.collegeId,
          members: { some: { userId: options.user.id, leftAt: null } },
        },
        select: { id: true },
        take: 2,
      });
      if (choices.length > 1)
        fail("Choose the workspace you want to use for this workflow.", 400);
      workspaceId = choices[0]?.id || null;
    }
    if (workspaceId)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}))`;
    const workspace = workspaceId
      ? await tx.researchWorkspace.findFirst({
          where: {
            id: workspaceId,
            programId: program.id,
            collegeId: program.collegeId,
            members: { some: { userId: options.user.id, leftAt: null } },
          },
          include: {
            members: {
              where: { leftAt: null },
              include: {
                user: {
                  select: { status: true, programId: true, collegeId: true },
                },
              },
            },
          },
        })
      : null;
    if (workspaceId && !workspace)
      fail("Choose a workspace you currently belong to in this program.", 403);
    const shared = workspace
      ? await tx.researchProject.findFirst({
          where: {
            workspaceId: workspace.id,
            status: { not: "ARCHIVED" },
            workflowInstance: { is: { workflowId: workflow.id } },
          },
        })
      : null;
    if (shared) {
      await tx.researchMember.upsert({
        where: {
          researchId_userId_projectRole: {
            researchId: shared.id,
            userId: options.user.id,
            projectRole: "MEMBER",
          },
        },
        create: {
          researchId: shared.id,
          userId: options.user.id,
          projectRole: "MEMBER",
        },
        update: { leftAt: null },
      });
      return shared;
    }
    let participants: Array<{
      userId: string;
      projectRole: "LEADER" | "MEMBER";
    }> = [{ userId: options.user.id, projectRole: "LEADER" }];
    if (workspace) {
      const enrolled = await tx.workflowEnrollment.findMany({
        where: {
          workflowId: workflow.id,
          status: "ACTIVE",
          userId: { in: workspace.members.map((member) => member.userId) },
        },
        select: { userId: true },
      });
      const eligibleIds = new Set(enrolled.map((item) => item.userId));
      const eligibleMembers = workspace.members.filter(
        (member) =>
          eligibleIds.has(member.userId) &&
          member.user.status === "ACTIVE" &&
          member.user.programId === program.id &&
          member.user.collegeId === program.collegeId,
      );
      if (!eligibleMembers.some((member) => member.role === "LEADER"))
        fail(
          "Your group leader must join this workflow before the group starts. No research title is required.",
        );
      participants = eligibleMembers.map((member) => ({
        userId: member.userId,
        projectRole: member.role === "LEADER" ? "LEADER" : "MEMBER",
      }));
    }
    const year = await tx.academicYear.findFirst({
      where: { isActive: true },
      orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    });
    if (!year)
      fail("No active academic year is configured. Contact your professor.");
    const project = await tx.researchProject.create({
      data: {
        title: "",
        workflowDraft: true,
        status: "DRAFT",
        registeredAt: null,
        researchTypeId: workflow.researchTypeId,
        programId: program.id,
        collegeId: program.collegeId,
        academicYearId: year.id,
        createdBy: participants.find(
          (member) => member.projectRole === "LEADER",
        )!.userId,
        workspaceId: workspace?.id,
        groupName:
          workspace?.participationMode === "GROUP" ? workspace.name : null,
        participationMode: workspace?.participationMode || "SOLO",
        accessMode: workspace?.accessMode || "INVITE_ONLY",
      },
    });
    await tx.researchMember.createMany({
      data: participants.map((member) => ({
        ...member,
        researchId: project.id,
      })),
    });
    const instance = await tx.workflowInstance.create({
      data: {
        researchId: project.id,
        workflowId: workflow.id,
        workflowVersion: workflow.version,
        currentStageId: workflow.stages[0].id,
      },
    });
    const started = await tx.researchProject.update({
      where: { id: project.id },
      data: { workflowInstanceId: instance.id },
    });
    await tx.auditLog.create({
      data: {
        userId: options.user.id,
        action: "CREATE",
        entityType: "WorkflowParticipation",
        entityId: project.id,
        newValues: {
          workflowId: workflow.id,
          workspaceId: workspace?.id || null,
        },
      },
    });
    return started;
  });
}
