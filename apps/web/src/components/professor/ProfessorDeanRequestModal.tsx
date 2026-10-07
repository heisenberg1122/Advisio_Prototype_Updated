import { useEffect, useState } from "react";
import { FileText, Send, X } from "lucide-react";

const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function ProfessorDeanRequestModal({ projects, onClose, onSent }: { projects: any[]; onClose: () => void; onSent: (message: string) => void }) {
  const [researchId, setResearchId] = useState(projects[0]?.id || "");
  const [recipients, setRecipients] = useState<Array<{ id: string; firstName: string; middleName?: string | null; lastName: string; email: string; college?: { name: string } | null; roles: string[] }>>([]);
  const [recipientId, setRecipientId] = useState("");
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [subject, setSubject] = useState("Defense Approval Request");
  const [message, setMessage] = useState("Good day, Dean. Please review and sign the attached defense approval request for this research group.");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!researchId) return void setRecipients([]);
    let active = true;
    const token = localStorage.getItem("advisio_token");
    setLoadingRecipients(true);
    setRecipientId("");
    fetch(`${apiBase}/api/dean-inbox/recipients?researchId=${encodeURIComponent(researchId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (response) => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Unable to find the Dean recipient."); return body; })
      .then((body) => { if (!active) return; setRecipients(body.recipients || []); setRecipientId(""); })
      .catch((reason) => active && setError(reason.message || "Unable to find the Dean recipient."))
      .finally(() => active && setLoadingRecipients(false));
    return () => { active = false; };
  }, [researchId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return setError("Attach the request letter as a PDF.");
    setBusy(true);
    setError("");
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 60_000);
      const form = new FormData();
      form.append("researchId", researchId);
      form.append("recipientId", recipientId);
      form.append("subject", subject);
      form.append("message", message);
      form.append("file", file);
      const token = localStorage.getItem("advisio_token");
      const response = await fetch(`${apiBase}/api/dean-inbox/requests`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form, signal: controller.signal }).finally(() => window.clearTimeout(timeoutId));
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to send the request.");
      onSent(`Your defense approval request was sent to ${body.recipient?.name || "the selected Dean"}.`);
    } catch (reason: any) {
      setError(reason?.name === "AbortError" ? "The storage upload took too long. Please check the Google Drive connection and try again." : reason.message || "Unable to send the request.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="dean-request-title">
    <form onSubmit={submit} className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b px-5 py-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#d98d00]">Dean's Office</p><h2 id="dean-request-title" className="mt-1 text-xl font-black text-[#102f49]">Request defense approval signature</h2></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500" aria-label="Close"><X className="h-4 w-4" /></button></header>
      <div className="space-y-4 p-5">{error && <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
        <label className="block text-xs font-extrabold text-slate-600">Student research group<select value={researchId} onChange={(event) => setResearchId(event.target.value)} required className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="">Select a group</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
        <label className="block text-xs font-extrabold text-slate-600">Send to<select value={recipientId} onChange={(event) => setRecipientId(event.target.value)} required disabled={loadingRecipients} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100"><option value="">{loadingRecipients ? "Finding the assigned Dean…" : "Select a Dean"}</option>{recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{[recipient.firstName, recipient.middleName, recipient.lastName].filter(Boolean).join(" ")} — {recipient.roles.includes("VPAA") ? "VPAA" : recipient.college?.name || "Dean's Office"}</option>)}</select>{!loadingRecipients && researchId && recipients.length === 0 && <span className="mt-1.5 block text-[11px] font-semibold text-rose-600">No active Dean is assigned to this college. Ask the System Administrator to assign one.</span>}</label>
        <label className="block text-xs font-extrabold text-slate-600">Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={255} required className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#173f63]" /></label>
        <label className="block text-xs font-extrabold text-slate-600">Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} maxLength={5000} required className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 p-3 text-sm leading-6 outline-none focus:border-[#173f63]" /></label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-4 hover:bg-slate-50"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700"><FileText className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-[#173f63]">{file?.name || "Attach request letter"}</span><span className="text-xs text-slate-400">PDF only, up to 50 MB</span></span><input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
      </div>
      <footer className="flex justify-end gap-3 border-t bg-slate-50 px-5 py-4"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button type="submit" disabled={busy || !researchId || !recipientId || !subject.trim() || !message.trim() || !file} className="inline-flex items-center gap-2 rounded-xl bg-[#f6a800] px-5 py-2.5 text-sm font-extrabold text-[#102f49] disabled:opacity-50"><Send className="h-4 w-4" />{busy ? "Sending…" : "Send to Dean"}</button></footer>
    </form>
  </div>;
}
