import {
  RESEARCHER_HELP,
  normalizeHelpSearch,
  type ResearcherHelpId,
} from "./researcher-help";

export const ASSISTANT_HELP_VERSION = "researcher-assistant-1";
export type AssistantTopicId = ResearcherHelpId | "tasks" | "history";
export type AssistantActionKind = "navigate" | "show" | "guide";
export interface AssistantTopic {
  id: AssistantTopicId;
  question: string;
  answer: string;
  href: string;
  guide: ResearcherHelpId;
  permission?: string;
  requirements?: string;
  projectRequired?: boolean;
  phrases: string[];
}
const phrases: Record<ResearcherHelpId, string[]> = {
  project: [
    "project details",
    "project overview",
    "my project",
    "research title",
  ],
  class: [
    "join class",
    "join a class",
    "join my class",
    "enroll",
    "enrol",
    "professor workflow",
    "class code",
    "class invitation",
    "workflow invitation",
  ],
  group: [
    "my group",
    "group members",
    "groups members",
    "teammates",
    "members of my group",
    "group leader",
    "see group",
    "find group",
    "find my group",
  ],
  "join-group": [
    "join group",
    "join a group",
    "join research group",
    "join a research group",
    "group code",
    "group invitation",
  ],
  documents: [
    "documents",
    "document workspace",
    "manuscript",
    "feedback",
    "version history",
    "working files",
    "group files",
    "research files",
  ],
  submit: [
    "submit",
    "submission status",
    "turn in",
    "send requirement",
    "upload requirement",
  ],
  progress: [
    "progress",
    "timeline",
    "milestones",
    "next stage",
    "what comes next",
  ],
  grades: ["grades", "grade", "scores", "class record", "attendance"],
  defense: [
    "defense schedule",
    "defense date",
    "defence",
    "defense",
    "panel schedule",
  ],
  adviser: [
    "contact adviser",
    "contact advisor",
    "talk to adviser",
    "meet adviser",
    "consultation",
    "appointment",
  ],
  theme: [
    "dark mode",
    "light mode",
    "change theme",
    "change the theme",
    "appearance",
    "night mode",
  ],
  communication: ["messages", "notifications", "inbox", "alerts", "chat"],
  settings: ["settings", "preferences", "password", "account settings"],
};
const permissions: Partial<Record<AssistantTopicId, string>> = {
  group: "research.view",
  project: "research.view",
  documents: "document.view",
  history: "document.view",
  progress: "research.view",
  defense: "research.view",
  submit: "research.submit",
  adviser: "research.view",
};
const conciseAnswers: Partial<Record<ResearcherHelpId, string>> = {
  class:
    "Your professor’s class appears as a research workflow in Tasks & Requirements. Use the invitation link or code from your professor, then check the actual access status. A join request needs professor approval, while an Inbox invitation has its own accept or decline choice.",
  group:
    "You can find your teammates under Research Workspace → Group & Members. Check the selected project if you have more than one. Want me to show you?",
  theme:
    "Open your profile menu in the topbar, then use Dark Mode to switch between light and dark. You can switch back anytime, including on mobile.",
  settings:
    "Settings is directly below Guide in the sidebar. Open it for your account, notifications, appearance and security preferences.",
};
export const ASSISTANT_TOPICS: AssistantTopic[] = [
  ...RESEARCHER_HELP.map((topic) => ({
    id: topic.id,
    question: topic.question,
    answer: conciseAnswers[topic.id] || topic.answer.join("\n\n"),
    href: topic.href,
    guide: topic.walkthrough,
    permission: permissions[topic.id],
    requirements: topic.requirements,
    projectRequired: [
      "documents",
      "group",
      "progress",
      "defense",
      "adviser",
    ].includes(topic.id),
    phrases: phrases[topic.id],
  })),
  {
    id: "tasks",
    question: "Where are my tasks and requirements?",
    answer:
      "Open Tasks & Requirements under Research Workspace. Check the selected class workflow, then open a milestone to read its instructions, availability and current status.",
    href: "/student/tasks",
    guide: "submit",
    phrases: [
      "my tasks",
      "tasks",
      "requirements",
      "assignments",
      "class requirements",
    ],
  },
  {
    id: "history",
    question: "Where is my submission history?",
    answer:
      "Submission history lists uploaded document versions and their statuses. For confirmation of an academic submission, open the actual task and read its submission record. A saved working file alone does not confirm delivery.",
    href: "/student/dashboard?tab=submissions",
    guide: "documents",
    permission: permissions.history,
    projectRequired: true,
    phrases: [
      "submission history",
      "past submissions",
      "upload history",
      "submitted work",
    ],
  },
];
export const assistantTopic = (id: string) =>
  ASSISTANT_TOPICS.find((topic) => topic.id === id);
