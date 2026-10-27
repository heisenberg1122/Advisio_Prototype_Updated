import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveProjectContext } from "@/providers/active-project-provider";
import {
  resolveResearcherLifecycle,
  type ResearchCohortOption,
  type ResearchTeamOption,
} from "@/lib/researcher-lifecycle";

export async function loadResearcherCohorts() {
  const cohorts: ResearchCohortOption[] = [];
  for (let page = 1; ; page++) {
    const result = await apiClient.get<{
      cohorts: ResearchCohortOption[];
      pagination: { totalPages: number };
    }>("/api/cohorts", { params: { page, limit: 100 } });
    cohorts.push(...result.cohorts);
    if (page >= result.pagination.totalPages) return { cohorts };
  }
}

export function useResearcherLifecycle() {
  const client = useQueryClient();
  const { user } = useAuth();
  const context = useActiveProjectContext();
  const [params, setParams] = useSearchParams();
  const research = useQuery({
    queryKey: ["student-research"],
    queryFn: () => apiClient.get<{ projects: any[] }>("/api/research"),
    enabled: Boolean(user),
    refetchInterval: 5000,
  });
  const teams = useQuery({
    queryKey: ["student-workspaces"],
    queryFn: () =>
      apiClient.get<{ workspaces: ResearchTeamOption[] }>("/api/workspaces/me"),
    enabled: Boolean(user),
    refetchInterval: 5000,
  });
  const cohorts = useQuery({
    queryKey: ["student-cohorts"],
    queryFn: loadResearcherCohorts,
    enabled: Boolean(user),
    refetchInterval: 15000,
  });
  const model = resolveResearcherLifecycle({
    cohorts: cohorts.data?.cohorts || [],
    teams: teams.data?.workspaces || [],
    projects: research.data?.projects || [],
    userId: user?.id,
    cohortId: params.get("cohortId"),
    workspaceId: params.get("workspaceId"),
    requestedProjectId: context.requestedProjectId,
    projectId: context.activeProjectId,
  });
  useEffect(() => {
    if (
      !context.requestedProjectId &&
      model.project?.id &&
      model.project.id !== context.activeProjectId
    )
      context.selectProject(model.project.id, { replace: true });
  }, [
    context.requestedProjectId,
    context.activeProjectId,
    context.selectProject,
    model.project?.id,
  ]);
  function chooseContext(cohortId: string, workspaceId?: string) {
    const currentCohorts = client.getQueryData<{
      cohorts: ResearchCohortOption[];
    }>(["student-cohorts"]);
    const currentTeams = client.getQueryData<{
      workspaces: ResearchTeamOption[];
    }>(["student-workspaces"]);
    if (
      !currentCohorts?.cohorts.some(
        (cohort) => cohort.id === cohortId && cohort.status === "ACTIVE",
      )
    )
      return;
    if (
      workspaceId &&
      !currentTeams?.workspaces.some(
        (team) => team.id === workspaceId && team.cohortId === cohortId,
      )
    )
      return;
    context.selectProject(null, { replace: true });
    const next = new URLSearchParams(params);
    for (const key of ["projectId", "researchId", "workflowId", "workspaceId"])
      next.delete(key);
    next.set("cohortId", cohortId);
    if (workspaceId) next.set("workspaceId", workspaceId);
    setParams(next, { replace: true });
  }
  return {
    ...model,
    user,
    research,
    teams,
    cohorts,
    chooseContext,
    selectCase: context.selectProject,
    projectSelection: {
      ...context,
      project: model.project,
      projectId: model.project?.id || null,
      invalidRequestedProjectId:
        context.requestedProjectId && !model.project
          ? context.requestedProjectId
          : null,
      requiresSelection: model.state === "SELECT_CASE",
    },
    loading:
      research.isPending ||
      (!model.project && (teams.isPending || cohorts.isPending)),
    error:
      research.isError ||
      (!model.project && (teams.isError || cohorts.isError)),
    retry: () =>
      Promise.all([research.refetch(), teams.refetch(), cohorts.refetch()]),
  };
}
