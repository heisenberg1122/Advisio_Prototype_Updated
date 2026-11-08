import {
  RESEARCHER_HELP,
  normalizeHelpSearch,
  type ResearcherHelpId,
} from "./researcher-help";

import {
  ADVISER_HELP,
  adviserPopular,
  type AdviserHelpId,
} from "./adviser-help";

import { PANELIST_HELP, panelistPopular, type PanelistHelpId } from "./panelist-help";
import { DEAN_HELP, deanPopular, type DeanHelpId } from "./dean-help";

import { facultyHelp, facultyPopular, type FacultyHelpId, type FacultyHelpWorkspace } from "./faculty-help";

export const assistantWorkspaces = ["researcher", "adviser", "panelist", "coordinator", "dean", "system-admin"] as const;
export type AssistantWorkspace = (typeof assistantWorkspaces)[number];
export const isFacultyHelpWorkspace = (workspace: AssistantWorkspace): workspace is FacultyHelpWorkspace =>
  workspace === "coordinator" || workspace === "system-admin";
export const assistantWorkspaceLabels: Record<AssistantWorkspace, string> = {
  researcher: "Researcher",
  adviser: "Faculty Adviser",
  panelist: "Defense Panelist",
  coordinator: "Professor Coordinator",
  dean: "College Dean",
  "system-admin": "System Administration",
};
export const ASSISTANT_HELP_VERSION = "workspace-assistant-3";
export type AssistantTopicId =
  | ResearcherHelpId
  | AdviserHelpId
  | PanelistHelpId
  | DeanHelpId
  | FacultyHelpId
  | "tasks"
  | "history";
