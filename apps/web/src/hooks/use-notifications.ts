"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { notificationLink } from "@/lib/notification-navigation";
import { useAuth } from "@/providers/auth-provider";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "success" | "info" | "warning" | "danger";
  module?: "Documents" | "Consultation" | "Defense" | "Milestones" | "Announcements" | "Adviser Requests";
  link?: string;
}

export function useNotifications() {
  const pathname = usePathname() || "";
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Determine active role from pathname
  let role = "student";
  if (pathname.includes("/system-admin")) {
    role = "system_admin";
  } else if (pathname.includes("/admin")) {
    role = "admin";
  } else if (pathname.includes("/adviser")) {
    role = "adviser";
  } else if (pathname.includes("/professor")) {
    role = "professor";
  } else if (pathname.includes("/panelist")) {
    role = "panelist";
  }

  // Load notifications helper
  const loadNotifications = useCallback(async () => {
    try {
      const response = await apiClient.get<{ notifications: any[] }>("/api/notifications");
      const apiItems: AppNotification[] = (response.notifications || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        time: new Date(item.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
        read: item.isRead,
        type:
          item.type === "SYSTEM_ANNOUNCEMENT" || item.type === "ADVISER_REQUESTED" || item.type === "REVISION_REQUESTED"
            ? "warning"
            : item.type === "ADVISER_REQUEST_DECIDED" || item.type === "MANUSCRIPT_APPROVED"
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
          (item.type === "ADVISER_REQUESTED" ? "/adviser/dashboard" : undefined),
      }));
      setNotifications(apiItems);
    } catch {
      setNotifications([]);
    }
  }, [role, user?.roles]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      loadNotifications().finally(() => setLoading(false));

      // Listen for notifications-updated events
      const handleUpdate = () => {
        void loadNotifications();
      };
      const refreshInterval = window.setInterval(() => void loadNotifications(), 15_000);
      window.addEventListener("notifications-updated", handleUpdate);
      return () => {
        window.clearInterval(refreshInterval);
        window.removeEventListener("notifications-updated", handleUpdate);
      };
    }
  }, [loadNotifications]);

  const markAsRead = async (id: string) => {
    await apiClient.patch(`/api/notifications/${id}/read`);
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    window.dispatchEvent(new Event("notifications-updated"));
  };

  const markAllAsRead = async () => {
    await apiClient.patch("/api/notifications/read-all");
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    window.dispatchEvent(new Event("notifications-updated"));
  };

  const deleteNotification = async (id: string) => {
    await apiClient.patch(`/api/notifications/${id}/archive`);
    setNotifications((current) => current.filter((item) => item.id !== id));
    window.dispatchEvent(new Event("notifications-updated"));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}
