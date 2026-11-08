import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Compass, ArrowRight } from "lucide-react";
import { useAuth } from "./auth-provider";
import { useDashboardWorkspace } from "./dashboard-workspace-provider";
import { useActiveProjectContext } from "./active-project-provider";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { evaluationRequest, type EvaluationSession } from "@/components/evaluation/evaluation-client";
import { evaluationIdentityGeneration } from "@/lib/evaluation-identity";
import { Modal } from "@/components/ui/Modal";
import { ProductTour } from "@/components/shared/ProductTour";
import {
  availableTourPages, currentTourPage, eligibleTourWorkspace, introductionTour, pageRouteKey, pageTour,
  readTourProgress, saveTourProgress, tourStorageKey, type WorkspaceTour,
} from "@/lib/workspace-tours";
import { cn } from "@/lib/utils";
import { ResearcherGuideLauncher, useResearcherGuide } from "./researcher-guide-provider";

type ActiveTour = { tour: WorkspaceTour; index: number; context: string; progressKey: string; skipped: boolean };
type TourContextValue = { available: boolean; launch: () => void; invitation: boolean; startIntroduction: () => void; dismissInvitation: () => void };
const TourContext = createContext<TourContextValue | null>(null);
export const useWorkspaceTours = () => useContext(TourContext);
function storage(evaluation: boolean): Storage | null {
  try { return evaluation ? window.sessionStorage : window.localStorage; } catch { return null; }
}

