import type { ResearcherHelpTopic } from "./researcher-help";

import { panelistReviewRoutes } from "./panelist-review-routes";

export const panelistRoutes = {
  overview: "/panelist/dashboard",
  schedule: "/panelist/dashboard?tab=schedule",
  ...panelistReviewRoutes,
  evaluation: "/panelist/dashboard?tab=evaluation",
  results: "/panelist/dashboard?tab=grades",
  official: "/panelist/documents?tab=official",
  consultations: "/panelist/consultations",
  calendar: "/panelist/calendar",
  messages: "/panelist/dashboard?tab=messages",
  inbox: "/panelist/inbox",
  settings: "/panelist/settings",
} as const;

export type PanelistHelpId =
  | "pn-01"
  | "pn-02"
  | "pn-03"
  | "pn-04"
  | "pn-05"
  | "pn-06"
  | "pn-07"
  | "pn-08"
  | "pn-09"
  | "pn-10"
  | "pn-11"
  | "pn-12"
  | "pn-13"
  | "pn-14"
  | "pn-15"
  | "pn-16"
  | "pn-17"
  | "pn-18"
  | "pn-19"
  | "pn-20";

export const panelistCategories = [
  "Assignments & schedules",
  "Manuscripts & review",
  "Evaluations & results",
  "Communication & settings",
] as const;

export const panelistPopular = ["pn-02", "pn-07", "pn-12", "pn-16"] as const;

type Category = (typeof panelistCategories)[number];
type PanelistTopic = Omit<
  ResearcherHelpTopic,
  "id" | "walkthrough" | "category"
> & {
  id: PanelistHelpId;
  walkthrough: PanelistHelpId;
  category: Category;
};

function help(
  id: PanelistHelpId,
  category: Category,
  href: string,
  question: string,
  keywords: string[],
  answer: string,
  fallback: string,
): PanelistTopic {
  return {
    id,
    category,
    href,
    question,
    keywords,
    answer: [answer],
    fallback,
    section: category,
    walkthrough: id,
    requirements:
      "Active Defense Panelist workspace and approved college. Session-specific controls require an authorized assignment.",
  };
}

