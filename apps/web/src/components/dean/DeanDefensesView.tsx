import React, { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { ClipboardList, ArrowUpRight, RotateCcw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Modal } from "@/components/ui/Modal";
import { useDashboardWorkspace } from "@/providers/dashboard-workspace-provider";
import type {
  DefenseResponse,
  DefenseRow,
} from "@research-management/shared/src/dean-monitoring";
import {
  actionClass,
  panelClass,
  filtersClass,
  inputClass,
  useDeanFilters,
  DefaultYear,
  FilterField,
  ScopeFilters,
  Pagination,
  QueryState,
  SummaryCards,
  readable,
  dateTime,
} from "./DeanMonitoringShared";
import { PhoneFilters } from "@/components/ui/PhoneFilters";

export function DeanDefensesView() {
  const { query, update, reset, identity, user } = useDeanFilters("defenses");
  const [selected, setSelected] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const { switchDashboard, switchError, isSwitching } = useDashboardWorkspace();
  const location = useLocation();
  const dataQuery = useQuery({
    queryKey: ["dean-defenses", ...identity, query],
    queryFn: () =>
      apiClient.get<DefenseResponse>("/api/dean/defenses", { params: query }),
    staleTime: 15000,
    refetchInterval: 30000,
  });
  const details = useQuery({
    queryKey: ["dean-defense", ...identity, selected],
    queryFn: () => apiClient.get<DefenseRow>(`/api/dean/defenses/${selected}`),
    enabled: Boolean(selected),
    staleTime: 0,
  });
  const data = dataQuery.data;
  const close = useCallback(() => setSelected(null), []);
  async function openPanel(row: DefenseRow) {
    setOpening(true);
    try {
      const fresh = await apiClient.get<DefenseRow>(
        `/api/dean/defenses/${row.id}`,
      );
      if (
        !fresh.myAssignment ||
        !["ACCEPTED", "PENDING", "RECONFIRMATION_REQUIRED"].includes(
          fresh.myAssignment.status,
        )
      ) {
        setSelected(row.id);
        return;
      }
      const returnTo = `${location.pathname}${location.search}`;
      const destination = fresh.myAssignment.canEvaluate
        ? `/panelist/dashboard?tab=evaluation&sessionId=${row.id}&returnTo=${encodeURIComponent(returnTo)}`
        : `/panelist/defenses/${row.id}?returnTo=${encodeURIComponent(returnTo)}`;
      await switchDashboard("panelist", { destination });
    } finally {
      setOpening(false);
    }
  }
  const [actionError, setActionError] = useState("");
  const panelAction = (row: DefenseRow) => {
    setActionError("");
    void openPanel(row).catch((e) =>
      setActionError(
        e instanceof Error ? e.message : "Unable to open defense.",
      ),
    );
  };
  return (
    <main className="workspace-page mx-auto flex max-w-[1360px] flex-col gap-5 p-4 text-[var(--color-text-primary)] sm:p-6 lg:p-8">
      <DefaultYear
        scope={data?.scope}
        selected={query.academicYearId}
        set={update}
      />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-primary)]">
            <ClipboardList size={16} />
            Dean’s Office
          </div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            Defense Oversight
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {data?.scope.college.name || user?.college?.name} · Schedules,
            readiness, and released outcomes.
          </p>
        </div>
        <button onClick={() => dataQuery.refetch()} className={actionClass}>
          <RotateCcw size={15} />
          Refresh
        </button>
      </header>
      <section aria-label="Defense filters" className={`${filtersClass} phone-filter-section`}>
        <PhoneFilters guide="de-monitor-search" title="Filter defenses">
        <ScopeFilters
          scope={data?.scope}
          query={query}
          update={update}
          stage="defense"
        />
        <FilterField label="Scheduled from">
          <input
            type="date"
            className={inputClass}
            value={query.from || ""}
            onChange={(e) => update({ from: e.target.value })}
          />
        </FilterField>
        <FilterField label="Scheduled to">
          <input
            type="date"
            className={inputClass}
            value={query.to || ""}
            onChange={(e) => update({ to: e.target.value })}
          />
        </FilterField>
        <FilterField label="Search project or group">
          <input
            type="search"
            maxLength={160}
            className={inputClass}
            value={query.search || ""}
            onChange={(e) => update({ search: e.target.value }, true)}
            placeholder="Project or group name"
          />
        </FilterField>
        <button className={actionClass} onClick={reset}>
          Reset filters
        </button>
        </PhoneFilters>
      </section>
      <QueryState
        loading={dataQuery.isPending}
        error={dataQuery.error}
        retry={() => dataQuery.refetch()}
      />
      {data && !dataQuery.isError && (
        <>
          <SummaryCards
            items={[
              { label: "Upcoming defenses", value: data.cards.upcoming },
              {
                label: "Awaiting panel confirmation",
                value: data.cards.awaitingPanel,
              },
              { label: "Needs rescheduling", value: data.cards.rescheduling },
              {
                label: "Awaiting result release",
                value: data.cards.awaitingRelease,
              },
            ]}
          />
          <p className="text-xs text-[var(--color-text-secondary)]">
            Counts use the selected filters and may overlap. All times are
            Asia/Manila. Updated {dateTime(data.generatedAt)}.
          </p>
          <section
            className={`${panelClass} overflow-hidden`}
            aria-label="College defenses"
          >
            <div
              className="flex flex-wrap gap-2 border-b border-[var(--color-border)] p-3"
              aria-label="Defense views"
            >
              {[
                ["upcoming", "Upcoming"],
                ["attention", "Needs Attention"],
                ["completed", "Completed"],
                ["cancelled", "Cancelled lookup"],
              ].map(([view, label]) => (
                <button
                  key={view}
                  aria-pressed={(query.view || "upcoming") === view}
                  onClick={() => update({ view })}
                  className={`${actionClass} ${(query.view || "upcoming") === view ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table data-phone-title="1" data-phone-summary="4" className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-xs text-[var(--color-text-secondary)]">
                  <tr>
                    {[
                      "Schedule",
                      "Project / group",
                      "Program / stage",
                      "Required panel",
                      "Status / attention",
                      "Details",
                    ].map((h) => (
                      <th scope="col" key={h} className="px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {data.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-4 align-top">
                        {dateTime(row.scheduledStart)}
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {row.venue || "Venue not recorded"}
                        </p>
                      </td>
                      <td className="max-w-xs px-4 py-4 align-top">
                        <p className="font-bold">{row.title}</p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {row.groupName || "Group not recorded"}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-bold">{row.program}</p>
                        <p className="mt-1 text-xs">{row.stage}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        {row.panelAccepted}/{row.panelRequired} confirmed
                      </td>
                      <td className="max-w-xs px-4 py-4 align-top">
                        <span className="font-semibold">
                          {readable(row.status)}
                        </span>
                        {row.attention.map((a) => (
                          <p
                            key={a}
                            className="mt-1 text-xs text-amber-700 dark:text-amber-300"
                          >
                            {a}
                          </p>
                        ))}
                        {row.decision && (
                          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                            {readable(row.decision)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <button
                          className={actionClass}
                          onClick={() => setSelected(row.id)}
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.rows.length && (
                <p className="p-10 text-center text-sm text-[var(--color-text-secondary)]">
                  No defenses match this view and its filters.
                </p>
              )}
            </div>
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              update={update}
            />
          </section>
          {user?.roles.includes("PANELIST") && (
            <section className={`${panelClass} p-5`}>
              <h2 className="text-lg font-extrabold">My Panel Assignments</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Your assignments in this college, using the selected filters.
                Evaluation opens in your Panelist workspace.
              </p>
              <div className="mt-4 max-h-80 space-y-3 overflow-auto">
                {data.myAssignments.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3"
                  >
                    <div>
                      <p className="font-bold">{row.title}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {dateTime(row.scheduledStart)} ·{" "}
                        {readable(row.myAssignment!.status)}
                      </p>
                    </div>
                    {row.myAssignment!.status !== "DECLINED" && (
                      <button
                        disabled={opening || isSwitching}
                        className={actionClass}
                        onClick={() => panelAction(row)}
                      >
                        {row.myAssignment!.canEvaluate
                          ? "Open Evaluation"
                          : row.myAssignment!.status === "ACCEPTED"
                            ? "View Defense"
                            : "Review invitation"}
                        <ArrowUpRight size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {!data.myAssignments.length && (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    No panel assignments match the selected filters.
                  </p>
                )}
              </div>
            </section>
          )}
        </>
      )}
      {(actionError || switchError) && (
        <p role="alert" className="text-sm text-rose-600">
          {actionError || switchError}
        </p>
      )}
      <Modal
        isOpen={Boolean(selected)}
        onClose={close}
        title="Defense details"
        maxWidth="xl"
      >
        <QueryState
          loading={details.isPending}
          error={details.error}
          retry={() => details.refetch()}
        />
        {details.data && !details.isError && (
          <DefenseDetails row={details.data} />
        )}
      </Modal>
    </main>
  );
}
function DefenseDetails({ row }: { row: DefenseRow }) {
  return (
    <div className="space-y-5 text-sm text-[var(--color-text-primary)]">
      <div>
        <h2 className="text-lg font-extrabold">{row.title}</h2>
        <p className="mt-1 text-[var(--color-text-secondary)]">
          {row.groupName || "Group not recorded"} · {row.program} ·{" "}
          {row.academicYear}
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          ["Adviser", row.adviser],
          ["Defense stage", row.stage],
          ["Cycle", row.cycle],
          ["Status", readable(row.status)],
          ["Scheduled start", dateTime(row.scheduledStart)],
          ["Scheduled end", dateTime(row.scheduledEnd)],
          ["Venue", row.venue || "Not recorded"],
          ["Preparation", row.preparation],
          [
            "Final evaluations",
            `${row.evaluationsSubmitted}/${row.evaluationsRequired} accepted required panelists submitted`,
          ],
          [
            "Released outcome",
            row.decision
              ? readable(row.decision)
              : row.releasedAt
                ? "Decision not recorded"
                : "Result not released",
          ],
          [
            "Released at",
            row.releasedAt ? dateTime(row.releasedAt) : "Not released",
          ],
          ["Revision clearance", row.revisionStatus],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-bold text-[var(--color-text-secondary)]">
              {label}
            </dt>
            <dd className="mt-1 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      {row.meetingUrl && (
        <a
          className="inline-block font-bold text-[var(--color-primary)] underline"
          href={row.meetingUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open meeting link
        </a>
      )}
      {!!row.preparationChecks?.length && (
        <section>
          <h3 className="font-bold">Preparation checklist</h3>
          <dl className="mt-2 divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
            {row.preparationChecks.map((check) => (
              <div
                key={check.label}
                className="flex flex-wrap justify-between gap-2 p-3"
              >
                <dt>{check.label}</dt>
                <dd className="font-semibold">{check.status}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {row.revisionInstructions && (
        <section>
          <h3 className="font-bold">Released revision instructions</h3>
          <p className="mt-2 whitespace-pre-wrap break-words">
            {row.revisionInstructions}
          </p>
        </section>
      )}
      <section>
        <h3 className="font-bold">Panel and participants</h3>
        <ul className="mt-2 space-y-2">
          {row.panel.map((p, i) => (
            <li
              key={`${p.name}-${i}`}
              className="rounded-xl bg-[var(--color-surface-muted)] p-3"
            >
              <span className="font-semibold">{p.name}</span>
              <p className="mt-1 text-xs">
                {readable(p.role)} · {readable(p.status)} ·{" "}
                {p.required ? "Required" : "Optional"}
              </p>
            </li>
          ))}
        </ul>
        {!row.panel.length && <p className="mt-2">No participants recorded.</p>}
      </section>
      {!!row.attention.length && (
        <section>
          <h3 className="font-bold">Needs attention</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-amber-700 dark:text-amber-300">
            {row.attention.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
