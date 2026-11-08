import {
  canonicalizeRole,
  getEligibleWorkspaces,
  type DashboardWorkspaceId,
} from "@research-management/auth";
import type { UserProfile } from "@/providers/auth-provider";

export function eligibleTourWorkspace(
  user: Pick<UserProfile, "roles" | "college" | "collegeMemberships"> | null,
  pathname: string,
): DashboardWorkspaceId | null {
  if (!user) return null;
  let roles = user.roles;
  if (user.collegeMemberships?.length) {
    const membership = user.collegeMemberships.find(
      (entry) => entry.college.id === user.college?.id,
    );
    roles = [
      ...(membership?.roleNames || []),
      ...user.roles.filter((role) => canonicalizeRole(role) === "SYSTEM_ADMIN"),
    ];
  }
  return (
    getEligibleWorkspaces(roles).find(
      (workspace) =>
        pathname === workspace.routePrefix ||
        pathname.startsWith(workspace.routePrefix + "/"),
    )?.id || null
  );
}

export type TourProgress = "completed" | "dismissed";
export function readTourProgress(
  storage: Pick<Storage, "getItem">,
  key: string,
): TourProgress | null {
  try {
    const value = storage.getItem(key);
    return value === "completed" || value === "dismissed" ? value : null;
  } catch {
    return null;
  }
}
export function saveTourProgress(
  storage: Pick<Storage, "setItem">,
  key: string,
  progress: TourProgress,
) {
  try {
    storage.setItem(key, progress);
  } catch {
    /* Guidance remains usable when browser storage is unavailable. */
  }
}
