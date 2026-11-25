"use client";

import {
  consultationViewModel,
  nextConsultation,
} from "@/lib/consultation-view";
import { useActiveProject } from "@/providers/active-project-provider";
import { resolveStudentWorkflow } from "@/lib/student-workflow-context";
import { projectAdviserRequests } from "@/lib/project-adviser-requests";

import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  DefenseEligibility,
  DefenseRequirement,
  GradeReport,
} from "@/types/student";
import { useActiveProjectContext } from "@/providers/active-project-provider";

export const studentKeys = {
  all: ["student"] as const,
  consultations: () => [...studentKeys.all, "consultations"] as const,
  notifications: () => [...studentKeys.all, "notifications"] as const,
  group: () => [...studentKeys.all, "group"] as const,
  advisers: () => [...studentKeys.all, "advisers"] as const,
  defense: () => [...studentKeys.all, "defense"] as const,
  grades: () => [...studentKeys.all, "grades"] as const,
};

// ── Overview (dashboard home) ──────────────────────────────────
// The current dashboard owns its project-scoped overview queries directly.

// ── Submissions ────────────────────────────────────────────────
// Legacy submissions now redirect to Tasks or Documents.

// ── Consultations ──────────────────────────────────────────────
function useStudentProjectSelection() {
  const projects = useQuery({
    queryKey: ["student-research"],
    queryFn: () => apiClient.get<{ projects: any[] }>("/api/research"),
  });
  const selection = useActiveProject(projects.data?.projects || []);
  return {
    ...selection,
    projectLoading: projects.isPending,
    projectError: projects.error,
  };
}

export function useConsultations() {
  const { projectId, projectLoading, projectError } =
    useStudentProjectSelection();
  const query = useQuery({
    queryKey: [...studentKeys.consultations(), projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const res = await apiClient.get<{ consultations: any[] }>(
        "/api/consultations",
        { params: { researchId: projectId! } },
      );
      const list = (res.consultations || []).map(consultationViewModel);
      return { list, next: nextConsultation(list) };
    },
  });
  return {
    ...query,
    isPending: projectLoading || (Boolean(projectId) && query.isPending),
    error: projectError || query.error,
    projectId,
  };
}

// ── Notifications ──────────────────────────────────────────────
export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...studentKeys.notifications(), user?.id],
    enabled: Boolean(user?.id),
    refetchInterval: 15000,
    queryFn: async ({ signal }) => {
      const res = await apiClient.get<{ notifications: any[] }>("/api/notifications", { params: { inbox: "researcher" }, signal });
      return res.notifications || [];
    },
  });
}

