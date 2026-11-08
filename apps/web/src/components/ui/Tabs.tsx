"use client";

import React, { ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion, LayoutGroup } from "motion/react";
import { uiMotion } from "@/lib/ui-motion";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }> | string;
  badge?: string | number;
  /** Optional Guide target placed on the tab button. */
  guide?: string;
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
  const id = useId();
  const reduceMotion = useReducedMotion();
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
    <LayoutGroup id={id}>
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
              data-guide={tab.guide}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const currentIndex = tabs.findIndex(
                  (item) => item.id === tab.id,
                );
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
                "group relative flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-all duration-150 select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--college-focus-ring)]",
                isActive
                  ? "text-[var(--color-primary)] border-b-2 border-b-transparent font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-[var(--color-primary)] border-b-2 border-b-transparent hover:border-b-[var(--color-primary)] font-medium",
              )}
            >
              {isActive && (
                <motion.span
                  aria-hidden="true"
                  layoutId="active-tab-underline"
                  initial={false}
                  transition={{
                    duration: reduceMotion ? 0 : uiMotion.state,
                    ease: uiMotion.ease,
                  }}
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--color-primary)]"
                />
              )}
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
    </LayoutGroup>
  );
}

export default Tabs;
