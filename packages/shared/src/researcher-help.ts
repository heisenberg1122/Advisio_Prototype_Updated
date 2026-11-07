export type ResearcherHelpId =
  | "project"
  | "class"
  | "group"
  | "join-group"
  | "documents"
  | "submit"
  | "progress"
  | "grades"
  | "defense"
  | "adviser"
  | "theme"
  | "communication"
  | "settings";
export type ResearcherHelpCategory =
  | "Getting started"
  | "Research work"
  | "Academic activities"
  | "Account and navigation";
export interface ResearcherHelpTopic {
  id: ResearcherHelpId;
  question: string;
  category: ResearcherHelpCategory;
  section: string;
  keywords: string[];
  answer: string[];
  href: string;
  requirements: string;
  walkthrough: ResearcherHelpId;
  fallback: string;
}

export const RESEARCHER_HELP: ResearcherHelpTopic[] = [
  {
    id: "project",
    question: "Where are my project details?",
    category: "Getting started",
    section: "Projects and groups",
    keywords: [
      "project details",
      "project overview",
      "my project",
      "research title",
    ],
    answer: [
      "Open Project Overview under Research Workspace to check your project title, workflow, adviser and next action.",
      "Check the selected project if you have more than one. If no project is available, use the existing create/join options when appropriate, or ask your professor about the required next step.",
    ],
    href: "/student/dashboard?tab=group",
    requirements:
      "An authorized selected project is needed to show its records.",
    walkthrough: "project",
    fallback:
      "Choose the project you need or check the empty-state options. The Guide does not create a project for you.",
  },
  {
    id: "class",
    question: "How do I join a class?",
    category: "Getting started",
    section: "Classes and workflows",
    keywords: [
      "join class",
      "enroll in class",
      "enrol",
      "professor workflow",
      "prof",
      "course invitation",
      "join course",
      "class code",
      "classroom",
      "enrollment",
      "invite",
      "requirements",
    ],
    answer: [
      "Your professor’s class uses a research workflow in Advisio. Open Tasks & Requirements to see a joined workflow, pending access, or an invitation.",
      "If you have no workflow yet, use the invitation link or code your professor gives you. Reviewing a code does not join the class: a request needs the professor’s approval. An Inbox invitation has its own accept or decline choice.",
    ],
    href: "/student/tasks",
    requirements:
      "An active enrollment is needed for class requirements. A professor supplies access or an invitation code.",
    walkthrough: "class",
    fallback:
      "Ask your professor for the correct invitation or to check your access. This guide cannot enroll you.",
  },
  {
    id: "group",
    question: "Where can I see my group?",
    category: "Getting started",
    section: "Projects and groups",
    keywords: [
      "my group",
      "find teammates",
      "see members",
      "group leader",
      "team",
      "who is in my group",
      "adviser details",
      "project context",
    ],
    answer: [
      "Looking for your teammates? Open Research Workspace, then Group & Members. You’ll find the group details and members for the selected project.",
      "The member labels show who leads the group. Leadership and adviser controls appear only when your account can use them. If you have several projects, check which project is selected first.",
    ],
    href: "/student/dashboard?tab=group&section=my-group",
    requirements:
      "An authorized project or group workspace is needed to show real members.",
    walkthrough: "group",
    fallback:
      "No group yet? Ask your leader for a research-group code. Joining that group is separate from joining your professor’s class.",
  },
  {
    id: "join-group",
    question: "How do I join a research group?",
    category: "Getting started",
    section: "Projects and groups",
    keywords: [
      "join research group",
      "group code",
      "team invitation",
      "research group invitation",
      "join team",
      "group approval",
    ],
    answer: [
      "Have a group invitation code? Use the code from your group leader to review the right group before deciding to join.",
      "Review group only looks up the code. The preview tells you whether the group is open, private, or needs leader approval. Request to join sends an approval request; it does not mean you are already a member. The guide stops before that action.",
    ],
    href: "/student/join-group",
    requirements:
      "A real code from the group leader is required to preview a group.",
    walkthrough: "join-group",
    fallback:
      "If you do not have a code, ask the group leader. The guide will not invent one or send a join request.",
  },
  {
    id: "documents",
    question: "How do I manage my documents?",
    category: "Research work",
    section: "Documents and group files",
    keywords: [
      "manuscript",
      "research files",
      "open document",
      "feedback",
      "comments",
      "versions",
      "submission history",
      "working draft",
      "group files",
      "upload",
      "saved files",
    ],
    answer: [
      "Looking for your manuscript? Document workspace keeps your working files together. Open an actual file to inspect its preview, feedback, and version history.",
      "A working document is not the same as a submitted requirement. Submission history currently lists uploaded document versions and their statuses; confirm an academic submission in the task itself. Group Files holds shared attachments. When your document is ready, return to its task to check submission options.",
    ],
    href: "/student/documents",
    requirements:
      "A selected project is needed for project files. Upload/create controls depend on the document permissions returned by the app.",
    walkthrough: "documents",
    fallback:
      "If the list is empty, use an available upload/create action after the guide, or check the selected project and task instructions. No sample document is created for this tour.",
  },
  {
    id: "submit",
    question: "How do I submit my work?",
    category: "Research work",
    section: "Tasks and submissions",
    keywords: [
      "submit",
      "submission",
      "send requirement",
      "upload requirement",
      "turn in",
      "assignment",
      "due date",
      "locked task",
      "revisions",
      "submt",
    ],
    answer: [
      "Ready to send a requirement? Start in Tasks & Requirements, open the task you need, and read its instructions, status, and deadline.",
      "Available methods may let you choose an eligible document version or upload a compatible file. Read any locked or unavailable message first. Review the exact selection before confirming; this walkthrough will not upload a file or submit for you.",
    ],
    href: "/student/tasks",
    requirements:
      "Submission depends on the active workflow/project, task availability, supported format and applicable leadership/adviser conditions.",
    walkthrough: "submit",
    fallback:
      "If a task is locked, read its displayed condition and ask your professor or adviser when it is unclear.",
  },
  {
    id: "progress",
    question: "How do I view my research progress?",
    category: "Research work",
    section: "Research milestones",
    keywords: [
      "timeline",
      "milestones",
      "progress",
      "next stage",
      "complete",
      "pending",
      "locked",
      "deadline",
      "schedule",
      "what next",
    ],
    answer: [
      "Want to see what comes next? Timeline brings together your planned research schedule and recorded project activity.",
      "Milestone details show the professor’s sequence and current states. The planned Gantt schedule is not proof that a requirement was completed. Open Tasks to read the next requirement and its actual availability message.",
    ],
    href: "/student/dashboard?tab=milestones",
    requirements:
      "A selected project with available workflow/milestone data is needed for project progress.",
    walkthrough: "progress",
    fallback:
      "If no milestones appear, check your selected project and class access, then ask your professor about the workflow requirements.",
  },
  {
    id: "grades",
    question: "Where can I see my grades?",
    category: "Academic activities",
    section: "Grades",
    keywords: [
      "grades",
      "scores",
      "results",
      "attendance",
      "class record",
      "defense grade",
      "marks",
      "unreleased",
    ],
    answer: [
      "Your available results are under Academic Activities → My Grades. Class Grades and Defense Grades are separate views.",
      "Choose the appropriate class or project context. A missing or unreleased result does not mean a zero grade; it may not have been released or assigned yet. You can only view the records available to your account.",
    ],
    href: "/student/grades",
    requirements:
      "A class record or project defense result must exist and be available to the authenticated researcher.",
    walkthrough: "grades",
    fallback:
      "If the expected result is unavailable, confirm the class/project and ask the professor about release status.",
  },
  {
    id: "defense",
    question: "How do I check my defense schedule?",
    category: "Academic activities",
    section: "Defense",
    keywords: [
      "defense",
      "defence",
      "presentation",
      "panel",
      "meeting link",
      "defense date",
      "defense schedule",
      "venue",
    ],
    answer: [
      "Open Academic Activities → Defense to check the defense information assigned to your selected project.",
      "Read the actual session status and any displayed date, venue, or meeting details. If there is no scheduled defense, check with your professor or coordinator; the guide does not create a schedule or a meeting link.",
    ],
    href: "/student/defense",
    requirements:
      "A selected authorized project is needed for its defense information.",
    walkthrough: "defense",
    fallback:
      "No session yet? Your professor or coordinator handles scheduling. Only use details actually shown for your project.",
  },
  {
    id: "adviser",
    question: "How do I contact my adviser?",
    category: "Academic activities",
    section: "Consultations and calendar",
    keywords: [
      "contact adviser",
      "advisor",
      "meet adviser",
      "consultation",
      "book meeting",
      "appointment",
      "talk to adviser",
      "calendar",
    ],
    answer: [
      "First check the adviser shown on Project Overview. Consultations is for meeting requests and session details; group messages are for ongoing coordination.",
      "Use Calendar to check assigned dates. Inbox carries separate messages and invitations. Booking or joining a meeting and sending a message are your own actions; the guide never does them for you.",
    ],
    href: "/student/dashboard?tab=consultations",
    requirements:
      "An assigned adviser is needed for an adviser-specific consultation or conversation.",
    walkthrough: "adviser",
    fallback:
      "If no adviser is assigned, ask your professor/coordinator about the assignment. Group leaders manage adviser requests where the app makes those controls available.",
  },
  {
    id: "theme",
    question: "How do I change the theme?",
    category: "Account and navigation",
    section: "Appearance and settings",
    keywords: [
      "dark mode",
      "light mode",
      "darkmode",
      "appearance",
      "switch color",
      "change theme",
      "night mode",
      "display",
    ],
    answer: [
      "Want a different appearance? Open your profile menu in the topbar, then use the existing Dark Mode control. It is available there on mobile too.",
      "You can switch back whenever you like. Light/dark mode changes the display; it does not change your authorized college, program, or role. Clicking the control saves your appearance preference.",
    ],
    href: "/student/settings",
    requirements:
      "Only the existing appearance control is used. College membership and branding are not changed.",
    walkthrough: "theme",
    fallback:
      "Open your profile menu to find Dark Mode. Appearance settings are also available through Settings.",
  },
  {
    id: "communication",
    question: "How do I find messages and notifications?",
    category: "Account and navigation",
    section: "Messages and notifications",
    keywords: [
      "messages",
      "notification",
      "alerts",
      "inbox",
      "conversation",
      "chat",
      "invitation",
      "updates",
    ],
    answer: [
      "Communication brings together group Messages, Inbox, and the Notifications page. The bell in the topbar gives you a quick look at available alerts.",
      "Choose a conversation or notification yourself when you are ready to open it. Reading an individual notification may mark it read. This guide only shows you where these controls are; it never sends a message or marks an item read.",
    ],
    href: "/student/dashboard?tab=group-chats",
    requirements:
      "Existing conversations and alerts depend on the account/project. No recipient or thread is invented.",
    walkthrough: "communication",
    fallback:
      "An empty list means there is nothing available in that view yet. Check the selected project or ask the sender to confirm the invitation.",
  },
  {
    id: "settings",
    question: "How do I find my settings?",
    category: "Account and navigation",
    section: "Appearance and settings",
    keywords: [
      "settings",
      "preferences",
      "account",
      "profile",
      "password",
      "security",
      "notification preferences",
    ],
    answer: [
      "Settings is directly below Guide in the sidebar. Open it for the account, notification, appearance, and security areas available to your account.",
      "Read an area before making changes. The guide will show you the settings navigation without editing personal information, preferences, or passwords.",
    ],
    href: "/student/settings",
    requirements: "Only the researcher's own settings navigation is shown.",
    walkthrough: "settings",
    fallback:
      "On mobile, open the navigation menu first. Guide and Settings stay together at the bottom.",
  },
];

