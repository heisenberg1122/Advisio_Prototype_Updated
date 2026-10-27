import type { QueryClient } from "@tanstack/react-query";
import { apiClient } from "./api-client";
import type { ResearchTeamOption } from "./researcher-lifecycle";

export const researcherContextKeys = [
  ["student-cohorts"],
  ["student-workspaces"],
  ["student-research"],
  ["student-workflow-enrollments"],
  ["student"],
  ["student-manuscript-workflow"],
  ["student-dashboard-documents"],
  ["workflow-access-me"],
  ["workflow-resources"],
  ["task-submission-options"],
] as const;

export async function refreshResearcherContext(client: QueryClient) {
  await Promise.all(
    researcherContextKeys.map((queryKey) =>
      client.invalidateQueries({ queryKey }),
    ),
  );
}

export async function createResearchTeam(
  client: QueryClient,
  input: {
    cohortId: string;
    name: string;
    participationMode: "SOLO" | "GROUP";
    accessMode: "INVITE_ONLY" | "PUBLIC_OPEN";
  },
) {
  // Deliberately no academic registration metadata or case creation here.
  const { workspace } = await apiClient.post<{ workspace: ResearchTeamOption }>(
    "/api/workspaces",
    input,
  );
  client.setQueryData<{ workspaces: ResearchTeamOption[] }>(
    ["student-workspaces"],
    (old) => ({
      workspaces: [
        ...(old?.workspaces || []).filter((team) => team.id !== workspace.id),
        workspace,
      ],
    }),
  );
  await refreshResearcherContext(client);
  return workspace;
}

export async function startTeamResearch(
  client: QueryClient,
  workspaceId: string,
) {
  const result = await apiClient.post<{
    project: { id: string; [key: string]: any };
    workflowInstance: { id: string; workflowId: string; [key: string]: any };
    created: boolean;
  }>(`/api/workspaces/${encodeURIComponent(workspaceId)}/start-research`);
  client.setQueryData<{ projects: any[] }>(["student-research"], (old) => {
    const existing = old?.projects.find(
      (project) => project.id === result.project.id,
    );
    const project = {
      ...existing,
      ...result.project,
      workflowInstance: {
        ...existing?.workflowInstance,
        ...result.workflowInstance,
      },
    };
    return {
      projects: [
        ...(old?.projects || []).filter((item) => item.id !== project.id),
        project,
      ],
    };
  });
  await refreshResearcherContext(client);
  return result;
}

export async function joinResearchTeam(client: QueryClient, code: string) {
  const result = await apiClient.post<{ workspace: ResearchTeamOption }>(
    `/api/workspaces/join/${encodeURIComponent(code.trim().toUpperCase())}`,
  );
  await refreshResearcherContext(client);
  return result;
}
