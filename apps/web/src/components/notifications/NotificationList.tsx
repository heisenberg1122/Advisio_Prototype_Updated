"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useNotifications, AppNotification } from "@/hooks/use-notifications";
import { Tag } from "@/components/ui/Tag";
import { useRouter } from "next/navigation";

const iconMap = {
  success: { icon: "ti-circle-check", bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
  info:    { icon: "ti-info-circle",   bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-100"    },
  warning: { icon: "ti-alert-triangle", bg: "bg-amber-50",   text: "text-amber-600",   border: "border-amber-100" },
  danger:  { icon: "ti-alert-circle",   bg: "bg-rose-50",    text: "text-rose-600",    border: "border-rose-100"  },
};

const moduleVariantMap: Record<string, "info" | "success" | "warn" | "danger" | "neutral"> = {
  Documents: "info",
  Consultation: "success",
  Defense: "warn",
  Milestones: "danger",
  Announcements: "neutral",
  "Adviser Requests": "warn",
};

export function NotificationList() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<"all" | "unread" | "read">("all");

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
        ))}
      </div>
    );
  }

  const filtered = notifications.filter((n) => {
    if (activeTab === "unread") return !n.read;
    if (activeTab === "read") return n.read;
    return true;
  });

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.read) {
      markAsRead(n.id);
    }
    if (n.link) {
      router.push(n.link);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-[12.5px]">
      
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        
        {/* Filter Tabs */}
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
          {(["all", "unread", "read"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1.5 rounded-md font-bold transition capitalize cursor-pointer",
                activeTab === tab
                  ? "bg-white text-[#1b4264] shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {tab}
              {tab === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 bg-[#ffa400] text-[#1b4264] px-1.5 py-0.5 rounded-full text-[9px] font-extrabold">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Action Button */}
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-3.5 py-1.5 border border-[#1b4264]/20 hover:border-[#1b4264] hover:bg-slate-50 text-[#1b4264] font-bold rounded-lg transition active:scale-[0.98] cursor-pointer"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 bg-slate-50/50 rounded-2xl flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-400">
            <i className="ti ti-bell-off text-xl" />
          </div>
          <div className="font-bold text-slate-500">No {activeTab !== "all" ? activeTab : ""} notifications found</div>
          <p className="text-[11px] text-slate-400 font-medium">You are all caught up!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((n) => {
            const styles = iconMap[n.type] || iconMap.info;
            return (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={cn(
                  "p-4 rounded-xl border border-slate-200 flex items-start gap-4 transition-all duration-150 relative group cursor-pointer hover:border-slate-350 hover:shadow-sm",
                  n.read ? "bg-white" : "bg-slate-50/60 font-semibold"
                )}
              >
                {/* Unread Indicator Dot */}
                {!n.read && (
                  <span className="absolute left-2.5 top-[22px] w-2 h-2 bg-[#ffa400] rounded-full border border-white" />
                )}

                {/* Left Icon */}
                <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center text-lg flex-shrink-0", styles.bg, styles.text, styles.border)}>
                  <i className={cn("ti", styles.icon)} />
                </div>

                {/* Message Body */}
                <div className="flex-1 min-w-0 pr-8">
                  <div className="flex items-center flex-wrap gap-2 mb-0.5">
                    <span className="font-extrabold text-[#1b4264] text-[13.5px] leading-tight truncate">
                      {n.title}
                    </span>
                    {n.module && (
                      <Tag variant={moduleVariantMap[n.module] || "neutral"} size="sm">
                        {n.module}
                      </Tag>
                    )}
                  </div>
                  <p className="text-slate-650 text-[12px] leading-relaxed break-words font-medium">
                    {n.message}
                  </p>
                  <span className="text-[10px] text-slate-400 font-bold block mt-1.5">
                    {n.time}
                  </span>
                </div>

                {/* Right Action Menu */}
                <div className="absolute right-3 top-3.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!n.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(n.id);
                      }}
                      title="Mark as read"
                      className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:text-emerald-600 text-slate-500 flex items-center justify-center cursor-pointer transition active:scale-[0.9]"
                    >
                      <i className="ti ti-check text-base" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    title="Dismiss notification"
                    className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:text-rose-600 text-slate-500 flex items-center justify-center cursor-pointer transition active:scale-[0.9]"
                  >
                    <i className="ti ti-trash text-base" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
