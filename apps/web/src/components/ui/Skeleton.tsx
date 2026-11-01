import React from "react";
import { cn } from "@/lib/utils";
import { AdvisioBrandMark } from "./AdvisioBrandMark";
import { contentSkeletonKindForPath } from "@/lib/skeleton-routing";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { workspaceViewForLocation } from "@/lib/workspace-appearance";
import "@/components/layout/workspace-layout.css";

export { contentSkeletonKindForPath } from "@/lib/skeleton-routing";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn("skeleton-shimmer rounded-lg", className)}
      {...props}
    />
  );
}

function LoadingRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-atomic="true"
      className={className}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function DashboardHeroSkeleton() {
  return (
    <div className="college-hero-surface relative overflow-hidden rounded-2xl border border-[var(--color-border)] p-6 sm:p-7 shadow-[var(--shadow-card-soft)]">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 max-w-xl space-y-3">
          <Skeleton className="h-3.5 w-32 rounded-md bg-[var(--color-primary)]/20" />
          <Skeleton className="h-8 w-72 max-w-full rounded-xl bg-[var(--color-primary)]/25" />
          <Skeleton className="h-4 w-96 max-w-[80vw] rounded-md bg-[var(--color-primary)]/15" />
        </div>
        <Skeleton className="h-11 w-36 shrink-0 rounded-xl bg-[var(--color-primary)]/25" />
      </div>
    </div>
  );
}

export function PageHeadingSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex min-h-14 items-start justify-between gap-3 sm:gap-4">
      <div className="min-w-0 flex-1 space-y-2.5">
        <Skeleton className="h-7 w-48 sm:w-64" />
        <Skeleton className="h-3.5 w-4/5 max-w-80" />
      </div>
      {action && <Skeleton className="h-10 w-10 shrink-0 rounded-xl sm:w-32" />}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex min-h-[104px] flex-col items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card-soft)] sm:flex-row sm:items-center sm:gap-4 sm:p-5"
        >
          <Skeleton className="h-12 w-12 shrink-0 rounded-xl bg-[var(--color-primary-light)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion
      label="Loading dashboard"
      className={cn("mx-auto w-full max-w-screen-2xl space-y-6 p-4 sm:p-6 lg:p-8", className)}
    >
      <DashboardHeroSkeleton />
      <StatCardsSkeleton />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
        <div className="space-y-5">
          {/* Getting Started card */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
            <div className="flex items-center justify-between pb-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 text-center">
                  <Skeleton className="h-10 w-10 rounded-full bg-[var(--color-primary-light)]" />
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity card */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
            <Skeleton className="mb-4 h-5 w-32" />
            <div className="flex flex-col items-center justify-center py-8">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="mt-3 h-3.5 w-28" />
              <Skeleton className="mt-1 h-2.5 w-44" />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {/* Next Consultation card */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
            <Skeleton className="mb-4 h-5 w-36" />
            <div className="flex flex-col items-center justify-center py-6">
              <Skeleton className="h-10 w-10 rounded-full bg-[var(--color-primary-light)]" />
              <Skeleton className="mt-3 h-3.5 w-36" />
              <Skeleton className="mt-1 h-2.5 w-48" />
              <Skeleton className="mt-5 h-11 w-full rounded-xl bg-[var(--color-primary)]/20" />
            </div>
          </div>

          {/* Quick Actions card */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
            <Skeleton className="mb-4 h-5 w-28" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3"
                >
                  <Skeleton className="h-6 w-6 rounded-md bg-[var(--color-primary-light)]" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

export function ListRowsSkeleton({ rows = 5, avatars = true }: { rows?: number; avatars?: boolean }) {
  return (
    <div className="divide-y divide-[var(--color-border)]/60 dark:divide-white/5">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
          {avatars && <Skeleton className="h-9 w-9 shrink-0 rounded-full" />}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={cn("h-3.5", index % 2 ? "w-3/4 sm:w-2/3" : "w-2/3 sm:w-1/2")} />
            <Skeleton className="h-3 w-1/2 sm:w-1/3" />
          </div>
          <Skeleton className="hidden h-6 w-16 shrink-0 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

export function ListPageSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <LoadingRegion label="Loading list" className={cn("mx-auto w-full max-w-screen-2xl space-y-6 p-4 sm:p-6 lg:p-8", className)}>
      <PageHeadingSkeleton />
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
        <div className="mb-5 flex gap-3"><Skeleton className="h-10 flex-1 rounded-xl" /><Skeleton className="h-10 w-28 rounded-xl" /></div>
        <ListRowsSkeleton rows={rows} />
      </div>
    </LoadingRegion>
  );
}

export function CardsPageSkeleton({ cards = 4, className }: { cards?: number; className?: string }) {
  return (
    <LoadingRegion label="Loading cards" className={cn("mx-auto w-full max-w-screen-2xl space-y-6 p-4 sm:p-6 lg:p-8", className)}>
      <PageHeadingSkeleton />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
            <div className="flex gap-3"><Skeleton className="h-12 w-12 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" /></div></div>
            <Skeleton className="mt-5 h-16 w-full rounded-xl" />
            <div className="mt-5 flex justify-between"><Skeleton className="h-6 w-20 rounded-full" /><Skeleton className="h-9 w-24 rounded-xl" /></div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  const minimumWidth = Math.max(640, columns * 132);

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card-soft)]">
      <div style={{ minWidth: `${minimumWidth}px` }}>
        <div className="grid gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-5 py-4 dark:border-white/10 dark:bg-white/5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, index) => <Skeleton key={index} className="h-3 w-3/4" />)}
        </div>
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="grid items-center gap-4 border-b border-[var(--color-border)]/60 px-5 py-4 last:border-0 dark:border-white/5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((_, column) => <Skeleton key={column} className={cn("h-3.5", column === 0 ? "w-4/5" : "w-2/3")} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TablePageSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion label="Loading table" className={cn("mx-auto w-full max-w-screen-2xl space-y-6 p-4 sm:p-6 lg:p-8", className)}>
      <PageHeadingSkeleton />
      <div className="flex flex-col gap-3 sm:flex-row"><Skeleton className="h-10 flex-1 rounded-xl" /><Skeleton className="h-10 w-full rounded-xl sm:w-40" /></div>
      <TableSkeleton />
    </LoadingRegion>
  );
}

export function ProfileSkeleton({ editing = false, className }: { editing?: boolean; className?: string }) {
  return (
    <LoadingRegion label={editing ? "Loading profile form" : "Loading profile"} className={cn("w-full space-y-6", className)}>
      <div className="flex flex-col items-center justify-between gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card-soft)] sm:flex-row sm:p-8">
        <div className="flex flex-col items-center gap-5 sm:flex-row"><Skeleton className="h-20 w-20 rounded-full" /><div className="space-y-2.5"><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-36" /><Skeleton className="h-6 w-24 rounded-full" /></div></div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      {editing ? <FormCards /> : <div className="grid gap-6 md:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="min-h-48 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card-soft)]"><Skeleton className="mb-6 h-4 w-1/2" /><ListRowsSkeleton rows={3} avatars={false} /></div>)}</div>}
    </LoadingRegion>
  );
}

function FormCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, card) => (
        <div key={card} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
          <Skeleton className="mb-5 h-5 w-36" />
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, field) => <div key={field} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-11 w-full rounded-xl" /></div>)}</div>
        </div>
      ))}
    </div>
  );
}

export function FormPageSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion label="Loading form" className={cn("mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8", className)}>
      <PageHeadingSkeleton action={false} />
      <FormCards />
    </LoadingRegion>
  );
}

function NotificationRows({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex gap-3 rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-surface-subtle)] p-4 dark:border-white/5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-full" /><Skeleton className="h-2.5 w-24" /></div>
        </div>
      ))}
    </div>
  );
}

export function NotificationListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <LoadingRegion label="Loading notifications" className={className}>
      <NotificationRows rows={rows} />
    </LoadingRegion>
  );
}

export function NotificationsPageSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion label="Loading notifications page" className={cn("mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8", className)}>
      <PageHeadingSkeleton />
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card-soft)] sm:p-5"><NotificationRows rows={6} /></div>
    </LoadingRegion>
  );
}

export function CalendarSkeleton({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <LoadingRegion label="Loading calendar" className={cn(!compact && "mx-auto w-full max-w-[1800px] space-y-5 p-3 sm:p-5 lg:p-6 xl:p-7", className)}>
      {!compact && (
        <div className="college-hero-surface rounded-[24px] border border-[var(--color-border)] px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <Skeleton className="h-12 w-12 shrink-0 rounded-2xl bg-[var(--color-primary)]/20" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <Skeleton className="h-2.5 w-28" />
                <Skeleton className="h-8 w-72 max-w-full" />
                <Skeleton className="h-3.5 w-[32rem] max-w-full" />
              </div>
            </div>
            <Skeleton className="h-16 w-full rounded-2xl lg:w-72" />
          </div>
        </div>
      )}
      <div className={cn("grid items-start gap-5", !compact && "xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_344px]")}>
        <div className="overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card-soft)]">
          <div className="flex flex-col gap-4 border-b border-[var(--color-border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-white/10">
            <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-xl" /><div className="space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-2.5 w-24" /></div></div>
            <div className="grid grid-cols-[40px_1fr_40px] gap-2 sm:flex"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-10 w-full rounded-xl sm:w-20" /><Skeleton className="h-10 w-10 rounded-xl" /></div>
          </div>
          <div className="flex gap-4 overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-3 dark:border-white/10"><Skeleton className="h-3 w-20 shrink-0" />{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-3 w-16 shrink-0" />)}</div>
          <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] dark:border-white/10">{Array.from({ length: 7 }).map((_, index) => <div key={index} className="p-2 sm:p-3"><Skeleton className="mx-auto h-3 w-3 sm:w-8" /></div>)}</div>
          <div className="grid grid-cols-7">{Array.from({ length: 42 }).map((_, index) => <div key={index} className="min-h-[72px] border-b border-r border-[var(--color-border)]/60 p-1 dark:border-white/5 sm:min-h-28 sm:p-2"><Skeleton className="h-7 w-7 rounded-full sm:h-8 sm:w-8" />{index % 4 === 0 && <Skeleton className="mt-2 hidden h-5 w-full rounded-md sm:block" />}</div>)}</div>
        </div>
        {!compact && <div className="space-y-4"><div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)]"><Skeleton className="h-5 w-32" /><div className="mt-5 space-y-4"><ListRowsSkeleton rows={3} avatars={false} /></div></div><div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)]"><Skeleton className="h-5 w-24" /><div className="mt-4 flex flex-wrap gap-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-7 w-20 rounded-full" />)}</div></div></div>}
      </div>
    </LoadingRegion>
  );
}

