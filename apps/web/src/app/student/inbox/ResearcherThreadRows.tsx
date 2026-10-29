import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Paperclip,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
  MailFolder,
  MailThread,
} from "@/components/messaging/mail-types";
import {
  formatMailDate,
  personInitials,
  personName,
} from "@/components/messaging/mail-types";

import type { ComponentProps } from "react";
import type { MailThreadList } from "@/components/messaging/MailThreadList";

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

export function ResearcherThreadRows({ folder, threads, selectedId, userId, query, filter, pagination, loading, onPageChange, onSelect }: ComponentProps<typeof MailThreadList>) {
  const title = folder === "inbox" ? "Inbox" : folder === "sent" ? "Sent" : folder === "drafts" ? "Drafts" : folder === "archive" ? "Archive" : "Trash";
  return <>
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
              <p className="mt-4 text-base font-bold text-[var(--color-text-secondary)]">No matching messages</p>
              <p className="mt-1 max-w-56 text-base leading-5 text-[var(--color-text-muted)]">
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
                  data-thread-id={thread.id}
                  onClick={() => onSelect(thread.id)}
                  aria-current={selected ? "true" : undefined}
                  className={`${selected ? "border-l-[3px] border-l-[var(--color-text-primary)] bg-[var(--color-surface-muted)]" : "border-l-[3px] border-l-transparent hover:bg-[var(--color-surface-muted)]/70"} rm-thread-row flex w-full cursor-pointer gap-3 px-3 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]`}
                >
                  <span className={`${thread.unread ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]"} grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-black`}>
                    {personInitials(identity.person)}
                  </span>
                  <span className="rm-thread-summary min-w-0 flex-1">
                    <span className="rm-thread-identity flex items-center gap-2">
                      <span className={`${thread.unread ? "font-black text-[var(--color-text-primary)]" : "font-semibold text-[var(--color-text-secondary)]"} rm-thread-sender min-w-0 flex-1 truncate text-sm`}>
                        {identity.label}
                      </span>
                      <time className={`${thread.unread ? "font-bold text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"} shrink-0 text-xs`}>
                        {formatMailDate(latest?.sentAt || latest?.createdAt || thread.updatedAt, true)}
                      </time>
                    </span>
                    <span className={`${thread.unread ? "font-bold text-[var(--color-text-primary)]" : "font-semibold text-[var(--color-text-secondary)]"} rm-thread-subject mt-1 block truncate text-sm`}>
                      {thread.subject || "(no subject)"}
                    </span>
                    <span className="rm-thread-snippet mt-1 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
                      <span className="min-w-0 flex-1 truncate">{latest?.body || "Empty draft"}</span>
                      {latest?.attachments?.length ? <Paperclip className="h-3.5 w-3.5 shrink-0" aria-label="Has attachments" /> : null}
                      {thread.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" aria-hidden="true" /> : null}
                      {thread.unread ? <span className="sr-only">Unread</span> : null}
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
  </>;
}
