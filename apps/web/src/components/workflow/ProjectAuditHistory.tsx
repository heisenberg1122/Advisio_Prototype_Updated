import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { History as HistoryIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

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
    <>
      <button
        type="button"
        className="mp-button mp-button--secondary mp-history-trigger"
        aria-label="View project history"
        title="View project history"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <HistoryIcon size={19} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Project history" maxWidth="lg">
        {open && <HistoryEntries researchId={researchId} />}
      </Modal>
    </>
  );
}