export function WorkspaceTourProvider({ children }: { children: ReactNode }) {
  const { user, token, isLoading, isSwitchingCollege } = useAuth();
  const { activeWorkspace, hasDirtyForms } = useDashboardWorkspace();
  const { projectHref } = useActiveProjectContext();
  const { openMobile, closeMobile } = useSidebarCollapsed();
  const location = useLocation();
  const navigate = useNavigate();
  const eligible = eligibleTourWorkspace(user, location.pathname);
  const evaluation = token === "__evaluation__";
  const usesGuide = eligible === "adviser" || (eligible === "panelist" && !evaluation) ||
    (eligible === "dean" && Boolean(user?.college?.id));
  const workspace = !usesGuide && eligible === activeWorkspace?.id ? eligible : null;
  const generation = evaluationIdentityGeneration();
  const session = useQuery({
    queryKey: ["workspace-tour-evaluation-session", user?.id, user?.college?.id, generation],
    queryFn: () => evaluationRequest<EvaluationSession>("session"),
    enabled: evaluation && Boolean(workspace) && !isSwitchingCollege,
    staleTime: Infinity, retry: false,
  });
  const sessionId = evaluation ? session.data?.progressKey || session.data?.projectId : undefined;
  const progressScope = workspace && user && !isLoading && !isSwitchingCollege
    ? tourStorageKey({ userId: user.id, collegeId: user.college?.id || "unassigned", workspace, evaluationSession: evaluation ? sessionId || "pending" : undefined }, "scope") : "";
  // Permission changes terminate an active tutorial without discarding the
  // user's completion history for this workspace and college.
  const context = progressScope ? `${progressScope}:${[...(user?.permissions || [])].sort().join(",")}` : "";
  const pages = workspace ? availableTourPages(workspace, user?.permissions || []) : [];
  const introduction = workspace ? introductionTour(workspace, pages) : null;
  const page = currentTourPage(pages, location.pathname + location.search);
  const [launcherContext, setLauncherContext] = useState("");
  const [active, setActive] = useState<ActiveTour | null>(null);
  const [invitationContext, setInvitationContext] = useState("");
  const [notice, setNotice] = useState("");
  const pendingRoute = useRef<string | null>(null);
  const focusReturn = useRef<HTMLElement | null>(null);
  const editedFields = useRef(new Map<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, string>());
  const progressStorage = storage(evaluation);
  const canPersist = Boolean(context && (!evaluation || sessionId));
  const running = active?.context === context && Boolean(context) ? active : null;
  const step = running?.tour.steps[running.index];
  const introKey = progressScope + ":introduction";

  const restoreFocus = () => requestAnimationFrame(() => {
    const visible = (element: HTMLElement | null) => {
      const rect = element?.getBoundingClientRect();
      return Boolean(element?.isConnected && rect?.width && rect?.height && rect.right > 0 && rect.left < window.innerWidth);
    };
    const fallback = document.querySelector<HTMLElement>('[data-tour="tour-launcher"]');
    const candidate = visible(focusReturn.current) ? focusReturn.current : fallback;
    if (visible(candidate)) candidate.focus({ preventScroll: true });
    else document.querySelector<HTMLElement>('button[aria-label="Open navigation menu"],header button')?.focus({ preventScroll: true });
  });
  const save = (key: string, completed: boolean) => { if (progressStorage && canPersist) saveTourProgress(progressStorage, key, completed ? "completed" : "dismissed"); };
  const close = () => { if (running) save(running.progressKey, false); setActive(null); pendingRoute.current = null; closeMobile(); restoreFocus(); };

  useEffect(() => {
    setActive(null); setLauncherContext(""); setInvitationContext(""); setNotice(""); pendingRoute.current = null;
  }, [context]);

  useEffect(() => {
    editedFields.current.clear();
    const remember = (event: Event) => {
      const element = event.target;
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return;
      if (element.closest('[data-tour="page-filter"],[data-tour="calendar-navigation"],[data-tour="audit-filters"],[data-tour="report-selection"],[data-tour="class-selection"]')) return;
      if (element instanceof HTMLInputElement && (element.type === "search" || /^(search|find)\b/i.test(element.placeholder) || /^(search|find)\b/i.test(element.getAttribute("aria-label") || ""))) return;
      if (!editedFields.current.has(element)) editedFields.current.set(element, fieldValue(element));
    };
    document.addEventListener("focusin", remember, true);
    document.addEventListener("beforeinput", remember, true);
    return () => { document.removeEventListener("focusin", remember, true); document.removeEventListener("beforeinput", remember, true); };
  }, [context, location.pathname]);

  const fieldValue = (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type) ? String(element.checked) : element.value;
  const hasUnfinishedEdits = () => hasDirtyForms() || Array.from(editedFields.current).some(([element, original]) => element.isConnected && fieldValue(element) !== original);

  useEffect(() => {
    if (!context || !canPersist || !introduction || !progressStorage || readTourProgress(progressStorage, introKey)) return;
    if (pageRouteKey(location.pathname + location.search) !== pageRouteKey(pages[0]?.href || "/")) return;
    const timer = window.setTimeout(() => {
      if (!document.querySelector('[role="dialog"]')) setInvitationContext(context);
    }, 1500);
    return () => window.clearTimeout(timer);
  // Primitive scope and route keys avoid restarting the invitation on unrelated renders.
  }, [context, canPersist, location.pathname, location.search]);

  useEffect(() => {
    if (!running || !step) return;
    const matches = pageRouteKey(location.pathname + location.search) === pageRouteKey(step.href);
    if (matches) pendingRoute.current = null;
    else if (!pendingRoute.current) { setActive(null); closeMobile(); }
  }, [location.key]);

  const prepare = (tour: WorkspaceTour, index: number, skipped = false) => {
    if (!context || !workspace) return;
    const leavesPage = tour.steps.some(item => !new URL(item.href, window.location.origin).pathname.endsWith("/inbox") && pageRouteKey(item.href) !== pageRouteKey(location.pathname + location.search));
    if (leavesPage && hasUnfinishedEdits()) { setNotice("Save your work and close the edited form, or discard your changes, before taking a tour to another page."); return; }
    // Inbox synchronizes institutional messages on entry. Point to its actual
    // navigation control rather than automatically opening that page in a tour.
    if (new URL(tour.steps[index].href, window.location.origin).pathname.endsWith("/inbox") && !location.pathname.endsWith("/inbox")) {
      tour = { ...tour, steps: tour.steps.map((item, position) => position === index ? { ...item, href: location.pathname + location.search, target: "navigation-inbox", content: "Find Inbox under Communication; open it after this tour to read and reply to messages." } : item) };
    }
    const destination = projectHref(tour.steps[index].href);
    const currentRoute = pageRouteKey(location.pathname + location.search);
    const destinationRoute = pageRouteKey(destination);
    pendingRoute.current = currentRoute === destinationRoute ? null : destinationRoute;
    if (currentRoute !== destinationRoute) navigate(destination);
    const sidebarTarget = ["tour-launcher", "navigation-inbox"].includes(tour.steps[index].target);
    if (tour.steps[index].target === "navigation-inbox") {
      const hiddenGroup = document.querySelector('[data-tour="navigation-inbox"]')?.closest<HTMLElement>("[hidden]");
      if (hiddenGroup?.id) document.querySelector<HTMLButtonElement>(`button[aria-controls="${CSS.escape(hiddenGroup.id)}"]`)?.click();
    }
    if (sidebarTarget && window.innerWidth < 1024) openMobile();
    else closeMobile();
    setActive({ tour, index, context, progressKey: tour.id.endsWith(":introduction") ? introKey : progressScope + ":" + tour.id, skipped });
    setLauncherContext(""); setInvitationContext(""); setNotice("");
  };
  const start = (tour: WorkspaceTour) => { focusReturn.current = document.activeElement as HTMLElement; prepare(tour, 0); };
  const dismissInvitation = () => { save(introKey, false); setInvitationContext(""); };
  const next = (completedStep: boolean) => {
    if (!running) return;
    if (running.index === running.tour.steps.length - 1) {
      save(running.progressKey, completedStep && !running.skipped); setActive(null); closeMobile(); restoreFocus();
    } else prepare(running.tour, running.index + 1, running.skipped || !completedStep);
  };
  const launcherOpen = Boolean(context && launcherContext === context);
  return <TourContext.Provider value={{
    available: Boolean(context),
    launch: () => { focusReturn.current = document.activeElement as HTMLElement; setLauncherContext(context); setNotice(""); closeMobile(); },
    invitation: Boolean(context && invitationContext === context && page?.id === "overview" && !running && !launcherOpen),
    startIntroduction: () => { if (introduction) start(introduction); }, dismissInvitation,
  }}>
    {children}
    {launcherOpen && introduction && createPortal(<Modal isOpen onClose={() => { setLauncherContext(""); restoreFocus(); }} title="Learn your workspace" subtitle="Get familiar with the essentials or choose a task." maxWidth="sm" overlayClassName="z-[2150]" className="max-h-[calc(100dvh-2rem)] [&>div:last-child]:min-h-0">
      {notice && <p role="status" className="mb-3 text-sm text-[var(--color-text-secondary)]">{notice}</p>}
      <button type="button" onClick={() => start(introduction)} className="mb-5 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-[var(--college-on-primary)] dark:text-[var(--college-on-primary-dark)] focus-visible:outline-2 focus-visible:outline-offset-2">
        Start Workspace Tour<ArrowRight size={17} />
      </button>
      {page && <button type="button" onClick={() => start(pageTour(workspace!, page))} className="mb-4 min-h-11 w-full rounded-xl border border-[var(--color-border)] px-3 text-left text-sm font-semibold focus-visible:outline-2">Help with this page: {page.label}</button>}
      <h3 className="mb-2 text-sm font-semibold">Learn a specific task</h3>
      <div className="max-h-[38dvh] space-y-1 overflow-y-auto">
        {pages.filter(entry => entry.id !== "overview").map(entry => <button type="button" key={entry.id} onClick={() => start(pageTour(workspace!, entry))} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm hover:bg-[var(--nav-hover-bg)] focus-visible:outline-2 focus-visible:outline-[var(--college-focus-ring)]">
          {entry.label}<ArrowRight size={15} aria-hidden="true" />
        </button>)}
      </div>
    </Modal>, document.body)}
    {running && step && <ProductTour key={running.tour.id + ":" + running.index} step={step} index={running.index} total={running.tour.steps.length} routeReady={pageRouteKey(location.pathname + location.search) === pageRouteKey(step.href)} onClose={close} onBack={() => prepare(running.tour, running.index - 1, running.skipped)} onNext={next} onRetry={() => prepare(running.tour, running.index, running.skipped)} />}
  </TourContext.Provider>;
}

