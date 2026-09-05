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
          adviser: null,
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
        const res = await apiClient.get<{ users: any[] }>("/api/users?role=ADVISER");
        return {
          assigned: null,
          available: res.users || [],
        };
      } catch {
        return { assigned: null, available: [] };
      }
    },
  });
}

// ── Defense ───────────────────────────────────────────────────
export function useDefense() {
  return useQuery<{ requirements: DefenseRequirement[]; eligibility: DefenseEligibility }>({
    queryKey: studentKeys.defense(),
    queryFn: async () => {
      return {
        requirements: [],
        eligibility: "not_eligible" as DefenseEligibility,
      };
    },
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
