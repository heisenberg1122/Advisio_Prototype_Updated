import { randomBytes } from "node:crypto";
import { Prisma, prisma } from "../lib/prisma.js";
import { CohortError } from "./cohort.service.js";

// Formation only: neither this check nor workspace creation grants workflow access.
export async function requireCohortTeamMembership(
  tx: Prisma.TransactionClient,
  cohortId: string,
  actorId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`research-cohort:${cohortId}`}))`;
  const cohort = await tx.researchCohort.findUnique({
    where: { id: cohortId },
    select: {
      id: true,
      status: true,
      collegeId: true,
      programId: true,
      members: {
        where: { userId: actorId, status: "ACTIVE" },
        select: { userId: true },
      },
    },
  });
  if (!cohort || !cohort.members.length)
    throw new CohortError(
      "Active membership in this cohort is required to form or join its research team.",
      403,
    );
  if (cohort.status !== "ACTIVE")
    throw new CohortError(
      "Teams can only be formed or joined in an active cohort.",
      409,
    );
  const actor = await tx.user.findFirst({
    where: {
      id: actorId,
      status: "ACTIVE",
      collegeId: cohort.collegeId,
      programId: cohort.programId,
      roles: { some: { role: { name: "RESEARCHER" } } },
      program: {
        isActive: true,
        collegeId: cohort.collegeId,
        college: { isActive: true },
      },
    },
    select: { id: true },
  });
  if (!actor)
    throw new CohortError(
      "The team must be within your active academic program and college.",
      403,
    );
  return cohort;
}

export async function createCohortWorkspace(input: {
  actorId: string;
  cohortId: string;
  name: string;
  participationMode: "SOLO" | "GROUP";
  accessMode: "INVITE_ONLY" | "PUBLIC_OPEN";
}) {
  return prisma.$transaction(
    async (tx) => {
      const cohort = await requireCohortTeamMembership(
        tx,
        input.cohortId,
        input.actorId,
      );
      return tx.researchWorkspace.create({
        data: {
          name: input.name,
          participationMode: input.participationMode,
          accessMode: input.accessMode,
          inviteCode: randomBytes(6).toString("hex").toUpperCase(),
          inviteCodeEnabled: input.participationMode === "GROUP",
          cohortId: cohort.id,
          collegeId: cohort.collegeId,
          programId: cohort.programId,
          createdBy: input.actorId,
          members: { create: { userId: input.actorId, role: "LEADER" } },
        },
        include: {
          members: true,
          college: true,
          program: true,
          projects: true,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
