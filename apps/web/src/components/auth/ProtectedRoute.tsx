import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#080e18]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1b4264] dark:border-[#ffa400] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Verifying session...</p>
        </div>
      </div>
    );
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
