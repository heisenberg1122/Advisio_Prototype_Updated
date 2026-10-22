import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { PdfEvaluationWorkspace } from "./PdfEvaluationWorkspace";
import { SharedManuscriptFeedback } from "@/components/documents/SharedManuscriptFeedback";

type Version = { id: string; fileName: string; versionNumber: number };
export function PacketManuscriptWorkspace({
  sessionId,
}: {
  sessionId: string;
}) {
  const client = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["manuscript-review-versions", sessionId],
    queryFn: () =>
      apiClient.get<{ currentVersion: Version; reviewedVersions: Version[] }>(
        `/api/defense-sessions/${sessionId}/manuscript-annotations`,
      ),
    refetchInterval: 15000,
  });
  const [selected, setSelected] = useState<Version | null>(null);
  useEffect(() => {
    if (data && !selected) setSelected(data.currentVersion);
  }, [data, selected]);
  if (error)
    return (
      <p role="alert" className="p-4 text-rose-600">
        Unable to open manuscript review. Please retry.
      </p>
    );
  if (!data || !selected)
    return (
      <p role="status" className="p-4">
        Loading the published manuscript…
      </p>
    );
  const versions = Array.from(
    new Map(
      [data.currentVersion, selected, ...data.reviewedVersions].map((v) => [
        v.id,
        v,
      ]),
    ).values(),
  );
  return (
    <div className="space-y-4 p-3">
      <div className="rounded-xl border p-4">
        <label className="text-sm font-bold">
          Manuscript version
          <select
            aria-label="Manuscript review version"
            value={selected.id}
            onChange={(e) =>
              setSelected(versions.find((v) => v.id === e.target.value)!)
            }
            className="mt-2 block w-full rounded-lg border bg-[var(--color-surface)] p-2"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.versionNumber} · {v.fileName}
                {v.id === data.currentVersion.id
                  ? " · Published for defense"
                  : " · Earlier review"}
              </option>
            ))}
          </select>
        </label>
        {selected.id !== data.currentVersion.id && (
          <p className="mt-2 text-sm text-amber-600">
            A newer manuscript is published. This earlier review is preserved as
            read-only history.
          </p>
        )}
      </div>
      <PdfEvaluationWorkspace
        key={selected.id}
        sessionId={sessionId}
        manuscriptVersionId={selected.id}
        readOnly={selected.id !== data.currentVersion.id}
        onDraftSaved={() => {
          client.invalidateQueries({ queryKey: ["defense-review-packets"] });
          client.invalidateQueries({
            queryKey: ["manuscript-review-versions", sessionId],
          });
        }}
        onShared={() => {
          client.invalidateQueries({
            queryKey: ["shared-manuscript-feedback", sessionId],
          });
          client.invalidateQueries({
            queryKey: ["manuscript-review-versions", sessionId],
          });
        }}
      />
      <SharedManuscriptFeedback sessionId={sessionId} />
    </div>
  );
}