export function MailPageSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion label="Loading inbox" className={cn("flex h-[calc(100vh-4rem)] min-h-0 w-full flex-1 flex-col overflow-hidden rounded-tl-[32px] bg-[var(--color-surface)] md:flex-row", className)}>
      <aside className="hidden w-52 shrink-0 border-r border-[var(--color-border)] p-4 dark:border-white/10 md:block lg:w-56"><Skeleton className="mb-5 h-10 w-full rounded-xl bg-[var(--color-primary)]/20" /><ListRowsSkeleton rows={4} avatars={false} /></aside>
      <section className="w-full shrink-0 border-b border-[var(--color-border)] dark:border-white/10 md:w-80 md:border-b-0 md:border-r lg:w-[340px]"><div className="border-b border-[var(--color-border)] p-4 dark:border-white/10"><Skeleton className="h-5 w-24" /></div><div className="p-4"><ListRowsSkeleton rows={7} /></div></section>
      <section className="hidden min-w-0 flex-1 p-6 md:block"><Skeleton className="h-6 w-1/2" /><Skeleton className="mt-3 h-3 w-1/3" /><div className="mt-8 space-y-4"><Skeleton className="h-24 w-3/4 rounded-2xl" /><Skeleton className="ml-auto h-20 w-2/3 rounded-2xl" /><Skeleton className="h-28 w-4/5 rounded-2xl" /></div><Skeleton className="mt-8 h-12 w-full rounded-xl" /></section>
    </LoadingRegion>
  );
}

export function FilesPageSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion label="Loading files" className={cn("mx-auto w-full max-w-screen-2xl space-y-5 p-4 sm:p-6 lg:p-8", className)}>
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card-soft)]"><div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 dark:border-white/10 sm:flex-row"><Skeleton className="h-9 flex-1 rounded-xl" /><Skeleton className="h-9 w-full rounded-xl sm:w-32" /></div><div className="p-5"><ListRowsSkeleton rows={6} /></div></div>
        <div className="space-y-4"><Skeleton className="h-44 w-full rounded-2xl" /><Skeleton className="h-40 w-full rounded-2xl" /></div>
      </div>
    </LoadingRegion>
  );
}

