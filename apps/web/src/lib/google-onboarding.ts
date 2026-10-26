export type GoogleOnboardingSession = {
  onboardingToken: string;
  onboardingStage: "IDENTITY" | "RESEARCHER" | "FACULTY";
  user: {
    id: string;
    universityId: string;
    email: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    collegeId?: string | null;
    programId?: string | null;
    roles: string[];
  };
  facultyProfile?: {
    academicTitle?: string | null;
    facultyDesignation?: string | null;
    department?: string | null;
    expertiseKeywords?: string[];
  } | null;
};
const key = "advisio_google_onboarding_session";
const researcherKeys = [
  "advisio_researcher_onboarding_token",
  "advisio_researcher_onboarding_identity",
  "advisio_researcher_onboarding_draft",
];

export function readGoogleOnboardingSession(): GoogleOnboardingSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    return value &&
      typeof value.onboardingToken === "string" &&
      value.user?.id &&
      ["IDENTITY", "RESEARCHER", "FACULTY"].includes(value.onboardingStage)
      ? value
      : null;
  } catch {
    return null;
  }
}
export function storeGoogleOnboardingSession(session: GoogleOnboardingSession) {
  const previous = readGoogleOnboardingSession();
  let sameResearcher = false;
  try {
    const identity = JSON.parse(
      sessionStorage.getItem("advisio_researcher_onboarding_identity") ||
        "null",
    );
    sameResearcher =
      identity?.email?.toLowerCase() === session.user.email.toLowerCase();
  } catch {
    /* A malformed or unrelated draft is discarded below. */
  }
  if (
    (previous && previous.user.id !== session.user.id) ||
    (!previous && !sameResearcher)
  ) {
    researcherKeys.forEach((name) => sessionStorage.removeItem(name));
  }
  sessionStorage.setItem(key, JSON.stringify(session));
}
export function clearGoogleOnboardingSession() {
  sessionStorage.removeItem(key);
  researcherKeys.forEach((name) => sessionStorage.removeItem(name));
}
export function prepareGoogleResearcherOnboarding(
  session: GoogleOnboardingSession,
) {
  storeGoogleOnboardingSession(session);
  const user = session.user;
  sessionStorage.setItem(
    "advisio_researcher_onboarding_token",
    session.onboardingToken,
  );
  sessionStorage.setItem(
    "advisio_researcher_onboarding_identity",
    JSON.stringify({
      name: [user.firstName, user.middleName, user.lastName]
        .filter(Boolean)
        .join(" "),
      email: user.email,
      universityId: user.universityId,
      collegeId: user.collegeId,
      programId: user.programId,
    }),
  );
  if (!sessionStorage.getItem("advisio_researcher_onboarding_draft")) {
    sessionStorage.setItem(
      "advisio_researcher_onboarding_draft",
      JSON.stringify({ collegeId: user.collegeId, programId: user.programId }),
    );
  }
}
