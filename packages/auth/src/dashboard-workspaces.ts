import { InstitutionalRoles, type InstitutionalRole } from "./roles.js";

export type DashboardWorkspaceId =
  | "researcher"
  | "adviser"
  | "panelist"
  | "coordinator"
  | "dean"
  | "system-admin";

export interface DashboardWorkspace {
  readonly id: DashboardWorkspaceId;
  readonly role: InstitutionalRole;
  readonly label: string;
  readonly description: string;
  readonly homeUrl: string;
  readonly routePrefix: string;
  readonly order: number;
}

export const DASHBOARD_WORKSPACES: readonly DashboardWorkspace[] = [
  {
    id: "researcher",
    role: InstitutionalRoles.RESEARCHER,
    label: "Researcher",
    description: "Undergraduate student authoring thesis or capstone deliverables, tasks, and defense presentations",
    homeUrl: "/student/dashboard",
    routePrefix: "/student",
    order: 1,
  },
  {
    id: "adviser",
    role: InstitutionalRoles.ADVISER,
    label: "Adviser",
    description: "Faculty research adviser guiding student groups, reviews, and endorsements",
    homeUrl: "/adviser/dashboard",
    routePrefix: "/adviser",
    order: 2,
  },
  {
    id: "panelist",
    role: InstitutionalRoles.PANELIST,
    label: "Panelist",
    description: "Defense committee evaluator reviewing manuscripts and scoring oral defenses",
    homeUrl: "/panelist/dashboard",
    routePrefix: "/panelist",
    order: 3,
  },
  {
    id: "coordinator",
    role: InstitutionalRoles.RESEARCH_COORDINATOR,
    label: "Professor Coordinator",
    description: "Program or college research coordinator managing workflows, schedules, and approvals",
    homeUrl: "/professor/dashboard",
    routePrefix: "/professor",
    order: 4,
  },
  {
    id: "dean",
    role: InstitutionalRoles.DEAN,
    label: "Dean's Office",
    description: "College research oversight and administration",
    homeUrl: "/admin/dashboard?workspace=dean",
    routePrefix: "/admin",
    order: 5,
  },
  {
    id: "system-admin",
    role: InstitutionalRoles.SYSTEM_ADMIN,
    label: "System Administration",
    description: "Platform administrator configuring accounts, permissions, and system settings",
    homeUrl: "/system-admin/dashboard",
    routePrefix: "/system-admin",
    order: 6,
  },
] as const;

export const LEGACY_ROLE_ALIASES: Record<string, InstitutionalRole> = {
  STUDENT: InstitutionalRoles.RESEARCHER,
  PROFESSOR: InstitutionalRoles.RESEARCH_COORDINATOR,
  ADMIN: InstitutionalRoles.DEAN,
};

export function canonicalizeRole(rawRole: string | null | undefined): InstitutionalRole | null {
  if (!rawRole || typeof rawRole !== "string") return null;
  const normalized = rawRole.trim().toUpperCase();

  const standardRoles = Object.values(InstitutionalRoles) as string[];
  if (standardRoles.includes(normalized)) {
    return normalized as InstitutionalRole;
  }

  if (normalized in LEGACY_ROLE_ALIASES) {
    return LEGACY_ROLE_ALIASES[normalized];
  }

  return null;
}

export function getEligibleWorkspaces(roles: (string | InstitutionalRole)[] = []): DashboardWorkspace[] {
  if (!Array.isArray(roles) || roles.length === 0) return [];

  const canonicalSet = new Set<InstitutionalRole>();
  for (const role of roles) {
    const canonical = canonicalizeRole(role);
    if (canonical) {
      canonicalSet.add(canonical);
    }
  }

  return DASHBOARD_WORKSPACES.filter((workspace) => canonicalSet.has(workspace.role));
}

export function getWorkspaceById(id: string | null | undefined): DashboardWorkspace | null {
  if (!id || typeof id !== "string") return null;
  const trimmed = id.trim().toLowerCase();
  return DASHBOARD_WORKSPACES.find((w) => w.id === trimmed) ?? null;
}

export function getWorkspaceForRole(role: string | null | undefined): DashboardWorkspace | null {
  const canonical = canonicalizeRole(role);
  if (!canonical) return null;
  return DASHBOARD_WORKSPACES.find((w) => w.role === canonical) ?? null;
}

export function resolveWorkspaceFromPath(
  pathname: string,
  search = ""
): DashboardWorkspace | null {
  if (!pathname || typeof pathname !== "string") return null;

  if (pathname.startsWith("/student")) return getWorkspaceById("researcher");
  if (pathname.startsWith("/adviser")) return getWorkspaceById("adviser");
  if (pathname.startsWith("/panelist")) return getWorkspaceById("panelist");
  if (pathname.startsWith("/professor")) return getWorkspaceById("coordinator");
  if (pathname.startsWith("/system-admin")) return getWorkspaceById("system-admin");

  if (pathname.startsWith("/admin")) {
    const params = new URLSearchParams(search);
    const workspaceQuery = params.get("workspace")?.toLowerCase();

    if (workspaceQuery === "dean") {
      return getWorkspaceById("dean");
    }

    return null;
  }

  return null;
}

export function getCanonicalAdminUrl(
  workspaceId: string | null | undefined,
  basePath = "/admin/dashboard"
): string {
  const [pathname, rawSearch] = basePath.split("?");
  const searchParams = new URLSearchParams(rawSearch || "");

  let resolvedWorkspace = "dean";
  if (workspaceId === "dean") resolvedWorkspace = "dean";

  searchParams.set("workspace", resolvedWorkspace);
  return `${pathname}?${searchParams.toString()}`;
}

export function isSafeInternalUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();

  // Must start with single slash, not protocol-relative or backslash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return false;
  }

  // Reject javascript:, data:, or protocol indicators
  if (/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return false;
  }

  const [pathOnly] = trimmed.split(/[?#]/);

  // Reject public authentication pages
  const forbiddenPaths = [
    "/login",
    "/register",
    "/choose-dashboard",
    "/first-login-setup",
    "/google-onboarding",
    "/forgot-password",
    "/reset-password",
    "/researcher-onboarding",
  ];
  if (forbiddenPaths.includes(pathOnly)) {
    return false;
  }

  return true;
}

export function getSafeReturnWorkspace(
  returnUrl: string | null | undefined,
  eligibleWorkspaces: DashboardWorkspace[]
): DashboardWorkspace | null {
  if (!isSafeInternalUrl(returnUrl) || !returnUrl) return null;

  const urlObj = new URL(returnUrl, "http://localhost");
  const workspace = resolveWorkspaceFromPath(urlObj.pathname, urlObj.search);
  if (workspace && eligibleWorkspaces.some((w) => w.id === workspace.id)) {
    return workspace;
  }

  // If returnUrl is /admin/* without explicit workspace query param, match any eligible admin workspace
  if (urlObj.pathname.startsWith("/admin")) {
    const adminWorkspace = eligibleWorkspaces.find((w) =>
      ["dean"].includes(w.id)
    );
    if (adminWorkspace) {
      return adminWorkspace;
    }
  }

  return null;
}

export function getDefaultWorkspace(
  eligibleWorkspaces: DashboardWorkspace[],
  rememberedId?: string | null
): DashboardWorkspace | null {
  if (!eligibleWorkspaces || eligibleWorkspaces.length === 0) return null;

  if (rememberedId) {
    const matched = eligibleWorkspaces.find((w) => w.id === rememberedId);
    if (matched) return matched;
  }

  return eligibleWorkspaces[0] ?? null;
}
