import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { GoogleDriveIntegration } from "./GoogleDriveIntegration";
import "./system-admin-overview.css";

function useEntrance<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function CountUp({ value }: { value: number }) {
  const { ref, visible } = useEntrance<HTMLSpanElement>();
  const [display, setDisplay] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      current.current = value;
      setDisplay(value);
    };
    const onPreferenceChange = () => {
      if (preference.matches) finish();
    };
    preference.addEventListener("change", onPreferenceChange);
    if (preference.matches) finish();
    else if (visible) {
      const from = current.current;
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / 1100);
        current.current = Math.round(
          from + (value - from) * (1 - (1 - progress) ** 3),
        );
        setDisplay(current.current);
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener("change", onPreferenceChange);
    };
  }, [value, visible]);
  return (
    <span ref={ref}>
      <span aria-hidden="true">{number(display)}</span>
      <span className="sr-only">{number(value)}</span>
    </span>
  );
}

type Overview = {
  generatedAt: string;
  metrics: {
    totalAccounts: number;
    pendingAccounts: number;
    activeColleges: number;
    registeredProjects: number;
  };
  registrations: {
    days: { date: string; count: number }[];
    total: number;
    previousTotal: number;
  };
  colleges: { id: string; code: string; name: string; projects: number }[];
  activity: {
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    actor: string;
  }[];
};

const panel =
  "rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[#101b2b]";
const muted = "text-slate-500 dark:text-slate-400";
const ink = "text-[#0B3A53] dark:text-[#D6B85A]";
const number = (value: number) => value.toLocaleString("en-PH");
const stamp = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
const dayLabel = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(`${value}T00:00:00+08:00`));
const words = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();

function useOverview() {
  return useQuery({
    queryKey: ["system-admin-overview"],
    queryFn: () => apiClient.get<Overview>("/api/admin/overview"),
    staleTime: 60_000,
  });
}

function LoadError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className={`${panel} p-6`}>
      <h2 className="font-bold">Overview unavailable</h2>
      <p className={`mt-2 text-sm ${muted}`}>
        The latest records could not be loaded. Try refreshing the overview.
      </p>
      <button
        type="button"
        onClick={retry}
        className={`mt-4 inline-flex items-center gap-2 text-sm font-bold ${ink}`}
      >
        <RefreshCw size={15} /> Try again
      </button>
    </div>
  );
}

