export interface ResearchCohortOption {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
  workflowId?: string | null;
  workflow?: { id: string; name?: string; status: string } | null;
  program?: { name?: string; code?: string };
  researchType?: { name?: string };
  academicYear?: { name?: string };
}
export interface ResearchTeamOption {
  id: string;
  name: string;
  cohortId?: string | null;
  participationMode?: "SOLO" | "GROUP";
  inviteCode?: string;
  inviteCodeEnabled?: boolean;
  members?: Array<{
    id?: string;
    userId: string;
    role: string;
    leftAt?: string | null;
    user?: { firstName?: string; lastName?: string; email?: string };
  }>;
  projects?: Array<{ id: string; title?: string; status?: string }>;
}
export interface ResearchCaseOption {
  id: string;
  title?: string | null;
  isTitleProvisional?: boolean;
  cohortId?: string | null;
  workspaceId?: string | null;
  workflowAccessRemoved?: boolean;
  workflowInstance?: { workflowId: string } | null;
}
export type ResearcherLifecycleState =
  | "NO_ACTIVE_COHORT"
  | "COHORT_NO_PROCESS"
  | "COHORT_NO_TEAM"
  | "TEAM_FORMING"
  | "RESEARCH_CASE_ACTIVE"
  | "COHORT_HISTORY"
  | "COHORT_INACTIVE"
  | "SELECT_COHORT"
  | "SELECT_TEAM"
  | "SELECT_CASE";

export function resolveResearcherLifecycle<P extends ResearchCaseOption>({
  cohorts,
  teams,
  projects,
  userId,
  cohortId,
  workspaceId,
  projectId,
  requestedProjectId,
}: {
  cohorts: ResearchCohortOption[];
  teams: ResearchTeamOption[];
  projects: P[];
  userId?: string;
  cohortId?: string | null;
  workspaceId?: string | null;
  projectId?: string | null;
  requestedProjectId?: string | null;
}) {
  const activeCohorts = cohorts.filter((cohort) => cohort.status === "ACTIVE");
  const requestedTeam = teams.find((team) => team.id === workspaceId);
  let cohort =
    cohorts.find((item) => item.id === cohortId) ||
    (!cohortId
      ? cohorts.find((item) => item.id === requestedTeam?.cohortId)
      : undefined) ||
    null;
  let team: ResearchTeamOption | null = null;
  let project: P | null = null;
  const finish = (state: ResearcherLifecycleState, invalidContext = false) => ({
    state,
    cohort,
    team,
    project,
    activeCohorts,
    teamChoices: cohort
      ? teams.filter((item) => item.cohortId === cohort.id)
      : [],
    caseChoices: projects,
    isLeader: Boolean(
      team?.members?.some(
        (member) =>
          member.userId === userId &&
          member.role === "LEADER" &&
          !member.leftAt,
      ),
    ),
    canStart:
      state === "TEAM_FORMING" &&
      Boolean(
        team?.members?.some(
          (member) =>
            member.userId === userId &&
            member.role === "LEADER" &&
            !member.leftAt,
        ),
      ),
    invalidContext,
  });
  const useCase = (value: P) => {
    project = value;
    cohort = cohorts.find((item) => item.id === value.cohortId) || null;
    team = teams.find((item) => item.id === value.workspaceId) || null;
    return finish(
      cohort && ["CLOSED", "ARCHIVED"].includes(cohort.status)
        ? "COHORT_HISTORY"
        : "RESEARCH_CASE_ACTIVE",
    );
  };
  // An explicit authorized case URL always wins over a remembered setup context.
  if (requestedProjectId) {
    const requested = projects.find((item) => item.id === requestedProjectId);
    return requested ? useCase(requested) : finish("SELECT_CASE", true);
  }
  const preferred = projects.find(
    (item) =>
      item.id === projectId &&
      (!cohortId || item.cohortId === cohortId) &&
      (!workspaceId || item.workspaceId === workspaceId),
  );
  if (preferred) return useCase(preferred);
  if (
    (cohortId && !cohort) ||
    (workspaceId &&
      (!requestedTeam || (cohort && requestedTeam.cohortId !== cohort.id)))
  )
    return finish("SELECT_COHORT", true);
  const relevantCases = projects.filter(
    (item) =>
      (!cohort || item.cohortId === cohort.id) &&
      (!workspaceId || item.workspaceId === workspaceId),
  );
  if (relevantCases.length === 1) return useCase(relevantCases[0]);
  if (relevantCases.length > 1) return finish("SELECT_CASE");
  if (!cohort && activeCohorts.length === 1) cohort = activeCohorts[0];
  if (!cohort)
    return finish(
      activeCohorts.length > 1 ? "SELECT_COHORT" : "NO_ACTIVE_COHORT",
    );
  if (requestedTeam && requestedTeam.cohortId !== cohort.id)
    return finish("SELECT_TEAM", true);
  if (cohort.status !== "ACTIVE") return finish("COHORT_INACTIVE");
  const choices = teams.filter((item) => item.cohortId === cohort!.id);
  team = requestedTeam || (choices.length === 1 ? choices[0] : null);
  // Existing cases were resolved above, so a newly published assignment never
  // changes an existing case's pinned process or forces historical setup again.
  if (
    !cohort.workflowId ||
    !cohort.workflow ||
    cohort.workflow.status !== "PUBLISHED" ||
    cohort.workflow.id !== cohort.workflowId
  )
    return finish("COHORT_NO_PROCESS");
  if (!team)
    return finish(choices.length > 1 ? "SELECT_TEAM" : "COHORT_NO_TEAM");
  return finish("TEAM_FORMING");
}