export function DocumentPreviewSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion
      label="Preparing document preview"
      className={cn("grid min-h-[420px] place-items-center bg-[var(--color-surface-subtle)] p-4 dark:bg-slate-950/40 sm:p-8", className)}
    >
      <div className="aspect-[8.5/11] w-full max-w-xl rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-lg sm:p-10">
        <Skeleton className="mx-auto h-5 w-2/5" />
        <Skeleton className="mx-auto mt-3 h-3 w-1/3" />
        <div className="mt-10 space-y-3">
          {Array.from({ length: 11 }).map((_, index) => (
            <Skeleton key={index} className={cn("h-3", index === 10 ? "w-2/3" : index % 4 === 0 ? "w-11/12" : "w-full")} />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

function DefenseEvaluationPlaceholder() {
  const columns = { gridTemplateColumns: "minmax(180px, 1.8fr) repeat(3, minmax(90px, 1fr))" };
  return (
    <div className="min-h-[336px] min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-5 w-56 max-w-full" /><Skeleton className="h-3 w-4/5 max-w-xl" /></div>
        <Skeleton className="h-3 w-60 max-w-full" />
      </div>
      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid items-center gap-5 border-y border-[var(--color-border)] py-5" style={columns}>
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 }).map((_, index) => <div key={index} className="space-y-2"><Skeleton className="ml-auto h-4 w-28 max-w-full" /><Skeleton className="ml-auto h-3 w-16" /></div>)}
          </div>
          {Array.from({ length: 2 }).map((_, row) => <div key={row} className="grid items-center gap-5 border-b border-[var(--color-border)] py-6" style={columns}>
            <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-24" /></div>
            {Array.from({ length: 3 }).map((_, column) => <Skeleton key={column} className="ml-auto h-4 w-14" />)}
          </div>)}
        </div>
      </div>
    </div>
  );
}

export function DefenseEvaluationsSkeleton() {
  return <LoadingRegion label="Loading consolidated evaluations" className="min-w-0"><DefenseEvaluationPlaceholder /></LoadingRegion>;
}

export function DefensePageSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion label="Loading research defense" className={cn("workspace-page flex w-full min-w-0 max-w-[1360px] flex-col gap-6", className)}>
      <div className="workspace-page-header flex min-h-[204px] flex-col justify-center gap-5 rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <Skeleton className="h-3 w-32" />
          <div className="flex flex-wrap items-center gap-3"><Skeleton className="h-8 w-52" /><Skeleton className="h-6 w-24 rounded-full" /></div>
          <Skeleton className="h-4 w-64 max-w-full" />
          <div className="flex flex-wrap gap-6 pt-1"><Skeleton className="h-3 w-40" /><Skeleton className="h-3 w-72 max-w-full" /></div>
        </div>
        <Skeleton className="h-11 w-40 shrink-0 rounded-lg" />
      </div>
      <div className="flex min-h-[200px] flex-col justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <Skeleton className="h-5 w-52 max-w-full" />
        <Skeleton className="mt-1 h-3 w-28" />
        <Skeleton className="h-7 w-4/5 max-w-lg" />
        <Skeleton className="h-3 w-52 max-w-full" />
        <Skeleton className="h-3 w-3/4 max-w-xl" />
      </div>
      <DefenseEvaluationPlaceholder />
      <div className="min-h-[188px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <Skeleton className="mb-5 h-5 w-64 max-w-full" />
        {Array.from({ length: 2 }).map((_, index) => <div key={index} className="border-t border-[var(--color-border)] py-4"><Skeleton className="h-4 w-80 max-w-full" /></div>)}
      </div>
      <div className="min-h-[164px] space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <Skeleton className="h-5 w-44" /><Skeleton className="h-4 w-56 max-w-full" /><Skeleton className="h-3 w-4/5 max-w-xl" /><Skeleton className="h-3 w-72 max-w-full" />
      </div>
    </LoadingRegion>
  );
}

