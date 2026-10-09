import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Inbox, Mail, Paperclip, Pencil, Save, Send, Trash2, X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { apiClient } from "@/lib/api-client";
import { MailPageSkeleton } from "@/components/ui/Skeleton";
import { DocumentSigningModal } from "@/components/adviser/AdviserDocumentSigningModal";
import { MailAttachmentMenu, type MailAttachment } from "@/components/messaging/MailAttachmentMenu";

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
  const [folder, setFolder] = useState<"inbox" | "sent" | "drafts">("inbox");
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
  const canSignAttachments = Boolean(user?.roles.some((role) => ["RESEARCH_COORDINATOR", "ADVISER", "PANELIST", "RPO", "VPAA"].includes(role)));
  const { data: contactsData } = useQuery({ queryKey: ["mail-contacts"], queryFn: () => apiClient.get<{ contacts: any[] }>("/api/mail/contacts"), staleTime: 60_000 });
  const { data: listData, isLoading } = useQuery({ queryKey: ["mail-threads", folder], queryFn: () => apiClient.get<{ threads: any[] }>("/api/mail/threads", { params: { folder } }), refetchInterval: 15_000 });
  const threads = listData?.threads || [];
  const selected = threads.find((item: any) => item.id === selectedId) || threads[0] || null;
  const draftMessage = folder === "drafts" ? selected?.messages?.[0] : null;
  const { data: threadData } = useQuery({ queryKey: ["mail-thread", selected?.id], queryFn: () => apiClient.get<{ thread: any }>(`/api/mail/threads/${selected.id}`), enabled: Boolean(selected?.id && folder !== "drafts") });
  const thread = threadData?.thread;
  const contacts = contactsData?.contacts || [];

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

  return <div className="h-[calc(100vh-9rem)] min-h-[650px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101827]">
    {signingDocument && <DocumentSigningModal document={signingDocument} onClose={() => setSigningDocument(null)} onSigned={(message) => { setSigningDocument(null); setNotice(message); queryClient.invalidateQueries({ queryKey: ["mail-thread", selected?.id] }); queryClient.invalidateQueries({ queryKey: ["mail-threads"] }); }} />}
    {compose && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4"><section className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-lg font-black text-[#102f49]">New message</h2><button onClick={resetCompose} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100"><X className="h-4 w-4" /></button></header><div className="space-y-3 p-5">{error && <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}<select value={recipientId} onChange={(e) => setRecipientId(e.target.value)} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"><option value="">To</option>{contacts.map((contact: any) => <option key={contact.id} value={contact.id}>{fullName(contact)} — {contact.roles.join(", ")}</option>)}</select><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /><textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message" rows={9} className="w-full resize-none rounded-xl border border-slate-300 p-3 text-sm leading-6" /><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 p-3 text-sm font-bold text-slate-600"><Paperclip className="h-4 w-4" />{files.length ? `${files.length} file(s) attached` : "Attach files (up to 5, 10 MB each)"}<input type="file" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} /></label></div><footer className="flex justify-between border-t bg-slate-50 p-4"><button onClick={() => composeMutation.mutate("draft")} disabled={!recipientId || !subject.trim() || !body.trim() || composeMutation.isPending} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold"><Save className="h-4 w-4" />Save draft</button><button onClick={() => composeMutation.mutate("send")} disabled={!recipientId || !subject.trim() || !body.trim() || composeMutation.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[#f6a800] px-5 py-2.5 text-sm font-extrabold text-[#102f49]"><Send className="h-4 w-4" />{composeMutation.isPending ? "Sending…" : "Send"}</button></footer></section></div>}
    <div className="grid h-full md:grid-cols-[190px_330px_1fr]">
      <aside className="border-r border-slate-200 p-3 dark:border-white/10"><button onClick={() => setCompose(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f6a800] px-4 py-3 text-sm font-extrabold text-[#102f49]"><Pencil className="h-4 w-4" />Compose</button><nav className="mt-4 space-y-1">{([{ id: "inbox", label: "Inbox", icon: Inbox }, { id: "sent", label: "Sent", icon: Send }, { id: "drafts", label: "Drafts", icon: FileText }] as const).map((item) => <button key={item.id} onClick={() => { setFolder(item.id); setSelectedId(""); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold ${folder === item.id ? "bg-[#173f63] text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"}`}><item.icon className="h-4 w-4" />{item.label}</button>)}</nav></aside>
      <aside className="min-h-0 overflow-y-auto border-r border-slate-200 dark:border-white/10"><div className="border-b p-4 dark:border-white/10"><h1 className="text-lg font-black capitalize text-[#102f49] dark:text-white">{folder}</h1></div>{isLoading ? <p className="p-6 text-center text-sm text-slate-400">Loading messages…</p> : !threads.length ? <p className="p-6 text-center text-sm text-slate-400">No {folder} messages.</p> : threads.map((item: any) => { const last = item.messages?.[0]; const others = item.participants.filter((p: any) => p.user.id !== user?.id); return <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full border-b p-4 text-left ${selected?.id === item.id ? "border-l-4 border-l-[#f6a800] bg-amber-50" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}><p className="truncate text-sm font-extrabold text-slate-800 dark:text-white">{folder === "sent" || folder === "drafts" ? `To: ${others.map((p: any) => fullName(p.user)).join(", ")}` : fullName(last?.sender)}</p><p className="mt-1 truncate text-xs font-bold text-slate-600 dark:text-slate-300">{item.subject}</p><p className="mt-1 truncate text-[11px] text-slate-400">{last?.body}</p>{last?.attachments?.length > 0 && <Paperclip className="mt-2 h-3.5 w-3.5 text-slate-400" />}</button>; })}</aside>
      <main className="flex min-h-0 flex-col">{!selected ? <div className="grid h-full place-items-center text-center"><div><Mail className="mx-auto h-12 w-12 text-slate-300" /><p className="mt-3 font-bold text-slate-500">Select a message to read it</p></div></div> : folder === "drafts" ? <div className="p-6"><p className="text-xs font-bold uppercase tracking-wider text-amber-600">Draft</p><h2 className="mt-2 text-xl font-black text-[#102f49]">{selected.subject}</h2><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-600">{draftMessage?.body}</p>{draftMessage?.attachments?.map((attachment: any) => <button key={attachment.id} onClick={() => downloadAttachment(attachment).catch((e) => setError(e.message))} className="mt-3 flex w-full max-w-md items-center gap-2 rounded-xl bg-slate-100 p-3 text-left text-xs font-extrabold text-[#173f63]"><Paperclip className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{attachment.fileName}</span><Download className="h-4 w-4" /></button>)}<div className="mt-6 flex gap-2"><button onClick={() => draftMutation.mutate("send")} className="inline-flex items-center gap-2 rounded-xl bg-[#173f63] px-4 py-2.5 text-sm font-extrabold text-white"><Send className="h-4 w-4" />Send draft</button><button onClick={() => draftMutation.mutate("delete")} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600"><Trash2 className="h-4 w-4" />Delete</button></div></div> : !thread ? <p className="p-6 text-center text-sm text-slate-400">Opening message…</p> : <><header className="border-b px-5 py-4 dark:border-white/10"><h2 className="text-lg font-black text-[#102f49] dark:text-white">{thread.subject}</h2><p className="mt-1 text-xs text-slate-500">Conversation with {otherPeople}</p>{notice && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{notice}</p>}</header><div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-5 dark:bg-black/10">{thread.messages.map((message: any) => { const mine = message.sender.id === user?.id; return <article key={message.id} className={`${mine ? "ml-auto bg-[#173f63] text-white" : "mr-auto border bg-white text-slate-700"} max-w-[85%] rounded-2xl p-4`}><p className={`text-xs font-bold ${mine ? "text-sky-100" : "text-slate-500"}`}>{fullName(message.sender)} · {new Date(message.sentAt).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p>{message.attachments?.map((attachment: MailAttachment) => <MailAttachmentMenu key={attachment.id} attachment={attachment} mine={mine} canSign={canSignAttachments} onOpen={() => openAttachment(attachment).catch((e) => setError(e.message))} onDownload={() => downloadAttachment(attachment).catch((e) => setError(e.message))} onSign={() => setSigningDocument({ versionId: attachment.id, docName: attachment.fileName, groupName: thread.subject, fileUrl: `/api/mail/attachments/${attachment.id}?inline=1`, signUrl: `/api/mail/attachments/${attachment.id}/sign` })} />)}</article>; })}</div><form onSubmit={(e) => { e.preventDefault(); if (reply.trim()) replyMutation.mutate(); }} className="border-t p-4 dark:border-white/10"><div className="flex items-end gap-2 rounded-2xl border border-slate-200 p-2"><label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><Paperclip className="h-4 w-4" /><input type="file" multiple className="hidden" onChange={(e) => setReplyFiles(Array.from(e.target.files || []).slice(0, 5))} /></label><textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={replyFiles.length ? `Reply · ${replyFiles.length} file(s) attached` : "Reply"} className="min-h-10 flex-1 resize-none bg-transparent p-2 text-sm outline-none dark:text-white" /><button type="submit" disabled={!reply.trim() || replyMutation.isPending} className="grid h-10 w-10 place-items-center rounded-xl bg-[#f6a800] text-[#102f49] disabled:opacity-40"><Send className="h-4 w-4" /></button></div></form></>}</main>
    </div>
  </div>;
}
