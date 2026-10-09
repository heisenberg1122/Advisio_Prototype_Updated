"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

type Resource = {
  id: string;
  title: string;
  description?: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  version: number;
  updatedAt: string;
  uploader?: { firstName: string; lastName: string };
};

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function WorkflowResourcesCard({ workflowId, canManage = false }: { workflowId?: string | null; canManage?: boolean }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["workflow-resources", workflowId],
    queryFn: () => apiClient.get<{ resources: Resource[]; canManage: boolean }>(`/api/workflows/${workflowId}/resources`),
    enabled: Boolean(workflowId),
    staleTime: 30_000,
  });
  const resources = data?.resources || [];
  const allowedToManage = canManage && data?.canManage !== false;
  const [dialog, setDialog] = useState<"upload" | "edit" | "replace" | null>(null);
  const [selected, setSelected] = useState<Resource | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDialog(null);
    setSelected(null);
    setNotice("");
  }, [workflowId]);

  const openUpload = () => {
    setSelected(null); setTitle(""); setDescription(""); setFile(null); setNotice(""); setDialog("upload");
  };
  const openEdit = (resource: Resource) => {
    setSelected(resource); setTitle(resource.title); setDescription(resource.description || ""); setFile(null); setNotice(""); setDialog("edit");
  };
  const openReplace = (resource: Resource) => {
    setSelected(resource); setTitle(resource.title); setDescription(resource.description || ""); setFile(null); setNotice(""); setDialog("replace");
  };

  const save = async () => {
    if (!workflowId) return;
    if ((dialog === "upload" && (!title.trim() || !file)) || (dialog === "replace" && !file)) {
      setNotice(dialog === "replace" ? "Select a replacement file." : "Enter a title and select a file.");
      return;
    }
    setBusy(true); setNotice("");
    try {
      if (dialog === "edit" && selected) {
        await apiClient.patch(`/api/workflows/resources/${selected.id}`, { title: title.trim(), description: description.trim() });
      } else {
        const form = new FormData();
        if (file) form.append("file", file);
        if (dialog === "upload") { form.append("title", title.trim()); form.append("description", description.trim()); }
        await apiClient.upload(dialog === "replace" && selected ? `/api/workflows/resources/${selected.id}/replace` : `/api/workflows/${workflowId}/resources`, form);
      }
      await refetch();
      setDialog(null); setFile(null);
    } catch (saveError: any) {
      setNotice(saveError?.message || "The resource could not be saved.");
    } finally { setBusy(false); }
  };

  const remove = async (resource: Resource) => {
    if (!window.confirm(`Remove “${resource.title}” from this workflow? This affects every enrolled researcher.`)) return;
    setBusy(true); setNotice("");
    try { await apiClient.delete(`/api/workflows/resources/${resource.id}`); await refetch(); }
    catch (removeError: any) { setNotice(removeError?.message || "The resource could not be removed."); }
    finally { setBusy(false); }
  };

  const openFile = async (resource: Resource, download = false) => {
    setNotice("");
    try {
      const blob = await apiClient.file(`/api/workflows/resources/${resource.id}/file${download ? "?download=1" : ""}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.target = download ? "_self" : "_blank"; link.rel = "noreferrer";
      if (download) link.download = resource.fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (fileError: any) { setNotice(fileError?.message || "The file could not be opened."); }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6 dark:border-white/10 dark:bg-[#101b2b]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-[#C98B00]"><i className="ti ti-books text-lg" /></span><div><h3 className="font-extrabold text-[#102f49] dark:text-white">Research Guides &amp; Templates</h3><p className="text-xs text-slate-500">Official reference files shared across the entire workflow.</p></div></div>
        </div>
        {allowedToManage && workflowId && <button type="button" onClick={openUpload} className="rounded-xl bg-[#173f63] px-4 py-2.5 text-xs font-extrabold text-white"><i className="ti ti-upload mr-1.5" />Upload resource</button>}
      </div>
      {notice && <p role="status" className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{notice}</p>}
      {!workflowId ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">Select or join a workflow to view its shared resources.</div>
        : isLoading ? <div className="mt-5 h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
        : error ? <div className="mt-5 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">The workflow resources could not be loaded.</div>
        : resources.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center"><p className="text-sm font-bold text-slate-600 dark:text-slate-300">No guides or templates shared yet</p><p className="mt-1 text-xs text-slate-400">{allowedToManage ? "Upload the official manuscript guide or other workflow-wide reference files." : "Your professor has not shared any workflow guides yet."}</p></div>
        : <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">{resources.map((resource) => <article key={resource.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#173f63]"><i className={`ti ${resource.mimeType === "application/pdf" ? "ti-file-type-pdf" : "ti-file-type-docx"} text-xl`} /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-[#102f49] dark:text-white">{resource.title}</p>{resource.description && <p className="mt-0.5 text-xs text-slate-500">{resource.description}</p>}<p className="mt-1 truncate text-[11px] font-semibold text-slate-400">{resource.fileName} · {formatBytes(resource.fileSize)} · Version {resource.version} · Updated {new Date(resource.updatedAt).toLocaleDateString()}</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => openFile(resource)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#173f63]">View</button><button type="button" onClick={() => openFile(resource, true)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#173f63]">Download</button>{allowedToManage && <><button type="button" onClick={() => openEdit(resource)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Edit</button><button type="button" onClick={() => openReplace(resource)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Replace</button><button type="button" disabled={busy} onClick={() => remove(resource)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600">Remove</button></>}</div>
          </article>)}</div>}

      {dialog && <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={(event) => event.target === event.currentTarget && !busy && setDialog(null)}><section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#101b2b]"><h2 className="text-lg font-black text-[#102f49] dark:text-white">{dialog === "upload" ? "Upload workflow resource" : dialog === "replace" ? `Replace ${selected?.title}` : "Edit resource details"}</h2><p className="mt-1 text-xs text-slate-500">This resource applies to the entire selected workflow, not a particular milestone.</p><div className="mt-5 space-y-4">{dialog !== "replace" && <><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#173f63] dark:bg-white/5 dark:text-white" placeholder="Official Manuscript Guide" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Description (optional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#173f63] dark:bg-white/5 dark:text-white" /></label></>}{dialog !== "edit" && <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{dialog === "replace" ? "Replacement file" : "File"}</span><input ref={fileInput} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] || null)} className="block w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-600" /><span className="mt-1.5 block text-[11px] text-slate-400">PDF, DOC, or DOCX · maximum 10 MB</span></label>}{notice && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{notice}</p>}</div><div className="mt-6 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setDialog(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500">Cancel</button><button type="button" disabled={busy} onClick={save} className="rounded-xl bg-[#173f63] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">{busy ? "Saving…" : dialog === "replace" ? "Replace file" : "Save"}</button></div></section></div>}
    </section>
  );
}
