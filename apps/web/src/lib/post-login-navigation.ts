import {
  getEligibleWorkspaces,
  getSafeReturnWorkspace,
  getDefaultWorkspace,
  isSafeInternalUrl,
  type DashboardWorkspace,
} from "@research-management/auth";

export interface PostLoginResolutionInput {
  roles: string[];
  needsAcademicSetup?: boolean;
  returnUrl?: string | null;
  rememberedWorkspaceId?: string | null;
  userId?: string | null;
}

export type PostLoginAction =
  | { type: "ACADEMIC_SETUP"; url: "/google-onboarding" }
  | {
      type: "NO_ROLE";
      url: "/choose-dashboard?state=no-role";
      eligibleWorkspaces: [];
    }
  | {
      type: "SINGLE_ROLE";
      url: string;
      workspace: DashboardWorkspace;
      resumedReturnUrl: boolean;
    }
  | {
      type: "CHOOSE_DASHBOARD";
      url: string;
      eligibleWorkspaces: DashboardWorkspace[];
      preselectedWorkspace: DashboardWorkspace;
      safeReturnUrl?: string;
    };

export function resolvePostLoginAction(
  input: PostLoginResolutionInput
): PostLoginAction {
  if (input.needsAcademicSetup) {
    return { type: "ACADEMIC_SETUP", url: "/google-onboarding" };
  }

  const eligibleWorkspaces = getEligibleWorkspaces(input.roles);

  if (eligibleWorkspaces.length === 0) {
    return {
      type: "NO_ROLE",
      url: "/choose-dashboard?state=no-role",
      eligibleWorkspaces: [],
    };
  }

  const safeReturn = isSafeInternalUrl(input.returnUrl)
    ? input.returnUrl!
    : undefined;
  const returnWorkspace = safeReturn
    ? getSafeReturnWorkspace(safeReturn, eligibleWorkspaces)
    : null;

  if (eligibleWorkspaces.length === 1) {
    const singleWorkspace = eligibleWorkspaces[0];
    if (safeReturn && returnWorkspace && returnWorkspace.id === singleWorkspace.id) {
      return {
        type: "SINGLE_ROLE",
        url: safeReturn,
        workspace: singleWorkspace,
        resumedReturnUrl: true,
      };
    }
    return {
      type: "SINGLE_ROLE",
      url: singleWorkspace.homeUrl,
      workspace: singleWorkspace,
      resumedReturnUrl: false,
    };
  }

  // Multi-role (>= 2)
  const preselected =
    returnWorkspace ||
    getDefaultWorkspace(eligibleWorkspaces, input.rememberedWorkspaceId) ||
    eligibleWorkspaces[0];

  const params = new URLSearchParams();
  if (safeReturn) {
    params.set("returnUrl", safeReturn);
  }
  const queryString = params.toString() ? `?${params.toString()}` : "";

  return {
    type: "CHOOSE_DASHBOARD",
    url: `/choose-dashboard${queryString}`,
    eligibleWorkspaces,
    preselectedWorkspace: preselected,
    safeReturnUrl: safeReturn,
  };
}

const ONBOARDING_COMPLETED_KEY_PREFIX = "advisio_dashboard_onboarding_completed_";
const REMEMBERED_WORKSPACE_KEY_PREFIX = "advisio_workspace_preference_";

export function getRememberedWorkspaceId(userId?: string | null): string | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    return localStorage.getItem(`${REMEMBERED_WORKSPACE_KEY_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

export function setRememberedWorkspaceId(userId: string, workspaceId: string): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(`${REMEMBERED_WORKSPACE_KEY_PREFIX}${userId}`, workspaceId);
  } catch {}
}

export function clearRememberedWorkspaceId(userId: string): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${REMEMBERED_WORKSPACE_KEY_PREFIX}${userId}`);
  } catch {}
}

export function isOnboardingCompletedInSession(userId?: string | null): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    return (
      sessionStorage.getItem(`${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`) ===
      "true"
    );
  } catch {
    return false;
  }
}

export function markOnboardingCompletedInSession(userId: string): void {
  if (!userId || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`, "true");
  } catch {}
}

export function resetOnboardingForSession(userId?: string | null): void {
  if (!userId || typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(`${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`);
  } catch {}
}
