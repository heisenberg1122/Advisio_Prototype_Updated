import type { Prisma } from "@research-management/database";
import { z } from "zod";
import { collegeUserWhere } from "../lib/college-authorization.js";

const recipient = z.object({ userId: z.string().uuid(), name: z.string().min(1) });
const recipients = z.array(recipient);

export const certificateBadgeInclude = {
  issuer: { select: { firstName: true, lastName: true } },
  _count: { select: { certificates: true } },
} satisfies Prisma.DefenseBadgeInclude;

export const certificateResearchInclude = {
  college: { select: { name: true, code: true } },
} satisfies Prisma.ResearchProjectInclude;

export function certificateDeans(tx: Prisma.TransactionClient, collegeId: string) {
  return tx.user.findMany({
    where: { ...collegeUserWhere(collegeId, "DEAN"), status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
  });
}

function fullName(person: { firstName: string; lastName: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
}

export async function issueDefenseCertificates(
  tx: Prisma.TransactionClient,
  badge: Prisma.DefenseBadgeGetPayload<{ include: typeof certificateBadgeInclude }>,
  research: Prisma.ResearchProjectGetPayload<{ include: typeof certificateResearchInclude }>,
  dean: { firstName: string; lastName: string },
) {
  const roster = recipients.safeParse(badge.recipients);
  if (!roster.success || !roster.data.length) return 0;
  const result = await tx.defenseCertificate.createMany({
    data: roster.data.map(({ userId, name }) => ({
      badgeId: badge.id,
      recipientId: userId,
      recipientName: name,
      coordinator: fullName(badge.issuer),
      dean: fullName(dean),
      collegeName: research.college.name,
      collegeCode: research.college.code,
      researchTitle: research.title,
      awardedAt: badge.issuedAt,
    })),
    skipDuplicates: true,
  });
  return result.count;
}
