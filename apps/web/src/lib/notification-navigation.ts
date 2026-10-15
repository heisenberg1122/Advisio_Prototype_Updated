export function notificationLink(actionUrl: unknown, role: string) {
  if (typeof actionUrl !== "string") return undefined;
  const url = new URL(actionUrl, "https://advisio.local");
  const query = url.searchParams.toString();
  if (url.pathname.startsWith("/research/manuscript")) {
    if (role === "student") return `/student/documents${query ? `?${query}` : ""}`;
    if (["adviser", "professor", "panelist", "admin"].includes(role))
      return `/${role}/reviews${query ? `?${query}` : ""}`;
  }
  if (url.pathname.startsWith("/defense/session")) {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) return undefined;
    if (role === "student") {
      const params = new URLSearchParams();
      const projectId = url.searchParams.get("projectId");
      if (projectId) params.set("projectId", projectId);
      return `/student/defense/${sessionId}${params.size ? `?${params}` : ""}`;
    }
    if (role === "panelist") return `/panelist/dashboard?${query}`;
  }
  if (url.pathname.startsWith(`/${role}/`))
    return `${url.pathname}${query ? `?${query}` : ""}`;
  return undefined;
}
