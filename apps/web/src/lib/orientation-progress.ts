import type { OrientationSample } from "./workspace-orientation";

export const orientationProgressKey = (introductionKey: string) =>
  introductionKey + ":orientation-v1";

export type OrientationProgress = { stepId: string } | { completed: true };

export function loadOrientationProgress(storage: Pick<Storage, "getItem">, key: string) {
  try {
    const saved: unknown = JSON.parse(storage.getItem(key) ?? "null");
    if (!saved || typeof saved !== "object") return null;
    if ("completed" in saved && saved.completed === true) return { completed: true } as const;
    if ("stepId" in saved && typeof saved.stepId === "string") return { stepId: saved.stepId };
  } catch {
    // Guidance is still available if browser storage is restricted.
  }
  return null;
}

export function saveOrientationProgress(
  storage: Pick<Storage, "setItem">,
  key: string,
  progress: OrientationProgress,
) {
  try {
    storage.setItem(key, JSON.stringify(progress));
  } catch {
    // The running orientation can still finish in this tab.
  }
}

const defaults = {
  tab: "overview",
  section: "overview",
  workflowView: "milestones",
  submissionView: "review",
  workspace: "",
  orientation: "",
  orientationReview: "",
};

export function matchesOrientationRoute(current: string, destination: string) {
  const actual = new URL(current, "https://advisio.local");
  const expected = new URL(destination, "https://advisio.local");
  return actual.pathname === expected.pathname &&
    Object.entries(defaults).every(([key, fallback]) =>
      (actual.searchParams.get(key) ?? fallback) === (expected.searchParams.get(key) ?? fallback),
    );
}

export function orientationSamplePath(sample: OrientationSample, href: string | null, route: string) {
  if (sample === "review") {
    const url = new URL(route, "https://advisio.local");
    if (url.origin !== "https://advisio.local" || !/^\/(adviser|panelist|professor|admin)\/reviews$/.test(url.pathname) ||
        !href || !/^[a-zA-Z0-9_-]{1,100}$/.test(href)) return null;
    url.searchParams.set("orientationReview", href);
    return url.pathname + url.search;
  }
  const prefix = sample === "advisee" ? "/adviser/advisees/" : "/panelist/defenses/";
  // Destinations are taken from a visible, permitted record on the list view.
  // Exclude arbitrary query strings, encoded segments and external destinations.
  if (!href?.startsWith(prefix) || !/^[a-zA-Z0-9_-]{1,100}$/.test(href.slice(prefix.length))) return null;
  return href;
}