export function TaskDetailsSkeleton({ className, backLink = true }: { className?: string; backLink?: boolean }) {
  return (
    <LoadingRegion label="Loading task details" className={cn("mx-auto w-full max-w-[1360px] space-y-6 p-4 sm:p-6 lg:p-8", className)}>
      {backLink && <Skeleton className="my-3 h-4 w-48" />}
      <div className="flex min-h-[204px] flex-col justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-3/4 max-w-lg" />
        <Skeleton className="h-4 w-4/5 max-w-xl" />
      </div>
      <div className="space-y-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex flex-wrap gap-3"><Skeleton className="h-6 w-24 rounded-full" /><Skeleton className="h-6 w-56 max-w-full" /></div>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-2/3 max-w-md" />
      </div>
      <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-60 max-w-full" />
      </div>
    </LoadingRegion>
  );
}

export function ContentSkeletonForPath({ pathname }: { pathname: string }) {
  switch (contentSkeletonKindForPath(pathname)) {
    case "form": return <FormPageSkeleton />;
    case "profile": return <div className="mx-auto w-full max-w-screen-2xl p-4 sm:p-6 lg:p-8"><ProfileSkeleton /></div>;
    case "notifications": return <NotificationsPageSkeleton />;
    case "calendar": return <CalendarSkeleton />;
    case "mail": return <MailPageSkeleton />;
    case "files": return <FilesPageSkeleton />;
    case "dashboard": return <DashboardSkeleton />;
    case "defense-record": return <DefensePageSkeleton />;
    case "cards": return <CardsPageSkeleton />;
    case "table": return <TablePageSkeleton />;
    case "task-details": return <TaskDetailsSkeleton />;
    default: return <ListPageSkeleton />;
  }
}

export function AppShellSkeleton({ pathname = typeof window === "undefined" ? "/dashboard" : window.location.pathname, search = typeof window === "undefined" ? "" : window.location.search }: { pathname?: string; search?: string }) {
  const { collapsed } = useSidebarCollapsed();
  return (
    <div className="workspace-frame min-h-screen bg-[var(--sidebar-background)] font-sans text-[var(--color-text-primary)] antialiased">
      {/* Universal Google Classroom-Inspired Institutional Sidebar Skeleton */}
      <aside className={cn("fixed inset-y-0 left-0 z-50 hidden flex-col bg-[var(--sidebar-background)] lg:flex", collapsed ? "w-[72px]" : "w-[260px]")}>
        <div className={cn("flex h-16 shrink-0 items-center", collapsed ? "justify-center px-2" : "gap-3 px-4")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600/30 dark:text-slate-400/30">
            <div className="h-5 w-5 rounded-md bg-current opacity-40" />
          </div>
          {!collapsed && <AdvisioBrandMark />}
          {!collapsed && <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-2.5 w-24 bg-[var(--color-primary)]/20" />
          </div>}
        </div>

        <div className="flex-1 space-y-1.5 px-3 py-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl",
                collapsed ? "justify-center" : "px-3",
                index === 0 && "bg-[var(--nav-active-bg)]/70"
              )}
            >
              <Skeleton className="h-5 w-5 shrink-0 rounded-md" />
              {!collapsed && <Skeleton className={cn("h-3.5", index % 2 === 0 ? "w-28" : "w-20")} />}
            </div>
          ))}
        </div>

        <div className="p-3">
          <div className={cn("flex h-11 items-center gap-3 rounded-xl", collapsed ? "justify-center" : "px-3")}>
            <Skeleton className="h-5 w-5 shrink-0 rounded-md" />
            {!collapsed && <Skeleton className="h-3.5 w-16" />}
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame Area */}
      <div className={cn("workspace-frame__body flex min-h-screen min-w-0 flex-col bg-[var(--sidebar-background)]", collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]")}>
        <header className="flex h-16 items-center justify-between bg-[var(--header-background)] px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {collapsed && <AdvisioBrandMark className="hidden lg:inline-flex" />}
            <Skeleton className="h-9 w-9 rounded-xl lg:hidden" />
            <Skeleton className="hidden h-9 w-64 rounded-xl sm:block" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="hidden space-y-1.5 sm:block"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-2.5 w-16" /></div>
          </div>
        </header>

        <main data-workspace-layout="standard" data-workspace-view={workspaceViewForLocation(pathname, search)} className="app-workspace flex min-h-[calc(100vh-4rem)] min-w-0 flex-1 flex-col rounded-tl-[32px] border-0 bg-[var(--color-background)] outline-none shadow-none">
          <ContentSkeletonForPath pathname={pathname} />
        </main>
      </div>
    </div>
  );
}
