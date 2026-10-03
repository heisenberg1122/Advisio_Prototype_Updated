"use client";

import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }> | string;
  badge?: string | number;
  actions?: ReactNode;
  className?: string;
}

/**
 * Standardized SectionHeader
 * Provides consistent typography, icon alignment, and action positioning across section blocks.
 */
export function SectionHeader({
  title,
  description,
  icon: Icon,
  badge,
  actions,
  className,
  ...props
}: SectionHeaderProps) {
  const renderIcon = () => {
    if (!Icon) return null;
    if (typeof Icon === "string") {
      return <i className={cn("ti", Icon, "text-lg text-[#0B3A53] dark:text-[#C9A227]")} aria-hidden="true" />;
    }
    const LucideIcon = Icon;
    return <LucideIcon className="h-5 w-5 text-[#0B3A53] dark:text-[#C9A227] shrink-0" />;
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EEF2F6] dark:border-white/10",
        className
      )}
      {...props}
    >
      <div>
        <div className="flex items-center gap-2">
          {renderIcon()}
          <h2 className="text-base sm:text-lg font-extrabold text-[#17212B] dark:text-white tracking-tight">
            {title}
          </h2>
          {badge !== undefined && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EAF3F7] dark:bg-white/10 text-[#0B3A53] dark:text-[#38bdf8]">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
          {actions}
        </div>
      )}
    </div>
  );
}

export default SectionHeader;
