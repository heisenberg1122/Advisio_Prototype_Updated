import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { findGuideTarget } from "@/components/guide/GuidedWalkthrough";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { workspaceOrientation, type OrientationSample, type OrientationWorkspace } from "@/lib/workspace-orientation";
import { loadOrientationProgress, matchesOrientationRoute, orientationSamplePath, saveOrientationProgress, type OrientationProgress } from "@/lib/orientation-progress";

interface Options {
  workspace: OrientationWorkspace | null;
  permissions: readonly string[];
  scope: string;
  storageKey: string | null;
  evaluation: boolean;
  drawerOpen: boolean;
  hasEdits: () => boolean;
  onBegin: () => void;
  onEnd: (message: string) => void;
}

interface Run {
  scope: string;
  stepId: string;
  destination: string;
  resolving: boolean;
}

export function useWorkspaceOrientation({
  workspace, permissions, scope, storageKey, evaluation, drawerOpen, hasEdits, onBegin, onEnd,
}: Options) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const { openMobile, closeMobile, collapsed, toggle } = useSidebarCollapsed();
  const href = location.pathname + location.search;
  const chapters = useMemo(() => workspace ? workspaceOrientation(workspace, permissions) : [], [workspace, permissions]);
  const steps = useMemo(() => chapters.flatMap((chapter, chapterIndex) =>
    chapter.steps.map((step, stepIndex) => ({ chapter, chapterIndex, step, stepIndex })),
  ), [chapters]);
  const [run, setRun] = useState<Run | null>(null);
  const currentRun = workspace && run?.scope === scope ? run : null;
  const position = currentRun ? steps.findIndex(({ step }) => step.id === currentRun.stepId) : -1;
  const current = steps[position];
  const lastLocation = useRef(location.key);
  const samples = useRef<Partial<Record<OrientationSample, string>>>({});
  const expandedSidebar = useRef(false);
  const [memory, setMemory] = useState<{ scope: string; progress: OrientationProgress } | null>(null);

  const stored = drawerOpen && workspace && storageKey
    ? loadOrientationProgress(evaluation ? sessionStorage : localStorage, storageKey)
    : null;
  const saved = memory?.scope === scope ? memory.progress : stored;
  const resumeId = saved && "stepId" in saved && steps.some(({ step }) => step.id === saved.stepId)
    ? saved.stepId : null;
  const status: "new" | "paused" | "completed" = saved && "completed" in saved ? "completed" : resumeId ? "paused" : "new";

  function save(progress: OrientationProgress) {
    setMemory({ scope, progress });
    if (storageKey) saveOrientationProgress(evaluation ? sessionStorage : localStorage, storageKey, progress);
  }

  function readSample(sample: OrientationSample, route: string) {
    const key = sample === "advisee" ? "adviser-group-card" : sample === "defense" ? "panelist-open-session" : "css:[data-orientation-review]";
    const element = findGuideTarget(key);
    return orientationSamplePath(sample, element?.getAttribute("href") ?? element?.dataset.orientationHref ?? element?.dataset.orientationReview ?? null, route);
  }

  function routeToSample(path: string, section?: string) {
    return section ? path + "?section=" + encodeURIComponent(section) : path;
  }

  function go(index: number) {
    const item = steps[index];
    if (!item) return;
    if (hasEdits()) {
      close("Save or close your edited form before continuing the orientation.");
      return;
    }
    const { step } = item;
    const path = step.sample && (samples.current[step.sample] ??
      (matchesOrientationRoute(href, step.route) ? readSample(step.sample, step.route) : null));
    if (step.sample && path) samples.current[step.sample] = path;
    let destination = path ? routeToSample(path, step.section) : step.route;
    const activeUrl = new URL(href, "https://advisio.local");
    const nextUrl = new URL(destination, "https://advisio.local");
    if (workspace === "coordinator" && activeUrl.searchParams.get("tab") === "builder" &&
        nextUrl.searchParams.get("tab") === "builder") {
      const selectedWorkflow = activeUrl.searchParams.get("workflowId");
      if (selectedWorkflow) {
        nextUrl.searchParams.set("workflowId", selectedWorkflow);
        destination = nextUrl.pathname + nextUrl.search;
      }
    }
    lastLocation.current = location.key;
    setRun({ scope, stepId: step.id, destination, resolving: Boolean(step.sample && !path) });
    save({ stepId: step.id });
    onBegin();
    if (!matchesOrientationRoute(href, destination)) navigate(destination);
  }

  function close(message: string) {
    if (currentRun) {
      closeMobile();
      if (expandedSidebar.current && !collapsed) toggle();
      expandedSidebar.current = false;
    }
    setRun(null);
    onEnd(message);
  }

  function begin(resume = false) {
    if (!workspace || !steps.length || !scope) return;
    samples.current = {};
    go(resume && resumeId ? steps.findIndex(({ step }) => step.id === resumeId) : 0);
  }

  useEffect(() => {
    if (run && run.scope !== scope) {
      setRun(null);
      samples.current = {};
      if (expandedSidebar.current && !collapsed) toggle();
      expandedSidebar.current = false;
      closeMobile();
    }
  }, [scope]);

  useEffect(() => {
    if (location.key === lastLocation.current) return;
    lastLocation.current = location.key;
    if (currentRun && (navigationType === "POP" ||
      !matchesOrientationRoute(href, currentRun.destination))) {
      close("The orientation paused when you changed pages. Resume it from Guide.");
    }
  }, [location.key]);

  useEffect(() => {
    if (!currentRun || !current) return;
    if (current.step.prepare === "sidebar") {
      if (innerWidth < 1024) openMobile();
      else if (collapsed) {
        expandedSidebar.current = true;
        toggle();
      }
    } else closeMobile();
  }, [currentRun?.stepId]);

  useEffect(() => {
    const sample = current?.step.sample;
    if (!currentRun?.resolving || !sample || !current ||
        !matchesOrientationRoute(href, currentRun.destination)) return;
    const started = performance.now();
    let timer: ReturnType<typeof setTimeout>;
    const find = () => {
      const path = readSample(sample, current.step.route);
      if (path) {
        samples.current[sample] = path;
        const destination = routeToSample(path, current.step.section);
        setRun({ ...currentRun, destination, resolving: false });
        navigate(destination);
      } else if (performance.now() - started < 6000) {
        timer = setTimeout(find, 100);
      }
    };
    timer = setTimeout(find, 0);
    return () => clearTimeout(timer);
  }, [currentRun, current, href]);

  function finish() {
    save({ completed: true });
    close("Orientation finished. Choose a help topic for a specific task.");
  }

  const nextChapter = current && chapters[current.chapterIndex + 1];
  return {
    status,
    begin,
    active: currentRun && current ? {
      ...current,
      step: currentRun.resolving ? {
        ...current.step,
        targets: [],
        fallback: "There is no available record to show in this list yet. Retry when it loads, or continue to the next step.",
      } : current.step,
      chapterCount: chapters.length,
      nextChapter: current.stepIndex === current.chapter.steps.length - 1 ? nextChapter?.title : undefined,
      routeReady: matchesOrientationRoute(href, currentRun.destination),
      last: position === steps.length - 1,
      canGoBack: position > 0,
      next: () => position === steps.length - 1 ? finish() : go(position + 1),
      back: () => go(position - 1),
      skipChapter: () => nextChapter
        ? go(steps.findIndex(({ chapter }) => chapter.id === nextChapter.id))
        : finish(),
      exit: () => {
        close("Orientation paused. You can resume this step from Guide.");
        if (current.step.sample === "review") navigate(current.step.route, { replace: true });
      },
      retry: () => setRun({ ...currentRun }),
      finish,
    } : null,
  };
}