export const researcherLifecycleMessage: Record<
  ResearcherLifecycleState,
  string
> = {
  NO_ACTIVE_COHORT:
    "You are not currently assigned to an active research cohort. Please contact your research coordinator.",
  COHORT_NO_PROCESS:
    "Your research coordinator has not assigned the research process yet.",
  COHORT_NO_TEAM:
    "Create or join your research team. Research starts only when your team leader confirms the team is ready.",
  TEAM_FORMING:
    "Your team is being prepared. The team leader can start the research process when ready.",
  RESEARCH_CASE_ACTIVE:
    "Your research record is available. Continue your assigned research process.",
  COHORT_HISTORY:
    "This cohort is closed or archived. Your existing research record remains available according to your access.",
  COHORT_INACTIVE:
    "This research cohort is not currently active. New research cannot be started.",
  SELECT_COHORT: "Select the research cohort you intend to work in.",
  SELECT_TEAM: "Select the research team you intend to work with.",
  SELECT_CASE:
    "Select an existing research study to continue, or choose an active cohort for team setup.",
};

export function researchStartError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/only.*leader|ACTOR_NOT_WORKSPACE_LEADER/i.test(message))
    return "Only the research team leader can start the research process.";
  if (
    /do not currently have access|WORKFLOW_ACCESS_REVOKED|access.*restricted/i.test(
      message,
    )
  )
    return "One or more team members currently do not have access to the assigned research process. Please contact your research coordinator.";
  if (
    /TEAM_MEMBER_NOT_IN_COHORT|every active team participant.*cohort/i.test(
      message,
    )
  )
    return "One or more team members are not active members of this research cohort.";
  if (
    /COHORT_NOT_ACTIVE|only start in an active cohort|not currently active/i.test(
      message,
    )
  )
    return "This research cohort is not currently active.";
  if (
    /COHORT_PROCESS|assign a research process|process must be published|assigned research process is unavailable/i.test(
      message,
    )
  )
    return "Your research coordinator has not assigned the research process yet.";
  if (
    /membership|TEAM_MEMBER_NOT_ELIGIBLE|INVALID_TEAM|every active team participant/i.test(
      message,
    )
  )
    return "Your team membership must be resolved before the research process can begin.";
  return message
    ? message
        .replace(/workspace/gi, "research team")
        .replace(/workflow/gi, "research process")
    : "Unable to start research. Please try again.";
}
