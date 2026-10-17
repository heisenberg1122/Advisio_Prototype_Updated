"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import type { FacultyProfileUpdateInput, ProfileCompletionResult } from "@research-management/validations";

export interface FacultyProfileData extends FacultyProfileUpdateInput {
  id?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FacultyProfileResponse {
  profile: FacultyProfileData | null;
  user: {
    id: string;
    email: string;
    universityId: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    college?: { id: string; name: string; code: string } | null;
    program?: { id: string; name: string; code: string } | null;
    status: string;
  };
  capacity: {
    adviseeCount: number;
    maxAdviseeGroups: number;
    availableSlots: number;
    isAcceptingAdvisees: boolean;
    isFull: boolean;
    note?: string | null;
    updatedAt?: string | null;
  };
  completion: ProfileCompletionResult;
}

export interface PublicFacultyProfileResponse {
  adviser: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    college?: string | null;
    collegeId?: string | null;
    program?: string | null;
    programId?: string | null;
    isVerified: boolean;
    capacity: {
      adviseeCount: number;
      maxAdviseeGroups: number;
      availableSlots: number;
      isAcceptingAdvisees: boolean;
      isFull: boolean;
    };
    profile: FacultyProfileData | null;
  };
}

interface LegacyFacultyProfileData {
  expertise?: string;
  specialization?: string;
  credentials?: string;
  department?: string;
  biography?: string;
}

function optionalString(record: Record<string, unknown>, key: keyof LegacyFacultyProfileData): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

export function useFacultyProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["faculty-profile", "me", user?.id],
    queryFn: async () => {
      return apiClient.get<FacultyProfileResponse>("/api/faculty-profiles/me");
    },
    enabled: Boolean(user?.id && (user.roles?.includes("ADVISER") || user.roles?.includes("SYSTEM_ADMIN"))),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FacultyProfileUpdateInput) => {
      return apiClient.put<{
        message: string;
        profile: FacultyProfileData;
        completion: ProfileCompletionResult;
      }>("/api/faculty-profiles/me", data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["faculty-profile", "me"],
      });
      // Notify other components if needed
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("profile-updated"));
      }
    },
  });

  // Safe localStorage inspection for legacy adviser drafts
  const getLegacyLocalStorageData = (): LegacyFacultyProfileData | null => {
    if (typeof window === "undefined" || !user?.id) return null;
    const dismissedKey = `advisio_profile_legacy_dismissed_${user.id}`;
    if (localStorage.getItem(dismissedKey) === "true") return null;

    const legacyKey = `advisio_profile_adviser_${user.id}`;
    const raw = localStorage.getItem(legacyKey);
    if (!raw) return null;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const record = parsed as Record<string, unknown>;
      const legacy: LegacyFacultyProfileData = {
        expertise: optionalString(record, "expertise"),
        specialization: optionalString(record, "specialization"),
        credentials: optionalString(record, "credentials"),
        department: optionalString(record, "department"),
        biography: optionalString(record, "biography"),
      };
      // Check if it has any meaningful legacy faculty fields
      const hasContent = Boolean(
        legacy.expertise?.trim() ||
        legacy.specialization?.trim() ||
        legacy.credentials?.trim() ||
        legacy.department?.trim() ||
        legacy.biography?.trim(),
      );
      return hasContent ? legacy : null;
    } catch {
      return null;
    }
  };

  const dismissLegacyData = () => {
    if (typeof window === "undefined" || !user?.id) return;
    localStorage.setItem(`advisio_profile_legacy_dismissed_${user.id}`, "true");
  };

  const convertLegacyData = (legacy: LegacyFacultyProfileData | null): Partial<FacultyProfileUpdateInput> => {
    if (!legacy) return {};

    const expertiseList = legacy.expertise
      ? String(legacy.expertise)
          .split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const specializedList = legacy.specialization
      ? String(legacy.specialization)
          .split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const certificationsList = legacy.credentials
      ? String(legacy.credentials)
          .split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((title, idx) => ({
            id: `legacy-cert-${idx}`,
            title,
            issuingBody: "Institutional Record",
            yearIssued: new Date().getFullYear(),
          }))
      : [];

    return {
      department: legacy.department?.trim() || undefined,
      biography: legacy.biography?.trim() || undefined,
      expertiseKeywords: expertiseList,
      specializedTopics: specializedList,
      certifications: certificationsList,
    };
  };

  return {
    ...query,
    profile: query.data?.profile || null,
    profileUser: query.data?.user || null,
    capacity: query.data?.capacity || null,
    completion: query.data?.completion || null,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
    getLegacyLocalStorageData,
    dismissLegacyData,
    convertLegacyData,
  };
}

export function usePublicFacultyProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["faculty-profile", "public", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");
      return apiClient.get<PublicFacultyProfileResponse>(`/api/faculty-profiles/${userId}`);
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}