export type AssistantActionKind = "navigate" | "show" | "guide";
export interface AssistantTopic {
  id: AssistantTopicId;
  question: string;
  answer: string;
  href: string;
  guide: ResearcherHelpId | AdviserHelpId | PanelistHelpId | DeanHelpId | FacultyHelpId;
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
const adviserAssistantTopics: AssistantTopic[] = ADVISER_HELP.map((topic) => ({
  id: topic.id,
  guide: topic.walkthrough,
  question: topic.question,
  answer: topic.answer.join("\n\n"),
  href: topic.href,
  permission: topic.permission,
  requirements: topic.requirements,
  phrases: topic.keywords,
}));
const panelistAssistantTopics: AssistantTopic[] = PANELIST_HELP.map((topic) => ({
  id: topic.id,
  guide: topic.walkthrough,
  question: topic.question,
  answer: topic.answer.join("\n\n"),
  href: topic.href,
  requirements: topic.requirements,
  phrases: topic.keywords.map(normalizeAssistantQuestion),
}));
const deanAssistantTopics: AssistantTopic[] = DEAN_HELP.map((topic) => ({
  id: topic.id,
  guide: topic.walkthrough,
  question: topic.question,
  answer: topic.answer.join("\n\n"),
  href: topic.href,
  permission: topic.permission,
  requirements: topic.requirements,
  phrases: topic.keywords.map(normalizeAssistantQuestion),
}));
const facultyAssistantTopics = Object.fromEntries(
  Object.entries(facultyHelp).map(([workspace, topics]) => [workspace, topics.map((topic): AssistantTopic => ({
    id: topic.id,
    guide: topic.id,
    question: topic.question,
    answer: topic.answer.join("\n\n"),
    href: topic.href,
    permission: topic.permission,
    requirements: topic.requirements,
    phrases: topic.keywords.map(normalizeAssistantQuestion),
  }))]),
) as Record<FacultyHelpWorkspace, AssistantTopic[]>;

export const assistantPopular: Record<AssistantWorkspace, readonly AssistantTopicId[]> = {
  researcher: ["class", "group", "submit", "theme"],
  adviser: adviserPopular,
  panelist: panelistPopular,
  ...facultyPopular,
  dean: deanPopular,
};

const topicsFor = (workspace: AssistantWorkspace) => isFacultyHelpWorkspace(workspace)
  ? facultyAssistantTopics[workspace]
  : ({
  adviser: adviserAssistantTopics,
  panelist: panelistAssistantTopics,
  dean: deanAssistantTopics,
  researcher: ASSISTANT_TOPICS,
})[workspace];
export const assistantTopic = (
  id: string,
  workspace: AssistantWorkspace = "researcher",
) => topicsFor(workspace).find((topic) => topic.id === id);
export const authorizedAssistantTopics = (
  permissions: readonly string[],
  workspace: AssistantWorkspace = "researcher",
) =>
  topicsFor(workspace).filter(
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
  workspace: AssistantWorkspace = "researcher",
): AssistantResolution {
  const available = authorizedAssistantTopics(permissions, workspace);
  const normalized = normalizeAssistantQuestion(question);
  if (workspace !== "researcher") {
    const popular = assistantPopular[workspace];
    const previous = available.find((topic) => topic.id === previousTopic);
    if (/^(yes|show me|take me there)$/.test(normalized) && previous)
      return { kind: "local", topic: previous };
    if (
      workspace === "dean" &&
      /\bevaluations?\b/.test(normalized) &&
      !/\b(panelist|panel assignments?|manuscript|defenses?|released|results?|rubric)\b/.test(normalized)
    ) {
      return {
        kind: "clarification",
        text: "Do you mean manuscript reviews, defense oversight and released results, or your own Panelist evaluation?",
        topicIds: available
          .filter(({ id }) => ["dean-reviews", "dean-defenses", "dean-panel-evaluation"].includes(id))
          .map(({ id }) => id),
      };
    }
    if (
      ({
        adviser: /^(help|help me|group|review|consultation|request|show me|yes)$/,
        panelist: /^(help|help me|review|evaluation|defense|results|show me|yes)$/,
        dean: /^(help|help me|show me|yes)$/,
        coordinator: /^(help|help me|show me|yes)$/,
        "system-admin": /^(help|help me|show me|yes)$/,
      })[workspace].test(normalized)
    ) {
      return {
        kind: "clarification",
        text: {
          adviser: "What are you trying to do: find an advisee, review a manuscript, respond to a request, or plan a consultation?",
          panelist: "Are you looking for an invitation, reviewing a defense packet, completing an evaluation, or checking results?",
          dean: "Would you like to find research groups, check progress, review defense schedules, or open a report?",
          coordinator: "Which coordination task do you need help with?",
          "system-admin": "Which administrative task do you need help with?",
        }[workspace],
        topicIds: available
          .filter((topic) => popular.includes(topic.id))
          .map((topic) => topic.id),
      };
    }
    const ranked = rankAssistantTopics(question, available);
    const first = ranked[0],
      second = ranked[1];
    const complex =
      /\b(compare|difference|because|even though|not working|kahit|ayaw|versus|vs)\b/.test(
        normalized,
      ) || normalized.split(" ").length > 18;
    if (
      first &&
      (first.score === 100 ||
        (!complex && (!second || first.score >= second.score + 6)))
    )
      return { kind: "local", topic: first.topic };
    return {
      kind: "ai",
      relevant: ranked.slice(0, 4).map((item) => item.topic),
    };
  }
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
  if (
    strongest?.topic.id === "history" &&
    /\bsubmission history\b/.test(normalized) &&
    /\bdrafts?\b/.test(normalized) &&
    /\b(different|difference|compare|versus|vs)\b/.test(normalized)
  ) {
    return { kind: "local", topic: strongest.topic };
  }
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
export type AssistantAIProvider = "openai" | "groq";

export interface AssistantReply {
  text: string;
  source: "local" | "ai" | "fallback" | "clarification";
  topicIds: AssistantTopicId[];
  needsConsent?: boolean;
  consentProvider?: AssistantAIProvider;
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
  workspace?: AssistantWorkspace;
  message: string;
  page?: AssistantTopicId;
  previousTopic?: AssistantTopicId;
  history?: AssistantTurn[];
  allowAI: boolean;
  aiProvider?: AssistantAIProvider;
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
  workspace: AssistantWorkspace = "researcher",
) {
  const [topicId, kind, extra] = id.split(":");
  if (extra || !["navigate", "show", "guide"].includes(kind)) return null;
  const topic = authorizedAssistantTopics(permissions, workspace).find(
    (topic) => topic.id === topicId,
  );
  return topic ? { topic, kind: kind as AssistantActionKind } : null;
}
