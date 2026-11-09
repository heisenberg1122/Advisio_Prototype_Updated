import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText } from "lucide-react";
import { useAuth } from "./auth-provider";
import { useDashboardWorkspace } from "./dashboard-workspace-provider";
import { useActiveProjectContext } from "./active-project-provider";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useResearcherGuideState } from "@/hooks/use-researcher-guide-state";
import {
  eligibleTourWorkspace,
  readTourProgress,
  saveTourProgress,
} from "@/lib/workspace-tours";
import {
  evaluationRequest,
  type EvaluationSession,
} from "@/components/evaluation/evaluation-client";
import { evaluationIdentityGeneration } from "@/lib/evaluation-identity";
import {
  researcherPageHelp,
  type ResearcherHelpId,
} from "@/lib/researcher-guide";
import { buildResearcherJourney } from "@/lib/researcher-walkthroughs";
import {
  adviserPageHelp,
  buildAdviserJourney,
} from "@/lib/adviser-walkthroughs";
import { buildPanelistJourney, panelistPageHelp } from "@/lib/panelist-walkthroughs";
import type { PanelistHelpId } from "@research-management/shared/src/panelist-help";
import type { AdviserHelpId } from "@research-management/shared/src/adviser-help";
import { GuideDrawer, type GuideHelpId } from "@/components/guide/GuideDrawer";
import {
  GuidedWalkthrough,
  findGuideTarget,
} from "@/components/guide/GuidedWalkthrough";
import type {
  GuidedJourney,
  GuidedTarget,
} from "@/components/guide/guided-walkthrough-types";
import { cn } from "@/lib/utils";
import {
  resolveAssistantAction,
  isFacultyHelpWorkspace,
  type AssistantWorkspace,
} from "@research-management/shared/src/researcher-assistant";
import { buildFacultyJourney, facultyPageHelp } from "@/lib/faculty-walkthroughs";
import { FloatingResearcherAssistant } from "@/components/guide/FloatingResearcherAssistant";
import { useWorkspaceOrientation } from "@/hooks/use-workspace-orientation";
import { orientationProgressKey } from "@/lib/orientation-progress";

const noPermissions: readonly string[] = [];

type TopicId = GuideHelpId | "introduction";
interface ActiveJourney {
  journey: GuidedJourney;
  topic: TopicId;
  step: string;
  href: string;
  history: { step: string; href: string }[];
  scope: string;
  project: string | null;
  classAccess: string;
  skipped: boolean;
}
interface ResearcherGuideContext {
  workspace: AssistantWorkspace;
  page: GuideHelpId | undefined;
  enabled: boolean;
  busy: boolean;
  drawerOpen: boolean;
  open: (topic?: GuideHelpId) => void;
  act: (actionId: string) => boolean;
}
const Context = createContext<ResearcherGuideContext | null>(null);
export const useResearcherGuide = () => useContext(Context);
const routeKey = (href: string) => {
  const url = new URL(href, "https://advisio.local");
  return (
    url.pathname +
    ":" +
    (url.searchParams.get("tab") || "overview") +
    ":" +
    (url.searchParams.get("section") || "")
  );
};
const sensitiveToProject = (topic: TopicId) =>
  !["theme", "settings", "communication", "join-group"].includes(topic);
const valueOf = (
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
) =>
  element instanceof HTMLInputElement &&
  ["checkbox", "radio"].includes(element.type)
    ? String(element.checked)
    : element.value;

