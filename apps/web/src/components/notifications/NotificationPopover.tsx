"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppNotification, useNotifications } from "@/hooks/use-notifications";

const notificationStyles = {
  success: { icon: "ti-circle-check", background: "bg-emerald-50", color: "text-emerald-600" },
  info: { icon: "ti-info-circle", background: "bg-blue-50", color: "text-blue-600" },
  warning: { icon: "ti-alert-triangle", background: "bg-amber-50", color: "text-amber-600" },
  danger: { icon: "ti-alert-circle", background: "bg-rose-50", color: "text-rose-600" },
};

interface NotificationPopoverProps {
  viewAllHref: string;
  compact?: boolean;
}

export function NotificationPopover({ viewAllHref, compact = false }: NotificationPopoverProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const previewNotifications = notifications.slice(0, 3);

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

  const openNotification = (notification: AppNotification) => {
    if (!notification.read) markAsRead(notification.id);
    setOpen(false);
    if (notification.link) router.push(notification.link);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "relative grid place-items-center text-[#173f63] transition hover:bg-slate-50 hover:text-[#f6a800] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f6a800]",
          compact ? "h-8 w-8 rounded-full" : "h-10 w-10 rounded-xl border border-slate-200"
        )}
      >
        <i className={cn("ti ti-bell", compact ? "text-[22px]" : "text-xl")} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Recent notifications"
          className="absolute right-0 top-[calc(100%+10px)] z-[100] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-2xl shadow-slate-900/15"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-extrabold text-[#102f49]">Notifications</p>
              <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You're all caught up"}
              </p>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllAsRead} className="text-[10px] font-extrabold text-[#1b4264] hover:text-[#f0a000]">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[330px] overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4" aria-label="Loading notifications">
                {[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
              </div>
            ) : previewNotifications.length > 0 ? (
              previewNotifications.map((notification) => {
                const styles = notificationStyles[notification.type] || notificationStyles.info;
                return (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => openNotification(notification)}
                    className={cn(
                      "relative flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50",
                      !notification.read && "bg-amber-50/35"
                    )}
                  >
                    {!notification.read && <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#f6a800]" />}
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", styles.background, styles.color)}>
                      <i className={cn("ti text-lg", styles.icon)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-extrabold text-[#173f63]">{notification.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[11px] font-medium leading-4 text-slate-500">{notification.message}</span>
                      <span className="mt-1 block text-[9px] font-bold text-slate-400">{notification.time}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center px-5 py-8 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400"><i className="ti ti-bell-off text-xl" /></span>
                <p className="mt-3 text-xs font-bold text-slate-500">No notifications yet</p>
                <p className="mt-1 text-[10px] text-slate-400">New updates will appear here.</p>
              </div>
            )}
          </div>

          <Link
            href={viewAllHref}
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-[11px] font-extrabold text-[#1b4264] transition hover:bg-slate-100"
          >
            View all notifications <i className="ti ti-arrow-right text-sm" />
          </Link>
        </div>
      )}
    </div>
  );
}
