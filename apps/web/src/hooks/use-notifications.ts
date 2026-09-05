"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "success" | "info" | "warning" | "danger";
  module?: "Documents" | "Consultation" | "Defense" | "Milestones" | "Announcements";
  link?: string;
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
  const loadNotifications = () => {
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
        setNotifications(clean);
        localStorage.setItem(key, JSON.stringify(clean));
      } catch {
        setNotifications([]);
      }
    } else {
      setNotifications([]);
      localStorage.setItem(key, JSON.stringify([]));
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      loadNotifications();
      setLoading(false);

      // Listen for notifications-updated events
      const handleUpdate = () => {
        loadNotifications();
      };
      window.addEventListener("notifications-updated", handleUpdate);
      return () => {
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
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    saveNotifications(updated);
  };

  const markAllAsRead = () => {
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