const [assignments, review, scoring, account] = panelistCategories;
const r = panelistRoutes;
export const PANELIST_HELP = [
  help(
    "pn-01",
    assignments,
    r.overview,
    "Where do I start as a panelist?",
    ["panelist overview", "get started", "my assignments"],
    "Start at Overview for assigned work and upcoming activity. Check Defense Schedule for invitations, then open the relevant session to see which steps are ready.",
    "If you have no assignments yet, the workspace will show an empty state.",
  ),
  help(
    "pn-02",
    assignments,
    r.schedule,
    "Where can I see my defense invitations?",
    [
      "find my invitation",
      "defense invitation",
      "panel invitation",
      "my invitation",
      "defense invitations",
    ],
    "Open Defense Schedule and look for your invitation status on the assigned defense. A pending invitation needs a response, and a rescheduled defense may ask you to confirm again.",
    "Your panel assignments will appear here once they’re available in this college.",
  ),
  help(
    "pn-03",
    assignments,
    r.schedule,
    "How do I accept or decline an invitation?",
    [
      "accept invitation",
      "accept my invitation",
      "accept my defense invitation",
      "decline invitation",
      "decline my invitation",
      "respond to invitation",
      "reply to invitation",
    ],
    "In Defense Schedule, verify the time and session before using the invitation’s Accept or Decline controls. If you decline, enter the requested reason before confirming your response.",
    "If response controls are missing, check the displayed invitation status.",
  ),
  help(
    "pn-04",
    assignments,
    r.schedule,
    "Where is my defense schedule?",
    [
      "defense schedule",
      "panel schedule",
      "defense date",
      "when is my defense",
      "upcoming defenses",
    ],
    "Defense Schedule shows assigned sessions, their date, venue when provided, and confirmation status. Open the relevant session for details, especially if the schedule is tentative or has changed.",
    "If the list is empty, there is no assigned defense displayed for this college.",
  ),
  help(
    "pn-05",
    assignments,
    r.schedule,
    "How do I open my defense session?",
    [
      "open session",
      "open my defense session",
      "defense workspace",
      "session details",
    ],
    "Use Open session on the correct Defense Schedule card. The workspace shows the invitation, defense packet, review and scoring readiness for that session.",
    "A session link only works for an assignment you can access.",
  ),
  help(
    "pn-06",
    review,
    r.reviews,
    "Where are the manuscripts assigned to me?",
    [
      "manuscript reviews",
      "assigned manuscripts",
      "review queue",
      "review assignments",
    ],
    "Open Manuscript Reviews for general reviewer assignments. If you’re preparing for an assigned defense, open its session and choose the published defense packet for the manuscript tied to that defense.",
    "An empty review queue can still coexist with a published defense packet.",
  ),
  help(
    "pn-07",
    review,
    r.packet,
    "How do I review the defense manuscript?",
    [
      "review defense materials",
      "review the defense manuscript",
      "defense papers",
      "defense packet",
      "published manuscript",
    ],
    "In Manuscript Reviews, choose Defense Packets and select your defense. Check the published version, review checklist and annotation tools. Notes stay private until you explicitly share feedback, and review completion is a separate action.",
    "Access depends on your invitation and packet publication. Check session readiness if the packet is unavailable.",
  ),
  help(
    "pn-08",
    review,
    r.reviews,
    "How do I leave feedback on an assigned manuscript version?",
    [
      "leave feedback",
      "review feedback",
      "comment on manuscript",
      "assigned manuscript version",
    ],
    "In Manuscript Reviews, open the active assignment and confirm the version before using its feedback or recommendation controls. Completed or superseded assignments may be read-only.",
    "If the assignment no longer appears, check whether it was reassigned or your access changed.",
  ),
  help(
    "pn-09",
    review,
    r.reviews,
    "Where can I see earlier manuscript versions?",
    [
      "earlier manuscript versions",
      "earlier versions",
      "previous versions",
      "version history",
      "old manuscript versions",
    ],
    "Open the relevant Manuscript Reviews assignment and look for version history. A defense packet has its own published version and may show prior versions separately. Check the version label before reading feedback.",
    "Version history only includes records available in your review context.",
  ),
  help(
    "pn-10",
    review,
    r.packet,
    "What is the panel recommendation form?",
    [
      "panel recommendation form",
      "recommendation form",
      "preview recommendation",
      "lock recommendation",
    ],
    "When a defense packet offers a separate recommendation form, review its draft and preview before confirming and locking it. A structured digital evaluation may include the recommendation in the evaluation itself.",
    "If the form is unavailable, check the packet and the session’s evaluation mode.",
  ),
  help(
    "pn-11",
    scoring,
    r.evaluation,
    "How do I start an evaluation?",
    [
      "start an evaluation",
      "start evaluation",
      "my evaluations",
      "evaluation form",
      "open scoring",
    ],
    "Open Evaluations for the assigned defense. The session determines whether you see a structured form, a PDF workspace, or a rubric. Scoring can remain unavailable until the professor starts the defense.",
    "Check the session’s readiness and the form’s availability message.",
  ),
  help(
    "pn-12",
    scoring,
    r.evaluation,
    "How do I save an evaluation draft?",
    [
      "save an evaluation draft",
      "save evaluation draft",
      "save draft",
      "draft evaluation",
      "save my evaluation",
    ],
    "Use Save draft on the available evaluation. Structured forms save criteria and answers, PDF workspaces save the current evaluation marks, and rubric forms save the displayed scores and comments. The draft remains editable while the form allows changes.",
    "If Save draft is absent, check whether the form is unavailable or the evaluation is already locked.",
  ),
  help(
    "pn-13",
    scoring,
    r.evaluation,
    "How do I submit a final evaluation?",
    [
      "submit a final evaluation",
      "submit final evaluation",
      "submit my defense evaluation",
      "submit my evaluation",
      "final evaluation",
      "lock evaluation",
    ],
    "Complete the required fields and follow the form’s preview and confirmation steps. A structured form generates a preview, a PDF workflow may require signature confirmation, and the legacy rubric asks for final confirmation. Final submission locks the evaluation.",
    "Follow the requirements shown on the selected form before you confirm.",
  ),
  help(
    "pn-14",
    scoring,
    r.evaluation,
    "Why is my evaluation unavailable or locked?",
    [
      "evaluation locked",
      "evaluation unavailable",
      "evaluation not available",
      "locked evaluation",
      "cant score",
      "scoring locked",
    ],
    "Check the evaluation’s status message and the defense session’s readiness. The form can be unavailable when the defense has yet to start, the required packet or rubric is missing, or access is restricted. A submitted and locked evaluation can be viewed where available.",
    "Use the status shown for the selected session to distinguish these cases.",
  ),
  help(
    "pn-15",
    scoring,
    r.results,
    "Where can I see my submitted evaluation?",
    [
      "submitted evaluation",
      "my submitted evaluation",
      "my completed evaluation",
      "personal evaluation",
      "my score",
    ],
    "Open Results to find your own completed evaluation. When the record offers View my completed evaluation, use it to open the locked form or preview.",
    "A personal submission can be available while the official decision is still pending release.",
  ),
  help(
    "pn-16",
    scoring,
    r.results,
    "How do I find official results or recommendations?",
    [
      "check my results",
      "where are my results",
      "official results",
      "official decision",
      "released decision",
      "defense results",
      "cant see the decision",
      "cant i see the decision",
      "cannot see the decision",
      "cant see the results",
      "cant i see the results",
    ],
    "Check Results for the session’s official decision or a pending-release message. Your completed evaluation is a separate record and may be visible earlier.",
    "If release is pending, check back after the authorized release.",
  ),
  help(
    "pn-17",
    review,
    r.official,
    "Where do I find official copies?",
    [
      "official copies",
      "official documents",
      "archived documents",
      "archival copies",
    ],
    "Open Official Copies to see archival files available to your account. Select an authorized project and use the available preview or download controls.",
    "Files appear when an official copy is available to you for the selected project.",
  ),
  help(
    "pn-18",
    account,
    r.consultations,
    "How can I find consultations and calendar events?",
    [
      "consultations",
      "consultation schedule",
      "calendar",
      "calendar events",
      "my calendar",
    ],
    "Open Consultations to check your faculty consultation workspace. Open Calendar to view the events available in your selected college.",
    "The controls and events depend on your assignment and permissions.",
  ),
  help(
    "pn-19",
    account,
    r.messages,
    "How can I contact the relevant faculty or group?",
    [
      "messages",
      "inbox",
      "message faculty",
      "contact faculty",
      "contact my group",
    ],
    "Use Messages for available group conversations or Inbox for direct conversations. Check the recipient and college before sending.",
    "Use the participants and conversations that are available in your current workspace.",
  ),
  help(
    "pn-20",
    account,
    r.settings,
    "How do I change appearance or hide the assistant?",
    [
      "hide the assistant",
      "hide assistant",
      "floating ai assistant",
      "dark mode",
      "light mode",
      "appearance",
      "turn off assistant",
    ],
    "Open Settings → Appearance to find Workspace Assistance and the Show floating AI Assistant switch. Your choice is saved, and Guide stays available. The appearance controls also let you change the visual theme.",
    "Return to the same switch to restore the floating button.",
  ),
];
