import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { facultyStateNotice } from "@/lib/faculty-walkthroughs";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  ChevronDown,
  Compass,
  Search,
  X,
} from "lucide-react";
import {
  RESEARCHER_HELP,
  researcherStateNotice,
  searchResearcherHelp,
  type ResearcherGuideState,
  type ResearcherHelpId,
} from "@/lib/researcher-guide";
import {
  ADVISER_HELP,
  adviserCategories,
  type AdviserHelpId,
} from "@research-management/shared/src/adviser-help";
import {
  assistantPopular,
  assistantWorkspaceLabels,
  authorizedAssistantTopics,
  isFacultyHelpWorkspace,
  normalizeAssistantQuestion,
  type AssistantWorkspace,
} from "@research-management/shared/src/researcher-assistant";
import { PANELIST_HELP, panelistCategories, type PanelistHelpId } from "@research-management/shared/src/panelist-help";
import { currentPanelistEvaluationNotice } from "@/lib/panelist-walkthroughs";
import { searchHelpTopics } from "@research-management/shared/src/researcher-help";
import { facultyHelp, type FacultyHelpId } from "@research-management/shared/src/faculty-help";
import "./researcher-guide.css";

export type GuideHelpId = ResearcherHelpId | AdviserHelpId | PanelistHelpId | FacultyHelpId;

const categories = [
  "Getting started",
  "Research work",
  "Academic activities",
  "Account and navigation",
] as const;
const contextual: Record<
  ResearcherHelpId,
  { title: string; description: string }
