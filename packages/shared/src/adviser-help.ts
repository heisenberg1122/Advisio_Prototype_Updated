import type { ResearcherHelpTopic } from "./researcher-help";

export const adviserRoutes = {
  overview: "/adviser/dashboard",
  groups: "/adviser/dashboard?tab=advisees",
  reviews: "/adviser/reviews",
  milestones: "/adviser/dashboard?tab=approvals",
  consultations: "/adviser/dashboard?tab=consultations",
  history: "/adviser/dashboard?tab=history",
  official: "/adviser/documents?tab=official",
  messages: "/adviser/dashboard?tab=group-chats",
  inbox: "/adviser/inbox",
  settings: "/adviser/settings",
  calendar: "/adviser/calendar",
  progress: "/adviser/dashboard?tab=progress",
} as const;

export type AdviserHelpId =
  | "ad-01"
  | "ad-02"
  | "ad-03"
  | "ad-04"
  | "ad-05"
  | "ad-06"
  | "ad-07"
  | "ad-08"
  | "ad-09"
  | "ad-10"
  | "ad-11"
  | "ad-12"
  | "ad-13"
  | "ad-14"
  | "ad-15"
  | "ad-16"
  | "ad-17"
  | "ad-17-inbox"
  | "ad-18"
  | "ad-19"
  | "ad-20";
type Category = (typeof adviserCategories)[number];
export const adviserCategories = [
  "Getting started",
  "Advisees & requests",
  "Reviews & feedback",
  "Progress & consultations",
  "Communication & account",
] as const;
export const adviserPopular = ["ad-01", "ad-07", "ad-04", "ad-13"] as const;

type AdviserTopic = Omit<
  ResearcherHelpTopic,
  "id" | "walkthrough" | "category"
> & {
  id: AdviserHelpId;
  walkthrough: AdviserHelpId;
  category: Category;
  permission?: string;
};

function help(
  id: AdviserHelpId,
  category: Category,
  question: string,
  href: string,
  keywords: string[],
  answer: string,
  fallback: string,
  permission?: string,
): AdviserTopic {
  return {
    id,
    category,
    section: category,
    question,
    href,
    keywords,
    answer: [answer],
    fallback,
    walkthrough: id,
    permission,
    requirements:
      "Active Faculty Adviser workspace and approved college. Records and controls must be available in that scope.",
  };
}

