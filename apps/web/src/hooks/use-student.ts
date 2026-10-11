"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { TaskStatus, DefenseEligibility, DefenseRequirement, GradeReport } from "@/types/student";

export const studentKeys = {
  all: ["student"] as const,
  overview: () => [...studentKeys.all, "overview"] as const,
  submissions: () => [...studentKeys.all, "submissions"] as const,
  consultations: () => [...studentKeys.all, "consultations"] as const,
  notifications: () => [...studentKeys.all, "notifications"] as const,
  group: () => [...studentKeys.all, "group"] as const,
  advisers: () => [...studentKeys.all, "advisers"] as const,
  defense: () => [...studentKeys.all, "defense"] as const,
  grades: () => [...studentKeys.all, "grades"] as const,
};

// ── Overview (dashboard home) ──────────────────────────────────
export function useStudentOverview() {
  return useQuery({
    queryKey: studentKeys.overview(),
    queryFn: async () => {
      try {
        const research = await apiClient.get<{ projects: any[] }>("/api/research");
        const active = research?.projects?.[0];
        if (!active) return null;
        return {
          id: active.id,
          projectTitle: active.title,
          abstract: active.abstract || "",
          status: active.status,
          currentMilestone: active.workflowInstance?.currentStage?.name || "Topic Proposal",
          overallProgress: 10,
          pendingTasks: [],
        };
      } catch {
        return null;
      }
    },
    staleTime: 30_000,
  });
}

// ── Submissions ────────────────────────────────────────────────
export function useSubmissions() {
  return useQuery({
    queryKey: studentKeys.submissions(),
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ documents: any[] }>("/api/documents");
        return res.documents || [];
      } catch {
        return [];
      }
    },
  });
}

// ── Consultations ──────────────────────────────────────────────
export function useConsultations() {
  return useQuery({
    queryKey: studentKeys.consultations(),
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ consultations: any[] }>("/api/consultations");
        return {
          list: res.consultations || [],
          next: res.consultations?.[0] || null,
        };
      } catch {
        return { list: [], next: null };
      }
    },
  });
}

// ── Notifications ──────────────────────────────────────────────
export function useNotifications() {
  return useQuery({
    queryKey: studentKeys.notifications(),
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ notifications: any[] }>("/api/notifications");
        return res.notifications || [];
      } catch {
        return [];
      }
    },
  });
}

