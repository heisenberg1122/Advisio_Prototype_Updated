import {
  RESEARCHER_HELP,
  type ResearcherHelpId,
} from "@research-management/shared/src/researcher-help";
export {
  RESEARCHER_HELP,
  normalizeHelpSearch,
  searchResearcherHelp,
} from "@research-management/shared/src/researcher-help";
export type {
  ResearcherHelpId,
  ResearcherHelpCategory,
  ResearcherHelpTopic,
} from "@research-management/shared/src/researcher-help";

export type ClassAccessState =
  | "unknown"
  | "joined"
  | "pending"
  | "invited"
  | "declined"
  | "removed"
  | "no-requirements"
  | "none";
export interface ResearcherGuideState {
  projectKnown: boolean;
  projectCount: number;
  projectId: string | null;
  hasGroup: boolean;
  memberCount: number;
  isLeader: boolean;
  hasAdviser: boolean;
  classAccess: ClassAccessState;
  enrollmentCount: number;
  hasDocuments: boolean;
  documentsKnown: boolean;
  requestError: boolean;
}
export function researcherPageHelp(
  pathname: string,
  search: string,
): ResearcherHelpId {
  const params = new URLSearchParams(search),
    tab = params.get("tab");
  if (pathname.includes("/workflows/join/")) return "class";
  if (pathname.endsWith("/join-group")) return "join-group";
  if (pathname.includes("/tasks")) return "submit";
  if (
    pathname.includes("/documents") ||
    pathname.includes("/group-files") ||
    [
      "workspace",
      "documents",
      "submissions",
      "submission",
      "version-control",
    ].includes(tab || "")
  )
    return "documents";
  if (pathname.includes("/grades")) return "grades";
  if (pathname.includes("/defense") || tab === "defense") return "defense";
  if (pathname.includes("/settings")) return "settings";
  if (
    pathname.includes("/calendar") ||
    pathname.includes("/consultations") ||
    tab === "consultations"
  )
    return "adviser";
  if (
    pathname.includes("/notifications") ||
    pathname.includes("/inbox") ||
    tab === "group-chats"
  )
    return "communication";
  if (tab === "milestones" || tab === "progress") return "progress";
  if (
    tab === "my-group" ||
    (tab === "group" && params.get("section") === "my-group")
  )
    return "group";
  if (tab === "group") return "project";
  return "class";
}

export function researcherStateNotice(
  id: ResearcherHelpId,
  state: ResearcherGuideState,
): string | null {
  if (state.requestError)
    return "Some guide context could not be loaded. Check the actual page status; the guide will not assume that you joined or submitted anything.";
  if (id === "class")
    return {
      unknown: "Checking your class access…",
      joined:
        "You already have an active class workflow. Let’s find its requirements.",
      "no-requirements":
        "Your class workflow is active, but it has no available stages yet. Ask your professor when requirements will be added.",
      pending:
        "Your class request is still pending. Your professor needs to approve it before requirements become available.",
      invited:
        "You have a workflow invitation. Read it in Inbox and make your own accept/decline choice.",
      declined:
        "Your workflow request was declined. Contact the professor for the next step.",
      removed:
        "Workflow access was removed. Ask the professor to check your access.",
      none: "No active class workflow was found. Use the code or link your professor supplies; reviewing it does not enroll you.",
    }[state.classAccess];
  if (
    [
      "project",
      "documents",
      "group",
      "progress",
      "defense",
      "adviser",
    ].includes(id) &&
    state.projectKnown &&
    !state.projectId &&
    state.projectCount > 1
  )
    return "You have more than one project. Choose the one you want before following project-specific records.";
  if (id === "group" && state.projectKnown && !state.hasGroup)
    return "No group is available in the current context. You can still join a class; a research-group code comes from your group leader.";
  if (id === "adviser" && state.projectKnown && !state.hasAdviser)
    return "This project does not show an assigned adviser. Ask your professor/coordinator about the assignment before looking for an adviser-specific meeting.";
  if (id === "documents" && state.documentsKnown && !state.hasDocuments)
    return "There are no working documents for this project yet. We’ll show the empty state and available next steps instead of inventing a file.";
  if (
    ["documents", "progress", "defense"].includes(id) &&
    state.projectKnown &&
    !state.projectId
  )
    return "No project is selected. Class/workflow access and joining a research group are available separately from project-specific records.";
  return null;
}
