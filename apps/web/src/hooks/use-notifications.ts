"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { apiClient } from "@/lib/api-client";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "success" | "info" | "warning" | "danger";
  module?: "Documents" | "Consultation" | "Defense" | "Milestones" | "Announcements" | "Adviser Requests";
  link?: string;
  source?: "api" | "local";
}

const DEFAULT_NOTIFICATIONS: Record<string, AppNotification[]> = {
  student: [],
  adviser: [],
  professor: [],
  panelist: [],
  admin: [],
  system_admin: [],
};

export function useNotifications() {
  const pathname = usePathname() || "";
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
  const loadNotifications = async () => {
    const key = `advisio_notifications_${role}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const clean = Array.isArray(parsed)
          ? parsed.filter(
              (n: any) =>
                !n.id?.startsWith("stud-n") &&
                !n.id?.startsWith("adv-n") &&
                !n.id?.startsWith("prof-n") &&
                !n.id?.startsWith("pan-n") &&
                !n.id?.startsWith("adm-n") &&
                !n.id?.startsWith("sys-n") &&
                !n.message?.includes("Juan Reyes") &&
                !n.message?.includes("Group AI-CCS-01")
            )
          : [];
        localStorage.setItem(key, JSON.stringify(clean));
      } catch {
        // Invalid local cache should not prevent API notifications from loading.
      }
    } else {
      localStorage.setItem(key, JSON.stringify([]));
    }

    let localItems: AppNotification[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      localItems = Array.isArray(parsed) ? parsed.map((item: AppNotification) => ({ ...item, source: "local" as const })) : [];
    } catch {
      localItems = [];
    }

    try {
      const response = await apiClient.get<{ notifications: any[] }>("/api/notifications");
      const apiItems: AppNotification[] = (response.notifications || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        time: new Date(item.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
        read: item.isRead,
        type: item.type === "SYSTEM_ANNOUNCEMENT" ? "warning" : item.type === "ADVISER_REQUESTED" ? "warning" : item.type === "ADVISER_REQUEST_DECIDED" ? "success" : "info",
        module: item.type === "SYSTEM_ANNOUNCEMENT" ? "Announcements" : item.type?.startsWith("ADVISER_") ? "Adviser Requests" : undefined,
        link: item.type === "ADVISER_REQUESTED" ? "/adviser/dashboard" : undefined,
        source: "api",
      }));
      setNotifications([...apiItems, ...localItems.filter((local) => !apiItems.some((api) => api.id === local.id))]);
    } catch {
      setNotifications(localItems);
    }
  };

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
  }, [role]);

  const saveNotifications = (updatedList: AppNotification[]) => {
    const key = `advisio_notifications_${role}`;
    localStorage.setItem(key, JSON.stringify(updatedList));
    setNotifications(updatedList);
    // Notify other hook instances (like topbars)
    window.dispatchEvent(new Event("notifications-updated"));
  };

  const markAsRead = (id: string) => {
    const target = notifications.find((notification) => notification.id === id);
    if (target?.source === "api") {
      apiClient.patch(`/api/notifications/${id}/read`).catch(() => undefined);
    }
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    saveNotifications(updated);
  };

  const markAllAsRead = () => {
    if (notifications.some((notification) => !notification.read && notification.source === "api")) {
      apiClient.patch("/api/notifications/read-all").catch(() => undefined);
    }
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  const deleteNotification = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    saveNotifications(updated);
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
