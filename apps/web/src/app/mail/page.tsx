import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Inbox, Mail, Paperclip, PenLine, Pencil, Save, Send, Trash2, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { apiClient } from "@/lib/api-client";
import { MailPageSkeleton } from "@/components/ui/Skeleton";
import { DocumentSigningModal } from "@/components/adviser/AdviserDocumentSigningModal";
import { MailAttachmentMenu, type MailAttachment } from "@/components/messaging/MailAttachmentMenu";
import SignatureCenterPage from "@/app/signatures/page";

const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const fullName = (user: any) => [user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(" ") || user?.email || "User";

async function downloadAttachment(attachment: any) {
  const token = localStorage.getItem("advisio_token");
  const response = await fetch(`${apiBase}/api/mail/attachments/${attachment.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new Error("Unable to download attachment.");
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = attachment.fileName; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function openAttachment(attachment: MailAttachment) {
  const token = localStorage.getItem("advisio_token");
  const response = await fetch(`${apiBase}/api/mail/attachments/${attachment.id}?inline=1`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new Error("Unable to preview attachment.");
  const url = URL.createObjectURL(await response.blob());
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function MailInboxPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const canUseDeanInbox = Boolean(user?.roles.some((role) => ["RPO", "VPAA"].includes(role)));
  const canSyncDeanApprovals = Boolean(user?.roles.includes("RESEARCH_COORDINATOR"));
  type MailFolder = "inbox" | "sent" | "drafts" | "signature-requests";
  const [folder, setFolder] = useState<MailFolder>(() =>
    canUseDeanInbox && searchParams.get("view") === "signature-requests" ? "signature-requests" : "inbox",
  );
  const [selectedId, setSelectedId] = useState("");
  const [compose, setCompose] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [signingDocument, setSigningDocument] = useState<any | null>(null);
  const { data: deanApprovalSync } = useQuery({
    queryKey: ["mail-dean-approval-sync", user?.id],
    queryFn: () => apiClient.post<{ delivered: number }>("/api/mail/sync-dean-approvals", {}),
    enabled: canSyncDeanApprovals,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const canSignAttachments = Boolean(user?.roles.some((role) => ["RESEARCH_COORDINATOR", "ADVISER", "PANELIST", "RPO", "VPAA"].includes(role)));
  const { data: contactsData } = useQuery({ queryKey: ["mail-contacts"], queryFn: () => apiClient.get<{ contacts: any[] }>("/api/mail/contacts"), staleTime: 60_000 });
  const { data: listData, isLoading } = useQuery({ queryKey: ["mail-threads", folder], queryFn: () => apiClient.get<{ threads: any[] }>("/api/mail/threads", { params: { folder } }), refetchInterval: 15_000, enabled: folder !== "signature-requests" });
  const threads = listData?.threads || [];
  const selected = threads.find((item: any) => item.id === selectedId) || threads[0] || null;
  const draftMessage = folder === "drafts" ? selected?.messages?.[0] : null;
  const { data: threadData } = useQuery({ queryKey: ["mail-thread", selected?.id], queryFn: () => apiClient.get<{ thread: any }>(`/api/mail/threads/${selected.id}`), enabled: Boolean(selected?.id && folder !== "drafts") });
  const thread = threadData?.thread;
  const contacts = contactsData?.contacts || [];
  useEffect(() => {
    if (deanApprovalSync?.delivered) queryClient.invalidateQueries({ queryKey: ["mail-threads"] });
  }, [deanApprovalSync?.delivered, queryClient]);
  const chooseFolder = (nextFolder: MailFolder) => {
    setFolder(nextFolder);
    setSelectedId("");
    if (nextFolder === "signature-requests") setSearchParams({ view: "signature-requests" }, { replace: true });
    else setSearchParams({}, { replace: true });
  };

  const resetCompose = () => { setCompose(false); setRecipientId(""); setSubject(""); setBody(""); setFiles([]); setError(""); };
  const submitMessage = async (action: "send" | "draft") => {
    const form = new FormData(); form.append("recipientId", recipientId); form.append("subject", subject); form.append("body", body); form.append("action", action); files.forEach((file) => form.append("files", file));
    const token = localStorage.getItem("advisio_token");
    const response = await fetch(`${apiBase}/api/mail/messages`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
    const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || "Unable to save message.");
  };
  const composeMutation = useMutation({ mutationFn: submitMessage, onSuccess: (_data, action) => { resetCompose(); queryClient.invalidateQueries({ queryKey: ["mail-threads"] }); setFolder(action === "draft" ? "drafts" : "sent"); }, onError: (reason: Error) => setError(reason.message) });
  const replyMutation = useMutation({ mutationFn: async () => { const form = new FormData(); form.append("body", reply); replyFiles.forEach((file) => form.append("files", file)); const token = localStorage.getItem("advisio_token"); const response = await fetch(`${apiBase}/api/mail/threads/${selected.id}/reply`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || "Unable to send reply."); }, onSuccess: () => { setReply(""); setReplyFiles([]); queryClient.invalidateQueries({ queryKey: ["mail-thread", selected?.id] }); queryClient.invalidateQueries({ queryKey: ["mail-threads"] }); } });
  const draftMutation = useMutation({ mutationFn: (action: "send" | "delete") => action === "send" ? apiClient.post(`/api/mail/drafts/${draftMessage.id}/send`, {}) : apiClient.delete(`/api/mail/drafts/${draftMessage.id}`), onSuccess: () => { setSelectedId(""); queryClient.invalidateQueries({ queryKey: ["mail-threads"] }); } });
  const otherPeople = useMemo(() => thread?.participants?.filter((item: any) => item.user.id !== user?.id).map((item: any) => fullName(item.user)).join(", ") || "", [thread, user?.id]);

  if (isLoading) return <MailPageSkeleton />;

  return (
    <div className="flex flex-1 min-h-0 h-[calc(100vh-4rem)] w-full flex-col overflow-hidden rounded-tl-[32px]">
      {signingDocument && (
        <DocumentSigningModal
          document={signingDocument}
          onClose={() => setSigningDocument(null)}
          onSigned={(message) => {
            setSigningDocument(null);
            setNotice(message);
            queryClient.invalidateQueries({ queryKey: ["mail-thread", selected?.id] });
            queryClient.invalidateQueries({ queryKey: ["mail-threads"] });
          }}
        />
      )}
      {compose && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4">
          <section className="w-full max-w-2xl overflow-hidden rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl">
            <header className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] dark:text-white">New message</h2>
              <button onClick={resetCompose} className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="space-y-3 p-5">
              {error && <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
              <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)} className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-text-primary)]">
                <option value="">To</option>
                {contacts.map((contact: any) => (
                  <option key={contact.id} value={contact.id}>{fullName(contact)} — {contact.roles.join(", ")}</option>
                ))}
              </select>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-text-primary)]" />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message" rows={9} className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm leading-6 text-[var(--color-text-primary)]" />
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] p-3 text-sm font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <Paperclip className="h-4 w-4" />
                {files.length ? `${files.length} file(s) attached` : "Attach files (up to 5, 10 MB each)"}
                <input type="file" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} />
              </label>
            </div>
            <footer className="flex justify-between border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
              <button onClick={() => composeMutation.mutate("draft")} disabled={!recipientId || !subject.trim() || !body.trim() || composeMutation.isPending} className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <Save className="h-4 w-4" />Save draft
              </button>
              <button onClick={() => composeMutation.mutate("send")} disabled={!recipientId || !subject.trim() || !body.trim() || composeMutation.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-5 py-2.5 text-sm font-semibold text-white">
                <Send className="h-4 w-4" />{composeMutation.isPending ? "Sending…" : "Send"}
              </button>
            </footer>
          </section>
        </div>
      )}
      <div className="flex flex-1 min-h-0 h-full flex-col md:flex-row overflow-hidden">
        <aside className="w-full md:w-52 lg:w-56 shrink-0 flex flex-col p-4 border-b md:border-b-0 md:border-r border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)] self-stretch">
          <button onClick={() => setCompose(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-4 py-2.5 text-sm font-semibold text-white transition shadow-xs">
            <Pencil className="h-4 w-4" />Compose
          </button>
          <nav className="mt-5 space-y-1">
            {([
              { id: "inbox", label: "Inbox", icon: Inbox },
              ...(canUseDeanInbox ? [{ id: "signature-requests" as const, label: "Signature requests", icon: PenLine }] : []),
              { id: "sent", label: "Sent", icon: Send },
              { id: "drafts", label: "Drafts", icon: FileText }
            ] as const).map((item) => (
              <button
                key={item.id}
                onClick={() => chooseFolder(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
                  folder === item.id
                    ? "bg-[var(--color-primary)] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                }`}
              >
                <item.icon className="h-4 w-4" />{item.label}
              </button>
            ))}
          </nav>
        </aside>
        {folder === "signature-requests" ? (
          <div className="flex-1 min-h-0 self-stretch overflow-hidden">
            <SignatureCenterPage embedded />
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 min-w-0 flex-col md:flex-row overflow-hidden self-stretch">
            <aside className="flex flex-col min-h-0 w-full md:w-80 lg:w-[340px] shrink-0 border-b md:border-b-0 md:border-r border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)] self-stretch">
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4">
                <h1 className="text-base font-bold capitalize text-[var(--color-text-primary)] dark:text-white">{folder}</h1>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {isLoading ? (
                  <p className="p-6 text-center text-sm text-slate-400">Loading messages…</p>
                ) : !threads.length ? (
                  <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                    <Inbox className="h-10 w-10 text-[var(--color-text-muted)] opacity-30 mb-2" />
                    <p className="text-sm font-semibold text-slate-400">No {folder} messages.</p>
                  </div>
                ) : (
                  threads.map((item: any) => {
                    const last = item.messages?.[0];
                    const others = item.participants.filter((p: any) => p.user.id !== user?.id);
                    const isSelected = selected?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full border-b border-[var(--color-border)]/60 p-4 text-left transition ${
                          isSelected
                            ? "bg-[var(--color-primary-light)]/40 text-[var(--color-text-primary)] border-l-4 border-l-[var(--color-primary)]"
                            : "hover:bg-slate-50 dark:hover:bg-white/5"
                        }`}
                      >
                        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)] dark:text-white">
                          {folder === "sent" || folder === "drafts" ? `To: ${others.map((p: any) => fullName(p.user)).join(", ")}` : fullName(last?.sender)}
                        </p>
                        <p className="mt-1 truncate text-xs font-semibold text-[var(--color-text-secondary)] dark:text-slate-300">{item.subject}</p>
                        <p className="mt-1 truncate text-[11px] text-slate-400">{last?.body}</p>
                        {last?.attachments?.length > 0 && <Paperclip className="mt-2 h-3.5 w-3.5 text-slate-400" />}
                      </button>
                    );
                  })
                )}
              </div>
            </aside>
            <div className="flex flex-1 min-h-0 min-w-0 flex-col bg-white dark:bg-[var(--color-surface)] self-stretch">
              {!selected ? (
                <div className="flex flex-1 h-full items-center justify-center p-8 text-center">
                  <div className="max-w-sm">
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]">
                      <Mail className="h-8 w-8 opacity-60" />
                    </div>
                    <p className="mt-4 text-base font-semibold text-[var(--color-text-secondary)]">Select a message to read it</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">Choose a conversation from the list to view its contents and attachments.</p>
                  </div>
                </div>
              ) : folder === "drafts" ? (
                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Draft</p>
                  <h2 className="mt-2 text-xl font-bold text-[var(--color-text-primary)] dark:text-white">{selected.subject}</h2>
                  <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[var(--color-text-secondary)]">{draftMessage?.body}</p>
                  {draftMessage?.attachments?.map((attachment: any) => (
                    <button key={attachment.id} onClick={() => downloadAttachment(attachment).catch((e) => setError(e.message))} className="mt-3 flex w-full max-w-md items-center gap-2 rounded-xl bg-[var(--color-surface-muted)] border border-[var(--color-border)] p-3 text-left text-xs font-extrabold text-[var(--color-text-primary)]">
                      <Paperclip className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{attachment.fileName}</span><Download className="h-4 w-4" />
                    </button>
                  ))}
                  <div className="mt-6 flex gap-2">
                    <button onClick={() => draftMutation.mutate("send")} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-4 py-2.5 text-sm font-semibold text-white">
                      <Send className="h-4 w-4" />Send draft
                    </button>
                    <button onClick={() => draftMutation.mutate("delete")} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600">
                      <Trash2 className="h-4 w-4" />Delete
                    </button>
                  </div>
                </div>
              ) : !thread ? (
                <div className="flex flex-1 h-full items-center justify-center p-6 text-center">
                  <p className="text-sm text-slate-400">Opening message…</p>
                </div>
              ) : (
                <>
                  <header className="flex min-h-14 shrink-0 flex-col justify-center border-b border-[var(--color-border)] px-6 py-3.5">
                    <h2 className="text-base font-bold text-[var(--color-text-primary)] dark:text-white">{thread.subject}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">Conversation with {otherPeople}</p>
                    {notice && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">{notice}</p>}
                  </header>
                  <div className="flex-1 min-h-0 space-y-4 overflow-y-auto bg-slate-50/50 p-6 dark:bg-black/10">
                    {thread.messages.map((message: any) => {
                      const mine = message.sender.id === user?.id;
                      return (
                        <article key={message.id} className={`${mine ? "ml-auto bg-[var(--color-primary)] text-white" : "mr-auto border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"} max-w-[85%] rounded-2xl p-4 shadow-2xs`}>
                          <p className={`text-xs font-bold ${mine ? "text-white/80" : "text-slate-500"}`}>{fullName(message.sender)} · {new Date(message.sentAt).toLocaleString()}</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                          {message.attachments?.map((attachment: MailAttachment) => (
                            <MailAttachmentMenu key={attachment.id} attachment={attachment} mine={mine} canSign={canSignAttachments} onOpen={() => openAttachment(attachment).catch((e) => setError(e.message))} onDownload={() => downloadAttachment(attachment).catch((e) => setError(e.message))} onSign={() => setSigningDocument({ versionId: attachment.id, docName: attachment.fileName, groupName: thread.subject, fileUrl: `/api/mail/attachments/${attachment.id}?inline=1`, signUrl: `/api/mail/attachments/${attachment.id}/sign` })} />
                          ))}
                        </article>
                      );
                    })}
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); if (reply.trim()) replyMutation.mutate(); }} className="shrink-0 border-t border-[var(--color-border)] p-4 bg-white dark:bg-[var(--color-surface)]">
                    <div className="flex items-end gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-2 focus-within:border-[var(--color-primary)] transition">
                      <label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                        <Paperclip className="h-4 w-4" /><input type="file" multiple className="hidden" onChange={(e) => setReplyFiles(Array.from(e.target.files || []).slice(0, 5))} />
                      </label>
                      <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={replyFiles.length ? `Reply · ${replyFiles.length} file(s) attached` : "Reply"} className="min-h-10 flex-1 resize-none bg-transparent p-2 text-sm outline-none dark:text-white" />
                      <button type="submit" disabled={!reply.trim() || replyMutation.isPending} className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white disabled:opacity-40 transition">
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
