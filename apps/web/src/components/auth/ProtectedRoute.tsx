import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { AppShellSkeleton } from "@/components/ui/Skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AppShellSkeleton pathname={location.pathname} />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRoles = (user.roles || []).map((r) => r.toUpperCase());
    const hasRole = allowedRoles.some((role) =>
      userRoles.includes(role.toUpperCase())
    );

    if (!hasRole) {
      // Map user's first role to their designated home dashboard
      const primaryRole = (user.roles[0] || "RESEARCHER").toUpperCase();
      const roleHomeMap: Record<string, string> = {
        SYSTEM_ADMIN: "/system-admin/dashboard",
        ADMIN: "/admin/dashboard",
        RESEARCH_COORDINATOR: "/professor/dashboard",
        PROFESSOR: "/professor/dashboard",
        PANELIST: "/panelist/dashboard",
        ADVISER: "/adviser/dashboard",
        RESEARCHER: "/student/dashboard",
      };
      const fallbackUrl = roleHomeMap[primaryRole] || "/student/dashboard";
      return <Navigate to={fallbackUrl} replace />;
    }
  }

  return <>{children}</>;
}
