"use client";

import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ComponentType<{ className?: string }> | string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Standardized EmptyState
 * Provides consistent spacing, icon badge, and actionable layout for empty lists, search results, or queues.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  const renderIcon = () => {
    if (!Icon) return null;
    if (typeof Icon === "string") {
      return <i className={cn("ti", Icon, "text-3xl text-slate-400 dark:text-slate-500")} aria-hidden="true" />;
    }
    const LucideIcon = Icon;
    return <LucideIcon className="h-8 w-8 text-slate-400 dark:text-slate-500 stroke-[1.75]" />;
  };

  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-dashed border-[#DDE3E8] dark:border-white/10 bg-white/60 dark:bg-[#101b2b]/60 p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-3",
        className
      )}
      {...props}
    >
      {Icon && (
        <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-1">
          {renderIcon()}
        </div>
      )}
      <h3 className="text-base sm:text-lg font-extrabold text-[#17212B] dark:text-white">
        {title}
      </h3>
      {description && (
        <p className="max-w-md text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