const stopWords = new Set([
  "how",
  "do",
  "i",
  "can",
  "my",
  "the",
  "a",
  "an",
  "to",
  "where",
  "is",
  "are",
  "with",
  "what",
  "of",
  "in",
  "me",
  "please",
]);
export const normalizeHelpSearch = (value: string) =>
  value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
function nearWord(a: string, b: string) {
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1)
    return false;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = current;
  }
  return previous[b.length] <= 1;
}
export function searchResearcherHelp(query: string): ResearcherHelpTopic[] {
  const normalized = normalizeHelpSearch(query);
  const tokens = normalized
    .split(" ")
    .filter((token) => token && !stopWords.has(token));
  if (!tokens.length) return [];
  return RESEARCHER_HELP.map((topic) => {
    const title = normalizeHelpSearch(topic.question);
    const aliases = topic.keywords.map(normalizeHelpSearch);
    const words = (title + " " + aliases.join(" ")).split(" ");
    let score = title.includes(normalized) ? 30 : 0;
    if (aliases.some((alias) => alias === normalized)) score += 35;
    for (const token of tokens) {
      if (title.split(" ").some((word) => word.startsWith(token))) score += 8;
      else if (
        words.some(
          (word) =>
            word.startsWith(token) ||
            (token.startsWith(word) && word.length > 3),
        )
      )
        score += 5;
      else if (words.some((word) => nearWord(word, token))) score += 2;
    }
    if (
      !tokens.every((token) =>
        words.some(
          (word) =>
            word.startsWith(token) ||
            (token.startsWith(word) && word.length > 3) ||
            nearWord(word, token),
        ),
      )
    )
      score *= 0.25;
    return { topic, score };
  })
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.topic);
}
