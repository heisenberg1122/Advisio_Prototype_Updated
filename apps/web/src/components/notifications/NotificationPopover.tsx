"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { NotificationListSkeleton } from "@/components/ui/Skeleton";
import { AppNotification, useNotifications } from "@/hooks/use-notifications";
import "./notification-popover.css";

const MODULE_ICONS: Record<string, string> = {
  Documents: "ti-file-text",
  Consultation: "ti-calendar-event",
  Defense: "ti-presentation",
  Milestones: "ti-flag",
  Announcements: "ti-speakerphone",
  "Adviser Requests": "ti-user-check",
};
const TYPE_ICONS: Record<AppNotification["type"], string> = {
  success: "ti-circle-check",
  info: "ti-info-circle",
  warning: "ti-alert-triangle",
  danger: "ti-alert-circle",
};

/** "Nov 2 · 2:30 PM" */
function shortTime(notification: AppNotification) {
  const date = notification.createdAt ? new Date(notification.createdAt) : null;
  if (!date || Number.isNaN(date.getTime())) return notification.time;
  const day = date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });
  const time = date.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

interface NotificationPopoverProps {
  guideTarget?: string;
  viewAllHref: string;
  compact?: boolean;
}

export function NotificationPopover({
  guideTarget,
  viewAllHref,
  compact = false,
}: NotificationPopoverProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const {
    notifications: dashboardNotifications,
    unreadCount: dashboardUnreadCount,
    loading,
    error,
    retry,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const account = useNotifications("account");
  const notifications = [
    ...dashboardNotifications.slice(0, 3),
    ...account.notifications.slice(0, 2),
  ];
  const unreadCount = dashboardUnreadCount + account.unreadCount;
  const previewNotifications = notifications;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const openNotification = async (notification: AppNotification) => {
    if (
      !notification.read &&
      !(await (notification.audience === "account"
        ? account.markAsRead(notification.id)
        : markAsRead(notification.id)))
    )
      return;
    setOpen(false);
    if (notification.link) router.push(notification.link);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-guide={guideTarget}
        onClick={() => setOpen((current) => !current)}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          compact
            ? "topbar-icon-btn"
            : "relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-[#173f63] transition hover:bg-slate-50 hover:text-[#f6a800] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f6a800]",
        )}
      >
        <i className={cn("ti ti-bell", compact ? "text-[20px]" : "text-xl")} aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className={cn(
              "pointer-events-none absolute flex items-center justify-center rounded-full bg-rose-500 px-1 font-semibold leading-none text-white shadow-xs ring-1.5 ring-white dark:ring-slate-900",
              compact
                ? "top-0.5 right-0.5 h-4 min-w-4 text-[10px]"
                : "top-1 right-1 h-3.5 min-w-3.5 text-xs",
            )}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Recent notifications" className="np-panel">
          <div className="np-head">
            <p>
              <strong>Notifications</strong>
              <span> · {unreadCount > 0 ? `${unreadCount} unread` : "all caught up"}</span>
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                className="np-mark"
                onClick={() => {
                  if (dashboardUnreadCount > 0) void markAllAsRead();
                  if (account.unreadCount > 0) void account.markAllAsRead();
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="np-list">
            {error || account.error ? (
              <div role="alert" className="np-error">
                {error || account.error}{" "}
                <button
                  type="button"
                  onClick={() => {
                    retry();
                    account.retry();
                  }}
                >
                  Retry
                </button>
              </div>
            ) : loading || account.loading ? (
              <NotificationListSkeleton rows={3} className="p-4" />
            ) : previewNotifications.length > 0 ? (
              previewNotifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  className="np-item"
                  data-read={notification.read}
                  data-type={notification.type}
                >
                  <span className="np-dot" aria-hidden="true" />
                  <span className="np-icon" aria-hidden="true">
                    <i className={cn("ti", (notification.module && MODULE_ICONS[notification.module]) || TYPE_ICONS[notification.type] || TYPE_ICONS.info)} />
                  </span>
                  <span className="np-text">
                    <span className="np-title">
                      {!notification.read && <span className="sr-only">Unread: </span>}
                      {notification.title}
                    </span>
                    <span className="np-message">{notification.message}</span>
                    <span className="np-meta">
                      {notification.audience === "account" ? "Account · " : ""}
                      {shortTime(notification)}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div className="np-empty">
                <span aria-hidden="true"><i className="ti ti-bell-off" /></span>
                <p>No notifications yet</p>
                <small>New updates will appear here.</small>
              </div>
            )}
          </div>

          <Link href={viewAllHref} onClick={() => setOpen(false)} className="np-all">
            View all notifications <i className="ti ti-arrow-right" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
