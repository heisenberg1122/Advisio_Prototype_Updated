import { prisma, Prisma, type ProjectRole } from "../lib/prisma.js";
import { canAccessCollege } from "../lib/college-scope.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { countActiveAdviseeGroups } from "../lib/adviser-capacity.js";

const requiredRole = {
  LEADER: "RESEARCHER",
  MEMBER: "RESEARCHER",
  ADVISER: "ADVISER",
  PANELIST: "PANELIST",
  COORDINATOR: "RESEARCH_COORDINATOR",
} as const;
function fail(message: string, statusCode = 403): never {
  throw Object.assign(new Error(message), { statusCode });
}

export async function assignResearchMember(
  actor: AuthenticatedUser,
  researchId: string,
  userId: string,
  projectRole: ProjectRole,
) {
  return prisma.$transaction(
    async (tx) => {
      // Serializes role changes with the leader-managed membership endpoints.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${researchId}))`;
      const project = await tx.researchProject.findUnique({
        where: { id: researchId },
        select: {
          collegeId: true,
          programId: true,
          status: true,
          participationMode: true,
          workflowInstance: {
            select: { workflow: { select: { createdBy: true } } },
          },
        },
      });
      if (!project || !canAccessCollege(actor, project.collegeId))
        fail("Research project not found in your academic scope.", 404);
      if (
        !["SYSTEM_ADMIN", "DEAN"].some((role) =>
          actor.roles.includes(role as any),
        ) &&
        !(
          actor.roles.includes("RESEARCH_COORDINATOR") &&
          project.workflowInstance?.workflow.createdBy === actor.id
        )
      ) {
        fail(
          "Only the assigned professor or an authorized academic administrator can assign members.",
        );
      }
      if (["ARCHIVED", "COMPLETED"].includes(project.status))
        fail("Membership is locked for this project.", 409);
      if (projectRole === "LEADER" || projectRole === "MEMBER")
        fail(
          "Use the group invitation and leadership-transfer workflows for researcher membership.",
        );
      const target = await tx.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
      });
      if (
        !target ||
        target.status !== "ACTIVE" ||
        target.collegeId !== project.collegeId ||
        !target.roles.some(
          ({ role }) => role.name === requiredRole[projectRole],
        ) ||
        (target.programId && target.programId !== project.programId)
      )
        fail("The selected account is not eligible for this project role.");
    const studentMembership = await tx.researchMember.findFirst({
      where: {
        researchId,
        userId,
        leftAt: null,
        projectRole: { in: ["LEADER", "MEMBER"] },
      },
    });
    if (studentMembership)
      fail("A researcher cannot receive a faculty role on their own project.");
      if (
        projectRole === "COORDINATOR" &&
        project.workflowInstance?.workflow.createdBy !== target.id
      )
        fail("The coordinator must own the project's workflow.");
      if (projectRole === "ADVISER") {
        if (target.programId !== project.programId)
          fail("The adviser must belong to the project's program.");
        const other = await tx.researchMember.findFirst({
          where: {
            researchId,
            projectRole: "ADVISER",
            leftAt: null,
            userId: { not: userId },
          },
        });
        if (other) fail("This project already has an active adviser.", 409);
        const existing = await tx.researchMember.findFirst({
          where: { researchId, userId, projectRole, leftAt: null },
        });
        if (
          !existing &&
          (!target.isAcceptingAdvisees ||
            (await countActiveAdviseeGroups(tx, userId)) >=
              target.maxAdviseeGroups)
        ) {
          fail("The adviser is not accepting additional groups.", 409);
        }
      }
      const member = await tx.researchMember.upsert({
        where: {
          researchId_userId_projectRole: { researchId, userId, projectRole },
        },
        update: { leftAt: null },
        create: { researchId, userId, projectRole },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "UPDATE",
          entityType: "ResearchMember",
          entityId: member.id,
          newValues: { researchId, userId, projectRole, leftAt: null },
        },
      });
      return member;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
