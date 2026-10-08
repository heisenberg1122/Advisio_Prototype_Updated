import React from "react";
import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
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
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function PageHeadingSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex min-h-14 items-start justify-between gap-4">
      <div className="space-y-2.5">
        <Skeleton className="h-7 w-48 sm:w-64" />
        <Skeleton className="h-3.5 w-56 max-w-[65vw] sm:w-80" />
      </div>
      {action && <Skeleton className="h-10 w-24 shrink-0 rounded-xl sm:w-32" />}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101b2b]">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-11 w-11 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion label="Loading dashboard" className={cn("mx-auto w-full max-w-screen-2xl space-y-6 p-4 sm:p-6 lg:p-8", className)}>
      <PageHeadingSkeleton />
      <StatCardsSkeleton />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101b2b] sm:p-6">
          <div className="mb-6 flex items-center justify-between"><Skeleton className="h-5 w-40" /><Skeleton className="h-8 w-20 rounded-xl" /></div>
          <Skeleton className="h-48 w-full rounded-xl sm:h-64" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101b2b] sm:p-6">
          <Skeleton className="mb-5 h-5 w-36" />
          <ListRowsSkeleton rows={5} />
        </div>
      </div>
    </LoadingRegion>
  );
}

export function ListRowsSkeleton({ rows = 5, avatars = true }: { rows?: number; avatars?: boolean }) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-white/5">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
          {avatars && <Skeleton className="h-9 w-9 shrink-0 rounded-full" />}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={cn("h-3.5", index % 2 ? "w-2/3" : "w-1/2")} />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function ListPageSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <LoadingRegion label="Loading list" className={cn("mx-auto w-full max-w-screen-2xl space-y-6 p-4 sm:p-6 lg:p-8", className)}>
      <PageHeadingSkeleton />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101b2b] sm:p-6">
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
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101b2b] sm:p-6">
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
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#101b2b]">
      <div className="grid gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4 dark:border-white/10 dark:bg-white/5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => <Skeleton key={index} className="h-3 w-3/4" />)}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0 dark:border-white/5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, column) => <Skeleton key={column} className={cn("h-3.5", column === 0 ? "w-4/5" : "w-2/3")} />)}
        </div>
      ))}
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
      <div className="flex flex-col items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#101b2b] sm:flex-row sm:p-8">
        <div className="flex flex-col items-center gap-5 sm:flex-row"><Skeleton className="h-20 w-20 rounded-full" /><div className="space-y-2.5"><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-36" /><Skeleton className="h-6 w-24 rounded-full" /></div></div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      {editing ? <FormCards /> : <div className="grid gap-6 md:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="min-h-48 rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#101b2b]"><Skeleton className="mb-6 h-4 w-1/2" /><ListRowsSkeleton rows={3} avatars={false} /></div>)}</div>}
    </LoadingRegion>
  );
}

function FormCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, card) => (
        <div key={card} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101b2b] sm:p-6">
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

export function NotificationListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <LoadingRegion label="Loading notifications" className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex gap-3 rounded-xl border border-slate-100 p-4 dark:border-white/5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-full" /><Skeleton className="h-2.5 w-24" /></div>
        </div>
      ))}
    </LoadingRegion>
  );
}

export function NotificationsPageSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion label="Loading notifications page" className={cn("mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8", className)}>
      <PageHeadingSkeleton />
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#101b2b] sm:p-5"><NotificationListSkeleton /></div>
    </LoadingRegion>
  );
}

export function CalendarSkeleton({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <LoadingRegion label="Loading calendar" className={cn(!compact && "mx-auto w-full max-w-screen-2xl space-y-5 p-4 sm:p-6 lg:p-8", className)}>
      {!compact && <PageHeadingSkeleton />}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#101b2b]">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-white/10"><Skeleton className="h-9 w-24 rounded-xl" /><Skeleton className="h-5 w-32" /><Skeleton className="h-9 w-24 rounded-xl" /></div>
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-white/10">{Array.from({ length: 7 }).map((_, index) => <div key={index} className="p-3"><Skeleton className="mx-auto h-3 w-8" /></div>)}</div>
        <div className="grid grid-cols-7">{Array.from({ length: 35 }).map((_, index) => <div key={index} className="min-h-20 border-b border-r border-slate-100 p-2 dark:border-white/5 sm:min-h-28"><Skeleton className="h-5 w-5 rounded-full" />{index % 4 === 0 && <Skeleton className="mt-2 h-5 w-full rounded-md" />}</div>)}</div>
      </div>
    </LoadingRegion>
  );
}