const [start, advisees, reviews, progress, account] = adviserCategories;
const r = adviserRoutes;
export const ADVISER_HELP = [
  help(
    "ad-01",
    start,
    "Where are my advisees?",
    r.groups,
    [
      "my advisees",
      "find my advisees",
      "assigned groups",
      "my research group",
      "advisees",
    ],
    "Open My Advisees to see the research groups assigned to you in this college. Choose a group card to see its workspace.",
    "If there are no assigned groups, check Overview for pending requests. A pending request is separate from an assigned group.",
    "research.view",
  ),
  help(
    "ad-02",
    advisees,
    "How do I open a group’s workspace?",
    r.groups,
    [
      "group workspace",
      "open a group",
      "open group",
      "group members",
      "group activity",
    ],
    "Choose a card under My Advisees. The group workspace has a project overview and separate tabs for records such as documents, milestones, consultations and activity.",
    "Only the currently assigned adviser can open the supervision workspace. If access is denied, return to My Advisees.",
    "research.view",
  ),
  help(
    "ad-03",
    advisees,
    "Did a group request me?",
    r.overview,
    [
      "pending adviser requests",
      "pending requests",
      "group request me",
      "new adviser request",
      "adviser requests",
    ],
    "Check Needs your attention on Overview for pending Adviser Request cards. Use View full request to inspect a request. Accepted groups appear separately under My Advisees.",
    "If no request cards appear, check whether the request list loaded before assuming there are none.",
    "research.view",
  ),
  help(
    "ad-04",
    advisees,
    "How do I respond to an adviser request?",
    r.overview,
    [
      "respond to an adviser request",
      "respond to a request",
      "accept adviser request",
      "decline a request",
      "accept or decline",
      "accept a request",
      "reject a request",
    ],
    "Open a pending request from Overview → Needs your attention. Review the details, then choose Accept request or Reject if available; Advisio asks you to confirm.",
    "If Accept is disabled, check the capacity or paused-requests notice. Guide does not send a response.",
    "research.view",
  ),
  help(
    "ad-05",
    advisees,
    "Why can’t I accept another group?",
    r.groups,
    [
      "accept another group",
      "adviser capacity",
      "available slots",
      "capacity full",
      "requests paused",
      "accept disabled",
    ],
    "Check the Capacity indicator in My Advisees. If Advisio shows that your limit is reached or new requests are paused, Accept is disabled. The current notice is the best way to tell what applies.",
    "If capacity is unavailable, refresh My Advisees or ask your coordinator to check your adviser capacity.",
    "research.view",
  ),
  help(
    "ad-06",
    reviews,
    "Where are my assigned manuscripts?",
    r.reviews,
    [
      "assigned manuscripts",
      "assigned reviews",
      "pending reviews",
      "review queue",
      "manuscripts assigned",
    ],
    "Open Reviews → Pending reviews. Each assignment identifies the group and exact submitted version; past assignments are under Review history.",
    "If Pending reviews is empty, no manuscript is currently waiting there. Check for load errors or review history.",
    "document.view",
  ),
  help(
    "ad-07",
    reviews,
    "How do I review a manuscript?",
    r.reviews,
    [
      "review a manuscript",
      "review the manuscript",
      "review manuscript",
      "review a submission",
      "review a draft",
      "review a paper",
      "manuscript review",
      "manuscript reviews",
      "review manuscripts",
      "check a submitted draft",
      "mag review manuscript",
    ],
    "In Reviews, choose Review manuscript or Continue review on an active assignment. Check the submitted version beside your feedback, then choose a recommendation. Submit permanent decision only when you’re ready.",
    "If you have no active assignment, check Review history for past work. The Guide never submits a review.",
    "document.view",
  ),
  help(
    "ad-08",
    reviews,
    "What do the review choices mean?",
    r.reviews,
    [
      "review choices",
      "major revision",
      "minor revision",
      "approve version",
      "reject version",
      "review recommendation",
      "review decisions",
    ],
    "Approve version accepts the assigned snapshot. Request minor or major revision when changes are needed, or Reject version when the snapshot should not be accepted. Revision and rejection need actionable feedback. The decision applies to that version.",
    "The choices are available only for an active, actionable assignment. For academic policy on which to choose, ask your coordinator.",
    "document.view",
  ),
  help(
    "ad-09",
    reviews,
    "Where are previous versions?",
    r.groups,
    [
      "previous versions",
      "version history",
      "older versions",
      "past versions",
      "previous version",
    ],
    "Open the assigned group from My Advisees, then open Documents and expand a document’s Version history. Compare the version number with the exact assignment in Reviews. Feedback belongs to the version on which it was recorded.",
    "A version may be absent or restricted. Use only preview or download controls that are available for that version.",
    "document.view",
  ),
  help(
    "ad-10",
    reviews,
    "Why can’t I review this version?",
    r.reviews,
    [
      "cant review",
      "cannot review",
      "review this version",
      "review unavailable",
      "assignment revoked",
      "review status",
      "superseded assignment",
    ],
    "Check Pending reviews and Review history for the assignment and its version. Active assignments can be reviewed; completed decisions are recorded. Revoked, reassigned or superseded assignments no longer let you submit a decision.",
    "If the version is missing or restricted, check the visible error or ask your coordinator to verify the assignment. Guide cannot infer your status.",
    "document.view",
  ),
  help(
    "ad-11",
    progress,
    "How is my group progressing?",
    r.groups,
    [
      "group progress",
      "group progressing",
      "pending tasks",
      "research milestones",
      "track progress",
    ],
    "Open the group under My Advisees, then check Milestones for stage and requirement statuses and Activity for recorded changes. Pending work is not necessarily overdue.",
    "If no milestones are shown, check whether a workflow has been assigned to the group.",
    "research.view",
  ),
  help(
    "ad-20",
    progress,
    "How do I compare my groups’ progress?",
    r.progress,
    ["group progress", "compare progress", "pending requirements"],
    "Open Progress, choose an assigned group, and check its requirement statuses. Open workspace for the group’s detailed milestones and history. A pending requirement may still need submission or review.",
    "If there are no assigned groups, check My Advisees and pending requests.",
    "research.view",
  ),
  help(
    "ad-12",
    progress,
    "How do I approve a milestone?",
    r.milestones,
    [
      "approve a milestone",
      "approve milestone",
      "milestone approval",
      "milestone approvals",
    ],
    "Overview → Needs your attention → View all opens Milestone Approval & Recommendation. This version of the workspace does not load actionable approvals there. Check Milestones in the group workspace for progress.",
    "Ask your coordinator to verify which approval action is available for this milestone.",
    "research.view",
  ),
  help(
    "ad-13",
    progress,
    "How do I schedule a consultation?",
    r.consultations,
    [
      "schedule a consultation",
      "schedule consultation",
      "schedule a meeting",
      "set a meeting",
      "book a consultation",
      "plan a consultation",
      "mag schedule consultation",
    ],
    "Open Consultations → Schedule consultation. Choose the advisee group, enter a topic, and pick a date and time. Review the meeting details before scheduling.",
    "If no eligible group is listed, check My Advisees. The Guide opens the form without scheduling anything.",
    "research.view",
  ),
  help(
    "ad-14",
    progress,
    "Where are consultation requests and notes?",
    r.consultations,
    [
      "consultation requests",
      "consultation notes",
      "consultation history",
      "meeting notes",
      "pending consultation",
    ],
    "Check Consultation Schedule for pending and confirmed sessions. Consultation History and a group’s Consultations tab show recorded notes or action items where available.",
    "A session may have no saved notes, action items or transcript. Check what the actual record contains.",
    "research.view",
  ),
  help(
    "ad-15",
    progress,
    "How do I start a video consultation?",
    r.consultations,
    [
      "video consultation",
      "join a meeting",
      "join meeting",
      "google meet",
      "start a video call",
      "meeting link",
    ],
    "Open Consultations and find the scheduled session. Use its meeting action if a link is available. You can also check the session in the group’s Consultations tab.",
    "If no meeting action is shown, check whether the session has a link and whether your meeting integration is available.",
    "research.view",
  ),
  help(
    "ad-16",
    reviews,
    "Where are finalized documents?",
    r.official,
    [
      "official copies",
      "finalized documents",
      "final documents",
      "signed documents",
      "final copy",
    ],
    "Open Official Copies and select the research project. Use the available view or download controls for published records. Pending manuscript assignments are separate and live in Reviews.",
    "If the list is empty, there may be no published copy available to your current role and college.",
    "document.view",
  ),
  help(
    "ad-17",
    account,
    "How do I message an advisee?",
    r.messages,
    ["message an advisee", "message my group", "group messages", "group chat"],
    "Use Messages for your group conversations. Use Inbox for formal Advisio correspondence with faculty and other permitted recipients.",
    "If no group conversation is available, check that you’re assigned to the group in the current college.",
  ),
  help(
    "ad-17-inbox",
    account,
    "Where is my faculty Inbox?",
    r.inbox,
    [
      "faculty inbox",
      "inbox",
      "faculty correspondence",
      "direct correspondence",
    ],
    "Open Inbox for direct Advisio correspondence. Group conversations with your advisees are under Messages.",
    "Check Inbox for available conversations and recipients in your current role and college.",
  ),
  help(
    "ad-18",
    account,
    "How do I change the theme or college?",
    r.settings,
    [
      "change the theme",
      "change theme",
      "dark mode",
      "light mode",
      "switch college",
      "change college",
      "color theme",
    ],
    "Use Dark Mode in the profile menu to switch display mode, or Settings → Appearance for color theme. Switch college separately using the profile menu if more than one approved college is available.",
    "Changing display appearance does not change the college or which records you can access.",
  ),
  help(
    "ad-19",
    account,
    "How do I find my settings?",
    r.settings,
    ["settings", "preferences", "profile", "account", "appearance", "security"],
    "Settings is directly below Guide in the sidebar. Open it for account details, notification preferences, appearance and security. Guide remains available while you explore these areas.",
    "Read each settings area before making changes. The walkthrough only shows the navigation; it does not edit your account or preferences.",
  ),
] satisfies AdviserTopic[];
