import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

type History = {
  events: {
    id: string;
    eventType: string | null;
    entityType: string;
    action: string;
    createdAt: string;
  }[];
  nextCursor: string | null;
  coverage: string;
};
function HistoryEntries({ researchId }: { researchId: string }) {
  const [cursor, setCursor] = useState<string>();
  const query = useQuery({
    queryKey: ["project-audit", researchId, cursor],
    queryFn: () =>
      apiClient.get<History>(`/api/research/${researchId}/audit`, {
        params: { cursor },
      }),
  });
  if (query.isPending) return <p role="status">Loading project history…</p>;
  if (query.isError)
    return (
      <p role="alert">
        Project history could not be loaded.{" "}
        <button type="button" onClick={() => void query.refetch()}>
          Try again
        </button>
      </p>
    );
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Recorded academic events from the last 30 days. Earlier records may be
        absent. Times are in Philippine Time.
      </p>
      <ol className="space-y-3">
        {query.data.events.map((event) => (
          <li
            key={event.id}
            className="border-b border-[var(--color-border)] pb-2"
          >
            <p className="capitalize">
              {(event.eventType || `${event.entityType} ${event.action}`)
                .replace(/([a-z])([A-Z])/g, "$1 $2")
                .replace(/[_.]/g, " ")
                .toLowerCase()}
            </p>
            <time
              className="text-sm text-[var(--color-text-secondary)]"
              dateTime={event.createdAt}
            >
              {new Date(event.createdAt).toLocaleString("en-PH", {
                timeZone: "Asia/Manila",
              })}
            </time>
          </li>
        ))}
      </ol>
      {!query.data.events.length && (
        <p>No project events recorded in this period.</p>
      )}
      <div className="flex gap-3">
        {cursor && (
          <button
            type="button"
            className="mp-button mp-button--secondary"
            onClick={() => setCursor(undefined)}
          >
            Latest events
          </button>
        )}
        {query.data.nextCursor && (
          <button
            type="button"
            className="mp-button mp-button--secondary"
            onClick={() => setCursor(query.data!.nextCursor!)}
          >
            Older events
          </button>
        )}
      </div>
    </div>
  );
}
export function ProjectAuditHistory({ researchId }: { researchId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mp-panel">
      <button
        type="button"
        className="mp-button mp-button--secondary"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide project history" : "View project history"}
      </button>
      {open && <HistoryEntries researchId={researchId} />}
    </section>
  );
}
