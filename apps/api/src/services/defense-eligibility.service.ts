import { prisma, type Prisma } from "../lib/prisma.js";
import { getMilestoneProgress } from "./research-workflow-integration.service.js";
import { assertMilestoneCondition } from "./milestone-condition.service.js";

type Db = Prisma.TransactionClient | typeof prisma;
export const activeDefenseStatuses = [
  "PENDING_ACKNOWLEDGEMENT",
  "NEEDS_RESCHEDULING",
  "SCHEDULED",
  "LIVE",
  "DELIBERATION",
] as const;

export class DefenseEligibilityError extends Error {
  constructor(
    message: string,
    public statusCode = 409,
  ) {
    super(message);
  }
}

export async function lockDefenseGroup(db: Db, researchId: string) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`defense-eligibility:${researchId}`}))`;
}

// Always use the first unconsumed gate in workflow order. Old approvals must
// never reappear after a pass, even if the milestone is edited or re-approved.
export async function currentDefenseEligibility(db: Db, researchId: string) {
  const progress = await getMilestoneProgress(db, researchId);
  const approvals = await db.defenseEligibility.findMany({
    where: { researchId },
  });
  for (const milestone of progress) {
    if (milestone.milestoneType !== "DEFENSE_ELIGIBILITY") continue;
    const approval = approvals.find(
      (item) => item.milestoneId === milestone.id,
    );
    if (approval?.consumedAt) continue;
    if (!milestone.completed) return null;
    if (!approval) return null;
    return { ...approval, milestoneName: milestone.name };
  }
  return null;
}

export async function approveDefenseEligibility(
  db: Db,
  input: {
    researchId: string;
    milestoneId: string;
    actorId: string;
  },
) {
  await lockDefenseGroup(db, input.researchId);
  await assertMilestoneCondition(db, input.researchId, input.milestoneId);
  const progress = await getMilestoneProgress(db, input.researchId);
  const milestone = progress.find((item) => item.id === input.milestoneId);
  if (!milestone || milestone.milestoneType !== "DEFENSE_ELIGIBILITY")
    throw new DefenseEligibilityError(
      "Choose a Defense Eligibility milestone from this group's workflow.",
      400,
    );
  if (
    (milestone.requiresDocument && !milestone.documentRequirementSatisfied) ||
    milestone.tasks.some(
      (task) => task.isRequired && task.status !== "APPROVED",
    )
  )
    throw new DefenseEligibilityError(
      "Approve all required submissions before granting defense eligibility.",
    );
  const previousGates = progress.filter(
    (item) =>
      item.milestoneType === "DEFENSE_ELIGIBILITY" &&
      item.sequence < milestone.sequence,
  );
  const consumed = await db.defenseEligibility.findMany({
    where: { researchId: input.researchId, consumedAt: { not: null } },
  });
  if (
    previousGates.some(
      (item) => !consumed.some((grant) => grant.milestoneId === item.id),
    )
  )
    throw new DefenseEligibilityError(
      "The group must pass its preceding defense cycle before receiving another defense eligibility.",
    );
  const approval = await db.defenseEligibility.upsert({
    where: {
      researchId_milestoneId: {
        researchId: input.researchId,
        milestoneId: input.milestoneId,
      },
    },
    create: {
      researchId: input.researchId,
      milestoneId: input.milestoneId,
      approvedBy: input.actorId,
    },
    update: {},
  });
  if (approval.consumedAt)
    throw new DefenseEligibilityError(
      "This milestone's eligibility was already consumed by a passed defense.",
    );
  return approval;
}

export async function requireDefenseEligibility(
  db: Db,
  researchId: string,
  signed = true,
) {
  const eligibility = await currentDefenseEligibility(db, researchId);
  if (!eligibility)
    throw new DefenseEligibilityError(
      "This group needs approval on an unconsumed Defense Eligibility milestone.",
    );
  if (
    await db.defenseSession.findFirst({
      where: { researchId, status: { in: [...activeDefenseStatuses] } },
      select: { id: true },
    })
  )
    throw new DefenseEligibilityError(
      "This group already has an active defense session.",
    );
  if (
    signed &&
    !(await hasSignedDefenseApproval(db, eligibility.deanApprovalDocumentId))
  )
    throw new DefenseEligibilityError(
      "A signed Dean approval for this defense eligibility is required before scheduling.",
    );
  return eligibility;
}

export async function hasSignedDefenseApproval(
  db: Db,
  documentId: string | null,
) {
  return Boolean(
    documentId &&
    (await db.document.findFirst({
      where: {
        id: documentId,
        documentType: "DEAN_DEFENSE_APPROVAL",
        versions: {
          some: {
            status: "ACTIVE",
            signedSignature: {
              is: {
                revokedAt: null,
                signedBy: {
                  status: "ACTIVE",
                  roles: { some: { role: { name: "DEAN" } } },
                },
              },
            },
          },
        },
      },
      select: { id: true },
    })),
  );
}

export async function consumeDefenseEligibility(
  db: Db,
  session: {
    id: string;
    researchId: string;
    eligibilityId: string | null;
  },
  decision: string,
  consumedAt: Date,
) {
  if (decision !== "APPROVED" || !session.eligibilityId) return;
  await lockDefenseGroup(db, session.researchId);
  const result = await db.defenseEligibility.updateMany({
    where: {
      id: session.eligibilityId,
      researchId: session.researchId,
      consumedAt: null,
    },
    data: { consumedAt },
  });
  if (!result.count)
    throw new DefenseEligibilityError(
      "This defense eligibility was already consumed.",
    );
}
