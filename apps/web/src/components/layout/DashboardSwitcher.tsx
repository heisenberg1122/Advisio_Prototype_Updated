"use client";

import React, { useState } from "react";
import {
  Award,
  BookOpen,
  BookOpenCheck,
  Check,
  ChevronDown,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Loader2,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  type DashboardWorkspace,
  type DashboardWorkspaceId,
} from "@research-management/auth";
import { useDashboardWorkspace } from "@/providers/dashboard-workspace-provider";
import { cn } from "@/lib/utils";

const WORKSPACE_ICONS: Record<
  DashboardWorkspaceId,
  React.ComponentType<{ className?: string }>
> = {
  researcher: GraduationCap,
  adviser: Users,
  panelist: Award,
  coordinator: BookOpen,
  dean: Landmark,
  ethics: ShieldCheck,
  "academic-affairs": BookOpenCheck,
  "system-admin": Settings,
};

export interface DashboardSwitcherProps {
  onCloseMenu?: () => void;
  className?: string;
}

export function DashboardSwitcher({
  onCloseMenu,
  className,
}: DashboardSwitcherProps) {
  const {
    availableWorkspaces,
    activeWorkspace,
    isMultiRole,
    isSwitching,
    switchDashboard,
  } = useDashboardWorkspace();

  const [isExpanded, setIsExpanded] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Single-role users do not see the switcher control
  if (!isMultiRole) {
    return null;
  }

  const handleSelect = async (workspace: DashboardWorkspace) => {
    if (workspace.id === activeWorkspace?.id) {
      onCloseMenu?.();
      return;
    }

    if (isSwitching) return;
    setSwitchingId(workspace.id);

    try {
      const success = await switchDashboard(workspace.id);
      if (success) {
        onCloseMenu?.();
      }
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <div className={cn("py-1 border-b border-slate-100 dark:border-white/10", className)}>
      {/* Switch Dashboard Trigger Row */}
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls="dashboard-switcher-options"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] cursor-pointer select-none"
      >
        <span className="flex items-center gap-2.5">
          <LayoutDashboard className="h-4 w-4 text-[var(--color-primary)]" />
          <span>Switch dashboard</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-400 transition-transform duration-200",
            isExpanded && "rotate-180 text-[var(--color-primary)]"
          )}
        />
      </button>

      {/* Expanded Dashboards List */}
      {isExpanded && (
        <div
          id="dashboard-switcher-options"
          className="mt-1 space-y-1 pb-1 animate-fade-in"
        >
          <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Your dashboards
          </div>

          <div className="space-y-1 max-h-56 overflow-y-auto overscroll-contain pr-1">
            {availableWorkspaces.map((ws) => {
              const isCurrent = ws.id === activeWorkspace?.id;
              const isThisSwitching = isSwitching && switchingId === ws.id;
              const Icon = WORKSPACE_ICONS[ws.id] || BookOpen;

              return (
                <button
                  key={ws.id}
                  type="button"
                  aria-current={isCurrent ? "true" : undefined}
                  disabled={isSwitching}
                  onClick={() => handleSelect(ws)}
                  className={cn(
                    "w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-colors cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] disabled:opacity-60",
                    isCurrent
                      ? "bg-[var(--color-primary-light)] text-[var(--color-primary)] font-bold dark:bg-white/10 dark:text-white"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                      isCurrent
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"
                    )}
                  >
                    {isThisSwitching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold truncate">
                        {ws.label}
                      </span>
                      {isCurrent && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[var(--color-primary)] dark:bg-white/20 dark:text-white">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                          Current
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-400 line-clamp-1 leading-snug">
                      {ws.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
