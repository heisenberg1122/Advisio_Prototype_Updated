import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdviserResearchGroupCardProps {
  href: string;
  title: string;
  groupName: string;
  status: string;
  currentStage: string;
  progress: number;
  memberCount: number;
  pendingTasks: number;
  leader: string;
  className?: string;
}

const readableStatus = (value: string) =>
  value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export function AdviserResearchGroupCard({
  href,
  title,
  groupName,
  status,
  currentStage,
  progress,
  memberCount,
  pendingTasks,
  leader,
  className,
}: AdviserResearchGroupCardProps) {
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  const active = status.toLowerCase() === "active";

  return (
    <Link
      href={href}
      aria-label={`Open ${groupName}: ${title}`}
      className={cn(
        "group flex min-h-[328px] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card-soft)] outline-none transition duration-200",
        "hover:-translate-y-1 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-card-hover)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]",
        className,
      )}
    >
      <div className="college-hero-surface relative min-h-[142px] overflow-hidden border-b p-5 text-[var(--color-text-primary)]">
        <div className="relative flex items-start justify-between gap-3">
          <span className="max-w-[70%] truncate rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
            {groupName}
          </span>
          <span className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wider",
            active
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-200"
              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-[var(--color-primary)]")} />
            {readableStatus(status)}
          </span>
        </div>
        <div className="relative mt-6">
          <h3 className="line-clamp-2 text-lg font-bold leading-snug tracking-tight text-[var(--color-text-primary)] group-hover:underline group-hover:decoration-[var(--color-primary)] group-hover:underline-offset-4">
            {title}
          </h3>
          <p className="mt-2 truncate text-sm font-medium text-[var(--color-text-secondary)]">Group lead: {leader}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Current research stage</p>
          <p className="mt-1 line-clamp-1 text-base font-semibold text-[var(--color-text-primary)]">{currentStage}</p>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--color-text-secondary)]">Overall progress</span>
            <span className="font-bold text-[var(--color-primary)]">{normalizedProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)] dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-500"
              style={{ width: `${normalizedProgress}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <span className="flex items-center gap-2 rounded-xl bg-[var(--color-surface-subtle)] px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
            <Users className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
            <span><strong className="text-[var(--color-text-primary)]">{memberCount}</strong> members</span>
          </span>
          <span className="flex items-center gap-2 rounded-xl bg-[var(--color-surface-subtle)] px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
            {pendingTasks ? <ClipboardList className="h-4 w-4 shrink-0 text-[#C58A18]" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2E7D5B]" />}
            <span><strong className="text-[var(--color-text-primary)]">{pendingTasks}</strong> pending</span>
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-xs font-semibold text-[var(--color-primary)] dark:border-white/10">
          <span>Open research workspace</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
