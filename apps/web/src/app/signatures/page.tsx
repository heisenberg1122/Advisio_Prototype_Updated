import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileCheck2, FileText, Inbox, Mail, PenLine, Search, Send } from "lucide-react";
import { DocumentSigningModal } from "@/components/adviser/AdviserDocumentSigningModal";
import { apiClient } from "@/lib/api-client";
import { FilesPageSkeleton, MailPageSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/providers/auth-provider";

const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

type InboxMessage = {
  id: string;
  documentId: string;
  message: string;
  createdAt: string;
  author: { id: string; firstName: string; middleName?: string | null; lastName: string };
  attachmentVersion?: { id: string; fileName: string; googleDriveFileId?: string | null; versionNumber: number } | null;
};

type DeanInboxThread = {
  id: string;
  title: string;
  currentVersion: number;
  research: { id: string; title: string; groupName?: string | null };
  versions: any[];
  deanInboxMessages: Array<{ author: InboxMessage["author"]; message: string; createdAt: string }>;
};

const guidance: Record<string, { title: string; text: string }> = {
  ADVISER: { title: "Adviser endorsement", text: "Sign only after completing the review and confirming the manuscript is ready for its next approval gate." },
  RESEARCH_COORDINATOR: { title: "Professor milestone clearance", text: "Sign after the required milestone evidence is complete and your academic decision has been recorded." },
  PANELIST: { title: "Panel evaluation confirmation", text: "Sign the final evaluation or decision copy only after scores and recommendations are submitted and locked." },
};

async function openFile(fileId?: string | null) {
  if (!fileId) return;
  const token = localStorage.getItem("advisio_token");
  const response = await fetch(`${apiBase}/api/documents/files/${fileId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Unable to open this document.");
  const url = URL.createObjectURL(await response.blob());
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function SignatureCenterPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isDean = Boolean(user?.roles?.some((role: string) => ["RPO", "VPAA"].includes(role)));
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [signingDocument, setSigningDocument] = useState<any | null>(null);
  const [notice, setNotice] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["signature-center-projects"], queryFn: () => apiClient.get<{ projects: any[] }>("/api/research") });
  const { data: messageData } = useQuery({
    queryKey: ["dean-inbox-messages"],
    queryFn: () => apiClient.get<{ messages: InboxMessage[] }>("/api/dean-inbox/messages"),
    enabled: isDean,
  });
  const { data: threadData, isLoading: threadsLoading } = useQuery({
    queryKey: ["dean-inbox-threads"],
    queryFn: () => apiClient.get<{ threads: DeanInboxThread[] }>("/api/dean-inbox/threads"),
    enabled: isDean,
  });
  const projectDocuments = useMemo(() => (data?.projects || []).flatMap((project: any) =>
    (project.taskSubmissions || []).flatMap((submission: any) => {
      const document = submission.document;
      const version = document?.versions?.find((item: any) => item.versionNumber === document.currentVersion) || document?.versions?.[0];
      const requestVersion = document?.versions?.find((item: any) => item.sourceSignature) || version;
      return version?.mimeType === "application/pdf" && version?.googleDriveFileId ? [{ project, submission, document, version, requestVersion }] : [];
    })), [data]);
  const deanDocuments = useMemo(() => (threadData?.threads || []).flatMap((document) => {
    const version = document.versions.find((item: any) => item.versionNumber === document.currentVersion) || document.versions[0];
    const requestVersion = [...document.versions].sort((a, b) => a.versionNumber - b.versionNumber)[0] || version;
    const firstMessage = document.deanInboxMessages[0];
    return version?.googleDriveFileId ? [{ project: document.research, document, version, requestVersion, requester: firstMessage?.author }] : [];
  }), [threadData]);
  const documents = isDean ? deanDocuments : projectDocuments;
  const filtered = documents.filter(({ project, document }: any) => `${project.title} ${document.title}`.toLowerCase().includes(search.toLowerCase()));
  const selected = documents.find(({ document }: any) => document.id === selectedId) || filtered[0] || null;
  const messages = (messageData?.messages || []).filter((item) => item.documentId === selected?.document.id);
  const sendReply = useMutation({
    mutationFn: () => apiClient.post(`/api/dean-inbox/documents/${selected.document.id}/messages`, { message: reply }),
    onSuccess: () => { setReply(""); queryClient.invalidateQueries({ queryKey: ["dean-inbox-messages"] }); },
  });

  if ((isDean && threadsLoading) || (!isDean && isLoading)) {
    return isDean ? <MailPageSkeleton /> : <FilesPageSkeleton />;
  }

  if (!isDean) {
    const role = user?.roles?.find((item: string) => guidance[item]) || "ADVISER";
    return <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      {signingDocument && <DocumentSigningModal document={signingDocument} onClose={() => setSigningDocument(null)} onSigned={(value) => { setSigningDocument(null); setNotice(value); queryClient.invalidateQueries({ queryKey: ["signature-center-projects"] }); }} />}
      <section className="rounded-2xl bg-[#0B3A53] p-6 text-white shadow-sm"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#f6a800]">Secure signature center</p><h1 className="mt-2 text-2xl font-black">{guidance[role].title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">{guidance[role].text}</p></section>
      {notice && <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{notice}</div>}
      <section className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{documents.map(({ project, document, version }: any) => <article key={version.id} className="flex items-center justify-between gap-3 rounded-xl border bg-slate-50 p-4"><div><h3 className="font-extrabold text-[#102f49]">{document.title}</h3><p className="text-xs text-slate-500">{project.title} · {version.fileName}</p></div><button onClick={() => setSigningDocument({ versionId: version.id, docName: document.title, groupName: project.title, fileUrl: `/api/documents/files/${version.googleDriveFileId}` })} className="rounded-xl bg-[#173f63] px-4 py-2.5 text-xs font-extrabold text-white">Review & sign</button></article>)}</section>
    </div>;
  }

  return <div className="h-[calc(100vh-9rem)] min-h-[650px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101827]">
    {signingDocument && <DocumentSigningModal document={signingDocument} onClose={() => setSigningDocument(null)} onSigned={(value) => { setSigningDocument(null); setNotice(value); queryClient.invalidateQueries({ queryKey: ["signature-center-projects"] }); queryClient.invalidateQueries({ queryKey: ["dean-inbox-threads"] }); queryClient.invalidateQueries({ queryKey: ["dean-inbox-messages"] }); }} />}
    <div className="grid h-full md:grid-cols-[330px_1fr]">
      <aside className="flex min-h-0 flex-col border-r border-slate-200 dark:border-white/10">
        <div className="border-b p-4 dark:border-white/10"><div className="flex items-center gap-2"><Inbox className="h-5 w-5 text-[#C58A18]" /><h1 className="text-lg font-black text-[#102f49] dark:text-white">Inbox</h1><span className="ml-auto rounded-full bg-amber-100 px-2 py-1 text-[10px] font-extrabold text-amber-800">{documents.length}</span></div><label className="mt-3 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 dark:bg-white/5"><Search className="h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests" className="w-full bg-transparent text-sm outline-none dark:text-white" /></label></div>
        <div className="min-h-0 flex-1 overflow-y-auto">{threadsLoading ? <p className="p-6 text-center text-sm text-slate-400">Loading inbox…</p> : filtered.length === 0 ? <div className="p-6 text-center"><p className="text-sm font-semibold text-slate-400">No signature requests addressed to you.</p><p className="mt-2 text-[11px] leading-5 text-slate-400">Requests sent to another Dean remain in that Dean’s private inbox.</p></div> : filtered.map((item: any) => { const active = item.document.id === selected?.document.id; return <button key={item.document.id} onClick={() => setSelectedId(item.document.id)} className={`w-full border-b p-4 text-left transition ${active ? "border-l-4 border-l-[#E3A008] bg-amber-50/70 dark:bg-amber-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#173f63] text-xs font-black text-white">{item.project.title.slice(0, 2).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-800 dark:text-white">{item.project.title}</p><p className="mt-0.5 truncate text-xs font-semibold text-slate-600 dark:text-slate-300">{item.document.title}</p><p className="mt-1 truncate text-[11px] text-slate-400">From {[item.requester?.firstName, item.requester?.lastName].filter(Boolean).join(" ") || "Professor"} · {new Date(item.version.uploadedAt).toLocaleDateString()}</p></div></div></button>; })}</div>
      </aside>
      <main className="flex min-h-0 flex-col">{!selected ? <div className="grid h-full place-items-center text-center"><div><Mail className="mx-auto h-12 w-12 text-slate-300" /><p className="mt-3 font-bold text-slate-500">Select a message to read it</p></div></div> : <>
        <header className="border-b px-5 py-4 dark:border-white/10"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-black text-[#102f49] dark:text-white">{selected.document.title}</h2><p className="mt-1 text-xs text-slate-500">{selected.project.title} · sent by {[selected.requester?.firstName, selected.requester?.lastName].filter(Boolean).join(" ") || "Professor"}</p></div><button onClick={() => setSigningDocument({ versionId: selected.version.id, docName: selected.document.title, groupName: selected.project.title, fileUrl: `/api/documents/files/${selected.version.googleDriveFileId}` })} className="inline-flex items-center gap-2 rounded-xl bg-[#173f63] px-4 py-2.5 text-xs font-extrabold text-white"><PenLine className="h-4 w-4" />Add signature</button></div>{notice && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{notice}</p>}</header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-5 dark:bg-black/10">
          {messages.map((item) => { const mine = item.author.id === user?.id; return <div key={item.id} className={`${mine ? "ml-auto rounded-tr-md bg-[#173f63] text-white" : "mr-auto rounded-tl-md border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"} max-w-[85%] rounded-2xl p-4`}><div className={`flex items-center gap-2 text-xs font-bold ${mine ? "text-sky-100" : "text-slate-500"}`}><FileCheck2 className="h-4 w-4" />{[item.author.firstName, item.author.middleName, item.author.lastName].filter(Boolean).join(" ")} · {new Date(item.createdAt).toLocaleString()}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.message}</p>{item.attachmentVersion?.googleDriveFileId && <button type="button" onClick={() => openFile(item.attachmentVersion?.googleDriveFileId).catch((error) => setNotice(error.message))} className={`mt-3 flex w-full items-center gap-2 rounded-xl p-3 text-left text-xs font-extrabold ${mine ? "bg-white/10 hover:bg-white/15" : "border border-slate-200 bg-slate-50 text-[#173f63] hover:bg-slate-100"}`}><FileText className={`h-5 w-5 ${mine ? "text-amber-300" : "text-amber-600"}`} /><span className="min-w-0 flex-1 truncate">{item.attachmentVersion.fileName}</span><Download className="h-4 w-4" /></button>}</div>; })}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (reply.trim()) sendReply.mutate(); }} className="border-t p-4 dark:border-white/10"><div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-white/5"><textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder='Type a reply, e.g. “I already signed your request. Good luck!”' rows={2} className="max-h-32 min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none dark:text-white" /><button type="submit" disabled={!reply.trim() || sendReply.isPending} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E3A008] text-[#102f49] disabled:opacity-40" aria-label="Send reply"><Send className="h-4 w-4" /></button></div>{sendReply.isError && <p className="mt-2 text-xs font-bold text-rose-600">{(sendReply.error as Error).message}</p>}</form>
      </>}</main>
    </div>
  </div>;
}
