"use client";

import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }> | string;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

/**
 * Standardized Tab Bar Component
 * Provides Google Classroom-style clean tab navigation with badge counts and smooth active states.
 */
export function Tabs({
  tabs,
  activeTab,
  onChange,
  className,
}: TabsProps) {
  const renderIcon = (icon?: React.ComponentType<{ className?: string }> | string) => {
    if (!icon) return null;
    if (typeof icon === "string") {
      return <i className={cn("ti", icon, "text-base")} aria-hidden="true" />;
    }
    const LucideIcon = icon;
    return <LucideIcon className="h-4 w-4 shrink-0" />;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1 border-b border-[#EEF2F6] dark:border-white/10 overflow-x-auto no-scrollbar",
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "group relative flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-150 select-none cursor-pointer outline-none",
              isActive
                ? "text-[#0B3A53] dark:text-[#C9A227] border-b-2 border-b-[#0B3A53] dark:border-b-[#C9A227]"
                : "text-slate-500 dark:text-slate-400 hover:text-[#0B3A53] dark:hover:text-white border-b-2 border-b-transparent hover:border-b-slate-300"
            )}
          >
            {renderIcon(tab.icon)}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  "ml-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full",
                  isActive
                    ? "bg-[#0B3A53]/10 dark:bg-white/10 text-[#0B3A53] dark:text-[#C9A227]"
                    : "bg-slate-100 dark:bg-white/5 text-slate-500"
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
