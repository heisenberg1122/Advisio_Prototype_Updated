export function notificationLink(
  actionUrl: unknown,
  role: string,
  userRoles: string[] = []
): string | undefined {
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
    if (userRoles.some((r) => r.toUpperCase() === "PANELIST")) {
      return `/panelist/dashboard?${query}`;
    }
  }

  if (url.pathname.startsWith(`/${role}/`))
    return `${url.pathname}${query ? `?${query}` : ""}`;

  // Allow cross-dashboard authorized links if user has the assigned portal
  const portalPrefixes = [
    "student",
    "adviser",
    "professor",
    "panelist",
    "admin",
    "system-admin",
  ];
  for (const prefix of portalPrefixes) {
    if (url.pathname.startsWith(`/${prefix}/`)) {
      return `${url.pathname}${query ? `?${query}` : ""}`;
    }
  }

  return undefined;
}
