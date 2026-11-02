/** Classify the page before its data or lazy content has loaded. */
export function workspaceViewForLocation(
  pathname: string,
  search = "",
): "overview" | "page" {
  const isDashboard =
    pathname === "/dashboard" ||
    /^\/(student|adviser|professor|panelist|admin|system-admin)(\/dashboard)?\/?$/.test(
      pathname,
    );
  const tab = new URLSearchParams(search).get("tab");
  return isDashboard && (!tab || tab === "overview") ? "overview" : "page";
}
