import React, { useEffect, useId } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import type { MonitoringScope } from "@research-management/shared/src/dean-monitoring";

export const panelClass =
  "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]";
export const filtersClass = `${panelClass} grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] items-end gap-3 p-4`;
export const inputClass =
  "h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--college-focus-ring)]";
export const actionClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold transition hover:bg-[var(--color-surface-muted)] disabled:opacity-50";
export const readable = (v: string) =>
  v
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
export const dateTime = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(new Date(v))
    : "Not scheduled";

export function useDeanFilters(kind: "defenses" | "reports") {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const keys =
    kind === "defenses"
      ? [
          "programId",
          "academicYearId",
          "stageId",
          "defenseType",
          "from",
          "to",
          "search",
          "view",
          "page",
        ]
      : [
          "programId",
          "academicYearId",
          "stageId",
          "defenseType",
          "researchTypeId",
          "status",
          "availability",
          "from",
          "to",
          "page",
        ];
  const query = Object.fromEntries(
    keys.flatMap((key) =>
      params.has(key) && params.get(key) !== ""
        ? [[key, params.get(key)!]]
        : [],
    ),
  );
  function update(values: Record<string, string | null>, replace = false) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("page");
        for (const [key, value] of Object.entries(values)) {
          if (value === null || value === "") next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace },
    );
  }
  function reset() {
    setParams(
      (prev) =>
        new URLSearchParams({
          tab: kind,
          workspace: prev.get("workspace") || "dean",
          ...(kind === "reports" &&
            prev.get("report") && { report: prev.get("report")! }),
        }),
    );
  }
  return {
    params,
    query,
    update,
    reset,
    identity: [user?.id, user?.college?.id, user?.roles.join(",")],
    user,
  };
}
export function DefaultYear({
  scope,
  selected,
  set,
}: {
  scope?: MonitoringScope;
  selected?: string;
  set: (values: Record<string, string>, replace?: boolean) => void;
}) {
  const current = scope?.academicYears.find((y) => y.isCurrent)?.id;
  useEffect(() => {
    if (!selected && current) set({ academicYearId: current }, true);
  }, [current, selected]);
  return null;
}
export function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement<{ "aria-labelledby"?: string }>;
}) {
  const id = useId();
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-bold text-[var(--color-text-secondary)]">
      <span id={id}>{label}</span>
      {React.cloneElement(children, { "aria-labelledby": id })}
    </label>
  );
}
export function ScopeFilters({
  scope,
  query,
  update,
  stage,
}: {
  scope?: MonitoringScope;
  query: Record<string, string>;
  update: (v: Record<string, string | null>) => void;
  stage?: "project" | "defense";
}) {
  return (
    <>
      <FilterField label="Program">
        <select
          data-guide="de-monitor-search"
          className={inputClass}
          value={query.programId || "all"}
          onChange={(e) => update({ programId: e.target.value })}
        >
          <option value="all">All programs</option>
          {scope?.programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.name}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField label="Academic year">
        <select
          className={inputClass}
          value={query.academicYearId || "all"}
          onChange={(e) => update({ academicYearId: e.target.value })}
        >
          <option value="all">All academic years</option>
          {scope?.academicYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
              {y.isCurrent ? " · Current" : ""}
            </option>
          ))}
        </select>
      </FilterField>
      {stage && (
        <FilterField
          label={stage === "defense" ? "Defense stage" : "Workflow stage"}
        >
          <select
            className={inputClass}
            value={
              query.defenseType
                ? `event:${query.defenseType}`
                : query.stageId || "all"
            }
            onChange={(e) => {
              const v = e.target.value;
              update(
                v.startsWith("event:")
                  ? { stageId: null, defenseType: v.slice(6) }
                  : { stageId: v, defenseType: null },
              );
            }}
          >
            <option value="all">All stages</option>
            {(stage === "defense" ? scope?.defenseStages : scope?.stages)?.map(
              (s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ),
            )}
          </select>
        </FilterField>
      )}
    </>
  );
}
export function Pagination({
  page,
  pageSize,
  total,
  update,
}: {
  page: number;
  pageSize: number;
  total: number;
  update: (v: Record<string, string>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] p-4 text-sm">
      <span>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
          : "0 records"}
      </span>
      <div className="flex items-center gap-3">
        <button
          className={actionClass}
          disabled={page <= 1}
          onClick={() => update({ page: String(page - 1) })}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          className={actionClass}
          disabled={page * pageSize >= total}
          onClick={() => update({ page: String(page + 1) })}
        >
          Next
        </button>
      </div>
    </div>
  );
}
export function QueryState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error?: Error | null;
  retry: () => void;
}) {
  if (loading)
    return (
      <p role="status" className={`${panelClass} p-8 text-center`}>
        Loading college records…
      </p>
    );
  if (!error) return null;
  return (
    <div role="alert" className={`${panelClass} p-6`}>
      <p className="text-rose-600">{error.message}</p>
      <button className={`${actionClass} mt-3`} onClick={retry}>
        Try again
      </button>
    </div>
  );
}
export function SummaryCards({
  items,
}: {
  items: { label: string; value: number | string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className={`${panelClass} p-4`}>
          <p className="text-xs font-bold text-[var(--color-text-secondary)]">
            {s.label}
          </p>
          <p className="mt-2 text-2xl font-extrabold text-[var(--color-text-primary)]">
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}
