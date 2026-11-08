"use client";

import React, { useState } from "react";
import { useNotifications, AppNotification } from "@/hooks/use-notifications";
import { useRouter } from "next/navigation";
import { NotificationListSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/use-auth";
import { getAcademicIdentity } from "@/lib/academic-identity";
import { calendarDaysUntil } from "@/lib/researcher-home";
import "./notification-list.css";

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
const INBOXES = [
  { value: undefined, label: "Updates" },
  { value: "account", label: "Account" },
  { value: "earlier", label: "Earlier" },
] as const;

function dayGroup(notification: AppNotification, now: number) {
  if (!notification.createdAt) return "Recent";
  const date = new Date(notification.createdAt);
  if (Number.isNaN(date.getTime())) return "Recent";
  const offset = calendarDaysUntil(date, now);
  if (offset === 0) return "Today";
  if (offset === -1) return "Yesterday";
  if (offset > -7) return "This week";
  return date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "long", year: "numeric" });
}

function timeLabel(notification: AppNotification, group: string) {
  if (!notification.createdAt) return notification.time;
  const date = new Date(notification.createdAt);
  if (Number.isNaN(date.getTime())) return notification.time;
  return group === "Today" || group === "Yesterday"
    ? date.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })
    : notification.time;
}

/**
 * Notification inbox. `standalone` renders its own card with a header band
 * (the researcher page); other portals wrap it in their own card.
 */
export function NotificationList({ standalone = false }: { standalone?: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const seal = standalone ? getAcademicIdentity({ college: user?.college, program: user?.program })?.logoSrc : undefined;
  const [inbox, setInbox] = useState<"account" | "earlier" | undefined>();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    retry,
    inboxLabel,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications(inbox);
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "read">("all");

  if (loading) {
    return <NotificationListSkeleton rows={5} />;
  }

  const now = Date.now();
  const filtered = notifications.filter((n) => {
    if (activeTab === "unread") return !n.read;
    if (activeTab === "read") return n.read;
    return true;
  });
  const groups: Array<{ label: string; items: AppNotification[] }> = [];
  for (const notification of filtered) {
    const label = dayGroup(notification, now);
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
    groups.at(-1)!.items.push(notification);
  }

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.read && !(await markAsRead(n.id))) return;
    if (n.link) router.push(n.link);
  };

  const markAll = unreadCount > 0 && (
    <button type="button" onClick={markAllAsRead} className="nl-btn" aria-label={`Mark ${inboxLabel.toLowerCase()} as read`}>
      <i className="ti ti-checks" aria-hidden="true" /> Mark all as read
    </button>
  );

  const body = (
    <>
      {standalone && (
        <header className="nl-band">
          {seal && <img className="nl-seal" src={seal} alt="" aria-hidden="true" draggable={false} />}
          <div>
            <p><strong>Notifications</strong> · {inboxLabel}</p>
            <h1>{unreadCount ? `${unreadCount} unread` : "You're all caught up"}</h1>
          </div>
          {markAll}
        </header>
      )}
      <div className="nl-controls">
        <div className="nl-tabs" role="group" aria-label="Notification inbox">
          {INBOXES.map(({ value, label }) => (
            <button key={label} type="button" aria-pressed={inbox === value} onClick={() => setInbox(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="nl-controls-side">
          <div className="nl-seg" role="group" aria-label="Filter notifications">
            {(["all", "unread", "read"] as const).map((tab) => (
              <button key={tab} type="button" aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)}>
                {tab === "all" ? "All" : tab === "unread" ? "Unread" : "Read"}
                {tab === "unread" && unreadCount > 0 && <span className="nl-seg-count">{unreadCount}</span>}
              </button>
            ))}
          </div>
          {!standalone && markAll}
        </div>
      </div>
      {error && (
        <div role="alert" className="nl-error">
          {error}{" "}
          <button type="button" onClick={retry}>Retry</button>
        </div>
      )}
      {error ? null : filtered.length === 0 ? (
        <div className="nl-empty">
          <span className="nl-empty-icon"><i className="ti ti-bell-off" aria-hidden="true" /></span>
          <p>{activeTab === "unread" ? "No unread notifications" : activeTab === "read" ? "Nothing read yet" : "No notifications here"}</p>
          <span>You're all caught up.</span>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="nl-group" aria-label={group.label}>
            <h2>{group.label}</h2>
            <ul>
              {group.items.map((n) => (
                <li key={n.id} className="nl-item" data-read={n.read} data-type={n.type}>
                  <button type="button" className="nl-item-main" onClick={() => handleNotificationClick(n)}>
                    <span className="nl-dot" aria-hidden="true" />
                    <span className="nl-icon" aria-hidden="true">
                      <i className={`ti ${(n.module && MODULE_ICONS[n.module]) || TYPE_ICONS[n.type] || TYPE_ICONS.info}`} />
                    </span>
                    <span className="nl-text">
                      <span className="nl-title">
                        {!n.read && <span className="sr-only">Unread: </span>}
                        {n.title}
                      </span>
                      <span className="nl-message">{n.message}</span>
                      {(n.module || n.link) && (
                        <span className="nl-meta">
                          {n.module}
                          {n.module && n.link ? " · " : ""}
                          {n.link && <span className="nl-open">Open <i className="ti ti-arrow-right" aria-hidden="true" /></span>}
                        </span>
                      )}
                    </span>
                    <time className="nl-time" dateTime={n.createdAt}>{timeLabel(n, group.label)}</time>
                  </button>
                  <span className="nl-actions">
                    {!n.read && (
                      <button type="button" onClick={() => markAsRead(n.id)} title="Mark as read" aria-label={`Mark "${n.title}" as read`}>
                        <i className="ti ti-check" aria-hidden="true" />
                      </button>
                    )}
                    <button type="button" onClick={() => deleteNotification(n.id)} title="Dismiss notification" aria-label={`Dismiss "${n.title}"`}>
                      <i className="ti ti-x" aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );

  return <div className="nl" data-standalone={standalone}>{body}</div>;
}