function ActivityList({ events }: { events: Overview["activity"] }) {
  if (!events.length)
    return (
      <div
        className={`flex min-h-40 flex-col items-center justify-center gap-2 text-center ${muted}`}
      >
        <ShieldCheck size={24} />
        <p className="text-sm font-semibold">
          No administrative events recorded yet
        </p>
        <p className="max-w-sm text-xs">
          Recorded account and institutional changes will appear here.
        </p>
      </div>
    );
  return (
    <ol className="divide-y divide-slate-100 dark:divide-white/5">
      {events.map((event) => (
        <li key={event.id} className="flex items-start gap-3 py-4">
          <span
            className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0B3A53]/5 dark:bg-white/5 ${ink}`}
          >
            <ShieldCheck size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold capitalize">
              {words(event.entityType)} · {words(event.action)}
            </p>
            <p className={`mt-1 break-words text-xs ${muted}`}>{event.actor}</p>
          </div>
          <time
            dateTime={event.createdAt}
            className={`mt-1 shrink-0 text-right text-[11px] ${muted}`}
          >
            {stamp(event.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}

export function AdminAuditActivity() {
  const query = useOverview();
  if (query.isPending) return <DashboardSkeleton />;
  if (!query.data) return <LoadError retry={() => void query.refetch()} />;
  return (
    <section className={`${panel} p-6`}>
      <h1 className="text-lg font-bold">Administrative audit events</h1>
      <p className={`mt-1 text-xs ${muted}`}>
        The six latest recorded account and institutional changes. Times are in
        Philippine Time.
      </p>
      <ActivityList events={query.data.activity} />
    </section>
  );
}

function RegistrationChart({ data }: { data: Overview["registrations"] }) {
  const { ref, visible } = useEntrance<HTMLElement>();
  const max = Math.max(1, ...data.days.map((day) => day.count));
  const ceiling = Math.max(4, Math.ceil(max / 4) * 4);
  const points = data.days.map((day, index) => ({
    ...day,
    x: 42 + index * (636 / Math.max(1, data.days.length - 1)),
    y: 172 - (day.count / ceiling) * 144,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const delta = data.total - data.previousTotal;
  return (
    <section
      ref={ref}
      className={`${panel} min-w-0 p-5 sm:p-6`}
      aria-labelledby="registrations-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="registrations-heading" className="text-sm font-bold">
            Account registrations
          </h2>
          <p className={`mt-1 text-xs ${muted}`}>
            New accounts per day · Philippine Time
          </p>
        </div>
        <span
          className={`rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-semibold dark:bg-white/5 ${muted}`}
        >
          Last 30 days
        </span>
      </div>
      <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-bold tracking-tight">
          <CountUp value={data.total} />
        </span>
        <span className={`text-xs ${muted}`}>new accounts</span>
        <span className={`text-xs font-medium ${ink}`}>
          {delta === 0
            ? "Same as"
            : `${number(Math.abs(delta))} ${delta > 0 ? "more" : "fewer"} than`}{" "}
          previous 30 days
        </span>
      </div>
      <svg
        viewBox="0 0 700 210"
        className={`admin-registration-chart ${visible ? "is-visible" : ""} mt-3 w-full ${ink}`}
        role="img"
        aria-labelledby="registration-chart-title registration-chart-description"
      >
        <title id="registration-chart-title">
          Daily account registrations for the last 30 days
        </title>
        <desc id="registration-chart-description">
          {data.total} accounts registered. The highest daily count is{" "}
          {max === 1 && data.total === 0 ? 0 : max}. Expand daily values below
          for exact counts.
        </desc>
        {[0, 1, 2, 3, 4].map((tick) => (
          <g key={tick}>
            <line
              x1="42"
              x2="678"
              y1={172 - tick * 36}
              y2={172 - tick * 36}
              stroke="currentColor"
              opacity="0.09"
              strokeDasharray="3 5"
            />
            <text
              x="30"
              y={176 - tick * 36}
              textAnchor="end"
              fill="currentColor"
              fontSize="10"
              opacity="0.65"
            >
              {(ceiling * tick) / 4}
            </text>
          </g>
        ))}
        {data.total > 0 && (
          <polygon
            className="admin-chart-area"
            points={`42,172 ${line} 678,172`}
            fill="currentColor"
            opacity="0.055"
          />
        )}
        <polyline
          className="admin-chart-line"
          pathLength="1"
          points={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points
          .filter((point) => point.count > 0)
          .map((point) => (
            <circle
              className="admin-chart-point"
              key={point.date}
              cx={point.x}
              cy={point.y}
              r="3.5"
              fill="currentColor"
            >
              <title>
                {dayLabel(point.date)}: {point.count} accounts
              </title>
            </circle>
          ))}
        {points
          .filter((_, index) => [0, 7, 14, 21, 29].includes(index))
          .map((point, index) => (
            <text
              key={point.date}
              x={point.x}
              y="199"
              textAnchor={
                index === 0 ? "start" : index === 4 ? "end" : "middle"
              }
              fill="currentColor"
              opacity="0.65"
              fontSize="10"
            >
              {dayLabel(point.date)}
            </text>
          ))}
      </svg>
      {data.total === 0 && (
        <p className={`text-center text-xs ${muted}`}>
          No new accounts in this period.
        </p>
      )}
      <details
        className={`mt-3 border-t border-slate-100 pt-3 text-xs dark:border-white/5 ${muted}`}
      >
        <summary className="w-fit cursor-pointer font-medium">
          View daily values
        </summary>
        <div className="mt-3 max-h-44 overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">
              Daily registrations in Philippine Time
            </caption>
            <thead>
              <tr>
                <th className="pb-2">Date</th>
                <th className="pb-2 text-right">Accounts</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) => (
                <tr key={day.date}>
                  <td className="py-1">{dayLabel(day.date)}</td>
                  <td className="text-right tabular-nums">{day.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function SystemAdminOverview() {
  const navigate = useNavigate();
  const query = useOverview();
  if (query.isPending) return <DashboardSkeleton />;
  if (!query.data) return <LoadError retry={() => void query.refetch()} />;
  const data = query.data;
  const largestCollege = Math.max(
    1,
    ...data.colleges.map((college) => college.projects),
  );
  const metrics = [
    {
      label: "Total accounts",
      value: data.metrics.totalAccounts,
      note: "Across all account statuses",
      icon: Users,
      href: "/system-admin/dashboard?tab=users",
    },
    {
      label: "Pending approvals",
      value: data.metrics.pendingAccounts,
      note: "Accounts awaiting verification",
      icon: UserRoundCheck,
      href: "/system-admin/dashboard?tab=users&status=PENDING",
      attention: data.metrics.pendingAccounts > 0,
    },
    {
      label: "Active colleges",
      value: data.metrics.activeColleges,
      note: "Enabled in the academic registry",
      icon: Building2,
      href: "/system-admin/dashboard?tab=onboarding",
    },
    {
      label: "Registered projects",
      value: data.metrics.registeredProjects,
      note: "All colleges · all project statuses",
      icon: FileText,
    },
  ];
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p
            className={`mb-2 text-[10px] font-bold uppercase tracking-[0.18em] ${ink}`}
          >
            Advisio administration
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            System overview
          </h1>
          <p className={`mt-2 text-sm ${muted}`}>
            Institutional adoption, account access, and administrative activity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] ${muted}`}>
            Updated {stamp(data.generatedAt)} PHT
          </span>
          <button
            type="button"
            aria-label="Refresh overview"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            className={`${panel} p-2.5 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-white/5`}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>
      {query.isError && (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"
        >
          Refresh failed. Showing the last successfully loaded overview.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const content = (
            <>
              <div className="flex items-center justify-between">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl ${metric.attention ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" : `bg-[#0B3A53]/5 dark:bg-white/5 ${ink}`}`}
                >
                  <metric.icon size={19} />
                </span>
                {metric.href && (
                  <ArrowUpRight size={16} className="text-slate-400" />
                )}
              </div>
              <p className={`mt-5 text-xs font-medium ${muted}`}>
                {metric.label}
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                <CountUp value={metric.value} />
              </p>
              <p className={`mt-3 text-[11px] ${muted}`}>{metric.note}</p>
            </>
          );
          return metric.href ? (
            <Link
              key={metric.label}
              to={metric.href}
              className={`${panel} p-5 transition-colors hover:border-[var(--color-border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A227]`}
            >
              {content}
            </Link>
          ) : (
            <div key={metric.label} className={`${panel} p-5`}>
              {content}
            </div>
          );
        })}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <RegistrationChart data={data.registrations} />
        <section
          className={`${panel} min-w-0 p-5 sm:p-6`}
          aria-labelledby="colleges-heading"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="colleges-heading" className="text-sm font-bold">
                Research projects by college
              </h2>
              <p className={`mt-1 text-xs ${muted}`}>
                Institutional distribution · all time
              </p>
            </div>
            <Building2 size={17} className={ink} />
          </div>
          <div className="mt-7 max-h-64 space-y-5 overflow-y-auto pr-1">
            {data.colleges.length ? (
              data.colleges.map((college) => (
                <div key={college.id}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span
                      title={college.name}
                      className="text-xs font-semibold"
                    >
                      {college.code}
                      <span className={`ml-2 font-normal ${muted}`}>
                        {college.name}
                      </span>
                    </span>
                    <span className="text-xs font-bold tabular-nums">
                      {number(college.projects)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                    <div
                      className="h-full rounded-full bg-[#C9A227] motion-safe:transition-[width] motion-safe:duration-300"
                      style={{
                        width: `${(college.projects / largestCollege) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className={`py-12 text-center text-sm ${muted}`}>
                No colleges configured yet.
              </p>
            )}
          </div>
          <p
            className={`mt-5 border-t border-slate-100 pt-3 text-[11px] dark:border-white/5 ${muted}`}
          >
            Includes every project status and active or inactive colleges.
          </p>
        </section>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_1.55fr]">
        <section
          className={`${panel} p-5 sm:p-6`}
          aria-labelledby="attention-heading"
        >
          <div className="flex items-center justify-between">
            <h2 id="attention-heading" className="text-sm font-bold">
              Needs attention
            </h2>
            <Clock3 size={17} className={ink} />
          </div>
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-white/5 dark:bg-white/[0.02]">
            <div className="flex items-start gap-3">
              {data.metrics.pendingAccounts ? (
                <UserRoundCheck
                  size={18}
                  className="mt-0.5 shrink-0 text-amber-600"
                />
              ) : (
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0 text-emerald-600"
                />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {data.metrics.pendingAccounts
                    ? `${number(data.metrics.pendingAccounts)} accounts awaiting approval`
                    : "Account approvals are up to date"}
                </p>
                <p className={`mt-1 text-xs leading-5 ${muted}`}>
                  {data.metrics.pendingAccounts
                    ? "Verify institutional details before granting access to Advisio."
                    : "There are no pending account requests to review."}
                </p>
                {data.metrics.pendingAccounts > 0 && (
                  <Link
                    to="/system-admin/dashboard?tab=users&status=PENDING"
                    className={`mt-3 inline-flex items-center gap-1.5 text-xs font-bold ${ink}`}
                  >
                    Review accounts <ArrowRight size={13} />
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="mt-5">
            <GoogleDriveIntegration
              compact
              onManage={() =>
                navigate("/system-admin/dashboard?tab=integrations")
              }
            />
          </div>
        </section>
        <section
          className={`${panel} p-5 sm:p-6`}
          aria-labelledby="activity-heading"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="activity-heading" className="text-sm font-bold">
                Recent administrative activity
              </h2>
              <p className={`mt-1 text-xs ${muted}`}>
                Latest recorded changes · Philippine Time
              </p>
            </div>
            <Link
              to="/system-admin/dashboard?tab=logs"
              className={`shrink-0 text-xs font-semibold ${ink}`}
            >
              View events <ArrowRight size={13} className="ml-1 inline" />
            </Link>
          </div>
          <div className="mt-3">
            <ActivityList events={data.activity} />
          </div>
        </section>
      </div>
    </>
  );
}