export const authorizedAssistantTopics = (permissions: readonly string[]) =>
  ASSISTANT_TOPICS.filter(
    (topic) => !topic.permission || permissions.includes(topic.permission),
  );

export function normalizeAssistantQuestion(question: string) {
  return normalizeHelpSearch(question)
    .replace(/\b(paano|papano)\b/g, "how")
    .replace(/\b(saan|nasaan|asan)\b/g, "where")
    .replace(/\b(makikita|makita|tingnan|tignan)\b/g, "see")
    .replace(/\b(sumali|magjoin|mag join)\b/g, "join")
    .replace(/\b(klase|klas|clas)\b/g, "class")
    .replace(
      /\b(kagrupo|ka grupo|kagroup|groupmates|groop|grup)\b/g,
      "my group",
    )
    .replace(/\b(grupo)\b/g, "group")
    .replace(/\b(mga gawain|gawain)\b/g, "tasks")
    .replace(/\b(mag submit|magsubmit|magpasa|ipasa|submt)\b/g, "submit")
    .replace(/\b(baguhin|palitan|ichange|i change)\b/g, "change")
    .replace(/\b(marka|grado)\b/g, "grades")
    .replace(/\b(miyembro|members ng group)\b/g, "group members")
    .replace(/\b(ko|kong|akin|aking)\b/g, "my")
    .replace(/\b(sa|ng|ang|yung|iyong|ako|po|ba|naman)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function rankAssistantTopics(
  question: string,
  available: AssistantTopic[],
) {
  const normalized = normalizeAssistantQuestion(question);
  return available
    .map((topic) => {
      let score =
        normalized === normalizeAssistantQuestion(topic.question) ? 100 : 0;
      for (const phrase of topic.phrases) {
        if ((" " + normalized + " ").includes(" " + phrase + " "))
          score = Math.max(score, 4 + phrase.split(" ").length * 3);
      }
      return { topic, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);
}
export type AssistantResolution =
  | { kind: "local"; topic: AssistantTopic }
  | { kind: "clarification"; text: string; topicIds: AssistantTopicId[] }
  | { kind: "ai"; relevant: AssistantTopic[] };

export function resolveAssistantQuestion(
  question: string,
  permissions: readonly string[],
  previousTopic?: AssistantTopicId,
): AssistantResolution {
  const available = authorizedAssistantTopics(permissions);
  const normalized = normalizeAssistantQuestion(question);
  if (
    /^(help|help me|join|how do i join|group|workflow|yes|show me|take me there)$/.test(
      normalized,
    )
  ) {
    const previous = available.find((topic) => topic.id === previousTopic);
    if (previous && /^(yes|show me|take me there)$/.test(normalized))
      return { kind: "local", topic: previous };
    return {
      kind: "clarification",
      text: "Do you mean joining your professor’s class or finding/joining a research group?",
      topicIds: available
        .filter((topic) => ["class", "group", "join-group"].includes(topic.id))
        .map((topic) => topic.id),
    };
  }
  const ranked = rankAssistantTopics(question, available);
  const strongest = ranked[0];
  const independent = ranked.filter(
    (item) =>
      item.topic.id !== strongest?.topic.id &&
      ![
        "history:submit",
        "history:documents",
        "defense:grades",
        "submit:tasks",
      ].includes(strongest?.topic.id + ":" + item.topic.id),
  );
  const requiresReasoning =
    /\b(why|because|compare|difference|although|even though|still cant|cant join|cannot join|not working|bakit|kahit|ayaw|explain)\b/.test(
      normalized,
    ) || normalized.split(" ").length > 24;
  if (
    strongest &&
    strongest.score >= 7 &&
    !independent.length &&
    !requiresReasoning
  )
    return { kind: "local", topic: strongest.topic };
  return { kind: "ai", relevant: ranked.map((item) => item.topic).slice(0, 5) };
}
export interface AssistantReply {
  text: string;
  source: "local" | "ai" | "fallback" | "clarification";
  topicIds: AssistantTopicId[];
  needsConsent?: boolean;
  retryable?: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd?: number;
  };
}
export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}
export interface AssistantRequest {
  message: string;
  page?: AssistantTopicId;
  previousTopic?: AssistantTopicId;
  history?: AssistantTurn[];
  allowAI: boolean;
}
export function assistantActionId(
  topic: AssistantTopicId,
  kind: AssistantActionKind,
) {
  return topic + ":" + kind;
}
export function resolveAssistantAction(
  id: string,
  permissions: readonly string[],
) {
  const [topicId, kind, extra] = id.split(":");
  if (extra || !["navigate", "show", "guide"].includes(kind)) return null;
  const topic = authorizedAssistantTopics(permissions).find(
    (topic) => topic.id === topicId,
  );
  return topic ? { topic, kind: kind as AssistantActionKind } : null;
}
