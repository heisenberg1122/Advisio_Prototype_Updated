const PANEL_ROLES = new Set(["PANELIST", "PANEL_CHAIR"]);

type InvitationLike = {
  inviteeId: string;
  role: string;
  status: string;
};

type CriterionLike = {
  id: string;
  criterion: string;
  maxScore: unknown;
};

type SubmittedScoreLike = {
  criterionId?: unknown;
  score?: unknown;
  comment?: unknown;
};

export function currentPanelInvitation(
  invitations: InvitationLike[],
  userId: string,
) {
  return invitations.find(
    (invitation) =>
      invitation.inviteeId === userId &&
      invitation.status !== "REMOVED" &&
      PANEL_ROLES.has(invitation.role),
  );
}

export function hasAcceptedPanelAssignment(
  invitations: InvitationLike[],
  userId: string,
) {
  return Boolean(
    currentPanelInvitation(invitations, userId)?.status === "ACCEPTED",
  );
}

/**
 * Concurrent defenses are isolated by managed defense event. Standalone
 * sessions are isolated by project. A defense in another event or college is
 * therefore not blocked by an unrelated live session.
 */
export function liveDefenseConflictScope(input: {
  defenseEventId?: string | null;
  researchId: string;
}) {
  return {
    OR: [
      { researchId: input.researchId },
      ...(input.defenseEventId
        ? [{ defenseEventId: input.defenseEventId }]
        : []),
    ],
  };
}

export class EvaluationScoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationScoreError";
  }
}

const isBlank = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim() === "");

/**
 * Drafts may be partial, but final evaluations require one explicit score for
 * every rubric criterion. An explicit numeric zero remains a valid answer.
 */
export function normalizeEvaluationScores(
  criteria: CriterionLike[],
  submittedScores: SubmittedScoreLike[],
  final: boolean,
) {
  const criteriaById = new Map(
    criteria.map((criterion) => [criterion.id, criterion]),
  );
  const submittedById = new Map<string, SubmittedScoreLike>();

  for (const submitted of submittedScores) {
    const criterionId = String(submitted?.criterionId || "");
    if (!criteriaById.has(criterionId) || submittedById.has(criterionId)) {
      throw new EvaluationScoreError(
        "Every rubric criterion must be submitted once and belong to the selected rubric.",
      );
    }
    submittedById.set(criterionId, submitted);
  }

  const normalized = criteria.map((criterion) => {
    const submitted = submittedById.get(criterion.id);
    const answered = Boolean(submitted) && !isBlank(submitted?.score);
    const score = answered ? Number(submitted?.score) : undefined;
    const maxScore = Number(criterion.maxScore);
    if (
      answered &&
      (!Number.isFinite(score) || score! < 0 || score! > maxScore)
    ) {
      throw new EvaluationScoreError(
        "Every answered rubric criterion requires a score within its allowed range.",
      );
    }
    return {
      criterionId: criterion.id,
      criterion: criterion.criterion,
      ...(answered ? { score } : {}),
      maxScore,
      comment: String(submitted?.comment || "").trim(),
      answered,
    };
  });

  if (final && normalized.some((item) => !item.answered)) {
    throw new EvaluationScoreError(
      "Every rubric criterion requires an explicit score before final submission.",
    );
  }

  const criteriaScores = normalized.map(
    ({ answered: _answered, ...item }) => item,
  );
  const totalScore = normalized.reduce(
    (sum, item) => sum + (item.answered ? Number(item.score) : 0),
    0,
  );
  return { criteriaScores, totalScore };
}
