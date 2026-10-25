import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { AppShellSkeleton } from "@/components/ui/Skeleton";
import {
  getEligibleWorkspaces,
  canonicalizeRole,
} from "@research-management/auth";
import {
  isOnboardingCompletedInSession,
  getRememberedWorkspaceId,
} from "@/lib/post-login-navigation";
import { resolveFallbackDestination } from "@/lib/dashboard-navigation";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated, sessionError, retrySession, logout } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AppShellSkeleton pathname={location.pathname} />;
  }

  if (sessionError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="max-w-md space-y-4 rounded-2xl border bg-white p-6 text-slate-800">
          <h1 className="text-2xl font-bold">Unable to load your session</h1>
          <p role="alert">{sessionError}</p>
          <button
            onClick={retrySession}
            className="rounded-lg bg-blue-700 px-4 py-2 text-white cursor-pointer"
          >
            Try again
          </button>
          <button
            onClick={logout}
            className="ml-3 rounded-lg border px-4 py-2 cursor-pointer"
          >
            Sign out
          </button>
        </section>
      </main>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const eligibleWorkspaces = getEligibleWorkspaces(user.roles || []);

  // Zero authorized roles
  if (eligibleWorkspaces.length === 0) {
    return <Navigate to="/choose-dashboard?state=no-role" replace />;
  }

  // Multi-role onboarding guard: newly signed-in accounts with 2+ roles must choose starting dashboard
  if (eligibleWorkspaces.length >= 2 && !isOnboardingCompletedInSession(user.id)) {
    return <Navigate to="/choose-dashboard" state={{ from: location }} replace />;
  }

  // Role authorization guard for specific portal routes
  if (allowedRoles && allowedRoles.length > 0) {
    const userCanonicalRoles = new Set(
      (user.roles || []).map((r) => canonicalizeRole(r)).filter(Boolean)
    );
    const hasRole = allowedRoles.some((role) => {
      const canonical = canonicalizeRole(role);
      return canonical ? userCanonicalRoles.has(canonical) : false;
    });

    if (!hasRole) {
      const remembered = getRememberedWorkspaceId(user.id);
      const fallbackUrl = resolveFallbackDestination(user.roles || [], remembered);
      return <Navigate to={fallbackUrl} replace />;
    }
  }

  return <>{children}</>;
}
