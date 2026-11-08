import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatusDot, type StatusTone } from "@/components/ui/advisio";

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

export const readableAdviserGroupStatus = (value: string) =>
  value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export const adviserGroupStatusTone = (value: string): StatusTone => {
  const status = value.toUpperCase();
  if (status === "ACTIVE" || status === "APPROVED") return "done";
  if (status === "COMPLETED") return "neutral";
  if (status === "REJECTED") return "attention";
  return "brand";
};

/** "Research Group B" becomes "B"; other names use their first letter. */
export const adviserGroupInitial = (groupName: string) => {
  const words = groupName.trim().split(/\s+/);
  const last = words[words.length - 1] ?? "";
  return (last.length <= 2 ? last : words[0]?.[0] ?? "?").toUpperCase();
};

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

  return (
    <Link
      href={href}
      data-guide="adviser-group-card"
      aria-label={`Open ${groupName}: ${title}`}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-[18px] shadow-[0_1px_2px_rgb(20_35_50/4%),0_6px_18px_rgb(20_35_50/6%)] outline-none transition duration-200 dark:shadow-none",
        "hover:-translate-y-0.5 hover:border-[var(--color-primary)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-surface))] text-[15px] font-bold text-[var(--color-primary)]"
        >
          {adviserGroupInitial(groupName)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-text-secondary)]">{groupName}</span>
        <StatusDot tone={adviserGroupStatusTone(status)}>{readableAdviserGroupStatus(status)}</StatusDot>
      </div>

      {/* Three reserved lines keep the stage and progress aligned across a row of cards. */}
      <h3
        title={title}
        className="line-clamp-3 min-h-[4.125rem] text-base font-semibold leading-[1.375rem] text-[var(--color-text-primary)] group-hover:underline group-hover:decoration-[var(--color-primary)] group-hover:underline-offset-4"
      >
        {title}
      </h3>

      <div className="mt-auto">
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate font-medium text-[var(--color-text-secondary)]">{currentStage}</span>
          <span className="shrink-0 font-semibold text-[var(--color-text-primary)]">{normalizedProgress}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={`${groupName} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={normalizedProgress}
          className="h-[7px] overflow-hidden rounded-full bg-[var(--color-surface-muted)] dark:bg-white/10"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              normalizedProgress >= 100 ? "bg-[var(--color-success)]" : "bg-[var(--color-primary)]",
            )}
            style={{ width: `${normalizedProgress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3 text-sm text-[var(--color-text-secondary)]">
        <span className="min-w-0 truncate">
          {memberCount} members · lead {leader}
        </span>
        {pendingTasks ? (
          <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--color-warning)_16%,var(--color-surface))] px-2.5 py-0.5 text-[12.5px] font-semibold text-[var(--au-waiting)]">
            {pendingTasks} pending
          </span>
        ) : (
          <span className="shrink-0 py-0.5 text-[12.5px]">Nothing pending</span>
        )}
      </div>
    </Link>
  );
}
