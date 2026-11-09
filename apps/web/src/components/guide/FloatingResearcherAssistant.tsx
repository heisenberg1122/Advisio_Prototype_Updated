import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp,
  BookOpenText,
  Bot,
  Check,
  ChevronDown,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  X,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useLocation } from "react-router-dom";
import { facultyStateNotice } from "@/lib/faculty-walkthroughs";
import { useResearcherGuide } from "@/providers/researcher-guide-provider";
import { useAssistantVisibility } from "@/lib/assistant-preference";
import { apiClient, ApiError } from "@/lib/api-client";
import { currentPanelistEvaluationNotice } from "@/lib/panelist-walkthroughs";
import {
  assistantActionId,
  assistantPopular,
  assistantWorkspaceLabels,
  authorizedAssistantTopics,
  isFacultyHelpWorkspace,
  resolveAssistantQuestion,
  type AssistantAIProvider,
  type AssistantReply,
  type AssistantTopicId,
  type AssistantTurn,
} from "@research-management/shared/src/researcher-assistant";
import "./researcher-assistant.css";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  reply?: AssistantReply;
  retryQuestion?: string;
}
const welcome =
  "Hi! Need help finding something or figuring out what to do next in Advisio?";

export function FloatingResearcherAssistant() {
  const { user } = useAuth();
  const guide = useResearcherGuide();
  const location = useLocation();
  const { visible } = useAssistantVisibility(user?.id);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [allowAI, setAllowAI] = useState(false);
  const [aiProvider, setAIProvider] = useState<AssistantAIProvider>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [actionNotice, setActionNotice] = useState("");
  const panel = useRef<HTMLElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null),
    transcript = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const workspace = guide?.workspace ?? "researcher";
  const panelist = workspace === "panelist";
  const available = authorizedAssistantTopics(
    user?.permissions || [],
    workspace,
  );
  const allowedIds = new Set(available.map((topic) => topic.id));
  const enabled = Boolean(guide?.enabled && visible && user);
  const hiddenByGuide = guide?.busy || guide?.drawerOpen;
  const aiProviderName = aiProvider === "groq" ? "Groq" : "OpenAI";

  useEffect(() => {
    if (!enabled) {
      controller.current?.abort();
      setOpen(false);
      setMessages([]);
      setDraft("");
      setAllowAI(false);
      setAIProvider(undefined);
    }
    if (!enabled) return;
    document.documentElement.style.setProperty(
      "--researcher-assistant-clearance",
      "80px",
    );
    return () => {
      document.documentElement.style.removeProperty(
        "--researcher-assistant-clearance",
      );
    };
  }, [enabled]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (open && !hiddenByGuide) input.current?.focus({ preventScroll: true });
  }, [open, hiddenByGuide]);
  useEffect(() => {
    const element = transcript.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, pending, open]);
  const minimize = () => {
    setOpen(false);
    requestAnimationFrame(() => launcher.current?.focus());
  };
  const clear = () => {
    controller.current?.abort();
    controller.current = null;
    setMessages([]);
    setDraft("");
    setPending(false);
    setActionNotice("");
    input.current?.focus();
  };
  const send = async (question = draft) => {
    const message = question.trim();
    if (!message || message.length > 1600 || pending || controller.current || !user) return;
    const previous = [...messages]
      .reverse()
      .find(
        (item) =>
          item.reply?.topicIds.length === 1 &&
          ["local", "ai"].includes(item.reply.source),
      )?.reply?.topicIds[0];
    const history: AssistantTurn[] = messages
      .filter(
        (item) =>
          item.role === "user" ||
          (item.reply && ["local", "ai"].includes(item.reply.source)),
      )
      .slice(-4)
      .map((item) => ({ role: item.role, content: (item.reply?.text ?? item.text).slice(0, 1000) }));
    const evaluationNotice = panelist && currentPanelistEvaluationNotice();
    const currentPage = location.pathname + location.search;
    const answerText = (reply: AssistantReply) => {
      if (reply.source !== "local" || reply.topicIds.length !== 1) return reply.text;
      const [topicId] = reply.topicIds;
      if (topicId === "pn-14" && evaluationNotice) return evaluationNotice;
      const notice = isFacultyHelpWorkspace(workspace)
        ? facultyStateNotice(workspace, topicId, currentPage, user.permissions)
        : undefined;
      return notice ? reply.text + "\n\n" + notice : reply.text;
    };
    setMessages((items) => [
      ...items.slice(-38),
      { id: ++nextId.current, role: "user", text: message },
    ]);
    setDraft("");
    setActionNotice("");
    setPending(true);
    const current = new AbortController();
    controller.current = current;
    const timeout = setTimeout(() => current.abort(), 30_000);
    try {
      const reply = await apiClient.post<AssistantReply>(
        "/api/researcher-assistant",
        {
          message,
          ...(workspace === "researcher" ? {} : { workspace }),
          page: guide?.page,
          previousTopic: previous,
          history,
          allowAI,
          aiProvider,
        },
        { signal: current.signal },
      );
      if (controller.current !== current || current.signal.aborted) return;
      if (
        typeof reply.text !== "string" ||
        !reply.text.trim() ||
        !Array.isArray(reply.topicIds)
      )
        throw new Error("Assistant response is unavailable.");
      const safeReply = {
        ...reply,
        topicIds: (reply.topicIds || []).filter((id) => allowedIds.has(id)),
      };
      if (safeReply.needsConsent) {
        setAIProvider(safeReply.consentProvider ?? "openai");
        setAllowAI(false);
      }
      setMessages((items) => [
        ...items,
        {
          id: ++nextId.current,
          role: "assistant",
          text: answerText(safeReply),
          reply: safeReply,
          retryQuestion:
            safeReply.retryable || safeReply.needsConsent ? message : undefined,
        },
      ]);
    } catch (error) {
      if (controller.current !== current) return;
      const local = resolveAssistantQuestion(
        message,
        user.permissions,
        previous,
        workspace,
      );
      const denied =
        error instanceof ApiError && [401, 403, 429].includes(error.statusCode);
      const reply: AssistantReply =
        !denied && local.kind === "local"
          ? {
              text: local.topic.answer,
              topicIds: [local.topic.id],
              source: "local",
            }
          : {
              text: denied
                ? (error as ApiError).message
                : "I couldn’t connect to assistant help. You can retry or open the verified Guide.",
              source: "fallback",
              topicIds: [],
              retryable: !denied,
            };
      setMessages((items) => [
        ...items,
        {
          id: ++nextId.current,
          role: "assistant",
          text: answerText(reply),
          reply,
          retryQuestion: reply.retryable ? message : undefined,
        },
      ]);
    } finally {
      clearTimeout(timeout);
      if (controller.current === current) {
        controller.current = null;
        setPending(false);
      }
    }
  };
  const act = (id: string) => {
    const outcome = guide?.act(id);
    if (outcome === false)
      setActionNotice(
        "Save or close your edited form before leaving this page. Your draft is still here.",
      );
    else minimize();
  };
  if (!enabled || hiddenByGuide) return null;
  return createPortal(
    <div className="researcher-assistant" data-researcher-assistant>
      {open ? (
        <aside
          ref={panel}
          className="researcher-assistant__panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="advisio-assistant-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              minimize();
            }
          }}
        >
          <header className="researcher-assistant__header">
            <span className="researcher-assistant__icon">
              <Bot size={21} aria-hidden="true" />
            </span>
            <div>
              <h2 id="advisio-assistant-title">Advisio Assistant</h2>
              <p>{assistantWorkspaceLabels[workspace]} Workspace</p>
            </div>
            <button
              type="button"
              aria-label="Clear conversation"
              title="Clear conversation"
              onClick={clear}
            >
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              aria-label="Minimize assistant"
              title="Minimize"
              onClick={minimize}
            >
              <ChevronDown size={19} />
            </button>
            <button
              type="button"
              aria-label="Close assistant"
              title="Close"
              onClick={minimize}
            >
              <X size={18} />
            </button>
          </header>
          <div
            className="researcher-assistant__transcript"
            ref={transcript}
            role="log"
            aria-label="Assistant conversation"
            aria-live="polite"
            aria-relevant="additions"
          >
            <div className="researcher-assistant__message researcher-assistant__message--assistant">
              <p>{panelist ? "Hi! Need help finding a defense invitation, reviewing a manuscript, or completing an evaluation?" : welcome}</p>
            </div>
            {!messages.length && (
              <div
                className="researcher-assistant__suggestions"
                aria-label="Suggested questions"
              >
                {assistantPopular[workspace]
                  .flatMap((id) => available.filter((topic) => topic.id === id))
                  .map(({ id, question }) => (
                    <button
                      key={id}
                      type="button"
                      disabled={pending}
                      onClick={() => void send(question)}
                    >
                      {question}
                    </button>
                  ))}
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  "researcher-assistant__message researcher-assistant__message--" +
                  message.role
                }
              >
                <span className="sr-only">
                  {message.role === "user" ? "You" : "Advisio Assistant"}
                </span>
                <p>{message.text}</p>
                {message.reply && (
                  <small className="researcher-assistant__source">
                    {message.reply.source === "ai"
                      ? "AI explanation"
                      : message.reply.source === "fallback"
                        ? "Guide fallback"
                        : "Verified workspace help"}
                  </small>
                )}
                {message.reply?.topicIds.slice(0, 2).map((id) => {
                  const topic = available.find((topic) => topic.id === id);
                  if (!topic) return null;
                  return (
                    <div key={id} className="researcher-assistant__actions">
                      {message.reply!.topicIds.length > 1 && (
                        <strong>{topic.question}</strong>
                      )}
                      <button
                        type="button"
                        onClick={() => act(assistantActionId(id, "navigate"))}
                      >
                        Take me there
                      </button>
                      <button
                        type="button"
                        onClick={() => act(assistantActionId(id, "show"))}
                      >
                        Show me
                      </button>
                      <button
                        type="button"
                        onClick={() => act(assistantActionId(id, "guide"))}
                      >
                        <BookOpenText size={13} />
                        Open Guide
                      </button>
                    </div>
                  );
                })}
                {message.retryQuestion && (
                  <button
                    type="button"
                    className="researcher-assistant__retry"
                    disabled={
                      pending ||
                      (message.reply?.needsConsent &&
                        (!allowAI ||
                          (message.reply.consentProvider ?? "openai") !==
                            aiProvider))
                    }
                    onClick={() => void send(message.retryQuestion)}
                  >
                    <RotateCcw size={13} />
                    {message.reply?.needsConsent ? "Ask with AI" : "Retry"}
                  </button>
                )}
                {message.reply?.source === "fallback" &&
                  !message.reply.topicIds.length && (
                    <div className="researcher-assistant__actions">
                      <button
                        type="button"
                        onClick={() => {
                          guide?.open();
                          minimize();
                        }}
                      >
                        <BookOpenText size={13} />
                        Open Guide
                      </button>
                    </div>
                  )}
              </div>
            ))}
            {pending && (
              <p className="researcher-assistant__loading" role="status">
                <LoaderCircle
                  size={15}
                  className="animate-spin"
                  aria-hidden="true"
                />
                Checking how I can help…
              </p>
            )}
          </div>
          {actionNotice && (
            <p className="researcher-assistant__notice" role="status">
              {actionNotice}
            </p>
          )}
          <form
            className="researcher-assistant__composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label className="sr-only" htmlFor="advisio-assistant-input">
              Ask Advisio Assistant
            </label>
            <textarea
              ref={input}
              id="advisio-assistant-input"
              rows={2}
              maxLength={1600}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about your workspace…"
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={pending || !draft.trim()}
            >
              <ArrowUp size={19} />
            </button>
          </form>
          <div className="researcher-assistant__privacy">
            {aiProvider && (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={allowAI}
                    onChange={(event) => setAllowAI(event.target.checked)}
                  />
                  <span>Use AI for harder questions</span>
                  {allowAI && <Check size={13} aria-hidden="true" />}
                </label>
                <p>
                  When enabled, your question and up to 4 recent turns may be
                  sent to {aiProviderName}. Avoid private research or personal
                  details.
                </p>
              </>
            )}
            <p>Chat clears on refresh or sign-out.</p>
          </div>
        </aside>
      ) : (
        <button
          ref={launcher}
          type="button"
          className="researcher-assistant__launcher"
          aria-label="Open Advisio Assistant"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <MessageCircle size={23} aria-hidden="true" />
          <span>Ask Advisio</span>
        </button>
      )}
    </div>,
    document.body,
  );
}
