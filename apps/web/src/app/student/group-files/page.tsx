"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowLeft, ChevronRight, Download, File, FileArchive, FileImage,
  FileSpreadsheet, FileText, Folder, FolderPlus, HardDrive, Loader2, MoreHorizontal,
  Plus, Search, Trash2, UploadCloud, X,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";

type GroupFolder = { id: string; name: string; parentId: string | null; createdBy: string };
type GroupFile = {
  id: string; folderId: string | null; name: string; originalName: string; mimeType: string;
  fileSize: number; description?: string | null; promotedDocumentId?: string | null;
  uploadedBy: string; createdAt: string; updatedAt: string;
  uploader: { firstName: string; lastName: string };
};
type Listing = {
  folders: GroupFolder[]; files: GroupFile[]; breadcrumbs: Array<{ id: string; name: string }>;
  usage: { bytes: number; files: number; limitBytes: number };
};

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function FileTypeIcon({ file }: { file: GroupFile }) {
  const className = "h-5 w-5";
  if (file.mimeType.includes("image")) return <FileImage className={`${className} text-violet-500`} />;
  if (file.mimeType.includes("sheet") || file.mimeType.includes("csv") || file.mimeType.includes("excel")) return <FileSpreadsheet className={`${className} text-emerald-600`} />;
  if (file.mimeType.includes("zip") || file.mimeType.includes("archive")) return <FileArchive className={`${className} text-amber-600`} />;
  if (file.mimeType.includes("pdf") || file.mimeType.includes("word") || file.mimeType.includes("text")) return <FileText className={`${className} text-blue-600`} />;
  return <File className={`${className} text-slate-500`} />;
}

