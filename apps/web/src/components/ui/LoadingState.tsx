"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

/**
 * Standardized LoadingState
 * Provides consistent academic loader styling and messaging across async dashboard sections.
 */
export function LoadingState({
  message = "Loading data...",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "min-h-[220px] flex flex-col items-center justify-center p-8 text-center gap-3",
        className
      )}
    >
      <div className="h-10 w-10 border-3 border-[#0B3A53] dark:border-[#C9A227] border-t-transparent rounded-full animate-spin" />
      <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
        {message}
      </p>
    </div>
  );
}

export default LoadingState;