// ── Group ──────────────────────────────────────────────────────
export function useStudentGroup() {
  return useQuery({
    queryKey: studentKeys.group(),
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ projects: any[] }>("/api/research");
        const active = res?.projects?.[0];
        if (!active) return null;
        return {
          id: active.id,
          name: active.title?.substring(0, 24) || "Research Group",
          title: active.title,
          researchTitle: active.title,
          members: active.members?.map((m: any) => ({
            id: m.id || m.userId,
            name: `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() || m.user?.email || "Member",
            initials: `${(m.user?.firstName?.[0] || "M")}${(m.user?.lastName?.[0] || "")}`.toUpperCase(),
            email: m.user?.email,
            role: m.projectRole?.toLowerCase() === "leader" ? "leader" : "member",
            isYou: false,
            colorVariant: "info",
          })) || [],
          adviser: active.members?.find((m: any) => m.projectRole === "ADVISER" && !m.leftAt)?.user
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
export function useAdvisers() {
  return useQuery({
    queryKey: studentKeys.advisers(),
    queryFn: async () => {
      try {
        const research = await apiClient.get<{ projects: any[] }>("/api/research");
        const project = research.projects?.[0];
        const adviserParams = new URLSearchParams({ role: "ADVISER", status: "ACTIVE" });
        if (project?.programId) adviserParams.set("programId", project.programId);
        const res = await apiClient.get<{ users: any[] }>(`/api/users?${adviserParams.toString()}`);
        const assignedMember = project?.members?.find((m: any) => m.projectRole === "ADVISER" && !m.leftAt);
        const requests = await apiClient.get<{ requests: any[] }>("/api/adviser-requests").catch(() => ({ requests: [] }));
        const requestsList = Array.isArray(requests?.requests) ? requests.requests : [];
        const usersList = Array.isArray(res?.users) ? res.users : [];
        const mapAdviser = (adviser: any) => ({
          ...adviser,
          name: adviser.name || `${adviser.firstName || ""} ${adviser.lastName || ""}`.trim() || adviser.email,
          initials: adviser.initials || `${adviser.firstName?.[0] || "F"}${adviser.lastName?.[0] || "A"}`.toUpperCase(),
          college: adviser.college?.name || adviser.college || "Faculty",
          adviseeCount: adviser.adviseeCount ?? 0,
          maxAdviseeGroups: adviser.maxAdviseeGroups ?? 5,
          availableSlots: adviser.availableSlots ?? 0,
          isAcceptingAdvisees: adviser.isAcceptingAdvisees ?? true,
          isFull: adviser.isFull ?? false,
          avgResponseDays: adviser.avgResponseDays || "—",
          requestStatus: requestsList.find((r: any) => r.adviserId === adviser.id && r.researchId === project?.id)?.status,
        });
        return {
          projectId: project?.id || null,
          project: project || null,
          assigned: assignedMember ? mapAdviser(assignedMember.user) : null,
          available: usersList.map(mapAdviser),
          requests: requestsList,
          pendingRequest:
            requestsList.find((request: any) => request.status === "PENDING") ||
            null,
        };
      } catch (err) {
        console.error("Failed to load advisers:", err);
        return {
          projectId: null,
          project: null,
          assigned: null,
          available: [],
          requests: [],
          pendingRequest: null,
        };
      }
    },
  });
}

// ── Defense ───────────────────────────────────────────────────
export function useDefense() {
  return useQuery<{
    requirements: DefenseRequirement[];
    eligibility: DefenseEligibility;
    project: any | null;
    sessions: any[];
    documents: any[];
  }>({
    queryKey: studentKeys.defense(),
    queryFn: async () => {
      const research = await apiClient.get<{ projects: any[] }>("/api/research");
      const project = research.projects?.[0] || null;
      if (!project) {
        return {
          requirements: [],
          eligibility: "not_eligible" as DefenseEligibility,
          project: null,
          sessions: [],
          documents: [],
        };
      }

      const [management, documentData] = await Promise.all([
        apiClient.get<{ sessions: any[] }>("/api/defense-management"),
        apiClient.get<{ documents: any[] }>(
          `/api/research/${project.id}/documents`,
        ),
      ]);
      const sessions = (management.sessions || []).filter(
        (session: any) => session.researchId === project.id,
      );
      const documents = documentData.documents || [];
      const hasAdviser = (project.members || []).some(
        (member: any) => member.projectRole === "ADVISER" && !member.leftAt,
      );
      const hasSignedDeanApproval = documents.some(
        (document: any) =>
          document.documentType === "DEAN_DEFENSE_APPROVAL" &&
          (document.versions || []).some(
            (version: any) =>
              version.status === "ACTIVE" &&
              version.signedSignature &&
              !version.signedSignature.revokedAt,
          ),
      );
      const approvedSubmissions = (project.taskSubmissions || []).filter(
        (submission: any) => submission.status === "APPROVED",
      );
      const hasFinalManuscript =
        approvedSubmissions.length > 0 ||
        documents.some(
          (document: any) =>
            document.documentType === "RESEARCH_MANUSCRIPT" &&
            (document.versions || []).some(
              (version: any) => version.status === "ACTIVE",
            ),
        );
      const requirements: DefenseRequirement[] = [
        {
          id: "workflow",
          label: "Required workflow milestones completed",
          status: project.workflowInstance?.completedAt ? "done" : "in_progress",
        },
        {
          id: "adviser",
          label: "Faculty adviser assigned",
          status: hasAdviser ? "done" : "pending",
        },
        {
          id: "manuscript",
          label: "Final manuscript or required submission approved",
          status: hasFinalManuscript ? "done" : "pending",
        },
        {
          id: "dean-approval",
          label: "Dean-signed defense approval received",
          status: hasSignedDeanApproval ? "done" : "pending",
        },
      ];
      const ready = requirements.every((requirement) => requirement.status === "done");
      return {
        requirements,
        eligibility: ready ? "eligible" : "not_eligible",
        project,
        sessions,
        documents,
      };
    },
    refetchInterval: 10000,
  });
}

// ── Grades ────────────────────────────────────────────────────
export function useGrades() {
  return useQuery<GradeReport>({
    queryKey: studentKeys.grades(),
    queryFn: async () => {
      return {
        finalGrade: null,
        gpa: null,
        status: "pending",
        panelistScores: [],
      };
    },
  });
}

// ── Optimistic task toggle ─────────────────────────────────────
export function useToggleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      return { taskId, status };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.overview() });
    },
  });
}
