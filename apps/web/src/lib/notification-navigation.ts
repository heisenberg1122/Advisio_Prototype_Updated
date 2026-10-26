import {
  getEligibleWorkspaces,
  isSafeInternalUrl,
} from "@research-management/auth";

export function adviserRequestNotificationLink(entityId: unknown): string {
  return typeof entityId === "string" && entityId
    ? `/adviser/dashboard?requestId=${encodeURIComponent(entityId)}`
    : "/adviser/dashboard";
}

export function notificationLink(
  actionUrl: unknown,
  role: string,
  userRoles: string[] = [],
): string | undefined {
  if (typeof actionUrl !== "string" || !isSafeInternalUrl(actionUrl))
    return undefined;
  const url = new URL(actionUrl, "https://advisio.local");
  const query = url.searchParams.toString();
  if (url.pathname.startsWith("/research/manuscript")) {
    if (role === "student")
      return `/student/documents${query ? `?${query}` : ""}`;
    if (["adviser", "professor", "panelist", "admin"].includes(role))
      return `/${role}/reviews${query ? `?${query}` : ""}`;
    return undefined;
  }
  if (url.pathname.startsWith("/defense/session")) {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) return undefined;
    if (role === "student") {
      const params = new URLSearchParams();
      const projectId = url.searchParams.get("projectId");
      if (projectId) params.set("projectId", projectId);
      return `/student/defense/${encodeURIComponent(sessionId)}${params.size ? `?${params}` : ""}`;
    }
    if (role === "panelist") return `/panelist/dashboard?${query}`;
    if (role === "professor" || role === "admin")
      return `/${role}/dashboard?tab=defenses&${query}`;
    return undefined;
  }
  const eligiblePrefixes = new Set(
    getEligibleWorkspaces(userRoles).map((workspace) => workspace.routePrefix),
  );
  const prefix = `/${url.pathname.split("/")[1]}`;
  if (!eligiblePrefixes.has(prefix) && prefix !== `/${role}`) return undefined;
  if (
    ![
      "/student",
      "/adviser",
      "/professor",
      "/panelist",
      "/admin",
      "/system-admin",
    ].includes(prefix)
  )
    return undefined;
  if (prefix === "/admin") {
    const workspace = url.searchParams.get("workspace");
    if (workspace && workspace !== "dean") return undefined;
    url.searchParams.set("workspace", "dean");
  }
  return `${url.pathname}${url.searchParams.size ? `?${url.searchParams}` : ""}`;
}
