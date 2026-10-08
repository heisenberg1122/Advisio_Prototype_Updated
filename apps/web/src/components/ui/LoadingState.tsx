"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

/**
 * Standardized LoadingState
 * Provides a compact content-shaped fallback for legacy async sections.
 */
export function LoadingState({
  message = "Loading data...",
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "min-h-[220px] space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101b2b] sm:p-6",
        className
      )}
    >
      <span className="sr-only">{message}</span>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-4/5 rounded-xl" />
    </div>
  );
}

export default LoadingState;
