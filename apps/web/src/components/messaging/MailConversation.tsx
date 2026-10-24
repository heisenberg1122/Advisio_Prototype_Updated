import { useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Download,
  Forward,
  Mail,
  MailOpen,
  Paperclip,
  Pencil,
  Reply,
  ReplyAll,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { MailAttachmentMenu, type MailAttachment } from "./MailAttachmentMenu";
import { MailFormattedBody } from "./MailFormattedBody";
import type { MailFolder, MailMessage, MailThread } from "./mail-types";
import { formatMailDate, personInitials, personName } from "./mail-types";

interface MailConversationProps {
  folder: MailFolder;
  thread?: MailThread | null;
  draftThread?: MailThread | null;
  userId?: string;
  loading: boolean;
  canSignAttachments: boolean;
  pendingAction: boolean;
  notice?: string;
  error?: string;
  onBack: () => void;
  onThreadAction: (action: "archive" | "trash" | "restore" | "mark-read" | "mark-unread") => void;
  onReplyAll: (body: string, files: File[]) => void;
  onReply: (message: MailMessage) => void;
  onForward: (message: MailMessage) => void;
  onEditDraft: () => void;
  onSendDraft: () => void;
  onDeleteDraft: () => void;
  onOpenAttachment: (attachment: MailAttachment) => void;
  onDownloadAttachment: (attachment: MailAttachment) => void;
  onSignAttachment: (attachment: MailAttachment) => void;
}

function recipientLine(thread: MailThread, type: "TO" | "CC" | "BCC") {
  return thread.participants
    .filter((participant) => participant.recipientType === type)
    .map((participant) => personName(participant.user))
    .join(", ");
}

function IconAction({
  label,
  onClick,
  children,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`${danger ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"} grid h-9 w-9 place-items-center rounded-lg disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

export function MailConversation({
  folder,
  thread,
  draftThread,
  userId,
  loading,
  canSignAttachments,
  pendingAction,
  notice,
  error,
  onBack,
  onThreadAction,
  onReplyAll,
  onReply,
  onForward,
  onEditDraft,
  onSendDraft,
  onDeleteDraft,
  onOpenAttachment,
  onDownloadAttachment,
  onSignAttachment,
}: MailConversationProps) {
  const [replyBody, setReplyBody] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const activeThread = folder === "drafts" ? draftThread : thread;
  const draft = draftThread?.messages[0];

  if (!activeThread) {
    return (
      <section className="hidden min-w-0 flex-1 place-items-center bg-[var(--color-surface)] p-8 text-center md:grid">
        <div className="max-w-sm">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]"><Mail className="h-8 w-8" /></span>
          <h2 className="mt-4 text-lg font-bold text-[var(--color-text-secondary)]">Select a conversation</h2>
          <p className="mt-1 text-base leading-6 text-[var(--color-text-muted)]">Choose a thread to read its complete history, download authorized attachments, or continue the correspondence.</p>
        </div>
      </section>
    );
  }

  if (loading && folder !== "drafts") {
    return (
      <section className="flex min-w-0 flex-1 flex-col p-5" role="status" aria-label="Opening conversation">
        <Skeleton className="h-7 w-2/3" /><Skeleton className="mt-2 h-3 w-1/3" />
        <div className="mt-8 space-y-4"><Skeleton className="h-40 w-full rounded-2xl" /><Skeleton className="h-32 w-full rounded-2xl" /></div>
      </section>
    );
  }

  if (folder === "drafts" && draftThread && draft) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-surface)]">
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-6">
          <button type="button" onClick={onBack} aria-label="Back to drafts" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[var(--color-surface-muted)] md:hidden"><ArrowLeft className="h-4 w-4" /></button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-600">Saved draft</p>
            <h2 className="truncate text-lg font-bold text-[var(--color-text-primary)]">{draftThread.subject || "(no subject)"}</h2>
          </div>
          <IconAction label="Edit draft" onClick={onEditDraft}><Pencil className="h-4 w-4" /></IconAction>
          <IconAction label="Delete draft" onClick={onDeleteDraft} danger><Trash2 className="h-4 w-4" /></IconAction>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-4xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
            <p className="text-base text-[var(--color-text-muted)]">To: {recipientLine(draftThread, "TO") || "No recipient selected"}</p>
            {recipientLine(draftThread, "CC") ? <p className="mt-1 text-base text-[var(--color-text-muted)]">Cc: {recipientLine(draftThread, "CC")}</p> : null}
            {recipientLine(draftThread, "BCC") ? <p className="mt-1 text-base text-[var(--color-text-muted)]">Bcc: {recipientLine(draftThread, "BCC")}</p> : null}
            <div className="mt-6 text-[var(--color-text-primary)]"><MailFormattedBody body={draft.body || "Empty draft"} /></div>
            {draft.attachments.map((attachment) => (
              <button key={attachment.id} type="button" onClick={() => onDownloadAttachment(attachment)} className="mt-3 flex w-full max-w-lg items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-left text-sm font-bold"><Paperclip className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{attachment.fileName}</span><Download className="h-4 w-4" /></button>
            ))}
          </div>
        </div>
        <footer className="flex shrink-0 gap-2 border-t border-[var(--color-border)] p-4">
          <button type="button" onClick={onEditDraft} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-bold"><Pencil className="h-4 w-4" />Continue editing</button>
          <button type="button" disabled={pendingAction} onClick={onSendDraft} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" />Send draft</button>
        </footer>
      </section>
    );
  }

  if (!thread) return null;
  const to = recipientLine(thread, "TO");
  const cc = recipientLine(thread, "CC");
  const bcc = recipientLine(thread, "BCC");

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-surface)]">
      <header className="shrink-0 border-b border-[var(--color-border)] px-4 py-3 sm:px-6">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onBack} aria-label="Back to message list" className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-[var(--color-surface-muted)] md:hidden"><ArrowLeft className="h-4 w-4" /></button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-[var(--color-text-primary)]">{thread.subject || "(no subject)"}</h2>
            <p className="mt-0.5 truncate text-sm text-[var(--color-text-muted)]">To: {to || "No visible recipients"}{cc ? ` · Cc: ${cc}` : ""}{bcc ? ` · Bcc: ${bcc}` : ""}</p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {folder === "archive" || folder === "trash" ? <IconAction label="Restore to inbox" disabled={pendingAction} onClick={() => onThreadAction("restore")}><RotateCcw className="h-4 w-4" /></IconAction> : <IconAction label="Archive" disabled={pendingAction} onClick={() => onThreadAction("archive")}><Archive className="h-4 w-4" /></IconAction>}
            <IconAction label={thread.unread ? "Mark as read" : "Mark as unread"} disabled={pendingAction} onClick={() => onThreadAction(thread.unread ? "mark-read" : "mark-unread")}>{thread.unread ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}</IconAction>
            {folder !== "trash" ? <IconAction label="Move to trash" disabled={pendingAction} danger onClick={() => onThreadAction("trash")}><Trash2 className="h-4 w-4" /></IconAction> : null}
          </div>
        </div>
        {notice ? <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-base font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">{notice}</p> : null}
        {error ? <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-base font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p> : null}
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--color-surface-muted)]/45 p-4 sm:p-6">
        {thread.messages.map((message) => {
          const mine = message.senderId === userId;
          return (
            <article key={message.id} className="mx-auto max-w-4xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card-soft)] sm:p-5">
              <header className="flex items-start gap-3">
                <span className={`${mine ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"} grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-black`}>{personInitials(message.sender)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{personName(message.sender)}{mine ? " (you)" : ""}</p>
                  <p className="truncate text-sm text-[var(--color-text-muted)]">{message.sender.email}</p>
                </div>
                <time className="shrink-0 text-xs text-[var(--color-text-muted)]">{formatMailDate(message.sentAt || message.createdAt)}</time>
              </header>
              <div className="mt-4 text-[var(--color-text-secondary)]"><MailFormattedBody body={message.body} /></div>
              {message.attachments.map((attachment) => (
                <MailAttachmentMenu key={attachment.id} attachment={attachment} mine={false} canSign={canSignAttachments} onOpen={() => onOpenAttachment(attachment)} onDownload={() => onDownloadAttachment(attachment)} onSign={() => onSignAttachment(attachment)} />
              ))}
              <footer className="mt-4 flex gap-2 border-t border-[var(--color-border)] pt-3">
                {!mine ? <button type="button" onClick={() => onReply(message)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"><Reply className="h-3.5 w-3.5" />Reply</button> : null}
                <button type="button" onClick={() => onForward(message)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"><Forward className="h-3.5 w-3.5" />Forward</button>
              </footer>
            </article>
          );
        })}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!replyBody.trim() || pendingAction) return;
          onReplyAll(replyBody, replyFiles);
          setReplyBody("");
          setReplyFiles([]);
        }}
        className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4"
      >
        <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 p-2 focus-within:border-[var(--color-primary)]">
          <label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]" aria-label="Attach files to reply">
            <Paperclip className="h-4 w-4" /><input type="file" multiple accept=".pdf,.txt,.csv,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={(event) => setReplyFiles(Array.from(event.target.files || []).slice(0, 5))} />
          </label>
          <textarea ref={replyRef} value={replyBody} onChange={(event) => setReplyBody(event.target.value)} rows={2} placeholder={replyFiles.length ? `Reply all · ${replyFiles.length} attachment(s)` : "Reply all to this conversation"} className="min-h-10 flex-1 resize-none bg-transparent p-2 text-base text-[var(--color-text-primary)] outline-none" />
          <button type="submit" disabled={!replyBody.trim() || pendingAction} aria-label="Send reply all" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-primary)] text-white disabled:opacity-40"><ReplyAll className="h-4 w-4" /></button>
        </div>
      </form>
    </section>
  );
}
