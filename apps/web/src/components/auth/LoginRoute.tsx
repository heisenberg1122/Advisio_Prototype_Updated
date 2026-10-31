import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import {
  getRememberedWorkspaceId,
  isOnboardingCompletedInSession,
  resolvePostLoginAction,
} from "@/lib/post-login-navigation";

export function LoginRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--color-background)] text-[var(--color-text-primary)]">
        <p role="status">Restoring your session…</p>
      </main>
    );
  }

  if (!isAuthenticated || !user) return <>{children}</>;

  const action = resolvePostLoginAction({
    roles: user.roles,
    rememberedWorkspaceId: getRememberedWorkspaceId(user.id),
  });
  const destination =
    action.type === "CHOOSE_DASHBOARD" &&
    isOnboardingCompletedInSession(user.id)
      ? action.preselectedWorkspace.homeUrl
      : action.url;

  // Replace stale login entries reached through Back or a saved login link.
  return <Navigate to={destination} replace />;
}
