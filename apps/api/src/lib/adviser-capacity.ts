import type { Prisma, PrismaClient, ResearchStatus } from "@prisma/client";

export const ACTIVE_ADVISEE_STATUSES: ResearchStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISION",
  "APPROVED",
  "DEFENSE",
];

type CapacityClient = PrismaClient | Prisma.TransactionClient;

export async function countActiveAdviseeGroups(client: CapacityClient, adviserId: string) {
  return client.researchMember.count({
    where: {
      userId: adviserId,
      projectRole: "ADVISER",
      leftAt: null,
      research: { status: { in: ACTIVE_ADVISEE_STATUSES } },
    },
  });
}

export function capacitySummary(adviser: {
  maxAdviseeGroups: number;
  isAcceptingAdvisees: boolean;
}, activeGroups: number) {
  const availableSlots = Math.max(0, adviser.maxAdviseeGroups - activeGroups);
  return {
    adviseeCount: activeGroups,
    maxAdviseeGroups: adviser.maxAdviseeGroups,
    availableSlots,
    isAcceptingAdvisees: adviser.isAcceptingAdvisees,
    isFull: !adviser.isAcceptingAdvisees || availableSlots === 0,
  };
}
