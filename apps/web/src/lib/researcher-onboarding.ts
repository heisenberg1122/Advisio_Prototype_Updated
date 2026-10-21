export const MAX_RESEARCH_INTERESTS = 10;

export type ResearcherOnboardingForm = {
  collegeId: string;
  programId: string;
  academicYearId: string;
  degreeLevel: "" | "UNDERGRADUATE" | "MASTERS" | "DOCTORATE" | "OTHER";
  otherDegreeLevel: string;
  yearLevel: string;
  academicStage: string;
  academicTerm: string;
  researchStatus: string;
  groupSetup: string;
  invitationCode: string;
  tentativeTitle: string;
  researchType: "" | "INDIVIDUAL" | "GROUP";
  interests: string[];
};

export const initialResearcherOnboardingForm: ResearcherOnboardingForm = {
  collegeId: "",
  programId: "",
  academicYearId: "",
  degreeLevel: "",
  otherDegreeLevel: "",
  yearLevel: "",
  academicStage: "",
  academicTerm: "",
  researchStatus: "",
  groupSetup: "SET_UP_LATER",
  invitationCode: "",
  tentativeTitle: "",
  researchType: "",
  interests: [],
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEGREE_LEVELS = new Set([
  "",
  "UNDERGRADUATE",
  "MASTERS",
  "DOCTORATE",
  "OTHER",
]);
const RESEARCH_TYPES = new Set(["", "INDIVIDUAL", "GROUP"]);

function safeString(value: unknown, maximumLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function safeUuid(value: unknown) {
  const candidate = safeString(value, 36);
  return UUID_PATTERN.test(candidate) ? candidate : "";
}

function safeEnum<T extends string>(
  value: unknown,
  choices: Set<string>,
  fallback: T,
) {
  return typeof value === "string" && choices.has(value)
    ? (value as T)
    : fallback;
}

export function sanitizeResearchInterests(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const item of value) {
    const interest = safeString(item, 80);
    if (interest) unique.add(interest);
    if (unique.size === MAX_RESEARCH_INTERESTS) break;
  }
  return [...unique];
}

export function restoreResearcherOnboardingDraft(
  serialized: string | null,
): ResearcherOnboardingForm {
  if (!serialized) return { ...initialResearcherOnboardingForm };

  let source: unknown;
  try {
    source = JSON.parse(serialized);
  } catch {
    return { ...initialResearcherOnboardingForm };
  }
  if (!source || typeof source !== "object" || Array.isArray(source))
    return { ...initialResearcherOnboardingForm };

  const draft = source as Record<string, unknown>;
  return {
    collegeId: safeUuid(draft.collegeId),
    programId: safeUuid(draft.programId),
    academicYearId: safeUuid(draft.academicYearId),
    degreeLevel: safeEnum(
      draft.degreeLevel,
      DEGREE_LEVELS,
      "" as ResearcherOnboardingForm["degreeLevel"],
    ),
    otherDegreeLevel: safeString(draft.otherDegreeLevel, 100),
    yearLevel: safeString(draft.yearLevel, 50),
    academicStage: safeString(draft.academicStage, 50),
    academicTerm: safeString(draft.academicTerm, 50),
    researchStatus: safeString(draft.researchStatus, 50),
    groupSetup:
      safeString(draft.groupSetup, 50) ||
      initialResearcherOnboardingForm.groupSetup,
    invitationCode: safeString(draft.invitationCode, 100),
    tentativeTitle: safeString(draft.tentativeTitle, 300),
    researchType: safeEnum(
      draft.researchType,
      RESEARCH_TYPES,
      "" as ResearcherOnboardingForm["researchType"],
    ),
    interests: sanitizeResearchInterests(draft.interests),
  };
}

export function restoreResearcherOnboardingSession(
  draftSerialized: string | null,
  identitySerialized: string | null,
): ResearcherOnboardingForm {
  const draft = restoreResearcherOnboardingDraft(draftSerialized);
  const registeredIdentity = restoreResearcherOnboardingDraft(identitySerialized);

  return {
    ...draft,
    // Registration owns these locked values. Prefer its identity record when a
    // first-render draft write or an older draft omitted or changed them.
    collegeId: registeredIdentity.collegeId || draft.collegeId,
    programId: registeredIdentity.programId || draft.programId,
  };
}

export function reconcileResearchInterests(
  selected: readonly string[],
  allowed: readonly string[],
) {
  const allowedSet = new Set(allowed);
  return sanitizeResearchInterests(selected).filter((interest) =>
    allowedSet.has(interest),
  );
}

export function toggleResearchInterest(
  selected: readonly string[],
  interest: string,
  allowed: readonly string[],
) {
  const reconciled = reconcileResearchInterests(selected, allowed);
  if (!allowed.includes(interest))
    return { interests: reconciled, limitReached: false };
  if (reconciled.includes(interest))
    return {
      interests: reconciled.filter((item) => item !== interest),
      limitReached: false,
    };
  if (reconciled.length >= MAX_RESEARCH_INTERESTS)
    return { interests: reconciled, limitReached: true };
  return {
    interests: [...reconciled, interest],
    limitReached: false,
  };
}
