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
export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  const renderIcon = (
    icon?: React.ComponentType<{ className?: string }> | string,
  ) => {
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
        "flex items-center gap-1 border-b border-[var(--color-border)] overflow-x-auto no-scrollbar",
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const currentIndex = tabs.findIndex((item) => item.id === tab.id);
              const nextIndex =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (currentIndex +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        tabs.length) %
                      tabs.length;
              const next = tabs[nextIndex];
              onChange(next.id);
              window.requestAnimationFrame(() =>
                document.getElementById(`tab-${next.id}`)?.focus(),
              );
            }}
            className={cn(
              "group relative flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--college-focus-ring)]",
              isActive
                ? "text-[var(--color-primary)] border-b-2 border-b-[var(--color-primary)] font-semibold"
                : "text-slate-500 dark:text-slate-400 hover:text-[var(--color-primary)] border-b-2 border-b-transparent hover:border-b-[var(--color-primary)] font-medium",
            )}
          >
            {renderIcon(tab.icon)}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  "ml-1 text-xs font-semibold px-1.5 py-0.5 rounded-full",
                  isActive
                    ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                    : "bg-slate-100 dark:bg-white/5 text-slate-500",
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
