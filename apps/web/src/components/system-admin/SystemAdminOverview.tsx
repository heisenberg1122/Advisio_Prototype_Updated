import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { GoogleDriveIntegration } from "./GoogleDriveIntegration";
import { useAuth } from "@/hooks/use-auth";
import { EmptyNote } from "@/components/ui/advisio";
import { ProgressTrack } from "@/components/dashboards/RoleHomeParts";
import { RoleBand } from "@/components/dashboards/RoleScreenParts";
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

const panel = "rh-panel";
const muted = "text-[var(--color-text-secondary)]";
const ink = "text-[var(--color-primary)] dark:text-[var(--color-text-primary)]";
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
      <p className={`mt-2 text-base ${muted}`}>
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
      <div className="rh-space">
        <EmptyNote layout="row" icon="ti-shield-check" title="No administrative events recorded yet" text="Recorded account and institutional changes will appear here." />
      </div>
    );
  return (
    <ol className="rh-rows">
      {events.map((event) => (
        <li key={event.id}>
          <div className="rh-row">
            <span className="rh-icon" aria-hidden="true"><i className="ti ti-shield-check" /></span>
            <div className="rh-text">
              <h3 className="capitalize">{words(event.entityType)} · {words(event.action)}</h3>
              <p>
                {event.actor} · <time dateTime={event.createdAt}>{stamp(event.createdAt)}</time>
              </p>
            </div>
          </div>
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
    <section className={panel}>
      <div className="workspace-page-header">
        <h1 className="text-xl font-semibold">Administrative audit events</h1>
        <p className={`mt-1 text-base ${muted}`}>
          The six latest recorded account and institutional changes. Times are in
          Philippine Time.
        </p>
      </div>
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
      className={panel}
      aria-labelledby="registrations-heading"
    >
      <div className="rh-head">
        <h2 id="registrations-heading">Account registrations</h2>
        <span className="rh-pill" style={{ marginLeft: "auto" }}>Last 30 days</span>
      </div>
      <p className="rh-lede">New accounts per day · Philippine Time</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[30px] font-semibold leading-tight tracking-tight">
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
        <p className={`text-center text-base ${muted}`}>
          No new accounts in this period.
        </p>
      )}
      <details
        className={`mt-3 border-t border-[var(--color-border)] pt-3 text-xs ${muted}`}
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
  const { user } = useAuth();
  const query = useOverview();
  if (query.isPending) return <DashboardSkeleton />;
  if (!query.data) return <LoadError retry={() => void query.refetch()} />;
  const data = query.data;
  const pending = data.metrics.pendingAccounts;
  const largestCollege = Math.max(1, ...data.colleges.map((college) => college.projects));
  const reviewAccounts = () => navigate("/system-admin/dashboard?tab=users&status=PENDING");
  return (
    <div className="rs">
      <RoleBand
        eyebrow="System administration"
        title={`Good day, ${user?.firstName?.trim() || "Administrator"}`}
        titleId="system-admin-title"
        home
        meta={`${pending ? `${number(pending)} ${pending === 1 ? "account awaits" : "accounts await"} approval` : "Account approvals are up to date"} · updated ${stamp(data.generatedAt)} PHT`}
        counts={[
          { label: "Accounts", value: number(data.metrics.totalAccounts), onClick: () => navigate("/system-admin/dashboard?tab=users") },
          { label: "To approve", value: number(pending), tone: pending ? "waiting" : undefined, onClick: reviewAccounts },
          { label: "Colleges", value: number(data.metrics.activeColleges), onClick: () => navigate("/system-admin/dashboard?tab=onboarding") },
          { label: "Projects", value: number(data.metrics.registeredProjects) },
        ]}
        countsLabel="System summary"
        primary={pending ? { label: "Review accounts", icon: "ti-arrow-right", onClick: reviewAccounts } : undefined}
        secondary={[{ label: "Refresh", icon: "ti-refresh", disabled: query.isFetching, onClick: () => void query.refetch() }]}
      />
      {query.isError && <p role="alert" className="rh-notice">Refresh failed. Showing the last successfully loaded overview.</p>}
      <div className="rh-grid">
        <section className="rh-panel" aria-labelledby="attention-heading">
          <div className="rh-head">
            <h2 id="attention-heading">Needs attention</h2>
            {pending > 0 && <span className="rh-pill" data-tone="waiting">{number(pending)}</span>}
          </div>
          {pending > 0 ? (
            <div className="rh-lead">
              <div className="rh-text">
                <span className="rh-tag"><i className="ti ti-user-check" aria-hidden="true" /> Account approvals</span>
                <h3>{number(pending)} {pending === 1 ? "account" : "accounts"} awaiting approval</h3>
                <p>Verify institutional details before granting access to Advisio.</p>
              </div>
              <button type="button" className="rh-cta" onClick={reviewAccounts}>Review accounts <i className="ti ti-arrow-right" aria-hidden="true" /></button>
            </div>
          ) : (
            <div className="rh-space">
              <EmptyNote layout="row" tone="ok" icon="ti-circle-check" title="Account approvals are up to date" text="There are no pending account requests to review." />
            </div>
          )}
          <div className="rh-rows">
            <GoogleDriveIntegration row onManage={() => navigate("/system-admin/dashboard?tab=integrations")} />
          </div>
        </section>
        <section className="rh-panel" aria-labelledby="activity-heading">
          <div className="rh-head">
            <h2 id="activity-heading">Recent activity</h2>
            <button type="button" className="au-link" onClick={() => navigate("/system-admin/dashboard?tab=logs")}>View events <i className="ti ti-arrow-right" aria-hidden="true" /></button>
          </div>
          <ActivityList events={data.activity} />
        </section>
      </div>
      <div className="rh-grid rh-grid--even">
        <RegistrationChart data={data.registrations} />
        <section className="rh-panel" aria-labelledby="colleges-heading">
          <div className="rh-head"><h2 id="colleges-heading">Projects by college</h2></div>
          {data.colleges.length ? (
            <>
              <p className="rh-lede">Every project status, active and inactive colleges, all time.</p>
              <ul className="rh-stages" style={{ maxHeight: 280, overflowY: "auto", paddingRight: 4 }}>
                {data.colleges.map((college) => (
                  <li key={college.id}>
                    <p className="rh-stage-line" title={college.name}>
                      <span><b>{college.code}</b> {college.name}</span>
                      <b>{number(college.projects)}</b>
                    </p>
                    <ProgressTrack value={(college.projects / largestCollege) * 100} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="rh-space"><EmptyNote layout="row" icon="ti-building" title="No colleges configured yet" /></div>
          )}
        </section>
      </div>
    </div>
  );
}
