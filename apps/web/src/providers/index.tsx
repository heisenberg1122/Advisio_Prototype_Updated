import React, { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { makeQueryClient } from "@/lib/query/query-client";
import { usesDefaultAuthAppearance } from "@/lib/auth-appearance";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider, useAuth } from "./auth-provider";

function UserThemeProvider({ children }: { children: ReactNode }) {
  const { user, token, isLoading } = useAuth();
  const { pathname } = useLocation();

  return (
    <ThemeProvider
      useDefaultAppearance={usesDefaultAuthAppearance(pathname, Boolean(token) && (isLoading || Boolean(user)))}
      userId={user?.id}
      college={user?.college}
      program={user?.program}
      roles={user?.roles}
      appearancePreference={user?.appearancePreference}
      colorThemePreference={user?.colorThemePreference}
      headingFontPreference={user?.headingFontPreference}
    >
      {children}
    </ThemeProvider>
  );
}

function SessionQueries({ children }: { children: ReactNode }) {
  const { user, isSwitchingCollege } = useAuth();
  const { pathname } = useLocation();
  const panel = pathname.split("/")[1] || "public";
  const scope = `${user?.id || "anonymous"}:${user?.college?.id || "unassigned"}:${(user?.roles || []).join(",")}:${panel}`;
  const queryClient = useMemo(() => makeQueryClient(), [scope]);
  const previousClient = useRef(queryClient);
  useEffect(() => {
    if (previousClient.current !== queryClient) {
      void previousClient.current.cancelQueries();
      previousClient.current.clear();
      previousClient.current = queryClient;
    }
  }, [queryClient]);
  useEffect(() => () => { void queryClient.cancelQueries(); queryClient.clear(); }, [queryClient]);

  return (
    <QueryClientProvider key={scope} client={queryClient}>
      {isSwitchingCollege && <div role="status" className="fixed inset-0 z-[1000] grid place-items-center bg-[var(--color-background)] text-[var(--color-text-secondary)]">Switching college…</div>}
      {children}
      {import.meta.env.DEV && import.meta.env.VITE_QUERY_DEVTOOLS === "true" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider><UserThemeProvider><SessionQueries>{children}</SessionQueries></UserThemeProvider></AuthProvider>;
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
