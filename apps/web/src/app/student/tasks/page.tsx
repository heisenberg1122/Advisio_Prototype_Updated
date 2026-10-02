"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";

const memberName = (member: any) => `${member?.user?.firstName || ""} ${member?.user?.lastName || ""}`.trim();
const userName = (user: any) => `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Group member";

export default function ResearchTasksPage() {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["student", "workflow-tasks"],
    queryFn: async () => {
      const list = await apiClient.get<{ projects: any[] }>("/api/research");
      const project = list.projects?.[0];
      if (!project) return { project: null, tasks: [] };
      const stages = project.workflowInstance?.workflow?.stages || [];
      const currentSequence = project.workflowInstance?.currentStage?.sequence || 0;
      const submissions = new Map((project.taskSubmissions || []).map((submission: any) => [submission.taskId, submission]));
      const tasks = stages.flatMap((stage: any) => {
        if (stage.requiresDocument === false) return [{ id: `milestone-${stage.id}`, title: stage.name, instructions: stage.description || "Complete this professor-created project milestone.", dueDays: stage.deadlineDays, allowedFileTypes: "", isRequired: true, stage, submission: null, locked: stage.sequence > currentSequence, milestoneOnly: true, requiresDocument: false }];
        const requirements = stage.tasks || [];
        if (requirements.length) return requirements.map((task: any) => ({ ...task, stage, submission: submissions.get(task.id), locked: stage.sequence > currentSequence, milestoneOnly: false, requiresDocument: true }));
        return [{ id: `milestone-${stage.id}`, title: stage.name, instructions: stage.description || "Complete this professor-created project milestone.", dueDays: stage.deadlineDays, allowedFileTypes: "PDF,DOCX", isRequired: true, stage, submission: null, locked: stage.sequence > currentSequence, milestoneOnly: true, requiresDocument: true }];
      });
      return { project, tasks };
    },
    refetchOnWindowFocus: true,
  });

  const openTask = (task: any) => {
    setSelectedTask(task);
    setFile(null);
    setNote(task.submission?.note || "");
    setMessage(null);
  };

  const submitRequirement = async () => {
    if (!selectedTask || !data?.project || !file || selectedTask.milestoneOnly) return;
    const allowed = String(selectedTask.allowedFileTypes || "PDF,DOCX").split(",").map((type: string) => type.trim().toLowerCase());
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowed.includes(extension)) return void setMessage(`Upload one of the allowed formats: ${selectedTask.allowedFileTypes}.`);
    setSubmitting(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", `${selectedTask.title} - ${data.project.title}`);
      formData.append("documentType", `TASK_${selectedTask.id}`);
      const token = localStorage.getItem("advisio_token");
      const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const uploadResponse = await fetch(`${apiBase}/api/research/${data.project.id}/documents`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: formData });
      const upload = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok) throw new Error(upload.error || "Document upload failed.");
      await apiClient.post(`/api/workflows/tasks/${selectedTask.id}/submissions`, { researchId: data.project.id, documentId: upload.document.id, note: note.trim() || undefined });
      await queryClient.invalidateQueries({ queryKey: ["student", "workflow-tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setSelectedTask(null);
      setFile(null);
      setNote("");
      setMessage("Requirement submitted for the entire group.");
    } catch (error: any) {
      setMessage(error?.message || "Unable to submit this requirement.");
    } finally {
      setSubmitting(false);
    }
  };

  const startMilestoneTask = async () => {
    if (!selectedTask?.milestoneOnly || !data?.project) return;
    setStarting(true);
    setMessage(null);
    try {
      const response = await apiClient.post<{ task: any | null; requiresDocument: boolean }>(`/api/workflows/stages/${selectedTask.stage.id}/start`, { researchId: data.project.id });
      const startedTask = response.task
        ? { ...response.task, stage: selectedTask.stage, submission: null, locked: false, milestoneOnly: false, requiresDocument: true }
        : { ...selectedTask, milestoneOnly: false, noDocumentRequired: true, requiresDocument: false };
      setSelectedTask(startedTask);
      await queryClient.invalidateQueries({ queryKey: ["student", "workflow-tasks"] });
      setMessage("Task started. Your group can now upload and submit the required file.");
    } catch (error: any) {
      setMessage(error?.message || "Unable to start this task.");
    } finally {
      setStarting(false);
    }
  };

  if (isPending) return <div className="p-6 text-sm font-semibold text-slate-500"><i className="ti ti-loader-2 mr-2 animate-spin" />Loading project requirements…</div>;
  if (isError) return <div className="m-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Requirements could not be loaded. <button onClick={() => refetch()} className="font-extrabold underline">Retry</button></div>;

  const tasks = data?.tasks || [];
  const project = data?.project;
  const currentSequence = project?.workflowInstance?.currentStage?.sequence || 0;
  const completed = tasks.filter((task: any) => task.submission?.status === "APPROVED" || task.stage.sequence < currentSequence).length;
  const activeMembers = (project?.members || []).filter((member: any) => !member.leftAt && ["LEADER", "MEMBER"].includes(member.projectRole));
  const adviser = (project?.members || []).find((member: any) => !member.leftAt && member.projectRole === "ADVISER");

  return <main className="flex flex-col gap-5 p-5 lg:p-6">
    <section className="rounded-2xl bg-gradient-to-r from-[#173f63] to-[#245a85] p-6 text-white"><p className="text-[11px] font-extrabold uppercase tracking-widest text-[#f6a800]">My project</p><h1 className="mt-1 text-2xl font-black">Tasks & Requirements</h1><p className="mt-2 text-sm text-slate-200">Open a milestone to review its full instructions and submit a shared group deliverable.</p></section>
    {message && <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-800">{message}</div>}
    <section className="grid gap-3 sm:grid-cols-3"><Summary label="Total requirements" value={tasks.length} icon="ti-checklist" /><Summary label="Approved" value={completed} icon="ti-circle-check" /><Summary label="Remaining" value={Math.max(0, tasks.length - completed)} icon="ti-clock" /></section>
    {!project ? <Empty text="Register a project to receive professor-created requirements." /> : !tasks.length ? <Empty text="Milestones will appear here when your professor adds them to the project workflow." /> : <section className="space-y-4">{tasks.map((task: any) => {
      const status = task.submission?.status || (task.stage.sequence < currentSequence ? "COMPLETED" : task.locked ? "LOCKED" : "IN_PROGRESS");
      return <article key={task.id} role="button" tabIndex={0} onClick={() => openTask(task)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openTask(task); }} className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#f6a800] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#f6a800]"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{task.stage.sequence}. Professor milestone</p><h2 className="mt-1 text-base font-extrabold text-[#102f49]">{task.title}</h2><p className="mt-2 line-clamp-2 text-sm text-slate-600">{task.instructions}</p><div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500"><span className="rounded bg-slate-100 px-2 py-1">{task.dueDays != null ? `Due within ${task.dueDays} days` : "Milestone deadline"}</span>{!task.milestoneOnly && <span className="rounded bg-slate-100 px-2 py-1">{task.allowedFileTypes}</span>}<span className="rounded bg-blue-50 px-2 py-1 text-blue-700">Shared with {activeMembers.length || 1} member{activeMembers.length === 1 ? "" : "s"}</span></div>{task.submission && <p className="mt-3 text-xs font-semibold text-slate-500">Submitted by: <span className="text-[#173f63]">{userName(task.submission.submittedByUser)}</span> · {new Date(task.submission.submittedAt).toLocaleString()}</p>}</div><div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end"><Tag variant={status === "APPROVED" || status === "COMPLETED" ? "success" : status === "REVISION_REQUIRED" || status === "REJECTED" ? "warn" : "info"}>{status.replace(/_/g, " ")}</Tag><span className="text-xs font-extrabold text-[#173f63]">View details <i className="ti ti-chevron-right transition group-hover:translate-x-0.5" /></span></div></div></article>;
    })}</section>}
    {selectedTask && <TaskDetails task={selectedTask} project={project} members={activeMembers} adviser={adviser} file={file} note={note} message={message} submitting={submitting} starting={starting} onFile={setFile} onNote={setNote} onClose={() => { setSelectedTask(null); setFile(null); setMessage(null); }} onStart={startMilestoneTask} onSubmit={submitRequirement} />}
  </main>;
}

function TaskDetails({ task, project, members, adviser, file, note, message, submitting, starting, onFile, onNote, onClose, onStart, onSubmit }: any) {
  const [submissionMode, setSubmissionMode] = useState<"choose" | "upload">("choose");
  const currentSequence = project?.workflowInstance?.currentStage?.sequence || 0;
  const status = task.submission?.status || (task.stage.sequence < currentSequence ? "COMPLETED" : task.locked ? "LOCKED" : "IN_PROGRESS");
  const canSubmit = !task.locked && !task.milestoneOnly && status !== "APPROVED";
  const canCreateInDocuments = /DOC|DOCX|HTML|TXT/i.test(task.allowedFileTypes || "");
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8">
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5"><div><p className="text-[10px] font-extrabold uppercase tracking-widest text-[#d98d00]">Milestone {task.stage.sequence}</p><h2 className="mt-1 text-2xl font-black text-[#102f49]">{task.title}</h2><div className="mt-2"><Tag variant={status === "APPROVED" || status === "COMPLETED" ? "success" : status === "REVISION_REQUIRED" || status === "REJECTED" ? "warn" : "info"}>{status.replace(/_/g, " ")}</Tag></div></div><button onClick={onClose} aria-label="Close task details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><i className="ti ti-x text-xl" /></button></div>
    <section className="mt-6"><h3 className="text-sm font-extrabold text-[#102f49]">Professor instructions</h3><p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{task.instructions || "Complete this milestone according to your professor's instructions."}</p></section>
    <section className="mt-5 grid gap-3 sm:grid-cols-2"><Info icon="ti-calendar" label="Deadline" value={task.dueDays != null ? `Within ${task.dueDays} days` : "Follow the milestone schedule"} /><Info icon="ti-file-type-pdf" label="Submission" value={task.requiresDocument === false ? "No document required" : task.milestoneOnly ? "PDF, DOCX after starting" : task.allowedFileTypes} /><Info icon="ti-user-shield" label="Adviser" value={adviser ? memberName(adviser) : "No adviser assigned"} /><Info icon="ti-users" label="Shared task" value={`${members.length || 1} active group member${members.length === 1 ? "" : "s"}`} /></section>
    <section className="mt-6"><h3 className="text-sm font-extrabold text-[#102f49]">Research group</h3><div className="mt-2 flex flex-wrap gap-2">{members.length ? members.map((member: any) => <span key={member.id} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"><i className="ti ti-user mr-1 text-[#173f63]" />{memberName(member)}{member.projectRole === "LEADER" ? " · Leader" : ""}</span>) : <span className="text-sm text-slate-500">Individual research project</span>}</div></section>
    {task.submission && <section className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4"><h3 className="text-sm font-extrabold text-[#102f49]">Current group submission</h3><p className="mt-2 text-sm text-slate-700"><strong>Submitted by:</strong> {userName(task.submission.submittedByUser)}</p><p className="mt-1 text-xs text-slate-500">{new Date(task.submission.submittedAt).toLocaleString()} · {task.submission.document?.title || "Submitted document"}</p>{task.submission.note && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-slate-600">{task.submission.note}</p>}{task.submission.reviewNote && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><strong>Professor feedback:</strong> {task.submission.reviewNote}</p>}</section>}
    {task.locked ? <Notice text="This milestone is visible to your group, but submission opens when the preceding milestone is completed." /> : task.milestoneOnly ? <section className="mt-6 rounded-2xl border border-[#f6a800]/40 bg-amber-50 p-5"><h3 className="text-base font-extrabold text-[#102f49]">Ready to work on this milestone?</h3><p className="mt-2 text-sm text-slate-600">{task.requiresDocument === false ? "This milestone does not require a file. Start it to review and follow the professor's instructions." : "Start the task to choose between creating a document in the workspace or uploading a finished file."}</p>{message && <p className="mt-3 text-xs font-semibold text-rose-600">{message}</p>}<button onClick={onStart} disabled={starting} className="mt-4 w-full rounded-xl bg-[#f6a800] px-5 py-3 text-sm font-extrabold text-[#102f49] shadow-sm disabled:opacity-50"><i className={`ti ${starting ? "ti-loader-2 animate-spin" : "ti-player-play"} mr-2`} />{starting ? "Starting task…" : "Start Task"}</button></section> : task.noDocumentRequired ? <Notice text="Task started. No document is required for this milestone. Follow the professor’s instructions; completion is handled through the milestone workflow." /> : status === "APPROVED" ? <Notice text="This shared group requirement has been approved. No further submission is needed." /> : submissionMode === "choose" ? <section className="mt-6 border-t border-slate-200 pt-6"><h3 className="text-base font-extrabold text-[#102f49]">How would you like to prepare the submission?</h3><p className="mt-1 text-sm text-slate-500">Only methods allowed by the professor’s file requirement are shown.</p>{message && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">{message}</p>}<div className={`mt-4 grid gap-3 ${canCreateInDocuments ? "sm:grid-cols-2" : ""}`}>{canCreateInDocuments && <button onClick={() => { window.location.href = `/dashboard?tab=workspace&milestoneId=${task.stage.id}&taskId=${task.id}`; }} className="rounded-xl border-2 border-[#173f63] bg-white p-5 text-left transition hover:bg-blue-50"><i className="ti ti-file-text text-2xl text-[#173f63]" /><span className="mt-3 block font-extrabold text-[#102f49]">Create in Documents</span><span className="mt-1 block text-xs text-slate-500">Write in the workspace and submit directly to this milestone.</span></button>}<button onClick={() => setSubmissionMode("upload")} className="rounded-xl border-2 border-[#f6a800] bg-amber-50 p-5 text-left transition hover:bg-amber-100"><i className="ti ti-upload text-2xl text-[#173f63]" /><span className="mt-3 block font-extrabold text-[#102f49]">Upload a file</span><span className="mt-1 block text-xs text-slate-500">Submit an existing {task.allowedFileTypes} file from your device.</span></button></div></section> : <section className="mt-6 border-t border-slate-200 pt-6"><button onClick={() => setSubmissionMode("choose")} className="mb-4 text-xs font-extrabold text-[#173f63]"><i className="ti ti-arrow-left mr-1" />Choose another method</button><h3 className="text-sm font-extrabold text-[#102f49]">{task.submission ? "Resubmit group requirement" : "Upload group requirement"}</h3><p className="mt-1 text-xs text-slate-500">Submitting records your name and updates the shared group status.</p><label className="mt-4 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-[#f6a800]"><i className="ti ti-upload text-3xl text-[#173f63]" /><span className="mt-2 text-sm font-bold">{file?.name || "Choose requirement file"}</span><span className="mt-1 text-xs text-slate-400">Accepted: {task.allowedFileTypes}</span><input type="file" className="hidden" onChange={(event) => onFile(event.target.files?.[0] || null)} /></label><textarea value={note} onChange={(event) => onNote(event.target.value)} rows={3} placeholder="Optional note for the professor and adviser" className="mt-4 w-full resize-none rounded-xl border border-slate-300 p-3 text-sm" />{message && <p className="mt-3 text-xs font-semibold text-rose-600">{message}</p>}<button onClick={onSubmit} disabled={!file || submitting || !canSubmit} className="mt-4 w-full rounded-xl bg-[#173f63] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50">{submitting ? "Submitting…" : task.submission ? "Resubmit for group" : "Submit for group"}</button></section>}
  </div></div>;
}

function Summary({ label, value, icon }: { label: string; value: number; icon: string }) { return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#173f63]"><i className={`ti ${icon} text-xl`} /></span><div><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-extrabold text-[#102f49]">{value}</p></div></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><i className="ti ti-checklist text-4xl text-slate-300" /><p className="mt-3 font-extrabold text-[#102f49]">No milestones deployed yet</p><p className="mt-1 text-sm text-slate-500">{text}</p></div>; }
function Info({ icon, label, value }: { icon: string; label: string; value: string }) { return <div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400"><i className={`ti ${icon} mr-1`} />{label}</p><p className="mt-1 text-sm font-bold text-[#102f49]">{value}</p></div>; }
function Notice({ text }: { text: string }) { return <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600"><i className="ti ti-info-circle mr-2 text-[#173f63]" />{text}</div>; }
