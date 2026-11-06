export interface NavigationDestination {
  href: string;
  tabName?: string;
  active?: boolean;
}

export function navigationItemActive(item: NavigationDestination, pathname: string, search: string): boolean {
  if (item.active !== undefined) return item.active;
  const [path, query = ""] = item.href.split("?");
  const targetPath = path.replace(/\/$/, "");
  const currentPath = pathname.replace(/\/$/, "");
  const targetTab = item.tabName || new URLSearchParams(query).get("tab");
  if (targetTab) {
    const tab = new URLSearchParams(search).get("tab") || "overview";
    return currentPath === targetPath && tab === targetTab;
  }
  return currentPath === targetPath || currentPath.startsWith(targetPath + "/");
}
