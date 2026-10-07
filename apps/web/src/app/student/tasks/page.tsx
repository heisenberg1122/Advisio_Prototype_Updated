"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Tag } from "@/components/ui/Tag";
import { StatCard } from "@/components/ui/StatCard";
import { useNavigate, useSearchParams } from "react-router-dom";

const memberName = (member: any) =>
  `${member?.user?.firstName || ""} ${member?.user?.lastName || ""}`.trim();
const userName = (user: any) =>
  `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Group member";

export default function ResearchTasksPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [workflowCode, setWorkflowCode] = useState("");

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["student", "workflow-tasks"],
    queryFn: async () => {
      const [list, enrollmentList] = await Promise.all([
        apiClient.get<{ projects: any[] }>("/api/research"),
        apiClient.get<{ enrollments: any[] }>("/api/workflows/enrollments/me"),
      ]);
      const project = list.projects?.[0];
      const enrollments = enrollmentList.enrollments || [];
      if (!project) return { project: null, tasks: [], enrollments };
      const stages = project.workflowInstance?.workflow?.stages || [];
      const currentSequence =
        project.workflowInstance?.currentStage?.sequence || 0;
      const submissions = new Map(
        (project.taskSubmissions || []).map((submission: any) => [
          submission.taskId,
          submission,
        ]),
      );
      const tasks = stages.flatMap((stage: any) => {
        if (stage.requiresDocument === false)
          return [
            {
              id: `milestone-${stage.id}`,
              title: stage.name,
              instructions:
                stage.description ||
                "Complete this professor-created project milestone.",
              dueDays: stage.deadlineDays,
              allowedFileTypes: "",
              isRequired: true,
              stage,
              submission: null,
              locked:
                stage.sequence > currentSequence && stage.requiresApproval,
              milestoneOnly: true,
              requiresDocument: false,
            },
          ];
        const requirements = stage.tasks || [];
        if (requirements.length)
          return requirements.map((task: any) => ({
            ...task,
            stage,
            submission: submissions.get(task.id),
            locked: stage.sequence > currentSequence && stage.requiresApproval,
            milestoneOnly: false,
            requiresDocument: true,
          }));
        return [
          {
            id: `milestone-${stage.id}`,
            title: stage.name,
            instructions:
              stage.description ||
              "Complete this professor-created project milestone.",
            dueDays: stage.deadlineDays,
            allowedFileTypes: "PDF,DOCX",
            isRequired: true,
            stage,
            submission: null,
            locked: stage.sequence > currentSequence && stage.requiresApproval,
            milestoneOnly: true,
            requiresDocument: true,
          },
        ];
      });
      return { project, tasks, enrollments };
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
    if (!selectedTask || !data?.project || !file || selectedTask.milestoneOnly)
      return;
    const allowed = String(selectedTask.allowedFileTypes || "PDF,DOCX")
      .split(",")
      .map((type: string) => type.trim().toLowerCase());
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowed.includes(extension))
      return void setMessage(
        `Upload one of the allowed formats: ${selectedTask.allowedFileTypes}.`,
      );
    setSubmitting(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", `${selectedTask.title} - ${data.project.title}`);
      formData.append("documentType", `TASK_${selectedTask.id}`);
      const token = localStorage.getItem("advisio_token");
      const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const uploadResponse = await fetch(
        `${apiBase}/api/research/${data.project.id}/documents`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
        },
      );
      const upload = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok)
        throw new Error(upload.error || "Document upload failed.");
      await apiClient.post(
        `/api/workflows/tasks/${selectedTask.id}/submissions`,
        {
          researchId: data.project.id,
          documentId: upload.document.id,
          note: note.trim() || undefined,
        },
      );
      await queryClient.invalidateQueries({
        queryKey: ["student", "workflow-tasks"],
      });
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
      const response = await apiClient.post<{
        task: any | null;
        requiresDocument: boolean;
      }>(`/api/workflows/stages/${selectedTask.stage.id}/start`, {
        researchId: data.project.id,
      });
      const startedTask = response.task
        ? {
            ...response.task,
            stage: selectedTask.stage,
            submission: null,
            locked: false,
            milestoneOnly: false,
            requiresDocument: true,
          }
        : {
            ...selectedTask,
            milestoneOnly: false,
            noDocumentRequired: true,
            requiresDocument: false,
          };
      setSelectedTask(startedTask);
      await queryClient.invalidateQueries({
        queryKey: ["student", "workflow-tasks"],
      });
      setMessage(
        "Task started. Your group can now upload and submit the required file.",
      );
    } catch (error: any) {
      setMessage(error?.message || "Unable to start this task.");
    } finally {
      setStarting(false);
    }
  };

  const openSubmissionVersion = async (version: any) => {
    if (!version?.googleDriveFileId) return void setMessage("The stored signed PDF is unavailable.");
    try {
      const token = localStorage.getItem("advisio_token");
      const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const response = await fetch(`${apiBase}/api/documents/files/${version.googleDriveFileId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error("Unable to open the signed PDF.");
      const url = URL.createObjectURL(await response.blob());
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error: any) {
      setMessage(error.message || "Unable to open the signed PDF.");
    }
  };

  if (isPending)
    return (
      <div className="p-6 text-sm font-semibold text-slate-500">
        <i className="ti ti-loader-2 mr-2 animate-spin" />
        Loading project requirements…
      </div>
    );
  if (isError)
    return (
      <div className="m-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Requirements could not be loaded.{" "}
        <button onClick={() => refetch()} className="font-extrabold underline">
          Retry
        </button>
      </div>
    );

  const tasks = data?.tasks || [];
  const project = data?.project;
  const enrollments = data?.enrollments || [];
  const activeEnrollment =
    enrollments.find(
      (enrollment: any) =>
        enrollment.workflowId === project?.workflowInstance?.workflowId,
    ) || enrollments[0];
  const acceptedWorkflowName = searchParams.get("workflowAccepted");
  const invitationDeclined = searchParams.get("invitation") === "declined";
  const currentSequence =
    project?.workflowInstance?.currentStage?.sequence || 0;
  const completed = tasks.filter(
    (task: any) =>
      task.submission?.status === "APPROVED" ||
      task.stage.sequence < currentSequence,
  ).length;
  const activeMembers = (project?.members || []).filter(
    (member: any) =>
      !member.leftAt && ["LEADER", "MEMBER"].includes(member.projectRole),
  );
  const adviser = (project?.members || []).find(
    (member: any) => !member.leftAt && member.projectRole === "ADVISER",
  );

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {message && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-3.5 text-sm font-semibold text-blue-900 dark:text-blue-200">
          {message}
        </div>
      )}

      {acceptedWorkflowName && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          <i className="ti ti-circle-check mt-0.5 text-lg" />
          <div><strong className="block">Workflow invitation accepted</strong><span>You joined {acceptedWorkflowName}. Its milestones are now available in Tasks & Requirements.</span></div>
        </div>
      )}

      {invitationDeclined && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <i className="ti ti-info-circle mt-0.5 text-lg" />
          <span>The workflow invitation was not accepted. You can use the invitation link again while it remains valid.</span>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total requirements"
          value={tasks.length}
          icon="ti-checklist"
          iconBg="bg-sky-50 dark:bg-sky-950/40"
          iconColor="text-sky-700 dark:text-sky-300"
        />
        <StatCard
          label="Approved"
          value={completed}
          icon="ti-circle-check"
          iconBg="bg-emerald-50 dark:bg-emerald-950/40"
          iconColor="text-emerald-700 dark:text-emerald-300"
        />
        <StatCard
          label="Remaining"
          value={Math.max(0, tasks.length - completed)}
          icon="ti-clock"
          iconBg="bg-amber-50 dark:bg-amber-950/40"
          iconColor="text-amber-700 dark:text-amber-300"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
        <div className="rounded-2xl border border-[#DDE3E8] bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#101b2b] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#C9A227]">Active workflow</p>
              {activeEnrollment ? (
                <>
                  <h2 className="mt-1 text-xl font-black text-[#17212B] dark:text-white">{activeEnrollment.workflow.name}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {activeEnrollment.workflow.creator
                      ? `Professor: ${`${activeEnrollment.workflow.creator.firstName || ""} ${activeEnrollment.workflow.creator.lastName || ""}`.trim() || activeEnrollment.workflow.creator.email}`
                      : "Professor-created research workflow"}
                  </p>
                </>
              ) : (
                <><h2 className="mt-1 text-xl font-black text-[#17212B] dark:text-white">No workflow joined yet</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use the code or invitation link provided by your professor.</p></>
              )}
            </div>
            <Tag variant={activeEnrollment ? "success" : "info"}>{activeEnrollment ? "Active" : "Not joined"}</Tag>
          </div>
          {activeEnrollment && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Info icon="ti-list-check" label="Milestones" value={`${activeEnrollment.workflow.stages?.length || 0} stages`} />
              <Info icon="ti-calendar-check" label="Joined" value={new Date(activeEnrollment.joinedAt).toLocaleDateString()} />
              <Info icon="ti-progress" label="Current status" value={project?.workflowInstance?.currentStage?.name || "Awaiting project registration"} />
            </div>
          )}
          {enrollments.length > 1 && <p className="mt-4 text-xs font-semibold text-slate-500">You have joined {enrollments.length} workflows. The workflow linked to your current project is shown first.</p>}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const code = workflowCode.trim().toUpperCase();
            if (code) navigate(`/student/workflows/join/${encodeURIComponent(code)}`);
          }}
          className="rounded-2xl border border-[#DDE3E8] bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#101b2b] sm:p-6"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#C9A227]">Join a workflow</p>
          <h2 className="mt-1 text-base font-black text-[#17212B] dark:text-white">Enter professor invitation code</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">You will review the invitation before deciding to accept or reject it.</p>
          <div className="mt-4 flex gap-2">
            <input value={workflowCode} onChange={(event) => setWorkflowCode(event.target.value.toUpperCase())} maxLength={32} placeholder="Invitation code" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm font-bold uppercase text-[#17212B] outline-none focus:border-[#0B3A53] dark:border-white/20 dark:bg-[#0B1726] dark:text-white" />
            <button type="submit" disabled={!workflowCode.trim()} className="rounded-xl bg-[#0B3A53] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">Review</button>
          </div>
        </form>
      </section>

      {!project ? (
        <Empty text={activeEnrollment ? "Workflow accepted. Register a project to begin submitting its professor-created requirements." : "Join a professor workflow, then register a project to receive its requirements."} />
      ) : !tasks.length ? (
        <Empty text="Milestones will appear here when your professor adds them to the project workflow." />
      ) : (
        <section className="space-y-3.5">
          {tasks.map((task: any) => {
            const status =
              task.submission?.status ||
              (task.stage.sequence < currentSequence
                ? "COMPLETED"
                : task.locked
                  ? "LOCKED"
                  : "IN_PROGRESS");
            return (
              <article
                key={task.id}
                role="button"
                tabIndex={0}
                onClick={() => openTask(task)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ")
                    openTask(task);
                }}
                className="group cursor-pointer rounded-2xl border border-[#E2E8F0] dark:border-white/10 bg-white dark:bg-[#101b2b] p-5 sm:p-6 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05),0_1px_4px_-1px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-[#0B3A53] dark:hover:border-[#FFA400] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#0B3A53]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {task.stage.sequence}. Professor milestone
                    </p>
                    <h2 className="mt-1 text-base font-extrabold text-[#17212B] dark:text-white">
                      {task.title}
                    </h2>
                    <p className="mt-1.5 line-clamp-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {task.instructions}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500">
                      <span className="rounded-lg bg-slate-100 dark:bg-white/5 px-2.5 py-1">
                        {task.dueDays != null
                          ? `Due within ${task.dueDays} days`
                          : "Milestone deadline"}
                      </span>
                      {!task.milestoneOnly && (
                        <span className="rounded-lg bg-slate-100 dark:bg-white/5 px-2.5 py-1">
                          {task.allowedFileTypes}
                        </span>
                      )}
                      <span className="rounded-lg bg-[#EAF3F7] dark:bg-white/10 px-2.5 py-1 text-[#0B3A53] dark:text-[#38bdf8]">
                        Shared with {activeMembers.length || 1} member
                        {activeMembers.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {task.submission && (
                      <p className="mt-3 text-xs font-semibold text-slate-500">
                        Submitted by:{" "}
                        <span className="text-[#0B3A53] dark:text-[#FFA400] font-bold">
                          {userName(task.submission.submittedByUser)}
                        </span>{" "}
                        ·{" "}
                        {new Date(task.submission.submittedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                    <Tag
                      variant={
                        status === "APPROVED" || status === "COMPLETED"
                          ? "success"
                          : status === "REVISION_REQUIRED" ||
                              status === "REJECTED"
                            ? "warn"
                            : "info"
                      }
                    >
                      {status.replace(/_/g, " ")}
                    </Tag>
                    <span className="text-xs font-extrabold text-[#0B3A53] dark:text-[#FFA400] group-hover:underline">
                      View details{" "}
                      <i className="ti ti-chevron-right transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
      {selectedTask && (
        <TaskDetails
          task={selectedTask}
          project={project}
          members={activeMembers}
          adviser={adviser}
          file={file}
          note={note}
          message={message}
          submitting={submitting}
          starting={starting}
          onFile={setFile}
          onNote={setNote}
          onClose={() => {
            setSelectedTask(null);
            setFile(null);
            setMessage(null);
          }}
          onStart={startMilestoneTask}
          onSubmit={submitRequirement}
          onOpenSigned={openSubmissionVersion}
        />
      )}
    </div>
  );
}

function TaskDetails({
  task,
  project,
  members,
  adviser,
  file,
  note,
  message,
  submitting,
  starting,
  onFile,
  onNote,
  onClose,
  onStart,
  onSubmit,
  onOpenSigned,
}: any) {
  const [submissionMode, setSubmissionMode] = useState<"choose" | "upload">(
    "choose",
  );
  const currentSequence =
    project?.workflowInstance?.currentStage?.sequence || 0;
  const status =
    task.submission?.status ||
    (task.stage.sequence < currentSequence
      ? "COMPLETED"
      : task.locked
        ? "LOCKED"
        : "IN_PROGRESS");
  const canSubmit =
    !task.locked && !task.milestoneOnly && status !== "APPROVED";
  const canCreateInDocuments = /DOC|DOCX|HTML|TXT/i.test(
    task.allowedFileTypes || "",
  );
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white dark:bg-[#101b2b] p-6 shadow-2xl sm:p-8 animate-in slide-in-from-right duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-[#EEF2F6] dark:border-white/10 pb-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#C9A227]">
              Milestone {task.stage.sequence}
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#17212B] dark:text-white">
              {task.title}
            </h2>
            <div className="mt-2">
              <Tag
                variant={
                  status === "APPROVED" || status === "COMPLETED"
                    ? "success"
                    : status === "REVISION_REQUIRED" || status === "REJECTED"
                      ? "warn"
                      : "info"
                }
              >
                {status.replace(/_/g, " ")}
              </Tag>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close task details"
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
          >
            <i className="ti ti-x text-xl" />
          </button>
        </div>
        <section className="mt-6">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0B3A53] dark:text-[#C9A227]">
            Professor instructions
          </h3>
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 dark:bg-white/5 p-4 text-xs sm:text-sm leading-6 text-slate-700 dark:text-slate-200 border border-[#EEF2F6] dark:border-white/5">
            {task.instructions ||
              "Complete this milestone according to your professor's instructions."}
          </p>
        </section>
        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          <Info
            icon="ti-calendar"
            label="Deadline"
            value={
              task.dueDays != null
                ? `Within ${task.dueDays} days`
                : "Follow the milestone schedule"
            }
          />
          <Info
            icon="ti-file-type-pdf"
            label="Submission"
            value={
              task.requiresDocument === false
                ? "No document required"
                : task.milestoneOnly
                  ? "PDF, DOCX after starting"
                  : task.allowedFileTypes
            }
          />
          <Info
            icon="ti-user-shield"
            label="Adviser"
            value={adviser ? memberName(adviser) : "No adviser assigned"}
          />
          <Info
            icon="ti-users"
            label="Shared task"
            value={`${members.length || 1} active group member${members.length === 1 ? "" : "s"}`}
          />
        </section>
        <section className="mt-6">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0B3A53] dark:text-[#C9A227]">
            Research group
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.length ? (
              members.map((member: any) => (
                <span
                  key={member.id}
                  className="rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200"
                >
                  <i className="ti ti-user mr-1 text-[#0B3A53] dark:text-[#C9A227]" />
                  {memberName(member)}
                  {member.projectRole === "LEADER" ? " · Leader" : ""}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500">
                Individual research project
              </span>
            )}
          </div>
        </section>
        {task.submission && (
          <section className="mt-6 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/20 p-4">
            <h3 className="text-sm font-extrabold text-[#0B3A53] dark:text-white">
              Current group submission
            </h3>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              <strong>Submitted by:</strong>{" "}
              {userName(task.submission.submittedByUser)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {new Date(task.submission.submittedAt).toLocaleString()} ·{" "}
              {task.submission.document?.title || "Submitted document"}
            </p>
            {(() => {
              const latestVersion = task.submission.document?.versions?.[0];
              const signature = latestVersion?.signedSignature;
              if (!signature) return null;
              return <div className="mt-3 flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-extrabold text-emerald-800 dark:text-emerald-200"><i className="ti ti-signature mr-1" />Adviser-signed copy available</p><p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">Verification: {signature.verificationCode}</p></div><button onClick={() => onOpenSigned(latestVersion)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">View signed PDF</button></div>;
            })()}
            {task.submission.note && (
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white dark:bg-white/5 p-3 text-xs text-slate-600 dark:text-slate-300">
                {task.submission.note}
              </p>
            )}
            {task.submission.reviewNote && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
                <strong>Professor feedback:</strong>{" "}
                {task.submission.reviewNote}
              </p>
            )}
          </section>
        )}
        {task.locked ? (
          <Notice text="This milestone is visible to your group, but submission opens when the preceding milestone is completed." />
        ) : task.milestoneOnly ? (
          <section className="mt-6 rounded-2xl border border-[#C9A227]/40 bg-[#FDF8E8] dark:bg-amber-950/20 p-5">
            <h3 className="text-base font-extrabold text-[#0B3A53] dark:text-white">
              Ready to work on this milestone?
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              {task.requiresDocument === false
                ? "This milestone does not require a file. Start it to review and follow the professor's instructions."
                : "Start the task to choose between creating a document in the workspace or uploading a finished file."}
            </p>
            {message && (
              <p className="mt-3 text-xs font-semibold text-rose-600">
                {message}
              </p>
            )}
            <button
              onClick={onStart}
              disabled={starting}
              className="mt-4 w-full rounded-xl bg-[#C9A227] hover:bg-[#B38E1B] px-5 py-3 text-sm font-extrabold text-[#072A3D] shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              <i
                className={`ti ${starting ? "ti-loader-2 animate-spin" : "ti-player-play"} mr-2`}
              />
              {starting ? "Starting task…" : "Start Task"}
            </button>
          </section>
        ) : task.noDocumentRequired ? (
          <Notice text="Task started. No document is required for this milestone. Follow the professor’s instructions; completion is handled through the milestone workflow." />
        ) : status === "APPROVED" ? (
          <Notice text="This shared group requirement has been approved. No further submission is needed." />
        ) : submissionMode === "choose" ? (
          <section className="mt-6 border-t border-[#EEF2F6] dark:border-white/10 pt-6">
            <h3 className="text-base font-extrabold text-[#17212B] dark:text-white">
              How would you like to prepare the submission?
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Only methods allowed by the professor’s file requirement are
              shown.
            </p>
            {message && (
              <p className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {message}
              </p>
            )}
            <div
              className={`mt-4 grid gap-3 ${canCreateInDocuments ? "sm:grid-cols-2" : ""}`}
            >
              {canCreateInDocuments && (
                <button
                  onClick={() => {
                    window.location.href = `/student/documents?milestoneId=${task.stage.id}&taskId=${task.id}`;
                  }}
                  className="rounded-xl border-2 border-[#0B3A53] bg-white dark:bg-white/5 p-5 text-left transition hover:bg-[#EAF3F7] dark:hover:bg-white/10 cursor-pointer"
                >
                  <i className="ti ti-file-text text-2xl text-[#0B3A53] dark:text-[#C9A227]" />
                  <span className="mt-3 block font-extrabold text-[#17212B] dark:text-white">
                    Create in Documents
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Write in the workspace and submit directly to this
                    milestone.
                  </span>
                </button>
              )}
              <button
                onClick={() => setSubmissionMode("upload")}
                className="rounded-xl border-2 border-[#C9A227] bg-[#FDF8E8] dark:bg-amber-950/20 p-5 text-left transition hover:bg-[#F9ECC4] dark:hover:bg-amber-900/30 cursor-pointer"
              >
                <i className="ti ti-upload text-2xl text-[#C9A227]" />
                <span className="mt-3 block font-extrabold text-[#17212B] dark:text-white">
                  Upload a file
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Submit an existing {task.allowedFileTypes} file from your
                  device.
                </span>
              </button>
            </div>
          </section>
        ) : (
          <section className="mt-6 border-t border-[#EEF2F6] dark:border-white/10 pt-6">
            <button
              onClick={() => setSubmissionMode("choose")}
              className="mb-4 text-xs font-extrabold text-[#0B3A53] dark:text-[#C9A227] cursor-pointer"
            >
              <i className="ti ti-arrow-left mr-1" />
              Choose another method
            </button>
            <h3 className="text-sm font-extrabold text-[#17212B] dark:text-white">
              {task.submission
                ? "Resubmit group requirement"
                : "Upload group requirement"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Submitting records your name and updates the shared group status.
            </p>
            <label className="mt-4 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20 p-6 text-center hover:border-[#0B3A53] dark:hover:border-[#C9A227]">
              <i className="ti ti-upload text-3xl text-[#0B3A53] dark:text-[#C9A227]" />
              <span className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                {file?.name || "Choose requirement file"}
              </span>
              <span className="mt-1 text-xs text-slate-400">
                Accepted: {task.allowedFileTypes}
              </span>
              <input
                type="file"
                className="hidden"
                onChange={(event) => onFile(event.target.files?.[0] || null)}
              />
            </label>
            <textarea
              value={note}
              onChange={(event) => onNote(event.target.value)}
              rows={3}
              placeholder="Optional note for the professor and adviser"
              className="mt-4 w-full resize-none rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-[#0B1726] p-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[#0B3A53]"
            />
            {message && (
              <p className="mt-3 text-xs font-semibold text-rose-600">
                {message}
              </p>
            )}
            <button
              onClick={onSubmit}
              disabled={!file || submitting || !canSubmit}
              className="mt-4 w-full rounded-xl bg-[#0B3A53] hover:bg-[#072A3D] px-5 py-3 text-sm font-extrabold text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {submitting
                ? "Submitting…"
                : task.submission
                  ? "Resubmit for group"
                  : "Submit for group"}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-[#DDE3E8] dark:border-white/10 bg-white dark:bg-[#101b2b] p-5 shadow-xs transition hover:shadow-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B3A53]/10 text-[#0B3A53] dark:text-[#C9A227]">
        <i className={`ti ${icon} text-xl`} />
      </span>
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="text-xl sm:text-2xl font-black text-[#17212B] dark:text-white mt-0.5 tracking-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-[#DDE3E8] dark:border-white/10 bg-white/60 dark:bg-[#101b2b]/60 p-10 text-center flex flex-col items-center justify-center gap-2">
      <i className="ti ti-checklist text-4xl text-slate-300 dark:text-slate-600 mb-1" />
      <p className="font-extrabold text-[#17212B] dark:text-white">
        No milestones deployed yet
      </p>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm">
        {text}
      </p>
    </div>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#EEF2F6] dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-3.5">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
        <i className={`ti ${icon} mr-1 text-[#0B3A53] dark:text-[#C9A227]`} />
        {label}
      </p>
      <p className="mt-1 text-xs sm:text-sm font-bold text-[#17212B] dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="mt-6 rounded-xl border border-[#EEF2F6] dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-4 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
      <i className="ti ti-info-circle text-base text-[#0B3A53] dark:text-[#C9A227] shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}
