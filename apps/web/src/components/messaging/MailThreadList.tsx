import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Paperclip,
  Search,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
  MailFilter,
  MailFolder,
  MailPagination,
  MailThread,
} from "./mail-types";
import {
  formatMailDate,
  personInitials,
  personName,
} from "./mail-types";

interface MailThreadListProps {
  folder: MailFolder;
  threads: MailThread[];
  selectedId: string;
  userId?: string;
  query: string;
  filter: MailFilter;
  pagination?: MailPagination;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: MailFilter) => void;
  onPageChange: (page: number) => void;
  onSelect: (id: string) => void;
}

const FOLDER_TITLES: Record<Exclude<MailFolder, "signature-requests">, string> = {
  inbox: "Inbox",
  sent: "Sent",
  drafts: "Drafts",
  archive: "Archive",
  trash: "Trash",
};

function listIdentity(thread: MailThread, folder: MailFolder, userId?: string) {
  const latest = thread.messages[0];
  if (folder === "sent" || folder === "drafts" || latest?.senderId === userId) {
    const recipients = thread.participants.filter(
      (participant) => participant.recipientType !== "SENDER",
    );
    return {
      label: `To: ${recipients.map((participant) => personName(participant.user)).join(", ") || "No recipient"}`,
      person: recipients[0]?.user,
    };
  }
  return { label: personName(latest?.sender), person: latest?.sender };
}

export function MailThreadList({
  folder,
  threads,
  selectedId,
  userId,
  query,
  filter,
  pagination,
  loading,
  onQueryChange,
  onFilterChange,
  onPageChange,
  onSelect,
}: MailThreadListProps) {
  const title = FOLDER_TITLES[folder as Exclude<MailFolder, "signature-requests">] || "Inbox";
  return (
    <aside
      aria-label={`${title} message list`}
      className={`${selectedId ? "hidden md:flex" : "flex"} min-h-0 w-full shrink-0 flex-col border-b border-[var(--color-border)] bg-[var(--color-surface)] md:w-[360px] md:border-b-0 md:border-r xl:w-[420px]`}
    >
      <div className="shrink-0 space-y-3 border-b border-[var(--color-border)] p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-primary)]">Academic correspondence</p>
            <h1 className="mt-0.5 text-xl font-bold text-[var(--color-text-primary)]">{title}</h1>
          </div>
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">
            {pagination?.total ?? 0} {pagination?.total === 1 ? "thread" : "threads"}
          </span>
        </div>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 focus-within:border-[var(--color-primary)]">
          <Search className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          <span className="sr-only">Search mail</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search sender, subject, or message"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text-primary)] outline-none"
          />
        </label>
        {folder !== "drafts" ? (
          <div className="flex gap-2" aria-label="Message filters">
            {(["all", "unread", "attachments"] as MailFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={filter === item}
                onClick={() => onFilterChange(item)}
                className={`${filter === item ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"} rounded-full px-3 py-1.5 text-[11px] font-bold capitalize`}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        {loading ? (
          <div className="space-y-1 p-2" role="status" aria-label="Loading messages">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="flex gap-3 rounded-xl p-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /></div>
              </div>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="grid h-full min-h-64 place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]"><Inbox className="h-7 w-7" /></span>
              <p className="mt-4 text-sm font-bold text-[var(--color-text-secondary)]">No matching messages</p>
              <p className="mt-1 max-w-56 text-xs leading-5 text-[var(--color-text-muted)]">
                {query || filter !== "all" ? "Try clearing the search or changing the filter." : `Your ${title.toLowerCase()} is currently empty.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]/70">
            {threads.map((thread) => {
              const latest = thread.messages[0];
              const identity = listIdentity(thread, folder, userId);
              const selected = selectedId === thread.id;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => onSelect(thread.id)}
                  aria-current={selected ? "true" : undefined}
                  className={`${selected ? "border-l-[3px] border-l-[var(--color-primary)] bg-[var(--color-primary-light)]/45" : "border-l-[3px] border-l-transparent hover:bg-[var(--color-surface-muted)]/70"} flex w-full gap-3 px-3 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]`}
                >
                  <span className={`${thread.unread ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]"} grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-black`}>
                    {personInitials(identity.person)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`${thread.unread ? "font-black text-[var(--color-text-primary)]" : "font-semibold text-[var(--color-text-secondary)]"} min-w-0 flex-1 truncate text-sm`}>
                        {identity.label}
                      </span>
                      <time className={`${thread.unread ? "font-bold text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"} shrink-0 text-[10px]`}>
                        {formatMailDate(latest?.sentAt || latest?.createdAt || thread.updatedAt, true)}
                      </time>
                    </span>
                    <span className={`${thread.unread ? "font-bold text-[var(--color-text-primary)]" : "font-semibold text-[var(--color-text-secondary)]"} mt-1 block truncate text-xs`}>
                      {thread.subject || "(no subject)"}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                      <span className="min-w-0 flex-1 truncate">{latest?.body || "Empty draft"}</span>
                      {latest?.attachments?.length ? <Paperclip className="h-3.5 w-3.5 shrink-0" aria-label="Has attachments" /> : null}
                      {thread.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" aria-label="Unread" /> : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex h-12 shrink-0 items-center justify-between border-t border-[var(--color-border)] px-4 text-xs text-[var(--color-text-muted)]">
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <div className="flex gap-1">
            <button type="button" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)} aria-label="Previous page" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--color-surface-muted)] disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)} aria-label="Next page" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--color-surface-muted)] disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
