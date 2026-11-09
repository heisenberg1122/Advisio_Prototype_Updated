import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  DeanReport,
  ReportType,
} from "@research-management/shared/src/dean-monitoring";
import {
  actionClass,
  panelClass,
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
import { RoleBand, plural } from "@/components/dashboards/RoleScreenParts";

const reportDetails: Record<ReportType, { icon: string; hint: string }> = {
  "research-progress": { icon: "ti-chart-line", hint: "Stage, progress and risk" },
  "defense-outcomes": { icon: "ti-gavel", hint: "Released panel decisions" },
  "adviser-workload": { icon: "ti-user-check", hint: "Assignments and capacity" },
};
const reports: Record<ReportType, string> = {
  "research-progress": "Research Progress",
  "defense-outcomes": "Defense Outcomes",
  "adviser-workload": "Adviser Workload",
};
const statuses = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISION",
  "APPROVED",
  "DEFENSE",
  "COMPLETED",
  "ARCHIVED",
  "REJECTED",
];
export function DeanReportsView() {
  const { params, query, update, reset, identity, user } =
    useDeanFilters("reports");
  const selected = params.get("report");
  const type = (
    selected && Object.prototype.hasOwnProperty.call(reports, selected)
      ? selected
      : "research-progress"
  ) as ReportType;
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);
  const [feedback, setFeedback] = useState<{
    error: boolean;
    text: string;
  } | null>(null);
  const endpoint = `/api/dean/reports/${type}`;
  const reportQuery = useQuery({
    queryKey: ["dean-report", ...identity, type, query],
    queryFn: () => apiClient.get<DeanReport>(endpoint, { params: query }),
    staleTime: 15000,
  });
  const report = reportQuery.data;
  async function download(format: "pdf" | "csv") {
    setExporting(format);
    setFeedback(null);
    try {
      const filters = new URLSearchParams(query);
      filters.delete("page");
      filters.set("format", format);
      const blob = await apiClient.file(`${endpoint}/export?${filters}`, {
        expectedMimeType: format === "pdf" ? "application/pdf" : "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `advisio-${type}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback({
        error: false,
        text: `${format.toUpperCase()} report downloaded.`,
      });
    } catch (error) {
      setFeedback({
        error: true,
        text:
          error instanceof Error
            ? error.message
            : "Could not export the report.",
      });
    } finally {
      setExporting(null);
    }
  }
  const chooseReport = (next: ReportType) => {
    setFeedback(null);
    update({
      report: next,
      stageId: null,
      defenseType: null,
      from: null,
      to: null,
      status: null,
      researchTypeId: null,
      availability: null,
    });
  };
  const mainSummary = (report?.summary || []).filter(
    (item) => !item.label.startsWith("Stage: ") && !item.label.startsWith("Status: "),
  );
  const bandSummary = report && !reportQuery.isError ? mainSummary.slice(0, 4) : [];
  const extraSummary = mainSummary.slice(4);
  return (
    <main className="workspace-page rs mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8">
      <DefaultYear
        scope={report?.scope}
        selected={query.academicYearId}
        set={update}
      />
      <RoleBand
        eyebrow="Research oversight"
        title="Reports"
        titleId="dean-reports-title"
        meta={report ? `${reports[type]} · ${plural(report.total, "record", "records")} in the current filters` : `${reports[type]} · ${user?.college?.name || "your college"}`}
        counts={bandSummary.map((item) => ({ label: item.label, value: item.value }))}
        countsLabel="Report summary"
        primary={{
          label: exporting === "pdf" ? "Generating…" : "Export PDF",
          icon: "ti-download",
          disabled: !report || Boolean(exporting) || report.total > 5000,
          onClick: () => void download("pdf"),
        }}
        secondary={[
          {
            label: exporting === "csv" ? "Generating…" : "Export CSV",
            icon: "ti-file-spreadsheet",
            guide: "de-report-export",
            disabled: !report || Boolean(exporting) || report.total > 5000,
            onClick: () => void download("csv"),
          },
          { label: "Refresh", icon: "ti-refresh", onClick: () => void reportQuery.refetch() },
        ]}
      />
      <div className="rs-risks" role="group" aria-label="Choose a report" data-guide="report-selection">
        {(Object.keys(reports) as ReportType[]).map((key) => (
          <button key={key} type="button" className="rs-risk" aria-pressed={type === key} onClick={() => chooseReport(key)}>
            <span className="rh-icon" aria-hidden="true"><i className={`ti ${reportDetails[key].icon}`} /></span>
            <span className="rs-text"><strong>{reports[key]}</strong><small>{reportDetails[key].hint}</small></span>
          </button>
        ))}
      </div>
      <section className="rs-filter-card phone-filter-section" aria-label="Report filters">
        <PhoneFilters title="Filter this report">
        <ScopeFilters
          scope={report?.scope}
          query={query}
          update={update}
          stage={
            type === "defense-outcomes"
              ? "defense"
              : type === "research-progress"
                ? "project"
                : undefined
          }
        />
        {type === "research-progress" && (
          <>
            <FilterField label="Research type">
              <select
                className={inputClass}
                value={query.researchTypeId || "all"}
                onChange={(e) => update({ researchTypeId: e.target.value })}
              >
                <option value="all">All research types</option>
                {report?.scope.researchTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Project status">
              <select
                className={inputClass}
                value={query.status || "all"}
                onChange={(e) => update({ status: e.target.value })}
              >
                <option value="all">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {readable(s)}
                  </option>
                ))}
              </select>
            </FilterField>
          </>
        )}
        {type === "defense-outcomes" && (
          <>
            <FilterField label="Released from">
              <input
                className={inputClass}
                type="date"
                value={query.from || ""}
                onChange={(e) => update({ from: e.target.value })}
              />
            </FilterField>
            <FilterField label="Released to">
              <input
                className={inputClass}
                type="date"
                value={query.to || ""}
                onChange={(e) => update({ to: e.target.value })}
              />
            </FilterField>
          </>
        )}
        {type === "adviser-workload" && (
          <FilterField label="Adviser availability">
            <select
              className={inputClass}
              value={query.availability || "all"}
              onChange={(e) => update({ availability: e.target.value })}
            >
              <option value="all">All advisers</option>
              <option value="accepting">Accepting requests</option>
              <option value="closed">Closed to requests</option>
            </select>
          </FilterField>
        )}
        <button
          className={actionClass}
          onClick={() => {
            setFeedback(null);
            reset();
          }}
        >
          Reset filters
        </button>
        </PhoneFilters>
      </section>
      <QueryState
        loading={reportQuery.isPending}
        error={reportQuery.error}
        retry={() => reportQuery.refetch()}
      />
      {report && !reportQuery.isError && (
        <>
          <section className={`${panelClass} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{report.title}</h2>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Preview generated {dateTime(report.generatedAt)} ·{" "}
                  {report.timezone}
                </p>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  Exports include all {report.total.toLocaleString()} matching
                  rows. A later export may reflect updates since this preview.
                </p>
              </div>
            </div>
            {report.total > 5000 && (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                Narrow your filters to 5,000 rows or fewer before exporting.
              </p>
            )}
            {feedback && (
              <p
                role={feedback.error ? "alert" : "status"}
                className={`mt-3 text-sm ${feedback.error ? "text-rose-600" : "text-emerald-700 dark:text-emerald-300"}`}
              >
                {feedback.text}
              </p>
            )}
            <dl className="mt-4 flex flex-wrap gap-3">
              {Object.entries(report.filters).map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-lg bg-[var(--color-surface-muted)] px-3 py-2"
                >
                  <dt className="text-xs text-[var(--color-text-secondary)]">
                    {k}
                  </dt>
                  <dd className="text-sm font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          {extraSummary.length > 0 && <SummaryCards items={extraSummary} />}
          {report.summary.some(
            (s) =>
              s.label.startsWith("Stage: ") || s.label.startsWith("Status: "),
          ) && (
            <details className={`${panelClass} p-4`}>
              <summary className="cursor-pointer text-sm font-bold">
                Stage and status breakdown
              </summary>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {report.summary
                  .filter(
                    (s) =>
                      s.label.startsWith("Stage: ") ||
                      s.label.startsWith("Status: "),
                  )
                  .map((s) => (
                    <div
                      className="flex justify-between gap-3 border-b border-[var(--color-border)] py-1 text-sm"
                      key={s.label}
                    >
                      <dt>{s.label}</dt>
                      <dd className="font-bold">{s.value}</dd>
                    </div>
                  ))}
              </dl>
            </details>
          )}
          {report.breakdowns
            ?.filter((b) => b.rows.length)
            .map((b) => (
              <details key={b.title} className={`${panelClass} p-4`}>
                <summary className="cursor-pointer text-sm font-bold">
                  {b.title}
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[740px] text-left text-sm">
                    <thead className="bg-[var(--color-surface-muted)]">
                      <tr>
                        {b.columns.map((c) => (
                          <th
                            scope="col"
                            key={c.key}
                            className="px-3 py-2 text-xs"
                          >
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {b.rows.map((row, i) => (
                        <tr key={i}>
                          {b.columns.map((c) => (
                            <td key={c.key} className="px-3 py-2">
                              {row[c.key]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          <section
            aria-label="Report preview"
            className={`${panelClass} overflow-hidden`}
          >
            <div className="overflow-x-auto">
              <table className="rs-native-table">
                <thead>
                  <tr>
                    {report.columns.map((c) => (
                      <th scope="col" key={c.key}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {report.rows.map((r, i) => (
                    <tr key={String(r.id ?? i)}>
                      {report.columns.map((c) => (
                        <td key={c.key}>
                          {r[c.key] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.rows.length && (
                <p className="p-10 text-center text-sm text-[var(--color-text-secondary)]">
                  No records match the selected filters.
                </p>
              )}
            </div>
            <Pagination
              page={report.page}
              pageSize={report.pageSize}
              total={report.total}
              update={update}
            />
          </section>
          <details className={`${panelClass} p-4`}>
            <summary className="cursor-pointer text-sm font-bold">
              How the metrics are calculated
            </summary>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-[var(--color-text-secondary)]">
              {report.definitions.map((def) => (
                <li key={def}>{def}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </main>
  );
}
