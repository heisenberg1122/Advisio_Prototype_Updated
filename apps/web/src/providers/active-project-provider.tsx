import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./auth-provider";
import {
  resolveActiveProject,
  withProjectContext,
  type ProjectOption,
} from "@/lib/active-project";

type ActiveProjectContextValue = {
  activeProjectId: string | null;
  requestedProjectId: string | null;
  selectProject: (projectId: string | null, options?: { replace?: boolean }) => void;
  projectHref: (path: string, projectId?: string | null) => string;
};

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedProjectId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("projectId") || params.get("researchId");
  }, [location.search]);
  const storageKey = user?.id ? `advisio:active-project:${user.id}` : null;
  const [storedProjectId, setStoredProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    setStoredProjectId(localStorage.getItem(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!requestedProjectId || !storageKey) return;
    localStorage.setItem(storageKey, requestedProjectId);
    setStoredProjectId(requestedProjectId);
  }, [requestedProjectId, storageKey]);

  const selectProject = useCallback(
    (projectId: string | null, options?: { replace?: boolean }) => {
      if (storageKey) {
        if (projectId) localStorage.setItem(storageKey, projectId);
        else localStorage.removeItem(storageKey);
      }
      setStoredProjectId(projectId);
      const params = new URLSearchParams(location.search);
      params.delete("researchId");
      if (projectId) params.set("projectId", projectId);
      else params.delete("projectId");
      const search = params.toString();
      navigate(`${location.pathname}${search ? `?${search}` : ""}`, {
        replace: options?.replace,
      });
    },
    [location.pathname, location.search, navigate, storageKey],
  );

  const value = useMemo<ActiveProjectContextValue>(
    () => ({
      activeProjectId: requestedProjectId || storedProjectId,
      requestedProjectId,
      selectProject,
      projectHref: (path, projectId) =>
        withProjectContext(path, projectId === undefined ? requestedProjectId || storedProjectId : projectId),
    }),
    [requestedProjectId, selectProject, storedProjectId],
  );

  return <ActiveProjectContext.Provider value={value}>{children}</ActiveProjectContext.Provider>;
}

export function useActiveProjectContext() {
  const context = useContext(ActiveProjectContext);
  if (!context) throw new Error("useActiveProjectContext must be used inside ActiveProjectProvider");
  return context;
}

export function useActiveProject<T extends ProjectOption>(projects: T[]) {
  const context = useActiveProjectContext();
  const resolution = resolveActiveProject(
    projects,
    context.requestedProjectId,
    context.activeProjectId,
  );

  const { activeProjectId, requestedProjectId, selectProject } = context;
  useEffect(() => {
    if (!requestedProjectId && resolution.projectId && resolution.projectId !== activeProjectId)
      selectProject(resolution.projectId, { replace: true });
  }, [activeProjectId, requestedProjectId, resolution.projectId, selectProject]);

  return { ...context, ...resolution };
}
