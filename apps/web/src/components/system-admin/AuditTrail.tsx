import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";

type Event = {
  id: string;
  createdAt: string;
  actorReference: string | null;
  actorRoles: string[];
  action: string;
  entityType: string;
  entityId: string | null;
  eventType: string | null;
  category: string;
  outcome: string;
  contractVersion: number;
  researchId: string | null;
  summaryCount: number | null;
  firstOccurredAt: string | null;
  lastOccurredAt: string | null;
};
type Page = {
  events: Event[];
  nextCursor: string | null;
  security: {
    configured: boolean;
    mode: string;
    lastFlushAt: string | null;
    pending: number;
    overflow: number;
    droppedObservations: number;
    oldestPendingSeconds: number;
  };
};
const stamp = (value: string) =>
  new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "medium",
  });
const words = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_.]/g, " ")
    .toLowerCase();
const inputStyle =
  "rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600";
const badgeStyle =
  "inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium";
const neutralBadgeStyle =
  "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";

function ActionBadge({ action }: { action: string }) {
  let tone = neutralBadgeStyle;
  switch (action) {
    case "CREATE":
    case "UPDATE":
      tone = "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200";
      break;
    case "ROLE_CHANGE":
    case "PERMISSION_CHANGE":
      tone =
        "bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-200";
      break;
    case "DELETE":
    case "REJECT":
      tone = "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
      break;
  }
  return (
    <span className={`${badgeStyle} ${tone}`}>
      <span className="capitalize break-words">
        {words(action) || "Unknown action"}
      </span>
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const { tone, Icon } =
    outcome === "SUCCESS"
      ? {
          tone: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200",
          Icon: CheckCircle2,
        }
      : outcome === "FAILURE"
        ? {
            tone: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
            Icon: XCircle,
          }
        : { tone: neutralBadgeStyle, Icon: CircleHelp };
  return (
    <span className={`${badgeStyle} ${tone}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="capitalize break-words">
        {words(outcome) || "Unknown"}
      </span>
    </span>
  );
}

function EventDetail({ id, close }: { id: string; close: () => void }) {
  const query = useQuery({
    queryKey: ["audit-event", id],
    queryFn: () =>
      apiClient.get<{
        event: Event & {
          requestId: string;
          oldValues: unknown;
          newValues: unknown;
          ipAddress: string | null;
          userAgent: string | null;
        };
      }>(`/api/admin/audit/${id}`),
  });
  const event = query.data?.event;
  return (
    <section
      className="rounded-xl border border-slate-300 p-5 dark:border-slate-600"
      aria-label="Audit event details"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Event details</h2>
        <button type="button" onClick={close} className={inputStyle}>
          Close details
        </button>
      </div>
      {query.isPending && <p role="status">Loading event…</p>}
      {query.isError && (
        <p role="alert">
          Could not load event.{" "}
          <button type="button" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      )}
      {event && (
        <>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {Object.entries({
              Event: event.eventType || `${event.entityType} ${event.action}`,
              "Event ID": event.id,
              "Recorded (PHT)": stamp(event.createdAt),
              Actor: event.actorReference || "System / unauthenticated",
              "Roles at event":
                event.actorRoles.join(", ") || "Unknown / not recorded",
              Action: <ActionBadge action={event.action} />,
              Outcome: <OutcomeBadge outcome={event.outcome} />,
              "Affected record": event.entityId || "—",
              Project: event.researchId || "—",
              "Request ID": event.requestId || "—",
              "Source IP": event.ipAddress || "Not recorded",
              Browser: event.userAgent || "Not recorded",
            }).map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="break-all">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {[
              ["Previous values", event.oldValues],
              ["Recorded values / summary", event.newValues],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <h3 className="font-semibold">{String(label)}</h3>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-900">
                  {JSON.stringify(value, null, 2) || "Not recorded"}
                </pre>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function AuditTrail() {
  const [filters, setFilters] = useState({
    category: "",
    action: "",
    outcome: "",
    actorId: "",
    researchId: "",
    eventType: "",
    from: "",
    to: "",
  });
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState<string | undefined>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const query = useQuery({
    queryKey: ["audit-trail", applied, cursor],
    queryFn: () =>
      apiClient.get<Page>("/api/admin/audit", {
        params: { ...applied, cursor },
      }),
    staleTime: 15_000,
  });
  const update = (key: keyof typeof filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const exportCsv = async () => {
    setExporting(true);
    setExportError("");
    try {
      const blob = await apiClient.file(
        `/api/admin/audit/export?${new URLSearchParams(applied)}`,
        { expectedMimeType: "text/csv" },
      );
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "advisio-audit.csv";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError(
        "Export failed. Narrow the filters to at most 1,000 events, or wait a minute before retrying.",
      );
    } finally {
      setExporting(false);
    }
  };
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101b2b] sm:p-6">
      <div className="workspace-page-header">
        <h1 className="text-2xl font-bold">Audit trail</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Recorded changes and security summaries · Philippine Time. Default
          range: last 30 days.
        </p>
      </div>
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          const values: Record<string, string> = {};
          for (const [key, value] of Object.entries(filters))
            if (value.trim())
              values[key] =
                key === "from"
                  ? `${value}T00:00:00+08:00`
                  : key === "to"
                    ? `${value}T23:59:59.999+08:00`
                    : value.trim();
          setApplied(values);
          setCursor(undefined);
          setPrevious([]);
          setSelected(null);
        }}
      >
        <label className="grid gap-1 text-sm">
          Category
          <select
            data-tour="audit-filters"
            className={inputStyle}
            value={filters.category}
            onChange={(e) => update("category", e.target.value)}
          >
            <option value="">All categories</option>
            {[
              "ACCOUNT",
              "ACADEMIC",
              "DOCUMENT",
              "CONFIGURATION",
              "SECURITY",
              "LEGACY",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Action
          <select
            className={inputStyle}
            value={filters.action}
            onChange={(e) => update("action", e.target.value)}
          >
            <option value="">All actions</option>
            {[
              "CREATE",
              "UPDATE",
              "DELETE",
              "APPROVE",
              "REJECT",
              "TRANSITION",
              "PUBLISH",
              "LOGIN",
              "LOGOUT",
              "ROLE_CHANGE",
              "PERMISSION_CHANGE",
              "SIGN",
              "DOWNLOAD",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Outcome
          <select
            className={inputStyle}
            value={filters.outcome}
            onChange={(e) => update("outcome", e.target.value)}
          >
            <option value="">All outcomes</option>
            {["SUCCESS", "FAILURE", "UNKNOWN"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Event type
          <input
            className={inputStyle}
            value={filters.eventType}
            onChange={(e) => update("eventType", e.target.value)}
            data-guide="audit-filters"
            placeholder="e.g. LOGIN_FAILED"
            maxLength={100}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Actor ID
          <input
            className={inputStyle}
            value={filters.actorId}
            onChange={(e) => update("actorId", e.target.value)}
            placeholder="Account UUID"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Project ID
          <input
            className={inputStyle}
            value={filters.researchId}
            onChange={(e) => update("researchId", e.target.value)}
            placeholder="Research UUID"
          />
        </label>
        <label className="grid gap-1 text-sm">
          From (PHT)
          <input
            type="date"
            className={inputStyle}
            value={filters.from}
            onChange={(e) => update("from", e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Through (PHT)
          <input
            type="date"
            className={inputStyle}
            value={filters.to}
            onChange={(e) => update("to", e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <button className={inputStyle} type="submit">
            Apply filters
          </button>
          <button
            className={inputStyle}
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            Refresh
          </button>
          <button
            className={inputStyle}
            type="button"
            disabled={exporting}
            onClick={() => void exportCsv()}
          >
            {exporting ? "Exporting…" : "Export CSV (max 1,000)"}
          </button>
        </div>
      </form>
      {exportError && (
        <p role="alert" className="text-red-600">
          {exportError}
        </p>
      )}
      {query.data && (
        <p className="rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-900">
          Security aggregation:{" "}
          {query.data.security.configured
            ? query.data.security.mode
            : "not configured"}
          . Pending summaries: {query.data.security.pending}. Overflowed
          dimension increments: {query.data.security.overflow}. Dropped
          observations: {query.data.security.droppedObservations}. Oldest
          pending: {query.data.security.oldestPendingSeconds}s.{" "}
          {query.data.security.lastFlushAt &&
            `Last worker pass: ${stamp(query.data.security.lastFlushAt)}.`}{" "}
          Pair, source, and target summaries overlap; do not add their counts
          together.
        </p>
      )}
      {query.isPending && <p role="status">Loading audit trail…</p>}
      {query.isError && (
        <p role="alert">
          Could not load audit history. Check UUIDs and dates (maximum range:
          366 days), then retry.
        </p>
      )}
      {query.data && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Audit events in Philippine Time
              </caption>
              <thead>
                <tr>
                  {[
                    "Recorded (PHT)",
                    "Event",
                    "Actor / roles",
                    "Outcome",
                    "",
                  ].map((heading) => (
                    <th key={heading} className="border-b p-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.events.map((event) => (
                  <tr key={event.id}>
                    <td className="border-b p-3 whitespace-nowrap">
                      {stamp(event.createdAt)}
                    </td>
                    <td className="border-b p-3">
                      <span className="capitalize">
                        {words(
                          event.eventType ||
                            `${event.entityType}.${event.action}`,
                        )}
                      </span>
                      <p className="text-xs text-slate-500">
                        {event.category}
                        {event.contractVersion === 0 ? " · legacy record" : ""}
                      </p>
                      <div className="mt-2">
                        <ActionBadge action={event.action} />
                      </div>
                      {typeof event.summaryCount === "number" && (
                        <p className="text-xs">
                          {event.summaryCount} observations
                          {event.firstOccurredAt && event.lastOccurredAt
                            ? ` · ${stamp(event.firstOccurredAt)} – ${stamp(event.lastOccurredAt)}`
                            : ""}
                        </p>
                      )}
                    </td>
                    <td className="max-w-56 break-all border-b p-3">
                      {event.actorReference || "System / unauthenticated"}
                      <p className="text-xs text-slate-500">
                        {event.actorRoles.join(", ") || "Role not recorded"}
                      </p>
                    </td>
                    <td className="border-b p-3">
                      <OutcomeBadge outcome={event.outcome} />
                    </td>
                    <td className="border-b p-3">
                      <button
                        type="button"
                        className={inputStyle}
                        data-guide="sa-audit-details"
                        onClick={() => setSelected(event.id)}
                        aria-label={`View details for ${event.eventType || event.entityType} at ${stamp(event.createdAt)}`}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!query.data.events.length && (
              <p className="py-8 text-center">
                No recorded events match these filters.
              </p>
            )}
          </div>
          <nav className="flex justify-between" aria-label="Audit pagination">
            <button
              type="button"
              className={inputStyle}
              disabled={!previous.length}
              onClick={() => {
                setCursor(previous.at(-1));
                setPrevious((pages) => pages.slice(0, -1));
              }}
            >
              Previous
            </button>
            <button
              type="button"
              className={inputStyle}
              disabled={!query.data.nextCursor}
              onClick={() => {
                setPrevious((pages) => [...pages, cursor]);
                setCursor(query.data!.nextCursor!);
              }}
            >
              Next
            </button>
          </nav>
        </>
      )}
      {selected && (
        <EventDetail id={selected} close={() => setSelected(null)} />
      )}
    </section>
  );
}