> = {
  project: {
    title: "Checking your project details?",
    description:
      "Find the selected project's title, workflow, adviser and next action.",
  },
  class: {
    title: "Finding your class?",
    description:
      "Check workflow access and find the requirements your professor has made available.",
  },
  group: {
    title: "Looking for your teammates?",
    description:
      "Find your selected group, its members, and the roles shown on the page.",
  },
  "join-group": {
    title: "Have a group code?",
    description:
      "See how to review the right group before deciding to join or request approval.",
  },
  documents: {
    title: "Working with documents?",
    description:
      "See where to open files, check feedback, and find past versions and shared attachments.",
  },
  submit: {
    title: "Working on a requirement?",
    description:
      "Find the instructions, actual task status, and available submission method.",
  },
  progress: {
    title: "Checking what comes next?",
    description:
      "Distinguish the planned schedule from actual milestone progress and recorded activity.",
  },
  grades: {
    title: "Looking for your results?",
    description:
      "See how Class Grades and Defense Grades differ and where availability is shown.",
  },
  defense: {
    title: "Checking a defense?",
    description:
      "Find the existing schedule or readiness information for the selected project.",
  },
  adviser: {
    title: "Planning to meet your adviser?",
    description:
      "Check the assignment and understand consultations, dates, and communication choices.",
  },
  theme: {
    title: "Changing the appearance?",
    description:
      "Find the existing light/dark control without changing your college or program.",
  },
  communication: {
    title: "Finding an update?",
    description:
      "Tell group messages, Inbox conversations, and application notifications apart.",
  },
  settings: {
    title: "Looking for a preference?",
    description:
      "Find the relevant settings area without making any account changes.",
  },
};
interface Props {
  workspace: AssistantWorkspace;
  permissions: readonly string[];
  page: GuideHelpId | undefined;
  selected: GuideHelpId | null;
  query: string;
  state: ResearcherGuideState;
  loading: boolean;
  introductionCompleted: boolean;
  notice: string;
  onQuery: (value: string) => void;
  onSelect: (id: GuideHelpId) => void;
  onBack: () => void;
  onClose: () => void;
  onStart: (id: GuideHelpId | "introduction") => void;
  orientation?: {
    status: "new" | "paused" | "completed";
    begin: (resume?: boolean) => void;
  };
}
export function GuideDrawer({
  workspace,
  permissions,
  page,
  selected,
  query,
  state,
  loading,
  introductionCompleted,
  notice,
  onQuery,
  onSelect,
  onBack,
  onClose,
  onStart,
  orientation,
}: Props) {
  const location = useLocation();
  const startButton = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const adviser = workspace === "adviser";
  const panelist = workspace === "panelist";
  const researcher = workspace === "researcher";
  const allowed = authorizedAssistantTopics(permissions, workspace);
  const topics = researcher
    ? RESEARCHER_HELP
    : (isFacultyHelpWorkspace(workspace) ? facultyHelp[workspace] : panelist ? PANELIST_HELP : ADVISER_HELP).filter((item) =>
        allowed.some((topic) => topic.id === item.id),
      );
  const popular = assistantPopular[workspace].flatMap((id) => topics.filter((item) => item.id === id));
  const sections = isFacultyHelpWorkspace(workspace)
    ? [...new Set(topics.map((item) => item.category))]
    : panelist ? panelistCategories : adviser ? adviserCategories : categories;
  const label = assistantWorkspaceLabels[workspace];
  const topic = topics.find((item) => item.id === selected);
  const contextTopic = topics.find((item) => item.id === page);
  const current = !researcher
    ? contextTopic && {
        title: contextTopic.question,
        description: contextTopic.answer[0],
      }
    : contextual[page as ResearcherHelpId];
  const results = !query.trim()
    ? []
    : researcher
      ? searchResearcherHelp(query)
      : searchHelpTopics<(typeof topics)[number]>(normalizeAssistantQuestion(query), topics);
  useEffect(() => {
    (selected ? heading.current : startButton.current ?? search.current)?.focus({
      preventScroll: true,
    });
  }, [selected]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  }, [onClose]);
  const question = (id: GuideHelpId, inSearch = false) => {
    const item = topics.find((topic) => topic.id === id);
    if (!item) return null;
    return (
      <button
        type="button"
        key={id}
        className="researcher-guide__question"
        onClick={() => onSelect(id)}
      >
        <span>
          {item.question}
          {inSearch && <small>{item.section}</small>}
        </span>
        <ArrowRight size={15} aria-hidden="true" />
      </button>
    );
  };
  const stateMessage =
    topic && researcher
      ? researcherStateNotice(topic.id as ResearcherHelpId, state)
      : selected === "pn-14"
        ? currentPanelistEvaluationNotice()
        : topic && isFacultyHelpWorkspace(workspace)
          ? facultyStateNotice(workspace, topic.id, location.pathname + location.search, permissions)
          : null;
  const intro = (
    <section className="researcher-guide__intro">
      <button
        ref={topics.length ? startButton : undefined}
        type="button"
        className="researcher-guide__primary"
        onClick={() => orientation
          ? orientation.begin(orientation.status === "paused")
          : onStart("introduction")}
        disabled={!topics.length}
      >
        <Compass size={18} aria-hidden="true" />
        {orientation?.status === "paused"
          ? "Resume guided tour"
          : (orientation ? orientation.status === "completed" : introductionCompleted)
            ? "Replay guided tour"
            : "Start guided tour"}
        <ArrowRight size={14} aria-hidden="true" />
      </button>
      {orientation?.status === "paused" && (
        <button
          type="button"
          className="workspace-orientation-restart"
          onClick={() => orientation.begin()}
        >
          Restart guided tour
        </button>
      )}
    </section>
  );
  return createPortal(
    <aside
      className="researcher-guide"
      role="dialog"
      aria-modal="false"
      aria-labelledby="researcher-guide-title"
      data-researcher-guide-drawer="true"
    >
      <header className="researcher-guide__header">
        <span className="researcher-guide__brand">
          <BookOpenText size={22} aria-hidden="true" />
        </span>
        <div>
          <h2 id="researcher-guide-title">Guide</h2>
          <p>
            {label} Workspace
          </p>
        </div>
        <button
          type="button"
          className="researcher-guide__close"
          aria-label="Close Guide"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </header>
      <div className="researcher-guide__body">
        {notice && (
          <p role="status" className="researcher-guide__state">
            {notice}
          </p>
        )}
        {topic ? (
          <>
            <button
              type="button"
              className="researcher-guide__back"
              onClick={onBack}
            >
              <ArrowLeft size={15} />
              All questions
            </button>
            <p className="researcher-guide__eyebrow">{topic.section}</p>
            <h3
              ref={heading}
              tabIndex={-1}
              className="researcher-guide__topic-title"
            >
              {topic.question}
            </h3>
            {topic.answer.map((paragraph) => (
              <p key={paragraph} className="researcher-guide__answer">
                {paragraph}
              </p>
            ))}
            {stateMessage && (
              <p role="status" className="researcher-guide__state">
                {stateMessage}
              </p>
            )}
            <button
              type="button"
              className="researcher-guide__primary researcher-guide__show"
              onClick={() => onStart(topic.walkthrough)}
            >
              <Compass size={17} />
              Show me
              <ArrowRight size={16} />
            </button>
            {loading && (
              <p role="status" className="researcher-guide__subtle">
                Checking the available workspace information…
              </p>
            )}
            <p className="researcher-guide__fallback">{topic.fallback}</p>
            <div className="researcher-guide__related">
              <h4>Related questions</h4>
              {topics
                .filter(
                  (item) =>
                    item.section === topic.section && item.id !== topic.id,
                )
                .map((item) => question(item.id))}
              {topic.id === "documents" && question("submit")}
              {topic.id === "class" && question("join-group")}
            </div>
          </>
        ) : (
          <>
            {intro}
            <label className="researcher-guide__search">
              <Search size={17} aria-hidden="true" />
              <input
                ref={search}
                type="search"
                aria-label="Search help topics"
                placeholder={
                  panelist
                    ? "Try ‘Where is my defense invitation?’"
                    : adviser
                    ? "Try ‘How do I review a manuscript?’"
                    : researcher ? "Try ‘How do I join a class?’" : topics[0]?.question || "Search help topics"
                }
                value={query}
                onChange={(event) => onQuery(event.target.value)}
                autoComplete="off"
              />
            </label>
            {query.trim() ? (
              <section aria-label="Help search results">
                <p role="status" className="researcher-guide__subtle">
                  {results.length
                    ? `${results.length} matching question${results.length === 1 ? "" : "s"}`
                    : "No matching question yet"}
                </p>
                {results.map((item) => question(item.id, true))}
                {!results.length && (
                  <p className="researcher-guide__answer">
                    {panelist
                      ? "Try invitation, defense packet, evaluation, or results."
                      : adviser
                      ? "Try words such as advisees, review, consultation, or appearance."
                      : researcher
                        ? "Try class, group, feedback, or dark mode."
                        : "Try the name of a task or control in your workspace."}
                  </p>
                )}
              </section>
            ) : (
              <>
                <section
                  className="researcher-guide__context"
                  aria-label="Help with this page"
                >
                  <span className="researcher-guide__eyebrow">
                    Help with this page
                  </span>
                  {current && page ? (
                    <>
                      <h4>{current.title}</h4>
                      <p>{current.description}</p>
                      <button type="button" onClick={() => onStart(page)}>
                        Show me
                        <ArrowRight size={15} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <p>Search for a task or choose a question below for this workspace.</p>
                  )}
                </section>
                <section
                  className="researcher-guide__section"
                  aria-label="Popular questions"
                >
                  <h4>Popular questions</h4>
                  {popular.map((item) => question(item.id))}
                </section>
                <section
                  className="researcher-guide__section"
                  aria-label="Browse help topics"
                >
                  <h4>Browse help topics</h4>
                  {sections
                    .filter((category) =>
                      topics.some((topic) => topic.category === category),
                    )
                    .map((category) => (
                      <details
                        key={category}
                        className="researcher-guide__category"
                      >
                        <summary>
                          {category}
                          <ChevronDown size={16} />
                        </summary>
                        {[
                          ...new Set(
                            topics
                              .filter((item) => item.category === category)
                              .map((item) => item.section),
                          ),
                        ].map((section) => (
                          <div key={section}>
                            <p className="researcher-guide__eyebrow">
                              {section}
                            </p>
                            {topics
                              .filter(
                                (item) =>
                                  item.category === category &&
                                  item.section === section,
                              )
                              .map((item) => question(item.id))}
                          </div>
                        ))}
                      </details>
                    ))}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </aside>,
    document.body,
  );
}
