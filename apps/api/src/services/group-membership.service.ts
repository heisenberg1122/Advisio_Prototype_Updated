import { prisma, Prisma } from "../lib/prisma.js";

function fail(message: string, statusCode = 409): never {
  throw Object.assign(new Error(message), { statusCode });
}

/** Project membership is authoritative. Workspace membership alone never grants project access. */
export async function removeResearcherMembership(
  researchId: string,
  actorId: string,
  memberId?: string,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${researchId}))`;
      const actor = await tx.researchMember.findFirst({
        where: {
          researchId,
          userId: actorId,
          leftAt: null,
          projectRole: { in: ["LEADER", "MEMBER"] },
        },
      });
      if (!actor || (memberId && actor.projectRole !== "LEADER"))
        fail("Only an active leader can remove another member.", 403);
      const member = memberId
        ? await tx.researchMember.findFirst({
            where: {
              id: memberId,
              researchId,
              leftAt: null,
              projectRole: "MEMBER",
            },
          })
        : actor;
      if (!member) fail("Active group member not found.", 404);
      if (member.projectRole === "LEADER")
        fail("Transfer leadership before leaving the group.");
      const project = await tx.researchProject.findUniqueOrThrow({
        where: { id: researchId },
        select: { workspaceId: true },
      });
      const leftAt = new Date();
      await tx.researchMember.updateMany({
        where: {
          researchId,
          userId: member.userId,
          projectRole: { in: ["LEADER", "MEMBER"] },
          leftAt: null,
        },
        data: { leftAt },
      });
      if (project.workspaceId) {
        const retainedMembership = await tx.researchMember.count({
          where: {
            userId: member.userId,
            leftAt: null,
            projectRole: { in: ["LEADER", "MEMBER"] },
            research: {
              workspaceId: project.workspaceId,
              status: { not: "ARCHIVED" },
            },
          },
        });
        if (!retainedMembership)
          await tx.workspaceMember.updateMany({
            where: { workspaceId: project.workspaceId, userId: member.userId },
            data: { leftAt },
          });
      }
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entityType: "ResearchMember",
          entityId: member.id,
          newValues: { leftAt: leftAt.toISOString(), researchId },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function transferResearchLeadership(
  researchId: string,
  actorId: string,
  targetId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${researchId}))`;
      const members = await tx.researchMember.findMany({
        where: {
          researchId,
          leftAt: null,
          projectRole: { in: ["LEADER", "MEMBER"] },
        },
      });
      if (
        !members.some((m) => m.userId === actorId && m.projectRole === "LEADER")
      )
        fail("Only the active leader can transfer leadership.", 403);
      if (
        !members.some(
          (m) => m.userId === targetId && m.projectRole === "MEMBER",
        )
      )
        fail("Select an active group member.", 400);
      await tx.researchMember.updateMany({
        where: {
          researchId,
          userId: { in: [actorId, targetId] },
          projectRole: { in: ["LEADER", "MEMBER"] },
          leftAt: null,
        },
        data: { leftAt: new Date() },
      });
      for (const [userId, projectRole] of [
        [actorId, "MEMBER"],
        [targetId, "LEADER"],
      ] as const) {
        await tx.researchMember.upsert({
          where: {
            researchId_userId_projectRole: { researchId, userId, projectRole },
          },
          update: { leftAt: null },
          create: { researchId, userId, projectRole },
        });
      }
      const project = await tx.researchProject.findUniqueOrThrow({
        where: { id: researchId },
        select: { workspaceId: true },
      });
      if (project.workspaceId) {
        await tx.workspaceMember.updateMany({
          where: {
            workspaceId: project.workspaceId,
            role: "LEADER",
            leftAt: null,
          },
          data: { role: "MEMBER" },
        });
        await tx.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: project.workspaceId,
              userId: targetId,
            },
          },
          update: { role: "LEADER", leftAt: null },
          create: {
            workspaceId: project.workspaceId,
            userId: targetId,
            role: "LEADER",
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entityType: "ResearchProject",
          entityId: researchId,
          newValues: { previousLeaderId: actorId, leaderId: targetId },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
