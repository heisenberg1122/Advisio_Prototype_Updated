"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  ExternalLink,
  Send,
  CheckCircle2,
  FileCode,
  Link as LinkIcon,
  Trash2,
  AlertCircle,
  X,
  ArrowLeft,
  Loader2,
  Download,
  Eye,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { apiClient } from "@/lib/api-client";

export interface LinkedDocItem {
  id: string;
  title: string;
  docUrl: string;
  milestone: string;
  lastEdited: string;
  status: "draft" | "submitted" | "approved";
  directUrl?: string;
  taskId?: string;
  milestoneId?: string;
}

type FormalDocumentVersion = {
  id: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  webViewLink?: string;
  uploadedAt: string;
  sourceSignature?: { signedVersionId: string; signedAt: string; revokedAt?: string | null } | null;
  signedSignature?: {
    signedAt: string;
    sourceVersionId: string;
    verificationCode: string;
    revokedAt?: string | null;
    signedBy: { firstName: string; middleName?: string | null; lastName: string };
  } | null;
};

type FormalDocument = {
  id: string;
  title: string;
  documentType: string;
  currentVersion: number;
  versions: FormalDocumentVersion[];
};

const STORAGE_KEY = "advisio_student_linked_google_docs";

// Helper to extract Google Docs or Google Drive ID
function extractGoogleId(rawUrl: string): { type: "doc" | "drive" | "other"; id: string | null } {
  const trimmed = rawUrl.trim();
  const docMatch = trimmed.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch && docMatch[1]) {
    return { type: "doc", id: docMatch[1] };
  }
  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return { type: "drive", id: driveMatch[1] };
  }
  return { type: "other", id: null };
}

// Format URL for clean iframe embedding
function formatEmbedUrl(rawUrl: string): string {
  const { type, id } = extractGoogleId(rawUrl);
  if (type === "doc" && id) {
    return `https://docs.google.com/document/d/${id}/preview`;
  }
  if (type === "drive" && id) {
    return `https://drive.google.com/file/d/${id}/preview`;
  }
  const trimmed = rawUrl.trim();
  if (trimmed.includes("docs.google.com/document/d/")) {
    if (trimmed.includes("?rm=minimal") || trimmed.includes("&rm=minimal")) return trimmed;
    return trimmed.includes("?") ? `${trimmed}&rm=minimal` : `${trimmed}?rm=minimal`;
  }
  return trimmed;
}

// Get the direct editable link for opening in a new browser tab
function getDirectOpenUrl(embedOrRawUrl: string): string {
  const { type, id } = extractGoogleId(embedOrRawUrl);
  if (type === "doc" && id) {
    return `https://docs.google.com/document/d/${id}/edit`;
  }
  if (type === "drive" && id) {
    return `https://drive.google.com/file/d/${id}/view`;
  }
  return embedOrRawUrl
    .replace("/preview", "/edit")
    .replace("?rm=minimal", "")
    .replace("&rm=minimal", "");
}

