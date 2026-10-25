import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { MilestoneEligibilityError } from "./milestone-eligibility.service.js";

/** Provision a submission owner only after the student chooses the workflow and team. */
export async function startWorkflowProject(
  user: AuthenticatedUser,
  input: {
    workflowId: string;
    workspaceId?: string;
    participationMode?: string;
  },
) {
  if (!user.roles.includes("RESEARCHER") || !user.collegeId || !user.programId)
    throw new MilestoneEligibilityError(
      "An assigned researcher account is required.",
      403,
    );
  if (!input.workspaceId && input.participationMode !== "SOLO")
    throw new MilestoneEligibilityError(
      "Choose your group workspace or explicitly choose Solo research.",
      400,
    );
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workflow-access:${input.workflowId}`}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`milestone-workflow:${input.workflowId}`}))`;
      if (input.workspaceId)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.workspaceId}))`;
      const enrollment = await tx.workflowEnrollment.findUnique({
        where: {
          workflowId_userId: { workflowId: input.workflowId, userId: user.id },
        },
      });
      const workflow = await tx.workflow.findUnique({
        where: { id: input.workflowId },
        include: {
          stages: {
            where: { category: { not: "Archived" } },
            orderBy: { sequence: "asc" },
          },
        },
      });
      if (
        !workflow ||
        workflow.status === "ARCHIVED" ||
        enrollment?.status !== "ACTIVE"
      )
        throw new MilestoneEligibilityError(
          "Join an active workflow before starting its requirements.",
          403,
        );
      const researchType = await tx.researchType.findFirst({
        where: {
          id: workflow.researchTypeId,
          isActive: true,
          programId: user.programId!,
          program: {
            isActive: true,
            collegeId: user.collegeId!,
            college: { isActive: true },
          },
        },
      });
      if (!researchType || !workflow.stages.length)
        throw new MilestoneEligibilityError(
          "The workflow has no active milestones or is outside your academic program.",
        );
      const workspace = input.workspaceId
        ? await tx.researchWorkspace.findFirst({
            where: {
              id: input.workspaceId,
              programId: user.programId!,
              collegeId: user.collegeId!,
              members: { some: { userId: user.id, leftAt: null } },
            },
            include: { members: { where: { leftAt: null } } },
          })
        : null;
      if (input.workspaceId && !workspace)
        throw new MilestoneEligibilityError(
          "You are not an active member of that workspace.",
          403,
        );
      const members = workspace?.members || [
        { userId: user.id, role: "LEADER" },
      ];
      const leader = members.find((member) => member.role === "LEADER");
      if (!leader)
        throw new MilestoneEligibilityError(
          "This workspace needs an active leader before starting.",
        );
      // Serialize starts in different workflows as well as simultaneous starts by
      // different group members. Academic-year uniqueness stays enforced.
      for (const member of [...members].sort((a, b) =>
        a.userId.localeCompare(b.userId),
      ))
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`research-start:${member.userId}`}))`;
      const academicYear = await tx.academicYear.findFirst({
        where: { isCurrent: true, isActive: true },
        orderBy: { startDate: "desc" },
      });
      if (!academicYear)
        throw new MilestoneEligibilityError(
          "No current academic year is configured. Contact your professor.",
        );
      const existing = await tx.researchProject.findMany({
        where: {
          academicYearId: academicYear.id,
          status: { not: "ARCHIVED" },
          OR: [
            {
              members: {
                some: {
                  userId: { in: members.map((member) => member.userId) },
                  leftAt: null,
                  projectRole: { in: ["LEADER", "MEMBER"] },
                },
              },
            },
            { createdBy: { in: members.map((member) => member.userId) } },
          ],
        },
        include: { workflowInstance: true },
      });
      if (existing.length) {
        const reusable = existing.find(
          (project) =>
            project.workflowInstance?.workflowId === workflow.id &&
            (workspace
              ? project.workspaceId === workspace.id
              : !project.workspaceId &&
                project.participationMode === "SOLO" &&
                project.createdBy === user.id),
        );
        if (reusable && existing.every((project) => project.id === reusable.id))
          return { projectId: reusable.id, created: false };
        throw new MilestoneEligibilityError(
          "You or a group member already has a research project for this academic year. Continue that project or ask your professor to resolve the workflow assignment.",
        );
      }
      const enrolledMembers = await tx.workflowEnrollment.count({
        where: {
          workflowId: workflow.id,
          status: "ACTIVE",
          userId: { in: members.map((member) => member.userId) },
        },
      });
      if (enrolledMembers !== members.length)
        throw new MilestoneEligibilityError(
          "All active group members must join this professor's workflow before the group starts.",
        );
      const groupInviteCode =
        workspace?.participationMode === "GROUP"
          ? (await tx.researchProject.findUnique({
              where: { inviteCode: workspace.inviteCode },
              select: { id: true },
            }))
            ? randomBytes(6).toString("hex").toUpperCase()
            : workspace.inviteCode
          : null;
      const project = await tx.researchProject.create({
        data: {
          researchTypeId: researchType.id,
          programId: user.programId!,
          collegeId: user.collegeId!,
          academicYearId: academicYear.id,
          title: "",
          groupName: workspace?.name || null,
          workspaceId: workspace?.id,
          participationMode: workspace?.participationMode || "SOLO",
          accessMode: workspace?.accessMode || "INVITE_ONLY",
          inviteCode: groupInviteCode,
          inviteCodeEnabled:
            workspace?.participationMode === "GROUP" &&
            workspace.inviteCodeEnabled,
          status: "DRAFT",
          createdBy: leader.userId,
          members: {
            create: members.map((member) => ({
              userId: member.userId,
              projectRole:
                member.role === "LEADER"
                  ? ("LEADER" as const)
                  : ("MEMBER" as const),
            })),
          },
        },
      });
      const instance = await tx.workflowInstance.create({
        data: {
          researchId: project.id,
          workflowId: workflow.id,
          workflowVersion: workflow.version,
          currentStageId: workflow.stages[0].id,
        },
      });
      await tx.researchProject.update({
        where: { id: project.id },
        data: { workflowInstanceId: instance.id },
      });
      return { projectId: project.id, created: true };
    },
    { timeout: 30000 },
  );
}
