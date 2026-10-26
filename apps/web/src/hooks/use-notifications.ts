"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  adviserRequestNotificationLink,
  notificationLink,
} from "@/lib/notification-navigation";
import { useAuth } from "@/providers/auth-provider";
import { useDashboardWorkspace } from "@/providers/dashboard-workspace-provider";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  audience: string;
  type: "success" | "info" | "warning" | "danger";
  module?:
    | "Documents"
    | "Consultation"
    | "Defense"
    | "Milestones"
    | "Announcements"
    | "Adviser Requests";
  link?: string;
}

export function useNotifications(selectedInbox?: "account" | "earlier") {
  const { user } = useAuth();
  const { activeWorkspace } = useDashboardWorkspace();
  const inbox = selectedInbox || activeWorkspace?.id;
  const inboxLabel =
    selectedInbox === "account"
      ? "Account notices"
      : selectedInbox === "earlier"
        ? "Earlier notifications"
        : `${activeWorkspace?.label || "Dashboard"} updates`;
  const role =
    inbox === "researcher"
      ? "student"
      : inbox === "coordinator"
        ? "professor"
        : inbox === "dean"
          ? "admin"
          : inbox || "";
  const queryClient = useQueryClient();
  const scopeKey = `${user?.id || ""}:${inbox || ""}`;
  const [mutationError, setMutationError] = useState<{
    scopeKey: string;
    message: string;
  } | null>(null);
  const query = useQuery({
    queryKey: ["notifications", user?.id, inbox, user?.roles.join(",")],
    enabled: Boolean(user?.id && inbox),
    refetchInterval: 15_000,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get<{
        notifications: any[];
        unreadCount: number;
      }>("/api/notifications", { params: { inbox }, signal });
      return {
        unreadCount: response.unreadCount,
        notifications: (response.notifications || []).map(
          (item: any): AppNotification => ({
            id: item.id,
            title: item.title,
            message: item.message,
            audience: item.audience,
            time: new Date(item.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }),
            read: item.isRead,
            type:
              item.type === "SYSTEM_ANNOUNCEMENT" ||
              item.type === "ADVISER_REQUESTED" ||
              item.type === "REVISION_REQUESTED"
                ? "warning"
                : item.type === "ADVISER_REQUEST_DECIDED" ||
                    item.type === "MANUSCRIPT_APPROVED"
                  ? "success"
                  : "info",
            module:
              item.type === "SYSTEM_ANNOUNCEMENT"
                ? "Announcements"
                : item.type?.startsWith("ADVISER_")
                  ? "Adviser Requests"
                  : item.entityType === "WorkflowStage"
                    ? "Milestones"
                    : item.actionUrl
                      ? "Documents"
                      : undefined,
            link:
              notificationLink(item.actionUrl, role, user?.roles || []) ||
              (item.type === "ADVISER_REQUESTED" && inbox === "adviser"
                ? adviserRequestNotificationLink(item.entityId)
                : undefined),
          }),
        ),
      };
    },
  });

  useEffect(() => {
    setMutationError(null);
  }, [user?.id, inbox]);
  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: ["notifications", user?.id],
      });
    };
    window.addEventListener("notifications-updated", refresh);
    return () => window.removeEventListener("notifications-updated", refresh);
  }, [queryClient, user?.id]);

  const update = async (endpoint: string): Promise<boolean> => {
    if (!user || !inbox) return false;
    try {
      await apiClient.patch(endpoint, { inbox });
      setMutationError((current) =>
        current?.scopeKey === scopeKey ? null : current,
      );
      window.dispatchEvent(new Event("notifications-updated"));
      return true;
    } catch (error) {
      setMutationError({
        scopeKey,
        message:
          error instanceof Error
            ? error.message
            : "Could not update the notification. Try again.",
      });
      return false;
    }
  };

  return {
    notifications: query.data?.notifications || [],
    unreadCount: query.data?.unreadCount || 0,
    loading: Boolean(user && inbox) && query.isPending,
    error:
      (mutationError?.scopeKey === scopeKey ? mutationError.message : null) ||
      query.error?.message ||
      null,
    retry: () => {
      void query.refetch();
    },
    inboxLabel,
    inbox,
    markAsRead: (id: string) => update(`/api/notifications/${id}/read`),
    markAllAsRead: () => update("/api/notifications/read-all"),
    deleteNotification: (id: string) =>
      update(`/api/notifications/${id}/archive`),
  };
}
