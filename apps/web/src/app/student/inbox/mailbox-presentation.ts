import type { MailFilter, MailFolder, MailThreadListResponse } from "@/components/messaging/mail-types";

export type ResearcherMailFolder = Exclude<MailFolder, "signature-requests">;
export type FolderObservation = { count: number; inconsistent: boolean };

// Counts describe the unfiltered folder, whereas pagination describes the query.
// Only an unfiltered first page can corroborate the count and its emptiness.
export function observeFolder(
  folder: ResearcherMailFolder,
  data: MailThreadListResponse | undefined,
  resolvedQuery: string,
  filter: MailFilter,
): FolderObservation | undefined {
  if (!data || resolvedQuery || filter !== "all" || data.pagination.page !== 1) return;
  const count = data.counts[folder];
  return {
    count,
    inconsistent: !Number.isInteger(count) || count < 0 ||
      count !== data.pagination.total || (count === 0) !== (data.threads.length === 0),
  };
}

export function mergeObservation(previous: FolderObservation | undefined, next: FolderObservation): FolderObservation {
  return { ...next, inconsistent: Boolean(previous?.inconsistent || next.inconsistent) };
}

export function isEmptyFolder(observation: FolderObservation | undefined, selectedId: string, loading: boolean, errored: boolean) {
  return Boolean(observation && !observation.inconsistent && observation.count === 0 && !selectedId && !loading && !errored);
}