export default function DocumentWorkspacePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const paramMilestoneId = searchParams.get("milestoneId");
  const paramTaskId = searchParams.get("taskId");

  const [docs, setDocs] = useState<LinkedDocItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newMilestone, setNewMilestone] = useState("");
  const [availableMilestones, setAvailableMilestones] = useState<string[]>([]);
  const [projectStages, setProjectStages] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [submittingToSystem, setSubmittingToSystem] = useState(false);
  const [paramHandled, setParamHandled] = useState(false);
  const [formalDocuments, setFormalDocuments] = useState<FormalDocument[]>([]);
  const [formalDocumentsLoading, setFormalDocumentsLoading] = useState(false);

  // Active milestone context if arrived from tasks with query params
  const activeMilestoneContext = useMemo(() => {
    if (!paramMilestoneId && !paramTaskId) return null;
    const stage = projectStages.find(
      (s: any) => s.id === paramMilestoneId || s.tasks?.some((t: any) => t.id === paramTaskId)
    );
    if (!stage) return null;
    const task = stage.tasks?.find((t: any) => t.id === paramTaskId) || stage.tasks?.[0];
    return {
      stageId: stage.id,
      stageSequence: stage.sequence,
      stageName: stage.name,
      taskId: task?.id || paramTaskId,
      taskTitle: task?.title || stage.name,
      label: `${stage.sequence}. ${stage.name}`,
    };
  }, [paramMilestoneId, paramTaskId, projectStages]);

  // Load real project workflow milestones from API
  useEffect(() => {
    async function loadProjectMilestones() {
      try {
        const res = await apiClient.get<{ projects: any[] }>("/api/research");
        const project = res.projects?.[0];
        if (project) {
          setActiveProjectId(project.id);
        }
        if (project?.workflowInstance?.workflow?.stages) {
          const stages: any[] = project.workflowInstance.workflow.stages;
          setProjectStages(stages);
          const names = stages.map(
            (s: any) => `${s.sequence}. ${s.name}`
          );
          if (names.length > 0) {
            setAvailableMilestones(names);
            return;
          }
        }
      } catch {
        // Fallback default stages if API lookup fails
      }

      const defaultStages = [
        "1. Topic Proposal",
        "2. Adviser Review & Endorsement",
        "3. Proposal Defense",
        "4. REB Ethics Evaluation",
        "5. Implementation & Manuscript",
        "6. Final Oral Defense",
        "7. Final Manuscript Archiving",
      ];
      setAvailableMilestones(defaultStages);
      setNewMilestone(defaultStages[0]);
    }

    loadProjectMilestones();
  }, []);

  useEffect(() => {
    if (!activeProjectId) return;
    let active = true;
    const loadFormalDocuments = async () => {
      setFormalDocumentsLoading(true);
      try {
        const result = await apiClient.get<{ documents: FormalDocument[] }>(`/api/research/${activeProjectId}/documents`);
        if (active) setFormalDocuments(result.documents || []);
      } catch (error: any) {
        if (active) setUrlError(error.message || "Unable to load official documents.");
      } finally {
        if (active) setFormalDocumentsLoading(false);
      }
    };
    loadFormalDocuments();
    const interval = window.setInterval(loadFormalDocuments, 15_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [activeProjectId]);

  // Load user-linked documents from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filter out dummy/broken test records
          const validDocs = parsed.filter(
            (d) =>
              d &&
              d.docUrl &&
              !d.docUrl.includes("1B_j5q6-aX8-v2_y8") &&
              !d.id?.startsWith("dummy-")
          );
          setDocs(validDocs);
          if (validDocs.length > 0 && !selectedDocId) {
            setSelectedDocId(validDocs[0].id);
          }
          if (validDocs.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(validDocs));
          }
        }
      }
    } catch {
      setDocs([]);
    }
  }, []);

  // Synchronize when arriving with query params (from task "Create in Documents" click)
  useEffect(() => {
    if (activeMilestoneContext && !paramHandled) {
      setNewMilestone(activeMilestoneContext.label);

      // Check if there is an existing linked doc for this milestone
      const existing = docs.find(
        (d) =>
          d.milestone === activeMilestoneContext.label ||
          (d.milestoneId && d.milestoneId === activeMilestoneContext.stageId)
      );

      if (existing) {
        setSelectedDocId(existing.id);
      } else {
        // Automatically open the link modal with title and milestone pre-populated
        setNewTitle(`${activeMilestoneContext.taskTitle} - Group Deliverable`);
        setIsLinkModalOpen(true);
      }
      setParamHandled(true);
    }
  }, [activeMilestoneContext, docs, paramHandled]);

  const saveDocsToStorage = (updatedDocs: LinkedDocItem[]) => {
    setDocs(updatedDocs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDocs));
    } catch {
      // storage unavailable
    }
  };

  const showToast = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 4000);
  };

  const selectedDoc = docs.find((d) => d.id === selectedDocId) || null;

  const officialCopies = useMemo(() => formalDocuments.flatMap((document) =>
    document.versions
      .filter((version) => Boolean(version.signedSignature))
      .map((version) => {
        const source = document.versions.find((item) => item.id === version.signedSignature?.sourceVersionId);
        return { document, version, source };
      })
  ), [formalDocuments]);

  const awaitingSignatureCount = useMemo(() => formalDocuments.filter((document) => {
    const current = document.versions.find((version) => version.versionNumber === document.currentVersion);
    return current?.mimeType === "application/pdf" && !current.signedSignature && !current.sourceSignature;
  }).length, [formalDocuments]);

  const openFormalFile = async (version: FormalDocumentVersion, download = false) => {
    if (!version.webViewLink) return showToast("This stored file is currently unavailable.");
    try {
      const token = localStorage.getItem("advisio_token");
      const response = await fetch(`${(import.meta.env.VITE_API_URL || "").replace(/\/$/, "")}${version.webViewLink}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Unable to open the file.");
      const objectUrl = URL.createObjectURL(await response.blob());
      if (download) {
        const link = window.document.createElement("a");
        link.href = objectUrl;
        link.download = version.fileName;
        link.click();
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error: any) {
      showToast(error.message || "Unable to open the file.");
    }
  };

  const openLinkDialog = (milestone?: string) => {
    setUrlError(null);
    if (activeMilestoneContext) {
      setNewTitle(`${activeMilestoneContext.taskTitle} - Group Deliverable`);
      setNewMilestone(activeMilestoneContext.label);
    }
    if (milestone) {
      setNewMilestone(milestone);
    }
    setIsLinkModalOpen(true);
  };

  const handleLinkDoc = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    const trimmedUrl = newUrl.trim();
    if (!newTitle.trim()) return;

    if (!trimmedUrl) {
      setUrlError("Please provide a valid Google Docs or Google Drive link.");
      return;
    }

    if (
      !trimmedUrl.includes("docs.google.com") &&
      !trimmedUrl.includes("drive.google.com")
    ) {
      setUrlError("The link must be a valid Google Docs (docs.google.com) or Google Drive URL.");
      return;
    }

    const embedUrl = formatEmbedUrl(trimmedUrl);
    const directUrl = getDirectOpenUrl(trimmedUrl);

    const docMilestone = newMilestone || (availableMilestones[0] || "1. Topic Proposal");

    const newDoc: LinkedDocItem = {
      id: `doc-${Date.now()}`,
      title: newTitle.trim(),
      docUrl: embedUrl,
      directUrl: directUrl,
      milestone: docMilestone,
      milestoneId: activeMilestoneContext?.stageId,
      taskId: activeMilestoneContext?.taskId,
      lastEdited: "Just now",
      status: "draft",
    };

    const updated = [newDoc, ...docs];
    saveDocsToStorage(updated);
    setSelectedDocId(newDoc.id);
    setIsLinkModalOpen(false);
    setNewTitle("");
    setNewUrl("");
    showToast(`Linked "${newDoc.title}" to workspace.`);
  };

  const handleDeleteDoc = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = docs.filter((d) => d.id !== docId);
    saveDocsToStorage(updated);
    if (selectedDocId === docId) {
      setSelectedDocId(updated[0]?.id || null);
    }
    showToast("Document unlinked from workspace.");
  };

  const handleMilestoneChange = (docId: string, milestone: string) => {
    const updated = docs.map((d) => (d.id === docId ? { ...d, milestone } : d));
    saveDocsToStorage(updated);
    showToast(`Updated milestone to "${milestone}".`);
  };

  const handleSubmitToSystem = async () => {
    if (!selectedDoc) return;
    setSubmittingToSystem(true);

    try {
      // Find matching stage and task from active project stages
      const matchedStage = projectStages.find((s: any) =>
        `${s.sequence}. ${s.name}`.toLowerCase() === selectedDoc.milestone.toLowerCase() ||
        selectedDoc.milestone.toLowerCase().includes(s.name.toLowerCase())
      );
      const matchedTask = matchedStage?.tasks?.find((t: any) =>
        paramTaskId ? t.id === paramTaskId : true
      ) || matchedStage?.tasks?.[0];
      const targetTaskId = selectedDoc.taskId || paramTaskId || matchedTask?.id;

      if (activeProjectId) {
        try {
          // 1. Create document record in PostgreSQL database
          const docRes = await apiClient.post<{ document: any }>(
            `/api/research/${activeProjectId}/documents`,
            {
              title: selectedDoc.title,
              documentType: targetTaskId ? `TASK_${targetTaskId}` : "RESEARCH_MANUSCRIPT",
              content: `<p>Google Doc Deliverable: <a href="${selectedDoc.directUrl || selectedDoc.docUrl}" target="_blank" rel="noopener noreferrer">${selectedDoc.title}</a></p>`,
            }
          );

          // 2. Submit to the workflow task
          if (targetTaskId && docRes?.document?.id) {
            await apiClient.post(`/api/workflows/tasks/${targetTaskId}/submissions`, {
              researchId: activeProjectId,
              documentId: docRes.document.id,
              note: `Google Doc deliverable submitted via Document Workspace: ${selectedDoc.directUrl || selectedDoc.docUrl}`,
            });
          }
        } catch (apiErr) {
          console.warn("API deliverable upload notice:", apiErr);
        }
      }

      // 3. Update local documents list
      const updated = docs.map((d) =>
        d.id === selectedDoc.id ? { ...d, status: "submitted" as const, lastEdited: "Just now" } : d
      );
      saveDocsToStorage(updated);

      // 4. Update localStorage submissions repository so Submissions center stays synced
      const newSubmission = {
        id: "sub-" + Date.now(),
        docName: `${selectedDoc.title} (Google Docs)`,
        milestone: selectedDoc.milestone,
        date: new Date().toISOString().split("T")[0],
        version: "v1.0",
        status: "pending",
        url: selectedDoc.directUrl || selectedDoc.docUrl,
      };

      const storedSubmissions = localStorage.getItem("advisio_student_submissions");
      let submissionsList = [];
      if (storedSubmissions) {
        try {
          submissionsList = JSON.parse(storedSubmissions);
        } catch {}
      }
      submissionsList.unshift(newSubmission);
      localStorage.setItem("advisio_student_submissions", JSON.stringify(submissionsList));

      showToast(`"${selectedDoc.title}" submitted to ${selectedDoc.milestone} successfully!`);
    } catch {
      showToast(`Submitted "${selectedDoc.title}" to ${selectedDoc.milestone}.`);
    } finally {
      setSubmittingToSystem(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#0B3A53] text-white px-5 py-3 rounded-xl shadow-lg border border-[#C9A227]/40 text-sm font-semibold animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="h-5 w-5 text-[#C9A227] shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Contextual Banner: If arrived from a task */}
      {activeMilestoneContext && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-[#C9A227]/40 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B3A53] text-[#C9A227] font-black text-sm">
              {activeMilestoneContext.stageSequence}
            </span>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0B3A53] dark:text-[#C9A227] block">
                Target Task Deliverable
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Milestone {activeMilestoneContext.stageSequence}: {activeMilestoneContext.stageName} · {activeMilestoneContext.taskTitle}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push("/student/tasks")}
            className="inline-flex items-center gap-1.5 self-start sm:self-center px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-bold text-[#0B3A53] dark:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Tasks</span>
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div className="flex w-full flex-col gap-4">
          <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm dark:border-emerald-900/60 dark:bg-[#101b2b]">
            <div className="flex flex-col gap-3 border-b border-emerald-100 bg-emerald-50/60 px-5 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"><ShieldCheck className="h-5 w-5" /></span>
                <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Official copies</p><h2 className="mt-0.5 text-lg font-extrabold text-[#0B3A53] dark:text-white">Adviser-signed documents</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Signed PDFs are locked to the exact version reviewed by your adviser.</p></div>
              </div>
              <div className="flex gap-2 text-xs font-bold"><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">{officialCopies.length} signed</span>{awaitingSignatureCount > 0 && <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{awaitingSignatureCount} awaiting signature</span>}</div>
            </div>
            <div className="p-4 sm:p-5">
              {formalDocumentsLoading && formalDocuments.length === 0 ? <div className="flex min-h-28 items-center justify-center text-sm font-bold text-slate-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading official documents…</div> : officialCopies.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-white/10"><ShieldCheck className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">No signed documents yet</p><p className="mt-1 text-xs text-slate-400">A signed copy will appear here after your adviser reviews and signs a PDF.</p></div> : <div className="grid gap-3 lg:grid-cols-2">
                {officialCopies.map(({ document, version, source }) => {
                  const signature = version.signedSignature!;
                  const signer = [signature.signedBy.firstName, signature.signedBy.middleName, signature.signedBy.lastName].filter(Boolean).join(" ");
                  const revoked = Boolean(signature.revokedAt);
                  return <article key={version.id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-extrabold text-[#0B3A53] dark:text-white">{document.title}</h3><p className="mt-1 truncate text-xs text-slate-500">{version.fileName}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${revoked ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{revoked ? "Revoked" : "Valid signature"}</span></div>
                    <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2"><div><dt className="text-slate-400">Signed by</dt><dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{signer}</dd></div><div><dt className="text-slate-400">Signed on</dt><dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{new Date(signature.signedAt).toLocaleString()}</dd></div><div className="sm:col-span-2"><dt className="text-slate-400">Verification code</dt><dd className="mt-0.5 font-mono font-bold tracking-wide text-[#0B3A53] dark:text-[#C9A227]">{signature.verificationCode}</dd></div></dl>
                    <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => openFormalFile(version)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B3A53] px-3 py-2 text-xs font-bold text-white"><Eye className="h-3.5 w-3.5" />View signed PDF</button><button onClick={() => openFormalFile(version, true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 dark:border-white/15 dark:text-slate-200"><Download className="h-3.5 w-3.5" />Download</button>{source?.webViewLink && <button onClick={() => openFormalFile(source)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5">View original</button>}</div>
                  </article>;
                })}
              </div>}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl bg-slate-100/80 dark:bg-white/[0.04]">
            <div className="flex items-center justify-between gap-4 px-4 pb-3 pt-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Document workflow</p>
                <h2 className="mt-1 text-lg font-bold tracking-tight text-[#0B3A53] dark:text-white">Start with a milestone</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden text-xs font-semibold text-slate-500 dark:text-slate-400 lg:block">
                  {availableMilestones.length} research stages
                </span>
                <button
                  onClick={() => openLinkDialog()}
                  className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#FFA400] px-4 text-xs font-bold text-[#072A3D] shadow-xs transition hover:bg-[#E59400] active:scale-95 sm:text-sm"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  <span className="hidden sm:inline">Link Google Doc</span>
                  <span className="sm:hidden">Link Doc</span>
                </button>
              </div>
            </div>

            <div className="flex gap-4 overflow-x-auto px-4 pb-6 sm:px-6">
              <button
                type="button"
                onClick={() => openLinkDialog()}
                className="group w-40 shrink-0 text-left sm:w-44"
              >
                <span className="flex aspect-[4/3] items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0B3A53] shadow-xs transition-all group-hover:-translate-y-1 group-hover:border-[#0B3A53]/40 group-hover:shadow-md dark:border-white/10 dark:bg-[#101b2b] dark:text-[#C9A227]">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF3F7] transition-transform group-hover:scale-105 dark:bg-white/10">
                    <Plus className="h-6 w-6" />
                  </span>
                </span>
                <span className="mt-2 block text-sm font-bold text-[#0B3A53] dark:text-white">Link Google Doc</span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Connect a live document</span>
              </button>

              {availableMilestones.map((milestone, index) => (
                <button
                  key={milestone}
                  type="button"
                  onClick={() => openLinkDialog(milestone)}
                  className="group w-40 shrink-0 text-left sm:w-44"
                >
                  <span className="relative flex aspect-[4/3] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all group-hover:-translate-y-1 group-hover:border-[#0B3A53]/40 group-hover:shadow-md dark:border-white/10 dark:bg-[#101b2b]">
                    <span className="flex items-center justify-between">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3F7] text-sm font-black text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227]">
                        {index + 1}
                      </span>
                      <FileText className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                    </span>
                    <span className="mt-auto space-y-2" aria-hidden="true">
                      <span className="block h-2 w-full rounded-full bg-slate-100 dark:bg-white/10" />
                      <span className="block h-2 w-4/5 rounded-full bg-slate-100 dark:bg-white/10" />
                      <span className="block h-2 w-3/5 rounded-full bg-[#C9A227]/30" />
                    </span>
                  </span>
                  <span className="mt-2 block truncate text-sm font-bold text-[#0B3A53] dark:text-white">{milestone}</span>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Link milestone document</span>
                </button>
              ))}
            </div>
          </section>

          <Card className="bg-white dark:bg-[#101b2b] border border-[#DDE3E8] dark:border-white/10 rounded-2xl p-0 shadow-sm overflow-hidden flex flex-col">
            {/* Directory Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EEF2F6] dark:border-white/10 bg-slate-50/60 dark:bg-white/5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#0B3A53] dark:text-[#C9A227]" />
                <h2 className="text-sm font-extrabold text-[#0B3A53] dark:text-white uppercase tracking-wider">
                  Docs Directory
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EAF3F7] text-[#0B3A53] dark:bg-white/10 dark:text-[#38bdf8]">
                  {docs.length}
                </span>
              </div>
              <button
                onClick={() => openLinkDialog()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B3A53] hover:bg-[#082E42] text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Link Doc</span>
              </button>
            </div>

            {/* Document List */}
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 2xl:grid-cols-4">
              {docs.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center gap-2 p-8 text-center text-slate-400 sm:col-span-2 lg:col-span-3 2xl:col-span-4">
                  <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    No documents linked yet
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-[200px]">
                    Click &quot;+ Link Doc&quot; to connect a live Google Document.
                  </p>
                </div>
              ) : (
                docs.map((doc) => {
                  const isActive = doc.id === selectedDocId;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`group cursor-pointer overflow-hidden rounded-2xl border bg-white p-3 transition-all duration-150 dark:bg-[#101b2b] ${
                        isActive
                          ? "border-[#0B3A53] ring-2 ring-[#0B3A53]/10 text-[#0B3A53] shadow-sm dark:border-[#C9A227] dark:text-white"
                          : "border-slate-200 text-slate-700 hover:-translate-y-1 hover:border-[#0B3A53]/30 hover:shadow-md dark:border-white/10 dark:text-slate-300"
                      }`}
                    >
                      <div className="relative mb-3 flex aspect-[4/3] flex-col overflow-hidden rounded-xl bg-slate-50 p-5 dark:bg-white/[0.04]">
                        <div className="flex items-center justify-between">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3F7] text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227]">
                            <FileCode className="h-5 w-5" />
                          </span>
                          <Tag
                            variant={
                              doc.status === "approved"
                                ? "success"
                                : doc.status === "submitted"
                                ? "info"
                                : "neutral"
                            }
                          >
                            {doc.status === "approved"
                              ? "Approved"
                              : doc.status === "submitted"
                              ? "Submitted"
                              : "Draft"}
                          </Tag>
                        </div>
                        <div className="mt-auto space-y-3">
                          <p className="line-clamp-2 text-sm font-bold leading-5 text-[#0B3A53] dark:text-white">{doc.milestone}</p>
                          <div className="space-y-2" aria-hidden="true">
                            <span className="block h-2 w-full rounded-full bg-slate-200/80 dark:bg-white/10" />
                            <span className="block h-2 w-5/6 rounded-full bg-slate-200/80 dark:bg-white/10" />
                            <span className="block h-2 w-2/3 rounded-full bg-[#C9A227]/30" />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-2 px-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0B3A53]/10 text-[#0B3A53] dark:bg-white/10 dark:text-[#C9A227]">
                            <FileCode className="h-4 w-4" />
                          </span>
                          <span
                            className={`text-[13px] truncate ${
                              isActive ? "font-bold text-[#0B3A53] dark:text-white" : "font-semibold"
                            }`}
                          >
                            {doc.title}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            onClick={(e) => handleDeleteDoc(doc.id, e)}
                            title="Unlink document"
                            className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-red-600 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 px-1 pl-10 pt-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="truncate font-medium text-slate-600 dark:text-slate-300">
                          {doc.milestone}
                        </span>
                        <span>{doc.lastEdited}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        <div className="w-full">
          <Card className="bg-white dark:bg-[#101b2b] border border-[#E2E8F0] dark:border-white/10 rounded-2xl p-0 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05),0_1px_4px_-1px_rgba(15,23,42,0.03)] overflow-hidden flex flex-col min-h-[75vh]">
            {selectedDoc ? (
              <>
                {/* Embedded Toolbar Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 border-b border-[#EEF2F6] dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold uppercase">
                        Google Docs
                      </span>
                      <h2 className="text-sm md:text-base font-extrabold text-[#0B3A53] dark:text-white truncate">
                        {selectedDoc.title}
                      </h2>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Last edited {selectedDoc.lastEdited} · Live collaborative document
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {/* Milestone Select */}
                    <select
                      value={selectedDoc.milestone}
                      onChange={(e) => handleMilestoneChange(selectedDoc.id, e.target.value)}
                      className="h-9 px-3 text-xs font-semibold rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#0B1726] text-slate-700 dark:text-slate-200 outline-none focus:border-[#0B3A53] focus:ring-1 focus:ring-[#0B3A53] cursor-pointer"
                    >
                      {availableMilestones.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>

                    {/* Open in New Tab Button */}
                    <a
                      href={selectedDoc.directUrl || getDirectOpenUrl(selectedDoc.docUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 px-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-[#0B3A53] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open in Tab</span>
                    </a>

                    {/* Submit to System Button */}
                    <button
                      onClick={handleSubmitToSystem}
                      disabled={submittingToSystem}
                      className="inline-flex h-9 items-center gap-1.5 px-4 rounded-xl bg-[#FFA400] hover:bg-[#E59400] text-[#072A3D] text-xs font-bold transition shadow-xs active:scale-95 disabled:opacity-60 cursor-pointer"
                    >
                      {submittingToSystem ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      <span>{submittingToSystem ? "Submitting…" : "Submit to Milestone"}</span>
                    </button>
                  </div>
                </div>

                {/* Live Google Docs Embed Frame */}
                <div className="flex-1 w-full bg-slate-50 dark:bg-black/20 flex flex-col relative">
                  <iframe
                    src={selectedDoc.docUrl}
                    title={selectedDoc.title}
                    width="100%"
                    className="w-full min-h-[70vh] flex-1 rounded-b-2xl border-t border-gray-200 dark:border-white/10"
                    style={{ border: 0 }}
                    allow="clipboard-write"
                  />
                </div>
              </>
            ) : (
              /* Empty State (when no document is selected) */
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center my-auto min-h-[60vh]">
                <div className="h-16 w-16 rounded-2xl bg-[#EAF3F7] dark:bg-white/10 text-[#0B3A53] dark:text-[#C9A227] flex items-center justify-center mb-4 shadow-xs">
                  <FileText className="h-8 w-8 stroke-[1.8]" />
                </div>
                <h3 className="text-lg font-extrabold text-[#0B3A53] dark:text-white">
                  No Document Selected
                </h3>
                <p className="mt-1.5 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                  {docs.length > 0
                    ? "Select a document from the gallery above to preview, edit, and submit it."
                    : "No Google Docs have been linked yet. Connect your team's live Google Doc to preview and submit it here."}
                </p>
                <button
                  onClick={() => openLinkDialog()}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B3A53] hover:bg-[#082E42] text-white font-bold text-xs transition shadow-sm cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Link Google Doc</span>
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modal: Link Real Google Doc */}
      {isLinkModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-[#101b2b] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-[#0B3A53] dark:text-[#C9A227]" />
                <h3 className="text-base font-extrabold text-[#0B3A53] dark:text-white">
                  Link Google Document
                </h3>
              </div>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleLinkDoc} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Document Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Topic Proposal - Group Deliverable"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#0B1726] text-slate-800 dark:text-slate-100 outline-none focus:border-[#0B3A53] focus:ring-1 focus:ring-[#0B3A53]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Google Docs Shareable Link <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://docs.google.com/document/d/.../edit"
                  value={newUrl}
                  onChange={(e) => {
                    setNewUrl(e.target.value);
                    setUrlError(null);
                  }}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#0B1726] text-slate-800 dark:text-slate-100 outline-none focus:border-[#0B3A53] focus:ring-1 focus:ring-[#0B3A53]"
                />
                {urlError ? (
                  <p className="flex items-center gap-1 text-[11px] text-red-600 mt-1.5">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{urlError}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Paste the share link to your team&apos;s Google Doc or Google Drive manuscript.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Milestone
                </label>
                <select
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#0B1726] text-slate-800 dark:text-slate-100 outline-none focus:border-[#0B3A53] focus:ring-1 focus:ring-[#0B3A53]"
                >
                  {availableMilestones.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10 mt-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0B3A53] hover:bg-[#082E42] text-white shadow-xs transition cursor-pointer"
                >
                  Save & Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
