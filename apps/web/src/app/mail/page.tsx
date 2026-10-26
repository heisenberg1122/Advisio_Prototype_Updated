import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  FileText,
  Inbox,
  PenLine,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { apiClient } from "@/lib/api-client";
import { DocumentSigningModal } from "@/components/adviser/AdviserDocumentSigningModal";
import { MailComposeWindow } from "@/components/messaging/MailComposeWindow";
import { MailConversation } from "@/components/messaging/MailConversation";
import { MailThreadList } from "@/components/messaging/MailThreadList";
import type { MailAttachment } from "@/components/messaging/MailAttachmentMenu";
import type {
  ComposeSeed,
  ComposeSubmission,
  MailContact,
  MailFilter,
  MailFolder,
  MailMessage,
  MailThreadListResponse,
} from "@/components/messaging/mail-types";
import { formatMailDate, personName } from "@/components/messaging/mail-types";
import SignatureCenterPage from "@/app/signatures/page";

const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function mailFetch(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem("advisio_token");
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The mail request could not be completed.");
  return result;
}

async function downloadAttachment(attachment: MailAttachment) {
  const token = localStorage.getItem("advisio_token");
  const response = await fetch(`${apiBase}/api/mail/attachments/${attachment.id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Unable to download attachment.");
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = attachment.fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function openAttachment(attachment: MailAttachment) {
  const token = localStorage.getItem("advisio_token");
  const response = await fetch(
    `${apiBase}/api/mail/attachments/${attachment.id}?inline=1`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!response.ok) throw new Error("Unable to preview attachment.");
  const url = URL.createObjectURL(await response.blob());
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function composeForm(submission: ComposeSubmission) {
  const form = new FormData();
  form.append("toIds", JSON.stringify(submission.toIds));
  form.append("ccIds", JSON.stringify(submission.ccIds));
  form.append("bccIds", JSON.stringify(submission.bccIds));
  form.append("subject", submission.subject);
  form.append("body", submission.body);
  form.append("action", submission.action);
  form.append("keepAttachmentIds", JSON.stringify(submission.keepAttachmentIds));
  form.append("sourceAttachmentIds", JSON.stringify(submission.sourceAttachmentIds));
  submission.files.forEach((file) => form.append("files", file));
  return form;
}

const FOLDER_ITEMS = [
  { id: "inbox" as const, label: "Inbox", icon: Inbox },
  { id: "sent" as const, label: "Sent", icon: Send },
  { id: "drafts" as const, label: "Drafts", icon: FileText },
  { id: "archive" as const, label: "Archive", icon: Archive },
  { id: "trash" as const, label: "Trash", icon: Trash2 },
];

export default function MailInboxPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const canUseDeanInbox = Boolean(
    user?.roles.some((role) => ["DEAN"].includes(role)),
  );
  const canSyncDeanApprovals = Boolean(
    user?.roles.includes("RESEARCH_COORDINATOR"),
  );
  const canSignAttachments = Boolean(
    user?.roles.some((role) =>
      ["RESEARCH_COORDINATOR", "ADVISER", "PANELIST", "DEAN"].includes(role),
    ),
  );

  const [folder, setFolder] = useState<MailFolder>(() =>
    canUseDeanInbox && searchParams.get("view") === "signature-requests"
      ? "signature-requests"
      : "inbox",
  );
  const [selectedId, setSelectedId] = useState(() => searchParams.get("thread") || "");
  useEffect(() => {const id=searchParams.get("thread");if(id){setSelectedId(id);setFolder("inbox");}},[searchParams]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [filter, setFilter] = useState<MailFilter>("all");
  const [page, setPage] = useState(1);
  const [composeSeed, setComposeSeed] = useState<ComposeSeed | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [signingDocument, setSigningDocument] = useState<any | null>(null);

  const { data: deanApprovalSync } = useQuery({
    queryKey: ["mail-dean-approval-sync", user?.id],
    queryFn: () =>
      apiClient.post<{ delivered: number }>("/api/mail/sync-dean-approvals", {}),
    enabled: canSyncDeanApprovals,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const { data: contactsData } = useQuery({
    queryKey: ["mail-contacts"],
    queryFn: () => apiClient.get<{ contacts: MailContact[] }>("/api/mail/contacts"),
    staleTime: 60_000,
  });
  const listQuery = useQuery({
    queryKey: ["mail-threads", folder, deferredQuery, filter, page],
    queryFn: () =>
      apiClient.get<MailThreadListResponse>("/api/mail/threads", {
        params: { folder, query: deferredQuery, filter, page, pageSize: 30 },
      }),
    refetchInterval: 20_000,
    enabled: folder !== "signature-requests",
  });
  const threads = listQuery.data?.threads || [];
  const selected = threads.find((thread) => thread.id === selectedId) || null;
  const detailQuery = useQuery({
    queryKey: ["mail-thread", selectedId],
    queryFn: () =>
      apiClient.get<{ thread: MailThreadListResponse["threads"][number] }>(
        `/api/mail/threads/${selectedId}`,
      ),
    enabled: Boolean(selectedId && folder !== "drafts" && folder !== "signature-requests"),
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (deanApprovalSync?.delivered) {
      void queryClient.invalidateQueries({ queryKey: ["mail-threads"] });
    }
  }, [deanApprovalSync?.delivered, queryClient]);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, filter, folder]);

  useEffect(() => {
    if (selectedId && selectedId !== searchParams.get("thread") && !listQuery.isFetching && !threads.some((thread) => thread.id === selectedId)) {
      setSelectedId("");
    }
  }, [listQuery.isFetching, selectedId, threads, searchParams]);

  const chooseFolder = (nextFolder: MailFolder) => {
    setFolder(nextFolder);
    setSelectedId("");
    setQuery("");
    setFilter("all");
    setPage(1);
    setError("");
    setNotice("");
    if (nextFolder === "signature-requests") {
      setSearchParams({ view: "signature-requests" }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const refreshMail = async () => {
    await queryClient.invalidateQueries({ queryKey: ["mail-threads"] });
    if (selectedId) {
      await queryClient.invalidateQueries({ queryKey: ["mail-thread", selectedId] });
    }
  };

  const composeMutation = useMutation({
    mutationFn: async (submission: ComposeSubmission) => {
      const form = composeForm(submission);
      if (submission.draftId) {
        await mailFetch(`/api/mail/drafts/${submission.draftId}`, {
          method: "PUT",
          body: form,
        });
        if (submission.action === "send") {
          await mailFetch(`/api/mail/drafts/${submission.draftId}/send`, {
            method: "POST",
          });
        }
        return submission.action;
      }
      await mailFetch("/api/mail/messages", { method: "POST", body: form });
      return submission.action;
    },
    onSuccess: async (action) => {
      setComposeSeed(null);
      setSelectedId("");
      setError("");
      chooseFolder(action === "draft" ? "drafts" : "sent");
      await refreshMail();
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ body, files }: { body: string; files: File[] }) => {
      const form = new FormData();
      form.append("body", body);
      files.forEach((file) => form.append("files", file));
      await mailFetch(`/api/mail/threads/${selectedId}/reply`, {
        method: "POST",
        body: form,
      });
    },
    onSuccess: async () => {
      setNotice("Reply sent to the conversation.");
      setError("");
      await refreshMail();
    },
    onError: (reason: Error) => setError(reason.message),
  });

  const stateMutation = useMutation({
    mutationFn: (action: "archive" | "trash" | "restore" | "mark-read" | "mark-unread") =>
      apiClient.patch(`/api/mail/threads/${selectedId}/state`, { action }),
    onSuccess: async (_data, action) => {
      setNotice(
        action === "archive"
          ? "Conversation archived."
          : action === "trash"
            ? "Conversation moved to Trash."
            : action === "restore"
              ? "Conversation restored."
              : action === "mark-unread"
                ? "Conversation marked unread."
                : "Conversation marked read.",
      );
      setSelectedId("");
      await refreshMail();
    },
    onError: (reason: Error) => setError(reason.message),
  });

  const draftMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "send" | "delete" }) =>
      action === "send"
        ? apiClient.post(`/api/mail/drafts/${id}/send`, {})
        : apiClient.delete(`/api/mail/drafts/${id}`),
    onSuccess: async (_data, variables) => {
      setComposeSeed(null);
      setSelectedId("");
      if (variables.action === "send") setFolder("sent");
      await refreshMail();
    },
    onError: (reason: Error) => setError(reason.message),
  });

  const contacts = contactsData?.contacts || [];
  const detailThread = detailQuery.data?.thread || null;
  const draftMessage = folder === "drafts" ? selected?.messages[0] : undefined;

  const editDraft = () => {
    if (!selected || !draftMessage) return;
    setComposeSeed({
      key: `draft-${draftMessage.id}`,
      draftId: draftMessage.id,
      toIds: selected.participants.filter((item) => item.recipientType === "TO").map((item) => item.userId),
      ccIds: selected.participants.filter((item) => item.recipientType === "CC").map((item) => item.userId),
      bccIds: selected.participants.filter((item) => item.recipientType === "BCC").map((item) => item.userId),
      subject: selected.subject,
      body: draftMessage.body,
      existingAttachments: draftMessage.attachments,
    });
  };

  const replyToMessage = (message: MailMessage) => {
    setComposeSeed({
      key: `reply-${message.id}-${Date.now()}`,
      toIds: [message.senderId],
      subject: `${detailThread?.subject.toLowerCase().startsWith("re:") ? "" : "Re: "}${detailThread?.subject || ""}`,
      body: `\n\nOn ${formatMailDate(message.sentAt || message.createdAt)}, ${personName(message.sender)} wrote:\n> ${message.body.replace(/\n/g, "\n> ")}`,
    });
  };

  const forwardMessage = (message: MailMessage) => {
    setComposeSeed({
      key: `forward-${message.id}-${Date.now()}`,
      subject: `${detailThread?.subject.toLowerCase().startsWith("fwd:") ? "" : "Fwd: "}${detailThread?.subject || ""}`,
      body: `\n\n---------- Forwarded message ----------\nFrom: ${personName(message.sender)} <${message.sender.email}>\nDate: ${formatMailDate(message.sentAt || message.createdAt)}\nSubject: ${detailThread?.subject || ""}\n\n${message.body}`,
      sourceAttachments: message.attachments,
    });
  };

  const counts = listQuery.data?.counts;
  const folderCount = (id: string) =>
    id === "inbox"
      ? counts?.unread
      : counts?.[id as keyof typeof counts];

  const pendingAction =
    replyMutation.isPending || stateMutation.isPending || draftMutation.isPending;

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] min-h-[560px] w-full max-w-[1920px] flex-1 flex-col overflow-hidden bg-[var(--color-surface)] xl:rounded-tl-[28px]">
      {signingDocument ? (
        <DocumentSigningModal
          document={signingDocument}
          onClose={() => setSigningDocument(null)}
          onSigned={(message) => {
            setSigningDocument(null);
            setNotice(message);
            void refreshMail();
          }}
        />
      ) : null}
      {composeSeed ? (
        <MailComposeWindow
          key={composeSeed.key}
          seed={composeSeed}
          contacts={contacts}
          pending={composeMutation.isPending || draftMutation.isPending}
          error={composeMutation.error?.message}
          onClose={() => setComposeSeed(null)}
          onSubmit={(submission) => composeMutation.mutate(submission)}
          onDiscard={(draftId) => {
            if (draftId) draftMutation.mutate({ id: draftId, action: "delete" });
            else setComposeSeed(null);
          }}
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-3 md:w-56 md:border-b-0 md:border-r md:p-4">
          <button
            type="button"
            onClick={() => setComposeSeed({ key: `new-${Date.now()}` })}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-bold text-white shadow-sm hover:bg-[var(--color-primary-dark)]"
          >
            <Pencil className="h-4 w-4" />Compose
          </button>
          <nav aria-label="Mail folders" className="mt-3 flex gap-1 overflow-x-auto pb-1 md:mt-5 md:block md:space-y-1 md:overflow-visible md:pb-0">
            {FOLDER_ITEMS.map((item) => {
              const count = folderCount(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseFolder(item.id)}
                  aria-current={folder === item.id ? "page" : undefined}
                  className={`${folder === item.id ? "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] dark:bg-white/10 dark:text-white" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"} flex h-10 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-bold md:w-full`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {count ? <span className="ml-auto rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-xs font-black text-white">{count}</span> : null}
                </button>
              );
            })}
            {canUseDeanInbox ? (
              <button
                type="button"
                onClick={() => chooseFolder("signature-requests")}
                aria-current={folder === "signature-requests" ? "page" : undefined}
                className={`${folder === "signature-requests" ? "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] dark:bg-white/10 dark:text-white" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"} flex h-10 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-bold md:w-full`}
              >
                <PenLine className="h-4 w-4" />Signature requests
              </button>
            ) : null}
          </nav>
          <div className="mt-6 hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 md:block">
            <p className="text-sm font-black uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Formal correspondence</p>
            <p className="mt-1 text-base leading-5 text-[var(--color-text-secondary)]">Inbox is separate from project group chats and uses authorized academic contacts only.</p>
          </div>
        </aside>

        {folder === "signature-requests" ? (
          <div className="min-h-0 flex-1 overflow-hidden"><SignatureCenterPage embedded /></div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1">
            <MailThreadList
              folder={folder}
              threads={threads}
              selectedId={selectedId}
              userId={user?.id}
              query={query}
              filter={filter}
              pagination={listQuery.data?.pagination}
              loading={listQuery.isLoading || listQuery.isFetching && !listQuery.data}
              onQueryChange={setQuery}
              onFilterChange={setFilter}
              onPageChange={setPage}
              onSelect={(id) => {
                setSelectedId(id);
                setNotice("");
                setError("");
              }}
            />
            <MailConversation
              folder={folder}
              thread={detailThread}
              draftThread={folder === "drafts" ? selected : null}
              userId={user?.id}
              loading={detailQuery.isLoading}
              canSignAttachments={canSignAttachments}
              pendingAction={pendingAction}
              notice={notice}
              error={error}
              onBack={() => setSelectedId("")}
              onThreadAction={(action) => stateMutation.mutate(action)}
              onReplyAll={(body, files) => replyMutation.mutate({ body, files })}
              onReply={replyToMessage}
              onForward={forwardMessage}
              onEditDraft={editDraft}
              onSendDraft={() => draftMessage && draftMutation.mutate({ id: draftMessage.id, action: "send" })}
              onDeleteDraft={() => {
                if (draftMessage && window.confirm("Permanently discard this draft?")) draftMutation.mutate({ id: draftMessage.id, action: "delete" });
              }}
              onOpenAttachment={(attachment) => openAttachment(attachment).catch((reason: Error) => setError(reason.message))}
              onDownloadAttachment={(attachment) => downloadAttachment(attachment).catch((reason: Error) => setError(reason.message))}
              onSignAttachment={(attachment) =>
                setSigningDocument({
                  versionId: attachment.id,
                  docName: attachment.fileName,
                  groupName: detailThread?.subject || "Inbox",
                  fileUrl: `/api/mail/attachments/${attachment.id}?inline=1`,
                  signUrl: `/api/mail/attachments/${attachment.id}/sign`,
                })
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
