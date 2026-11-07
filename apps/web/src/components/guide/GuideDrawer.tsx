import { useEffect, useRef } from "react";
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
  adviserPopular,
  type AdviserHelpId,
} from "@research-management/shared/src/adviser-help";
import {
  authorizedAssistantTopics,
  normalizeAssistantQuestion,
  type AssistantWorkspace,
} from "@research-management/shared/src/researcher-assistant";
import { searchHelpTopics } from "@research-management/shared/src/researcher-help";
import "./researcher-guide.css";

export type GuideHelpId = ResearcherHelpId | AdviserHelpId;

const categories = [
  "Getting started",
  "Research work",
  "Academic activities",
  "Account and navigation",
] as const;
const frequentlyAsked: ResearcherHelpId[] = [
  "class",
  "group",
  "submit",
  "theme",
];
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
  page: GuideHelpId;
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
}: Props) {
  const search = useRef<HTMLInputElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const adviser = workspace === "adviser";
  const adviserTopics = adviser
    ? authorizedAssistantTopics(permissions, workspace)
    : [];
  const adviserHelp = ADVISER_HELP.filter((item) =>
    adviserTopics.some((topic) => topic.id === item.id),
  );
  const topics = adviser ? adviserHelp : RESEARCHER_HELP;
  const topic = topics.find((item) => item.id === selected);
  const contextTopic = topics.find((item) => item.id === page);
  const current = adviser
    ? contextTopic && {
        title: contextTopic.question,
        description: contextTopic.answer[0],
      }
    : contextual[page as ResearcherHelpId];
  const results = !query.trim()
    ? []
    : adviser
      ? searchHelpTopics(normalizeAssistantQuestion(query), adviserHelp)
      : searchResearcherHelp(query);
  useEffect(() => {
    (selected ? heading.current : search.current)?.focus({
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
    topic && !adviser
      ? researcherStateNotice(topic.id as ResearcherHelpId, state)
      : null;
  const intro = (
    <section className="researcher-guide__intro">
      <Compass size={19} aria-hidden="true" />
      <div>
        <h4>New to Advisio?</h4>
        <p>
          Take a guided look around your {adviser ? "advising" : "research"}{" "}
          workspace.
        </p>
        <button type="button" onClick={() => onStart("introduction")}>
          {introductionCompleted ? "Replay guided tour" : "Start guided tour"}
          <ArrowRight size={14} />
        </button>
      </div>
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
            {adviser ? "Faculty Adviser Workspace" : "Researcher Workspace"}
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
            {!adviser && !query.trim() && intro}
            <h3>What do you need help with?</h3>
            <p className="researcher-guide__subtle">
              Find an answer or let me show you around.
            </p>
            <label className="researcher-guide__search">
              <Search size={17} aria-hidden="true" />
              <input
                ref={search}
                type="search"
                aria-label={
                  adviser ? "Search adviser help" : "Search researcher help"
                }
                placeholder={
                  adviser
                    ? "Try ‘How do I review a manuscript?’"
                    : "Try ‘How do I join a class?’"
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
                    {adviser
                      ? "Try words such as advisees, review, consultation, or appearance."
                      : "Try words such as class, group, feedback, or dark mode. If your question is outside these topics, ask your professor/coordinator. These are written help topics, not generated answers."}
                  </p>
                )}
              </section>
            ) : (
              <>
                {current && (
                  <section
                    className="researcher-guide__context"
                    aria-label="Help with this page"
                  >
                    <span className="researcher-guide__eyebrow">
                      Help with this page
                    </span>
                    <h4>{current.title}</h4>
                    <p>{current.description}</p>
                    <button type="button" onClick={() => onStart(page)}>
                      Show me
                      <ArrowRight size={15} />
                    </button>
                  </section>
                )}
                <section
                  className="researcher-guide__section"
                  aria-label="Frequently asked questions"
                >
                  <h4>
                    {adviser
                      ? "Popular questions"
                      : "Frequently asked questions"}
                  </h4>
                  {(adviser ? adviserPopular : frequentlyAsked).map((id) =>
                    question(id),
                  )}
                </section>
                <section
                  className="researcher-guide__section"
                  aria-label="Browse help topics"
                >
                  <h4>Browse help topics</h4>
                  {(adviser ? adviserCategories : categories)
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
                {adviser && intro}
              </>
            )}
          </>
        )}
      </div>
    </aside>,
    document.body,
  );
}
