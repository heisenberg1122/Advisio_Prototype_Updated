import React, { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { makeQueryClient } from "@/lib/query/query-client";
import { usesDefaultAuthAppearance } from "@/lib/auth-appearance";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider, useAuth } from "./auth-provider";

function UserThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  return (
    <ThemeProvider
      useDefaultAppearance={usesDefaultAuthAppearance(pathname)}
      userId={user?.id}
      college={user?.college}
      program={user?.program}
      roles={user?.roles}
      appearancePreference={user?.appearancePreference}
      colorThemePreference={user?.colorThemePreference}
    >
      {children}
    </ThemeProvider>
  );
}

function SessionQueries({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const panel = pathname.split("/")[1] || "public";
  const scope = `${user?.id || "anonymous"}:${panel}`;
  const queryClient = useMemo(() => makeQueryClient(), [scope]);
  const previousClient = useRef(queryClient);
  useEffect(() => {
    if (previousClient.current !== queryClient) {
      void previousClient.current.cancelQueries();
      previousClient.current.clear();
      previousClient.current = queryClient;
    }
  }, [queryClient]);

  return (
    <QueryClientProvider key={scope} client={queryClient}>
      <UserThemeProvider>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </UserThemeProvider>
    </QueryClientProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider><SessionQueries>{children}</SessionQueries></AuthProvider>;
}

export { ThemeProvider, useTheme } from "./theme-provider";
export { AuthProvider, useAuth } from "./auth-provider";
export {
  DashboardWorkspaceProvider,
  useDashboardWorkspace,
  type DirtyFormEntry,
  type DashboardWorkspaceContextType,
} from "./dashboard-workspace-provider";
export {
  ActiveProjectProvider,
  useActiveProject,
  useActiveProjectContext,
} from "./active-project-provider";