export default function GroupFilesPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState<any>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"updated" | "name" | "size">("updated");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [movingFile, setMovingFile] = useState<GroupFile | null>(null);
  const [moveDestination, setMoveDestination] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const loadListing = useCallback(async (activeProject = project, activeFolder = folderId) => {
    if (!activeProject?.id) return;
    setLoading(true);
    setError(null);
    try {
      const suffix = activeFolder ? `?folderId=${encodeURIComponent(activeFolder)}` : "";
      setListing(await apiClient.get<Listing>(`/api/research/${activeProject.id}/group-files${suffix}`));
    } catch (err: any) {
      setError(err.message || "Unable to load group files.");
    } finally {
      setLoading(false);
    }
  }, [project, folderId]);

  useEffect(() => {
    apiClient.get<{ projects: any[] }>("/api/research")
      .then((result) => {
        const active = result.projects?.find((item) => item.status !== "ARCHIVED") || result.projects?.[0];
        setProject(active || null);
        if (active) return loadListing(active, null);
        setLoading(false);
      })
      .catch((err) => { setError(err.message || "Unable to find your research project."); setLoading(false); });
  }, []);

  const navigateFolder = (next: string | null) => {
    setFolderId(next);
    loadListing(project, next);
  };

  const visibleFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(listing?.files || [])]
      .filter((file) => !query || file.name.toLowerCase().includes(query) || `${file.uploader.firstName} ${file.uploader.lastName}`.toLowerCase().includes(query))
      .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "size" ? b.fileSize - a.fileSize : +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [listing?.files, search, sort]);
  const visibleFolders = (listing?.folders || []).filter((folder) => folder.name.toLowerCase().includes(search.trim().toLowerCase()));

  const chooseFiles = (files: FileList | File[]) => {
    const accepted = Array.from(files).slice(0, 10);
    const tooLarge = accepted.find((file) => file.size > 50 * 1024 * 1024);
    if (tooLarge) return setError(`${tooLarge.name} exceeds the 50 MB file limit.`);
    setSelectedFiles(accepted);
    setUploadOpen(true);
  };

  const uploadFiles = async () => {
    if (!project?.id || !selectedFiles.length) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      selectedFiles.forEach((file) => form.append("files", file));
      if (folderId) form.append("folderId", folderId);
      if (description.trim()) form.append("description", description.trim());
      const token = localStorage.getItem("advisio_token");
      const response = await fetch(`${API_BASE}/api/research/${project.id}/group-files`, {
        method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      setUploadOpen(false); setSelectedFiles([]); setDescription("");
      toast(`${result.files.length} file${result.files.length === 1 ? "" : "s"} uploaded.`);
      await loadListing();
    } catch (err: any) { setError(err.message || "Upload failed."); }
    finally { setBusy(false); }
  };

  const createFolder = async () => {
    if (!project?.id || !newFolderName.trim()) return;
    setBusy(true); setError(null);
    try {
      await apiClient.post(`/api/research/${project.id}/group-folders`, { name: newFolderName.trim(), parentId: folderId });
      setFolderOpen(false); setNewFolderName(""); toast("Folder created."); await loadListing();
    } catch (err: any) { setError(err.message || "Unable to create folder."); }
    finally { setBusy(false); }
  };

  const openFile = async (file: GroupFile, download = false) => {
    try {
      const token = localStorage.getItem("advisio_token");
      const response = await fetch(`${API_BASE}/api/group-files/${file.id}/content${download ? "?download=1" : ""}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Unable to open file.");
      const url = URL.createObjectURL(await response.blob());
      if (download) { const link = document.createElement("a"); link.href = url; link.download = file.name; link.click(); }
      else window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) { setError(err.message || "Unable to open file."); }
  };

  const renameFile = async (file: GroupFile) => {
    const name = window.prompt("Rename file", file.name)?.trim();
    if (!name || name === file.name) return;
    try { await apiClient.patch(`/api/research/${project.id}/group-files/${file.id}`, { name }); toast("File renamed."); await loadListing(); }
    catch (err: any) { setError(err.message); }
  };

  const deleteFile = async (file: GroupFile) => {
    if (!window.confirm(`Move “${file.name}” to trash?`)) return;
    try { await apiClient.delete(`/api/research/${project.id}/group-files/${file.id}`); toast("File moved to trash."); await loadListing(); }
    catch (err: any) { setError(err.message); }
  };

  const renameFolder = async (folder: GroupFolder) => {
    const name = window.prompt("Rename folder", folder.name)?.trim();
    if (!name || name === folder.name) return;
    try { await apiClient.patch(`/api/research/${project.id}/group-folders/${folder.id}`, { name }); toast("Folder renamed."); await loadListing(); }
    catch (err: any) { setError(err.message); }
  };

  const deleteFolder = async (folder: GroupFolder) => {
    if (!window.confirm(`Delete the empty folder “${folder.name}”?`)) return;
    try { await apiClient.delete(`/api/research/${project.id}/group-folders/${folder.id}`); toast("Folder deleted."); await loadListing(); }
    catch (err: any) { setError(err.message); }
  };

  const moveFile = async () => {
    if (!movingFile) return;
    setBusy(true);
    try {
      await apiClient.patch(`/api/research/${project.id}/group-files/${movingFile.id}`, { folderId: moveDestination || null });
      setMovingFile(null); setMoveDestination(""); toast("File moved."); await loadListing();
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  const promoteFile = async (file: GroupFile) => {
    try {
      await apiClient.post(`/api/research/${project.id}/group-files/${file.id}/promote`);
      toast("File added to Documents."); await loadListing();
    } catch (err: any) { setError(err.message); }
  };

  if (!loading && !project) return <EmptyProject onProject={() => router.push("/student/dashboard?tab=group")} />;

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-5 p-4 sm:p-6 lg:p-8">
      {notice && <div className="fixed right-5 top-20 z-50 rounded-xl bg-[#0B3A53] px-4 py-3 text-sm font-bold text-white shadow-xl">{notice}</div>}
      <section className="flex flex-col justify-between gap-4 rounded-2xl bg-[#0B3A53] p-6 text-white sm:flex-row sm:items-center">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#FFC04D]">Collaborative workspace</p><h1 className="mt-1 text-2xl font-black">Group Files</h1><p className="mt-1 max-w-2xl text-sm text-white/70">Upload and organize drafts, datasets, references, and other working materials for {project?.groupName || "your research group"}.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => setFolderOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold hover:bg-white/15"><FolderPlus size={17} />New folder</button><button onClick={() => inputRef.current?.click()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#FFA400] px-5 text-sm font-black text-[#072A3D] hover:bg-[#ffb52f]"><UploadCloud size={18} />Upload files</button></div>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => event.target.files && chooseFiles(event.target.files)} />
      </section>

      {error && <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><span className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</span><button onClick={() => setError(null)}><X size={16} /></button></div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <Card className="min-w-0 p-0 sm:p-0">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-1 text-sm"><button onClick={() => navigateFolder(null)} className="font-bold text-[#0B3A53] hover:underline">Group Files</button>{listing?.breadcrumbs.map((crumb) => <React.Fragment key={crumb.id}><ChevronRight size={15} className="shrink-0 text-slate-400" /><button onClick={() => navigateFolder(crumb.id)} className="max-w-40 truncate font-semibold text-slate-600 hover:underline">{crumb.name}</button></React.Fragment>)}</div>
            <div className="flex gap-2"><label className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3"><Search size={15} className="text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files" className="w-full bg-transparent text-xs outline-none sm:w-40" /></label><select value={sort} onChange={(e) => setSort(e.target.value as any)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold"><option value="updated">Recently updated</option><option value="name">Name</option><option value="size">Size</option></select></div>
          </div>

          <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); chooseFiles(e.dataTransfer.files); }} className={`min-h-96 ${isDragging ? "bg-amber-50 ring-2 ring-inset ring-[#FFA400]" : ""}`}>
            {loading ? <div className="grid h-80 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#0B3A53]" /></div> : visibleFolders.length || visibleFiles.length ? <div className="divide-y divide-slate-100">
              {folderId && <button onClick={() => navigateFolder(listing?.breadcrumbs.at(-2)?.id || null)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"><ArrowLeft size={18} className="text-slate-400" /><span className="text-sm font-bold text-slate-600">Back</span></button>}
              {visibleFolders.map((folder) => <div key={folder.id} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50"><button onClick={() => navigateFolder(folder.id)} className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50"><Folder className="h-5 w-5 fill-amber-400 text-amber-500" /></button><button onClick={() => navigateFolder(folder.id)} className="min-w-0 flex-1 truncate text-left text-sm font-bold text-slate-800">{folder.name}</button><span className="text-xs text-slate-400">Folder</span><div className="relative group/menu"><button className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-[#0B3A53]"><MoreHorizontal size={18} /></button><div className="invisible absolute right-0 top-8 z-20 w-40 rounded-xl border border-slate-200 bg-white p-1.5 opacity-0 shadow-xl group-hover/menu:visible group-hover/menu:opacity-100"><button onClick={() => renameFolder(folder)} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50">Rename</button><button onClick={() => deleteFolder(folder)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"><Trash2 size={14} />Delete folder</button></div></div><button onClick={() => navigateFolder(folder.id)}><ChevronRight size={16} className="text-slate-300" /></button></div>)}
              {visibleFiles.map((file) => <div key={file.id} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50"><button onClick={() => openFile(file)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100"><FileTypeIcon file={file} /></button><button onClick={() => openFile(file)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-bold text-slate-800">{file.name}</span><span className="block truncate text-xs text-slate-400">{file.uploader.firstName} {file.uploader.lastName} · {new Date(file.updatedAt).toLocaleDateString()} · {formatBytes(file.fileSize)}</span></button>{file.promotedDocumentId && <span className="hidden rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 sm:block">In Documents</span>}<button title="Download" onClick={() => openFile(file, true)} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-[#0B3A53]"><Download size={17} /></button><div className="relative group/menu"><button className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-[#0B3A53]"><MoreHorizontal size={18} /></button><div className="invisible absolute right-0 top-8 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 opacity-0 shadow-xl group-hover/menu:visible group-hover/menu:opacity-100"><button onClick={() => renameFile(file)} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50">Rename</button><button onClick={() => { setMovingFile(file); setMoveDestination(""); }} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50">Move to folder</button>{!file.promotedDocumentId && <button onClick={() => promoteFile(file)} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50">Add to Documents</button>}<button onClick={() => deleteFile(file)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"><Trash2 size={14} />Move to trash</button></div></div></div>)}
            </div> : <button onClick={() => inputRef.current?.click()} className="flex h-80 w-full flex-col items-center justify-center gap-3 p-8 text-center"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100"><UploadCloud className="h-8 w-8 text-[#0B3A53]" /></span><span className="font-black text-slate-800">Drop files here or choose files</span><span className="max-w-sm text-sm text-slate-500">Upload up to 10 files at once, with a maximum size of 50 MB per file.</span></button>}
          </div>
        </Card>

        <div className="space-y-4"><Card><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50"><HardDrive className="h-5 w-5 text-[#0B3A53]" /></span><div><p className="text-sm font-black text-slate-800">Group storage</p><p className="text-xs text-slate-500">{listing?.usage.files || 0} files</p></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#FFA400]" style={{ width: `${Math.min(100, ((listing?.usage.bytes || 0) / (listing?.usage.limitBytes || 1)) * 100)}%` }} /></div><div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-500"><span>{formatBytes(listing?.usage.bytes || 0)} used</span><span>{formatBytes(listing?.usage.limitBytes || 0)}</span></div></Card><Card accentColor="accent"><p className="text-sm font-black text-slate-800">Working files vs. Documents</p><p className="mt-2 text-xs leading-5 text-slate-500">Group Files is for collaboration. Add a finished file to Documents when it is ready for formal review or submission.</p><button onClick={() => router.push("/student/documents")} className="mt-4 text-xs font-black text-[#0B3A53] hover:underline">Open Documents →</button></Card></div>
      </div>

      <Modal isOpen={uploadOpen} onClose={() => !busy && setUploadOpen(false)} title="Upload group files" subtitle={`Destination: ${listing?.breadcrumbs.at(-1)?.name || "Group Files"}`} footer={<><button onClick={() => setUploadOpen(false)} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button onClick={uploadFiles} disabled={busy || !selectedFiles.length} className="inline-flex items-center gap-2 rounded-xl bg-[#0B3A53] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />}Upload {selectedFiles.length || ""}</button></>}><div className="space-y-4"><div className="max-h-48 space-y-2 overflow-auto">{selectedFiles.map((file) => <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><FileText size={18} className="text-[#0B3A53]" /><span className="min-w-0 flex-1 truncate text-sm font-bold">{file.name}</span><span className="text-xs text-slate-400">{formatBytes(file.size)}</span></div>)}</div><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Description (optional)</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#0B3A53]" placeholder="What are these files for?" /></label></div></Modal>
      <Modal isOpen={folderOpen} onClose={() => !busy && setFolderOpen(false)} title="Create folder" subtitle={`Inside ${listing?.breadcrumbs.at(-1)?.name || "Group Files"}`} footer={<><button onClick={() => setFolderOpen(false)} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button onClick={createFolder} disabled={busy || !newFolderName.trim()} className="rounded-xl bg-[#0B3A53] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Create folder</button></>}><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Folder name</span><input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createFolder()} maxLength={120} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#0B3A53]" placeholder="e.g. Research Instruments" /></label></Modal>
      <Modal isOpen={Boolean(movingFile)} onClose={() => !busy && setMovingFile(null)} title="Move file" subtitle={movingFile?.name} footer={<><button onClick={() => setMovingFile(null)} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button onClick={moveFile} disabled={busy} className="rounded-xl bg-[#0B3A53] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Move file</button></>}><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Destination</span><select value={moveDestination} onChange={(e) => setMoveDestination(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#0B3A53]"><option value="">Group Files (root)</option>{listing?.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><span className="mt-2 block text-xs text-slate-400">Create or open a destination folder first if it is not shown here.</span></label></Modal>
    </div>
  );
}

function EmptyProject({ onProject }: { onProject: () => void }) {
  return <div className="mx-auto grid min-h-[60vh] max-w-xl place-items-center p-6 text-center"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-50"><FolderPlus className="h-8 w-8 text-[#C58A18]" /></span><h1 className="mt-5 text-xl font-black text-slate-800">Create a project first</h1><p className="mt-2 text-sm text-slate-500">Your shared Group Files workspace becomes available after you register or join a research project.</p><button onClick={onProject} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0B3A53] px-5 py-3 text-sm font-bold text-white"><Plus size={17} />Open My Project</button></div></div>;
}