export function ResearcherGuideProvider({ children }: { children: ReactNode }) {
  const { user, token, isLoading, isSwitchingCollege } = useAuth();
  const { activeWorkspace, hasDirtyForms } = useDashboardWorkspace();
  const { activeProjectId, projectHref } = useActiveProjectContext();
  const { collapsed, toggle, openMobile, closeMobile } = useSidebarCollapsed();
  const location = useLocation(),
    navigate = useNavigate(),
    navigationType = useNavigationType();
  const groupJoinPage = location.pathname === "/join-group";
  const researcherRoute = groupJoinPage
    ? "/student/join-group"
    : location.pathname;
  const eligible = eligibleTourWorkspace(user, researcherRoute);
  const workspace: AssistantWorkspace = eligible ?? "researcher";
  const adviser = workspace === "adviser";
  const panelist = workspace === "panelist";
  const researcher = workspace === "researcher";
  const faculty = isFacultyHelpWorkspace(workspace) ? workspace : null;
  const enabled =
    Boolean(user && eligible) &&
    !isLoading &&
    !isSwitchingCollege &&
    (activeWorkspace?.id === eligible || (groupJoinPage && researcher)) &&
    (researcher || workspace === "system-admin" || Boolean(user?.college?.id));
  const href = location.pathname + location.search;
  const page = faculty
    ? facultyPageHelp(faculty, href, user?.permissions || [])
    : panelist
      ? panelistPageHelp(location.pathname, location.search)
      : adviser
        ? adviserPageHelp(location.pathname, location.search)
        : researcherPageHelp(location.pathname, location.search);
  const [drawer, setDrawer] = useState(false),
    [selected, setSelected] = useState<GuideHelpId | null>(null),
    [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [active, setActive] = useState<ActiveJourney | null>(null);
  const [requested, setRequested] = useState<TopicId | null>(null);
  const { state, loading } = useResearcherGuideState(
    enabled && researcher && (drawer || Boolean(active)),
    user?.id,
  );
  const evaluation = token === "__evaluation__";
  const session = useQuery({
    queryKey: [
      "workspace-tour-evaluation-session",
      user?.id,
      user?.college?.id,
      evaluationIdentityGeneration(),
    ],
    queryFn: () => evaluationRequest<EvaluationSession>("session"),
    enabled: enabled && evaluation,
    staleTime: Infinity,
    retry: false,
  });
  const sessionKey = evaluation
    ? session.data?.progressKey || session.data?.projectId || "pending"
    : "account";
  const scope =
    enabled && user
      ? [
          workspace,
          user.id,
          user.college?.id || "unassigned",
          sessionKey,
          [...user.permissions].sort().join(","),
        ]
          .map(encodeURIComponent)
          .join(":")
      : "";
  const running = active?.scope === scope && enabled ? active : null;
  const step = running?.journey.steps.find((step) => step.id === running.step);
  const stepIndex =
    running?.journey.steps.findIndex((step) => step.id === running.step) ?? -1;
  const ownNavigation = useRef(false),
    navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocation = useRef(location.key),
    opener = useRef<HTMLElement | null>(null);
  const expandedForGuide = useRef(false),
    initialProfileOpen = useRef(false);
  const edited = useRef(
    new Map<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
      string
    >(),
  );

  const progressKey = (topic: TopicId, project: string | null) =>
    (researcher ? "advisio:researcher-guide:v3:" : `advisio:${workspace}-guide:v1:`) +
    [
      user?.id || "",
      user?.college?.id || "unassigned",
      sessionKey,
      topic,
      researcher && sensitiveToProject(topic)
        ? project || "no-project"
        : "workspace",
    ]
      .map(encodeURIComponent)
      .join(":");
  let introductionCompleted = false;
  if (enabled && drawer) {
    try {
      introductionCompleted =
        readTourProgress(
          evaluation ? sessionStorage : localStorage,
          progressKey("introduction", state.projectId),
        ) === "completed";
    } catch {
      // Written help remains available when browser storage is restricted.
    }
  }
  const save = (journey: ActiveJourney, completed: boolean) => {
    if (!enabled || (evaluation && sessionKey === "pending")) return;
    try {
      saveTourProgress(
        evaluation ? sessionStorage : localStorage,
        progressKey(journey.topic, journey.project),
        completed ? "completed" : "dismissed",
      );
    } catch {
      /* Guidance stays usable without browser storage. */
    }
  };
  const restoreFocus = () =>
    requestAnimationFrame(() => {
      const launcher = findGuideTarget("guide-launcher");
      const candidate = opener.current?.isConnected ? opener.current : launcher;
      const bounds = candidate?.getBoundingClientRect();
      if (bounds && bounds.right > 0 && bounds.left < innerWidth)
        candidate?.focus({ preventScroll: true });
      else
        document
          .querySelector<HTMLElement>(
            'button[aria-label="Open navigation menu"]',
          )
          ?.focus({ preventScroll: true });
    });
  const cleanView = () => {
    closeMobile();
    if (expandedForGuide.current && !collapsed) {
      toggle();
      expandedForGuide.current = false;
    }
    const profile = findGuideTarget("profile-menu-button");
    if (
      !initialProfileOpen.current &&
      profile?.getAttribute("aria-expanded") === "true"
    )
      profile.click();
  };
  const topicLoading = (topic: TopicId) =>
    researcher && loading(topic as ResearcherHelpId | "introduction");
  const routeHref = (destination: string, project?: string | null) =>
    researcher ? projectHref(destination, project) : destination;
  const hasEdits = () =>
    hasDirtyForms() ||
    Array.from(edited.current).some(
      ([element, original]) =>
        element.isConnected && valueOf(element) !== original,
    );
  const orientation = useWorkspaceOrientation({
    workspace: enabled && !researcher ? workspace : null,
    permissions: user?.permissions ?? noPermissions,
    scope,
    storageKey: enabled && !researcher && (!evaluation || sessionKey !== "pending")
      ? orientationProgressKey(progressKey("introduction", null))
      : null,
    evaluation,
    drawerOpen: drawer,
    hasEdits,
    onBegin: () => {
      setActive(null);
      setRequested(null);
      setDrawer(false);
      setNotice("");
    },
    onEnd: (message) => {
      setSelected(null);
      setQuery("");
      setDrawer(true);
      setNotice(message);
    },
  });
  const end = (completed: boolean, explore = false) => {
    if (running) save(running, completed && !running.skipped);
    setActive(null);
    ownNavigation.current = false;
    cleanView();
    const modal = !researcher
      ? Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="dialog"][aria-modal="true"]',
          ),
        ).at(-1)
      : null;
    setDrawer(explore || !modal);
    if (modal && !explore)
      requestAnimationFrame(() =>
        modal
          .querySelector<HTMLElement>('button[aria-label^="Close"]')
          ?.focus({ preventScroll: true }),
      );
    if (explore) {
      setSelected(null);
      setQuery("");
    }
    setNotice(
      completed
        ? (panelist || faculty)
          ? "Walkthrough finished. You can return to Guide for another task."
          : adviser
          ? "Walkthrough finished. No decision, approval or meeting was submitted by the Guide."
          : "Walkthrough finished. Only the guide is complete; no class enrollment, request, or research submission was made for you."
        : "You can return to this question or restart its walkthrough whenever you need it.",
    );
  };
  const intent = () => {
    ownNavigation.current = true;
    if (navigationTimer.current) clearTimeout(navigationTimer.current);
    navigationTimer.current = setTimeout(() => {
      ownNavigation.current = false;
    }, 700);
  };

  useEffect(() => {
    if (active) cleanView();
    setActive(null);
    setDrawer(false);
    setSelected(null);
    setQuery("");
    setRequested(null);
    setNotice("");
    edited.current.clear();
  }, [scope]);
  useEffect(
    () => () => {
      if (navigationTimer.current) clearTimeout(navigationTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!enabled) return;
    const remember = (event: Event) => {
      const element = event.target;
      if (
        !(
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        )
      )
        return;
      if (
        element.closest(
          "[data-researcher-guide-drawer], [data-researcher-assistant]",
        )
      )
        return;
      if (
        ["class-code", "group-code", "adviser-official-project"].includes(
          element.dataset.guide || "",
        )
      )
        return;
      if (
        element instanceof HTMLInputElement &&
        (element.type === "search" ||
          /^(search|find)\b/i.test(
            element.placeholder || element.getAttribute("aria-label") || "",
          ))
      )
        return;
      if (!edited.current.has(element))
        edited.current.set(element, valueOf(element));
    };
    document.addEventListener("focusin", remember, true);
    document.addEventListener("beforeinput", remember, true);
    return () => {
      document.removeEventListener("focusin", remember, true);
      document.removeEventListener("beforeinput", remember, true);
    };
  }, [enabled, location.pathname]);
  useEffect(() => {
    if (lastLocation.current === location.key) return;
    lastLocation.current = location.key;
    const sameFacultyView =
      faculty && running &&
      navigationType === "REPLACE" &&
      routeKey(running.href) === routeKey(href);
    if (running && (navigationType === "POP" || (!ownNavigation.current && !sameFacultyView))) {
      setActive(null);
      cleanView();
      setNotice(
        "The page changed, so the walkthrough paused. Open Guide to continue with the current page.",
      );
    } else if ((panelist || faculty) && running && running.href !== href) {
      setActive({ ...running, href });
    }
  }, [location.key]);
  useEffect(() => {
    if (!running || !researcher) return;
    if (
      (sensitiveToProject(running.topic) &&
        state.projectKnown &&
        running.project !== state.projectId) ||
      (running.topic === "class" &&
        !loading("class") &&
        running.classAccess !== state.classAccess)
    ) {
      setActive(null);
      cleanView();
      setDrawer(true);
      setNotice(
        "Your project or class access changed. The guide now follows the current context; restart when you are ready.",
      );
    }
  }, [state.projectId, state.classAccess, state.projectKnown]);

  const begin = (topic: TopicId) => {
    if (
      !enabled ||
      (!researcher &&
        topic !== "introduction" &&
        !resolveAssistantAction(
          topic + ":show",
          user?.permissions || [],
          workspace,
        ))
    )
      return;
    const journey = faculty
      ? buildFacultyJourney(faculty, topic, href, user?.permissions || [])
      : panelist
      ? buildPanelistJourney(topic as PanelistHelpId | "introduction", href)
      : adviser
      ? buildAdviserJourney(
          topic as AdviserHelpId | "introduction",
          location.pathname,
          user?.permissions || [],
        )
      : buildResearcherJourney(
          topic as ResearcherHelpId | "introduction",
          state,
          location.pathname,
        );
    if (!journey) {
      setRequested(null);
      setNotice("Choose a help question available in this workspace.");
      return;
    }
    const leavesPage = journey.steps.some((step) =>
      [step.route, step.to, ...step.targets.map((target) => target.to)].some(
        (destination) =>
          destination && routeKey(destination) !== routeKey(href),
      ),
    );
    const changesView = (panelist || faculty) && journey.steps.some((step) =>
      step.targets.some((target) => target.interaction === "click"),
    );
    if ((leavesPage || adviser || changesView) && hasEdits()) {
      setRequested(null);
      setNotice(
        "Save and close your edited form, or discard your draft, before a walkthrough takes you to another page. Your work has not been changed.",
      );
      return;
    }
    initialProfileOpen.current =
      findGuideTarget("profile-menu-button")?.getAttribute("aria-expanded") ===
      "true";
    const first = journey.steps[0];
    const startHref =
      first.route && routeKey(first.route) !== routeKey(href)
        ? routeHref(first.route, state.projectId)
        : href;
    if (startHref !== href) {
      intent();
      navigate(startHref);
    }
    setActive({
      journey,
      topic,
      step: first.id,
      href: startHref,
      history: [],
      scope,
      project: state.projectId || activeProjectId,
      classAccess: state.classAccess,
      skipped: false,
    });
    setRequested(null);
    setDrawer(false);
    setNotice("");
  };
  const start = (topic: TopicId) => {
    if (
      !enabled ||
      (!researcher &&
        topic !== "introduction" &&
        !resolveAssistantAction(
          topic + ":show",
          user?.permissions || [],
          workspace,
        ))
    )
      return;
    if (topicLoading(topic)) {
      setRequested(topic);
      setNotice(
        "Checking your actual workspace before choosing the right steps…",
      );
      return;
    }
    begin(topic);
  };
  useEffect(() => {
    if (requested && !topicLoading(requested)) begin(requested);
  }, [requested, state]);
  useEffect(() => {
    if (!requested) return;
    const timeout = setTimeout(() => {
      setRequested(null);
      setNotice(
        "Your workspace is taking longer to load. You can keep reading this answer and try Show me again when the page is ready.",
      );
    }, 8000);
    return () => clearTimeout(timeout);
  }, [requested]);

  useEffect(() => {
    if (!running || !step) return;
    if (step.prepare === "sidebar") {
      if (innerWidth < 1024) openMobile();
      else if (collapsed) {
        expandedForGuide.current = true;
        toggle();
      }
      const frame = requestAnimationFrame(() => {
        for (const target of step.targets) {
          // A hidden child has no client rects; locate it by its stable identifier.
          const raw = document.querySelector<HTMLElement>(
            `[data-guide="${target.key}"]`,
          );
          const container = raw?.closest<HTMLElement>("[hidden]");
          if (container?.id)
            document
              .querySelector<HTMLButtonElement>(
                `button[aria-controls="${CSS.escape(container.id)}"]`,
              )
              ?.click();
        }
      });
      return () => cancelAnimationFrame(frame);
    } else closeMobile();
    if (step.prepare === "profile") {
      const trigger = findGuideTarget("profile-menu-button");
      if (trigger?.getAttribute("aria-expanded") !== "true") trigger?.click();
    }
  }, [running?.step]);

  const advance = (
    variant: GuidedTarget | null,
    skipped = false,
    interacted = false,
  ) => {
    if (!running || !step) return;
    const nextId =
      variant?.next || step.next || running.journey.steps[stepIndex + 1]?.id;
    if (!nextId || nextId === "finish") {
      end(!skipped);
      return;
    }
    const nextStep = running.journey.steps.find((item) => item.id === nextId);
    const destination = interacted
      ? undefined
      : variant?.to || step.to || (!researcher ? nextStep?.route : undefined);
    const nextHref =
      destination && routeKey(destination) !== routeKey(href)
        ? routeHref(destination, running.project)
        : href;
    if (nextHref !== href) {
      if (!researcher && hasEdits()) {
        end(false);
        setNotice(
          "Save or close your edited form before continuing to another page.",
        );
        return;
      }
      intent();
      navigate(nextHref);
    }
    setActive({
      ...running,
      step: nextId,
      href: nextHref,
      history:
        adviser &&
        interacted &&
        ["review-open", "request-open", "consultation-open"].includes(step.id)
          ? []
          : [...running.history, { step: running.step, href: running.href }],
      skipped: running.skipped || skipped,
    });
  };
  const back = () => {
    if (!running) return;
    const previous = running.history.at(-1);
    if (!previous) return;
    if (previous.href !== href) {
      if (!researcher && hasEdits()) {
        end(false);
        setNotice(
          "Save or close your edited form before going back to another page.",
        );
        return;
      }
      intent();
      navigate(previous.href);
    }
    setActive({
      ...running,
      ...previous,
      history: running.history.slice(0, -1),
    });
  };
  const open = (topic?: GuideHelpId) => {
    if (!enabled) return;
    opener.current = document.activeElement as HTMLElement;
    closeMobile();
    if (topic || !researcher) {
      setSelected(topic ?? null);
      setQuery("");
    }
    setDrawer(true);
    setNotice("");
  };
  const act = (actionId: string) => {
    if (!enabled || !user) return false;
    const action = resolveAssistantAction(
      actionId,
      user.permissions,
      workspace,
    );
    if (!action) return false;
    if (action.kind !== "guide" && !(panelist && action.kind === "show") && hasEdits())
      return false;
    if (action.kind === "navigate") {
      closeMobile();
      if (!panelist || routeKey(action.topic.href) !== routeKey(href))
        navigate(routeHref(action.topic.href));
    } else {
      open(action.topic.guide);
      if (action.kind === "show") {
        setRequested(action.topic.guide);
        setNotice(
          "Checking your actual workspace before choosing the right steps…",
        );
      }
    }
    return true;
  };
  return (
    <Context.Provider
      value={{
        workspace,
        page,
        enabled,
        open,
        act,
        busy: Boolean(running || requested || orientation.active),
        drawerOpen: drawer,
      }}
    >
      {children}
      {enabled && drawer && (
        <GuideDrawer
          workspace={workspace}
          permissions={user?.permissions || []}
          page={page}
          selected={selected}
          query={query}
          state={state}
          loading={selected ? topicLoading(selected) : false}
          introductionCompleted={introductionCompleted}
          notice={notice}
          onQuery={(value) => {
            setQuery(value);
            setRequested(null);
            setNotice("");
          }}
          onSelect={(topic) => {
            setSelected(topic);
            setRequested(null);
            setNotice("");
          }}
          onBack={() => {
            setSelected(null);
            setRequested(null);
            setNotice("");
          }}
          onClose={() => {
            setDrawer(false);
            setRequested(null);
            restoreFocus();
          }}
          onStart={start}
          orientation={researcher ? undefined : {
            status: orientation.status,
            begin: orientation.begin,
          }}
        />
      )}
      {orientation.active && (
        <GuidedWalkthrough
          key={orientation.active.step.id}
          step={orientation.active.step}
          index={orientation.active.stepIndex}
          total={orientation.active.chapter.steps.length}
          orientation={{
            chapter: orientation.active.chapter.title,
            index: orientation.active.chapterIndex,
            total: orientation.active.chapterCount,
            nextChapter: orientation.active.nextChapter,
            onSkipChapter: orientation.active.skipChapter,
          }}
          routeReady={orientation.active.routeReady}
          canGoBack={orientation.active.canGoBack}
          isLast={orientation.active.last}
          onIntent={() => {}}
          onNext={orientation.active.next}
          onBack={orientation.active.back}
          onExit={orientation.active.exit}
          onRetry={orientation.active.retry}
          onExplore={orientation.active.finish}
        />
      )}
      {running && step && (
        <GuidedWalkthrough
          key={running.step}
          routeReady={!faculty || !step.route || routeKey(step.route) === routeKey(href)}
          step={step}
          index={stepIndex}
          total={researcher ? running.journey.steps.length : undefined}
          canGoBack={Boolean(running.history.length)}
          isLast={
            stepIndex === running.journey.steps.length - 1 ||
            step.next === "finish"
          }
          onIntent={intent}
          onNext={advance}
          onBack={back}
          onExit={() => end(false)}
          onRetry={() => {}}
          onExplore={() => end(true, true)}
        />
      )}
      {enabled && workspace === "dean" && <FloatingResearcherAssistant key={scope} />}
    </Context.Provider>
  );
}

export function ResearcherGuideLauncher({
  collapsed,
  className,
}: {
  collapsed: boolean;
  className?: string;
}) {
  const guide = useResearcherGuide();
  if (!guide?.enabled) return null;
  return (
    <button
      type="button"
      data-guide="guide-launcher"
      aria-label="Guide"
      aria-haspopup="dialog"
      title={collapsed ? "Guide" : undefined}
      onClick={() => guide.open()}
      className={cn(
        "flex h-11 shrink-0 items-center rounded-xl text-sm font-medium text-[var(--color-text-primary)]/80 hover:bg-[var(--nav-hover-bg)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--college-focus-ring)]",
        collapsed ? "w-11 justify-center" : "mx-1 gap-3.5 px-3.5",
        className,
      )}
    >
      <BookOpenText className="h-5 w-5 shrink-0" aria-hidden="true" />
      {!collapsed && <span>Guide</span>}
    </button>
  );
}