// ── Group ──────────────────────────────────────────────────────
export function useStudentGroup() {
  const { activeProjectId } = useActiveProjectContext();
  return useQuery({
    queryKey: [...studentKeys.group(), activeProjectId],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ projects: any[] }>("/api/research");
        const projects = res?.projects || [];
        const active = activeProjectId
          ? projects.find((project: any) => project.id === activeProjectId)
          : projects.length === 1
            ? projects[0]
            : null;
        if (!active) return null;
        return {
          id: active.id,
          name: active.title?.substring(0, 24) || "Research Group",
          title: active.title,
          researchTitle: active.title,
          members:
            active.members?.map((m: any) => ({
              id: m.id || m.userId,
              name:
                `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() ||
                m.user?.email ||
                "Member",
              initials:
                `${m.user?.firstName?.[0] || "M"}${m.user?.lastName?.[0] || ""}`.toUpperCase(),
              email: m.user?.email,
              role:
                m.projectRole?.toLowerCase() === "leader" ? "leader" : "member",
              isYou: false,
              colorVariant: "info",
            })) || [],
          adviser: active.members?.find(
            (m: any) => m.projectRole === "ADVISER" && !m.leftAt,
          )?.user
            ? `${active.members.find((m: any) => m.projectRole === "ADVISER" && !m.leftAt).user.firstName} ${active.members.find((m: any) => m.projectRole === "ADVISER" && !m.leftAt).user.lastName}`.trim()
            : null,
          status: active.status,
        };
      } catch {
        return null;
      }
    },
  });
}

// ── Advisers ───────────────────────────────────────────────────
export function useAdvisers(explicitProjectId?: string | null, explicitWorkflowId?: string | null) {
  const { activeProjectId } = useActiveProjectContext();
  const targetProjectId = explicitProjectId || activeProjectId;
  return useQuery({
    queryKey: [...studentKeys.advisers(), targetProjectId, explicitWorkflowId],
    queryFn: async () => {
      const research = await apiClient.get<{ projects: any[] }>(
        "/api/research",
      );
      const projects = research.projects || [];
      const selectedProject = targetProjectId
        ? projects.find((candidate: any) => candidate.id === targetProjectId)
        : projects.length === 1
          ? projects[0]
          : null;
      const { enrollments } = await apiClient.get<{ enrollments: any[] }>("/api/workflows/enrollments/me");
      const { activeEnrollment, workflowProject } = resolveStudentWorkflow(enrollments, selectedProject, explicitWorkflowId, explicitProjectId && !selectedProject ? [] : projects);
      const project = workflowProject || (explicitWorkflowId ? null : selectedProject);
      const adviserParams = new URLSearchParams({
        role: "ADVISER",
        status: "ACTIVE",
      });
      if (project?.programId)
        adviserParams.set("programId", project.programId);
      const res = await apiClient.get<{ users: any[] }>(
        `/api/users?${adviserParams.toString()}`,
      );
      const assignedMember = project?.members?.find(
        (m: any) => m.projectRole === "ADVISER" && !m.leftAt,
      );
      const requests = await apiClient
        .get<{ requests: any[] }>("/api/adviser-requests")
        .catch(() => ({ requests: [] }));
      const requestsList = Array.isArray(requests?.requests)
        ? requests.requests
        : [];
      const usersList = Array.isArray(res?.users) ? res.users : [];
      const mapAdviser = (adviser: any) => ({
        ...adviser,
        name:
          adviser.name ||
          `${adviser.firstName || ""} ${adviser.lastName || ""}`.trim() ||
          adviser.email,
        initials:
          adviser.initials ||
          `${adviser.firstName?.[0] || "F"}${adviser.lastName?.[0] || "A"}`.toUpperCase(),
        college: adviser.college?.name || adviser.college || "Faculty",
        adviseeCount: adviser.adviseeCount ?? 0,
        maxAdviseeGroups: adviser.maxAdviseeGroups ?? 5,
        availableSlots: adviser.availableSlots ?? 0,
        isAcceptingAdvisees: adviser.isAcceptingAdvisees ?? true,
        isFull: adviser.isFull ?? false,
        avgResponseDays: adviser.avgResponseDays || "—",
        requestStatus: requestsList.find(
          (r: any) =>
            r.adviserId === adviser.id && r.researchId === project?.id,
        )?.status,
      });
      return {
        workflow: activeEnrollment?.workflow || null,
        workflowId: activeEnrollment?.workflowId || null,
        projectId: project?.id || null,
        project: project || null,
        assigned: assignedMember ? mapAdviser(assignedMember.user) : null,
        available: usersList.map(mapAdviser),
        ...projectAdviserRequests(requestsList, project?.id),
      };
    },
  });
}

// ── Defense ───────────────────────────────────────────────────
export function useDefense() {
  const { activeProjectId } = useActiveProjectContext();
  return useQuery<{
    requirements: DefenseRequirement[];
    eligibility: DefenseEligibility;
    project: any | null;
    sessions: any[];
    documents: any[];
    projects: any[];
    progress?: { completed: number; total: number; current: string | null };
    defenseMilestoneId?: string | null;
  }>({
    queryKey: [...studentKeys.defense(), activeProjectId],
    queryFn: async () => {
      const research = await apiClient.get<{ projects: any[] }>(
        "/api/research",
      );
      const projects = research.projects || [];
      const project = activeProjectId
        ? projects.find((candidate: any) => candidate.id === activeProjectId) ||
          null
        : projects.length === 1
          ? projects[0]
          : null;
      if (!project) {
        return {
          requirements: [],
          eligibility: "not_eligible" as DefenseEligibility,
          project: null,
          sessions: [],
          documents: [],
          projects,
        };
      }

      const [management, documentData, workflowData] = await Promise.all([
        apiClient.get<{ sessions: any[] }>("/api/defense-management"),
        apiClient.get<{ documents: any[] }>(
          `/api/research/${project.id}/documents`,
        ),
        apiClient.get<{
          milestones: { completed: boolean; isCurrent: boolean; name: string }[];
          defenseReadiness: {
            workflowApproved: boolean; requirementsReady: boolean;
            deanApprovalSigned: boolean; deanApprovalRequested: boolean;
            milestoneId?: string | null; milestoneName?: string | null;
          };
        }>(`/api/research/${project.id}/manuscript-workflow`),
      ]);
      const sessions = (management.sessions || []).filter(
        (session: any) => session.researchId === project.id,
      );
      const documents = documentData.documents || [];
      const readiness = workflowData.defenseReadiness;
      const requirements: DefenseRequirement[] = [
        {
          id: "requirements",
          label: readiness.milestoneName ? `Requirements for ${readiness.milestoneName}` : "Defense requirements",
          status: readiness.requirementsReady || readiness.workflowApproved ? "done" : "in_progress",
          hint: "The research group submits the required work and assigned faculty approve it.",
        },
        {
          id: "workflow",
          label: "Defense eligibility approval",
          status: readiness.workflowApproved ? "done" : readiness.requirementsReady ? "in_progress" : "pending",
          hint: "The professor or coordinator approves the eligibility milestone.",
        },
        {
          id: "dean-approval",
          label: "Dean-signed defense approval received",
          status: readiness.deanApprovalSigned ? "done" : readiness.deanApprovalRequested ? "in_progress" : "pending",
          hint: readiness.deanApprovalRequested ? "Waiting for the Dean to sign." : "The coordinator requests the Dean’s signature after eligibility approval.",
        },
      ];
      const ready = requirements.every(
        (requirement) => requirement.status === "done",
      );
      return {
        progress: {
          completed: (workflowData.milestones || []).filter(m => m.completed).length,
          total: (workflowData.milestones || []).length,
          current: (workflowData.milestones || []).find(m => m.isCurrent)?.name || null,
        },
        requirements,
        defenseMilestoneId: readiness.milestoneId,
        eligibility: ready ? "eligible" : "not_eligible",
        project,
        sessions,
        documents,
        projects,
      };
    },
    refetchInterval: 10000,
  });
}

// ── Grades ────────────────────────────────────────────────────
export function useGrades() {
  const { projectId, projectLoading, projectError } =
    useStudentProjectSelection();
  const query = useQuery<GradeReport>({
    queryKey: [...studentKeys.grades(), projectId],
    enabled: Boolean(projectId),
    queryFn: async () =>
      (
        await apiClient.get<{ grades: GradeReport }>(
          `/api/research/${projectId}/grades`,
        )
      ).grades,
  });
  return {
    ...query,
    isPending: projectLoading || (Boolean(projectId) && query.isPending),
    error: projectError || query.error,
    projectId,
  };
}

// ── Optimistic task toggle ─────────────────────────────────────
