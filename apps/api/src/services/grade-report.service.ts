import { prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";

export async function getReleasedGradeReport(
  user: AuthenticatedUser,
  researchId: string,
) {
  const member = await prisma.researchMember.findFirst({
    where: {
      researchId,
      userId: user.id,
      leftAt: null,
      projectRole: { in: ["LEADER", "MEMBER"] },
    },
  });
  if (!user.roles.includes("RESEARCHER") || !member)
    throw Object.assign(new Error("You cannot view this grade report."), {
      statusCode: 403,
    });
  const session = await prisma.defenseSession.findFirst({
    where: { researchId, status: "COMPLETED", releasedAt: { not: null } },
    orderBy: { releasedAt: "desc" },
    include: {
      evaluations: {
        where: { status: "LOCKED" },
        include: {
          template: { select: { totalScore: true } },
          evaluator: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!session)
    return {
      finalGrade: null,
      gpa: null,
      status: "pending",
      panelistScores: [],
    };
  const panelistScores = session.evaluations
    .filter((evaluation) => evaluation.totalScore !== null)
    .map((evaluation) => ({
      id: evaluation.id,
      panelistName: `${evaluation.evaluator.firstName} ${evaluation.evaluator.lastName}`,
      score: Number(evaluation.totalScore),
      maxScore: Number(evaluation.template.totalScore),
      remarks: evaluation.remarks || undefined,
    }));
  const normalized = panelistScores
    .filter((score) => score.maxScore > 0)
    .map((score) => (score.score / score.maxScore) * 100);
  return {
    finalGrade: normalized.length
      ? `${(normalized.reduce((sum, score) => sum + score, 0) / normalized.length).toFixed(2)}%`
      : null,
    gpa: null,
    status: "released",
    panelistScores,
  };
}
