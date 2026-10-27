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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  resolveActiveProject,
  withProjectContext,
  type ProjectOption,
} from "@/lib/active-project";

type ActiveProjectContextValue = {
  activeProjectId: string | null;
  requestedProjectId: string | null;
  authorizedProjectIds: string[] | null;
  selectProject: (projectId: string | null, options?: { replace?: boolean }) => void;
  projectHref: (path: string, projectId?: string | null) => string;
};

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const panel = location.pathname.split("/")[1] || "public";
  const researcherPanel = panel === "student";
  const projectsQuery = useQuery({
    queryKey: ["student-research"],
    queryFn: () => apiClient.get<{ projects: ProjectOption[] }>("/api/research", {
      headers: { "X-Advisio-Panel": "researcher" },
    }),
    enabled: researcherPanel && Boolean(user?.id),
    refetchOnWindowFocus: true,
    refetchInterval: researcherPanel ? 5000 : false,
  });
  const requestedProjectId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("projectId") || params.get("researchId");
  }, [location.search]);
  const storageKey = user?.id ? `advisio:active-project:${user.id}:${panel}` : null;
  const [storedProjectId, setStoredProjectId] = useState<string | null>(null);

  useEffect(() => {
    setStoredProjectId(storageKey ? localStorage.getItem(storageKey) : null);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    if (researcherPanel && !projectsQuery.isSuccess) return;
    const candidate = requestedProjectId || storedProjectId;
    const allowed = !researcherPanel || projectsQuery.data?.projects.some(({ id }) => id === candidate);
    if (candidate && allowed) {
      localStorage.setItem(storageKey, candidate);
      setStoredProjectId(candidate);
    } else if (candidate) {
      localStorage.removeItem(storageKey);
      setStoredProjectId(null);
    }
  }, [requestedProjectId, storedProjectId, storageKey, researcherPanel, projectsQuery.isSuccess, projectsQuery.data]);

  const candidateId = requestedProjectId || storedProjectId;
  const validatedProjectId = researcherPanel
    ? projectsQuery.isSuccess && projectsQuery.data.projects.some(({ id }) => id === candidateId) ? candidateId : null
    : candidateId;

  const selectProject = useCallback(
    (projectId: string | null, options?: { replace?: boolean }) => {
      const currentProjects = queryClient.getQueryData<{ projects: ProjectOption[] }>(["student-research"]);
      if (projectId && researcherPanel && !currentProjects?.projects.some(({ id }) => id === projectId)) return;
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
    [location.pathname, location.search, navigate, storageKey, researcherPanel, queryClient],
  );

  const value = useMemo<ActiveProjectContextValue>(
    () => ({
      activeProjectId: validatedProjectId,
      requestedProjectId,
      authorizedProjectIds: researcherPanel ? (projectsQuery.isSuccess ? projectsQuery.data.projects.map(({ id }) => id) : []) : null,
      selectProject,
      projectHref: (path, projectId) =>
        withProjectContext(path, projectId === undefined ? validatedProjectId : projectId),
    }),
    [requestedProjectId, selectProject, validatedProjectId, researcherPanel, projectsQuery.isSuccess, projectsQuery.data],
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
    context.authorizedProjectIds === null ? projects : projects.filter(({ id }) => context.authorizedProjectIds!.includes(id)),
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
