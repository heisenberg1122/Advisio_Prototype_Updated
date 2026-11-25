import React, { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Modal } from "@/components/ui/Modal";
import { useDashboardWorkspace } from "@/providers/dashboard-workspace-provider";
import type {
  DefenseResponse,
  DefenseRow,
} from "@research-management/shared/src/dean-monitoring";
import {
  actionClass,
  inputClass,
  useDeanFilters,
  DefaultYear,
  FilterField,
  ScopeFilters,
  Pagination,
  QueryState,
  readable,
  dateTime,
} from "./DeanMonitoringShared";
import { PhoneFilters } from "@/components/ui/PhoneFilters";
import { DateTile, EmptyNote, StatusDot, type StatusTone } from "@/components/ui/advisio";
import { FilterChips, RoleBand, plural } from "@/components/dashboards/RoleScreenParts";

const manila = (value: string | null, options: Intl.DateTimeFormatOptions) =>
  value ? new Intl.DateTimeFormat("en-PH", { ...options, timeZone: "Asia/Manila" }).format(new Date(value)) : "—";

function defenseTone(status: string, attention: string[], decision?: string | null): StatusTone {
  if (decision || status === "COMPLETED") return "done";
  if (status === "ONGOING") return "live";
  if (status === "CANCELLED") return "neutral";
  return attention.length ? "waiting" : "brand";
}

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
    <main className="workspace-page rs mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8">
      <DefaultYear
        scope={data?.scope}
        selected={query.academicYearId}
        set={update}
      />
      <RoleBand
        eyebrow="Research oversight"
        title="Defenses"
        titleId="dean-defenses-title"
        meta={
          data
            ? `${plural(data.cards.awaitingPanel, "defense is", "defenses are")} waiting on panel confirmation · ${data.scope.college.name}`
            : "Schedules, readiness, and released outcomes."
        }
        counts={
          data && !dataQuery.isError
            ? [
                { label: "Upcoming", value: data.cards.upcoming },
                { label: "Awaiting panel", value: data.cards.awaitingPanel, tone: data.cards.awaitingPanel ? "waiting" : undefined },
                { label: "Reschedule", value: data.cards.rescheduling },
                { label: "Result to release", value: data.cards.awaitingRelease },
              ]
            : undefined
        }
        countsLabel="Defense summary"
        secondary={[{ label: "Refresh", icon: "ti-refresh", onClick: () => void dataQuery.refetch() }]}
      />
      <FilterChips
        label="Defense views"
        value={query.view || "upcoming"}
        onChange={(view) => update({ view })}
        options={[
          { value: "upcoming", label: "Upcoming" },
          { value: "attention", label: "Needs attention" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled lookup" },
        ]}
      />
      <section aria-label="Defense filters" className="rs-filter-card phone-filter-section">
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
        <div className={user?.roles.includes("PANELIST") ? "rh-grid" : "rs"}>
          <section className="rs-table" aria-label="College defenses">
            {data.rows.length ? (
              <ul className="rh-rows" style={{ margin: 0, padding: "0 18px" }}>
                {data.rows.map((row) => (
                  <li key={row.id}>
                    <div className="rh-row">
                      <DateTile top={manila(row.scheduledStart, { month: "short" })} bottom={manila(row.scheduledStart, { day: "numeric" })} />
                      <div className="rh-text">
                        <h3>{row.title}</h3>
                        <p>
                          {manila(row.scheduledStart, { hour: "numeric", minute: "2-digit" })} · {row.venue || "Venue not recorded"} · {row.groupName || "Group not recorded"} · {row.program} · {row.stage}
                        </p>
                        {row.attention.map((item) => <span key={item} className="rs-why" data-tone="waiting">{item}</span>)}
                        {row.decision && <span className="rs-why" data-tone="done">{readable(row.decision)}</span>}
                      </div>
                      <span className="rs-text" style={{ flex: "none", textAlign: "right" }}>
                        <StatusDot tone={defenseTone(row.status, row.attention, row.decision)}>{readable(row.status)}</StatusDot>
                        <small>Panel {row.panelAccepted}/{row.panelRequired} confirmed</small>
                      </span>
                      <button type="button" className="rh-secondary" aria-label={`View details for ${row.title}`} onClick={() => setSelected(row.id)}>Details</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyNote layout="row" icon="ti-gavel" title="No defenses in this view" text="Try another view or change your filters." />
            )}
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              update={update}
            />
          </section>
          {user?.roles.includes("PANELIST") && (
            <section className="rh-panel" aria-labelledby="dean-panel-assignments">
              <div className="rh-head">
                <h2 id="dean-panel-assignments">My panel assignments</h2>
                {data.myAssignments.length > 0 && <span className="rh-pill">{data.myAssignments.length}</span>}
              </div>
              <p className="rh-lede">Evaluation opens in your Panelist workspace.</p>
              {data.myAssignments.length ? (
                <ul className="rh-rows">
                  {data.myAssignments.map((row) => (
                    <li key={row.id}>
                      <div className="rh-row" style={{ flexWrap: "wrap" }}>
                        <DateTile top={manila(row.scheduledStart, { month: "short" })} bottom={manila(row.scheduledStart, { day: "numeric" })} />
                        <div className="rh-text">
                          <h3>{row.title}</h3>
                          <p>{manila(row.scheduledStart, { hour: "numeric", minute: "2-digit" })} · {readable(row.myAssignment!.status)}</p>
                        </div>
                        {row.myAssignment!.status !== "DECLINED" && (
                          <button type="button" disabled={opening || isSwitching} className="rh-secondary" onClick={() => panelAction(row)}>
                            {row.myAssignment!.canEvaluate
                              ? "Open Evaluation"
                              : row.myAssignment!.status === "ACCEPTED"
                                ? "View Defense"
                                : "Review invitation"}
                            <ArrowUpRight size={15} />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rh-space"><EmptyNote layout="row" icon="ti-gavel" title="No panel assignments" text="Assignments matching the filters appear here." /></div>
              )}
            </section>
          )}
        </div>
      )}
      {data && !dataQuery.isError && (
        <p className="rs-note">Counts use the selected filters and may overlap. All times are Asia/Manila. Updated {dateTime(data.generatedAt)}.</p>
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
