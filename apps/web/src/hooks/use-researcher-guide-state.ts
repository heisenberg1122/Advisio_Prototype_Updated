import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useActiveProjectContext } from "@/providers/active-project-provider";
import { useLocation } from "react-router-dom";
import { resolveStudentWorkflow } from "@/lib/student-workflow-context";
import type {
  ResearcherGuideState,
  ResearcherHelpId,
} from "@/lib/researcher-guide";

interface GuideMember {
  userId?: string;
  projectRole?: string;
  role?: string;
  leftAt?: string | null;
}
interface GuideProject {
  id: string;
  workspaceId?: string | null;
  members?: GuideMember[];
  workflowAccessRemoved?: boolean;
  workflowInstance?: { workflowId: string } | null;
}
interface GuideEnrollment {
  workflowId: string;
  status: string;
  workflow: { stages?: unknown[] };
}
interface GuideAccessEntry {
  status: string;
  kind: string;
  workflow: { id?: string; name: string };
}
interface GuideWorkspace {
  id: string;
  members?: GuideMember[];
}

export function resolveResearcherGuideState({
  projects,
  requestedProjectId,
  activeProjectId,
  userId,
  enrollments,
  removedIds,
  entries,
  workspaces,
  documents,
  documentsKnown,
  projectKnown,
  requestError,
  workflowId,
}: {
  projects: GuideProject[];
  requestedProjectId: string | null;
  activeProjectId: string | null;
  userId?: string;
  enrollments: GuideEnrollment[];
  removedIds: string[];
  entries: GuideAccessEntry[];
  workspaces: GuideWorkspace[];
  documents: unknown[];
  documentsKnown: boolean;
  projectKnown: boolean;
  requestError: boolean;
  workflowId: string | null;
}): ResearcherGuideState {
  const invalidRequested = Boolean(
    requestedProjectId &&
    !projects.some((project) => project.id === requestedProjectId),
  );
  const project = invalidRequested
    ? undefined
    : projects.find(
        (project) => project.id === (requestedProjectId || activeProjectId),
      ) ||
      (!requestedProjectId && projects.length === 1 ? projects[0] : undefined);
  const workspace = project?.workspaceId
    ? workspaces.find((item) => item.id === project.workspaceId)
    : !project && projects.length === 0 && workspaces.length === 1
      ? workspaces[0]
      : undefined;
  const members = (project?.members || workspace?.members || []).filter(
    (member) =>
      !member.leftAt &&
      ["LEADER", "MEMBER"].includes(member.projectRole || member.role || ""),
  );
  const active = enrollments.filter(
    (enrollment) => enrollment.status === "ACTIVE",
  );
  const { activeEnrollment } = resolveStudentWorkflow(
    active,
    project,
    workflowId,
    projects,
  );
  const classAccess = activeEnrollment
    ? activeEnrollment.workflow.stages?.length
      ? "joined"
      : "no-requirements"
    : entries.some(
          (entry) => entry.kind === "REQUEST" && entry.status === "PENDING",
        )
      ? "pending"
      : entries.some(
            (entry) =>
              entry.kind === "INVITATION" && entry.status === "PENDING",
          )
        ? "invited"
        : project?.workflowAccessRemoved || removedIds.length
          ? "removed"
          : entries.some(
                (entry) =>
                  entry.kind === "REQUEST" && entry.status === "DECLINED",
              )
            ? "declined"
            : requestError
              ? "unknown"
              : "none";
  return {
    projectKnown,
    projectCount: projects.length,
    projectId: project?.id || null,
    hasGroup: Boolean(project || workspace),
    memberCount: members.length,
    isLeader: members.some(
      (member) =>
        member.userId === userId &&
        (member.projectRole || member.role) === "LEADER",
    ),
    hasAdviser: Boolean(
      project?.members?.some(
        (member) => !member.leftAt && member.projectRole === "ADVISER",
      ),
    ),
    classAccess,
    enrollmentCount: active.length,
    documentsKnown,
    hasDocuments: Boolean(project && documents.length),
    requestError,
  };
}

export function useResearcherGuideState(enabled: boolean, userId?: string) {
  const { activeProjectId, requestedProjectId } = useActiveProjectContext();
  const { search } = useLocation();
  const projects = useQuery({
    queryKey: ["student-research"],
    queryFn: () =>
      apiClient.get<{ projects: GuideProject[] }>("/api/research", {
        headers: { "X-Advisio-Panel": "researcher" },
      }),
    enabled,
    staleTime: 30000,
  });
  const selected =
    (projects.data?.projects || []).find(
      (project) => project.id === (requestedProjectId || activeProjectId),
    ) ||
    (!requestedProjectId && projects.data?.projects?.length === 1
      ? projects.data.projects[0]
      : null);
  const enrollments = useQuery({
    queryKey: ["student-workflow-enrollments"],
    queryFn: () =>
      apiClient.get<{
        enrollments: GuideEnrollment[];
        removedWorkflowIds?: string[];
      }>("/api/workflows/enrollments/me"),
    enabled,
    staleTime: 15000,
  });
  const access = useQuery({
    queryKey: ["workflow-access-me"],
    queryFn: () =>
      apiClient.get<{ entries: GuideAccessEntry[] }>(
        "/api/workflows/access/me",
      ),
    enabled,
    staleTime: 15000,
  });
  const workspaces = useQuery({
    queryKey: ["student-workspaces"],
    queryFn: () =>
      apiClient.get<{ workspaces: GuideWorkspace[] }>("/api/workspaces/me"),
    enabled,
    staleTime: 30000,
  });
  const documents = useQuery({
    queryKey: ["researcher-guide-documents", selected?.id],
    queryFn: () =>
      apiClient.get<{ documents: unknown[] }>(
        `/api/research/${selected!.id}/documents`,
      ),
    enabled: enabled && Boolean(selected),
    staleTime: 15000,
  });
  const state = resolveResearcherGuideState({
    projects: projects.data?.projects || [],
    requestedProjectId,
    activeProjectId,
    userId,
    enrollments: enrollments.data?.enrollments || [],
    removedIds: enrollments.data?.removedWorkflowIds || [],
    entries: access.data?.entries || [],
    workspaces: workspaces.data?.workspaces || [],
    documents: documents.data?.documents || [],
    projectKnown: projects.isSuccess,
    documentsKnown: documents.isSuccess && Boolean(selected),
    requestError:
      projects.isError ||
      enrollments.isError ||
      access.isError ||
      workspaces.isError ||
      documents.isError,
    workflowId: new URLSearchParams(search).get("workflowId"),
  });
  const loading = (id: ResearcherHelpId | "introduction") => {
    if (!enabled || ["theme", "settings", "communication"].includes(id))
      return false;
    if (projects.isPending) return true;
    if (
      ["class", "submit", "introduction"].includes(id) &&
      (enrollments.isPending || access.isPending)
    )
      return true;
    if (["group", "introduction"].includes(id) && workspaces.isPending)
      return true;
    return (
      ["documents", "introduction"].includes(id) &&
      Boolean(selected) &&
      documents.isPending
    );
  };
  return { state, loading };
}