export function MailPageSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion label="Loading inbox" className={cn("grid min-h-[calc(100vh-72px)] grid-cols-1 overflow-hidden bg-white dark:bg-[#101b2b] md:grid-cols-[210px_320px_1fr]", className)}>
      <aside className="hidden border-r border-slate-200 p-4 dark:border-white/10 md:block"><Skeleton className="mb-5 h-11 w-full rounded-xl" /><ListRowsSkeleton rows={4} avatars={false} /></aside>
      <section className="border-r border-slate-200 dark:border-white/10"><div className="border-b p-4 dark:border-white/10"><Skeleton className="h-5 w-24" /></div><div className="p-4"><ListRowsSkeleton rows={7} /></div></section>
      <section className="hidden p-6 md:block"><Skeleton className="h-6 w-1/2" /><Skeleton className="mt-3 h-3 w-1/3" /><div className="mt-8 space-y-4"><Skeleton className="h-24 w-3/4 rounded-2xl" /><Skeleton className="ml-auto h-20 w-2/3 rounded-2xl" /><Skeleton className="h-28 w-4/5 rounded-2xl" /></div></section>
    </LoadingRegion>
  );
}

export function FilesPageSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion label="Loading files" className={cn("mx-auto w-full max-w-screen-2xl space-y-5 p-4 sm:p-6 lg:p-8", className)}>
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#101b2b]"><div className="flex gap-3 border-b p-4 dark:border-white/10"><Skeleton className="h-9 flex-1 rounded-xl" /><Skeleton className="h-9 w-32 rounded-xl" /></div><div className="p-5"><ListRowsSkeleton rows={6} /></div></div>
        <div className="space-y-4"><Skeleton className="h-44 w-full rounded-2xl" /><Skeleton className="h-40 w-full rounded-2xl" /></div>
      </div>
    </LoadingRegion>
  );
}

export function DocumentPreviewSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion
      label="Preparing document preview"
      className={cn("grid min-h-[420px] place-items-center bg-slate-100 p-4 dark:bg-slate-950/40 sm:p-8", className)}
    >
      <div className="aspect-[8.5/11] w-full max-w-xl rounded-sm bg-white p-7 shadow-lg dark:bg-[#101b2b] sm:p-10">
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

export function ContentSkeletonForPath({ pathname }: { pathname: string }) {
  const path = pathname.toLowerCase();
  if (path.includes("/profile/edit") || path.includes("/settings") || path.includes("/join") || path.includes("onboarding")) return <FormPageSkeleton />;
  if (path.includes("/profile")) return <div className="mx-auto w-full max-w-screen-2xl p-4 sm:p-6 lg:p-8"><ProfileSkeleton /></div>;
  if (path.includes("notification")) return <NotificationsPageSkeleton />;
  if (path.includes("calendar") || path.includes("schedule")) return <CalendarSkeleton />;
  if (path.includes("inbox") || path.includes("mail")) return <MailPageSkeleton />;
  if (path.includes("document") || path.includes("file") || path.includes("submission") || path.includes("signature")) return <FilesPageSkeleton />;
  if (path.includes("dashboard") || path === "/dashboard" || path.includes("analytics")) return <DashboardSkeleton />;
  if (path.includes("adviser-pool") || path.includes("consultation") || path.includes("defense")) return <CardsPageSkeleton />;
  if (path.includes("task") || path.includes("request") || path.includes("review") || path.includes("evaluation") || path.includes("panelist") || path.includes("rubric") || path.includes("announcement") || path.includes("grade")) return <TablePageSkeleton />;
  return <ListPageSkeleton />;
}

export function AppShellSkeleton({ pathname = typeof window === "undefined" ? "/dashboard" : window.location.pathname }: { pathname?: string }) {
  return (
    <div className="min-h-screen bg-[#f6f8fb] dark:bg-[#080e18]">
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] border-r border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101b2b] lg:block">
        <Skeleton className="h-10 w-36" /><div className="mt-10 space-y-3">{Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-10 w-full rounded-xl" />)}</div>
      </aside>
      <div className="lg:pl-[240px]">
        <header className="flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-white/10 dark:bg-[#101b2b] sm:px-6"><Skeleton className="h-9 w-9 rounded-xl lg:hidden" /><Skeleton className="hidden h-9 w-64 rounded-xl sm:block" /><div className="ml-auto flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-9 w-28 rounded-xl" /></div></header>
        <main><ContentSkeletonForPath pathname={pathname} /></main>
      </div>
    </div>
  );
}