export function TourLauncher({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  const tours = useWorkspaceTours();
  const researcher = useResearcherGuide();
  if (researcher?.enabled) return <ResearcherGuideLauncher collapsed={collapsed} className={className} />;
  if (!tours?.available) return null;
  return <button type="button" data-tour="tour-launcher" aria-label="Take a Tour" aria-haspopup="dialog" title={collapsed ? "Take a Tour" : undefined} onClick={tours.launch}
    className={cn("flex h-11 shrink-0 items-center rounded-xl text-sm font-medium text-[var(--color-text-primary)]/80 hover:bg-[var(--nav-hover-bg)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--college-focus-ring)]", collapsed ? "w-11 justify-center" : "mx-1 gap-3.5 px-3.5", className)}>
    <Compass className="h-5 w-5 shrink-0" aria-hidden="true" />{!collapsed && <span>Take a Tour</span>}
  </button>;
}

export function WorkspaceTourInvitation() {
  const tours = useWorkspaceTours();
  const researcher = useResearcherGuide();
  if (researcher?.enabled) return null;
  if (!tours?.invitation) return null;
  return <aside aria-label="Workspace tour invitation" className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm">
    <div><strong>New to this workspace?</strong><p className="text-xs text-[var(--color-text-secondary)]">Learn the basics with a few guided steps.</p></div>
    <div className="flex gap-2"><button type="button" onClick={tours.startIntroduction} className="min-h-11 rounded-lg px-3 font-semibold text-[var(--color-primary)] focus-visible:outline-2">Show me around</button><button type="button" onClick={tours.dismissInvitation} className="min-h-11 rounded-lg px-3 text-[var(--color-text-secondary)] focus-visible:outline-2">Maybe later</button></div>
  </aside>;
}
