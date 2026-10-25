"use client";

import { WorkflowAccessInbox } from "@/components/workflow/WorkflowAccessInbox";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { formatTaskDeadline } from "@/lib/workflow-deadlines";
import { Tag } from "@/components/ui/Tag";
import { StatCard } from "@/components/ui/StatCard";
import { TablePageSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { WorkflowResourcesCard } from "@/components/workflow/WorkflowResourcesCard";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useActiveProject,
  useActiveProjectContext,
} from "@/providers/active-project-provider";
import {
  allowedUploadExtensions,
  buildDocumentSubmissionRequest,
  directUploadFileTypes,
  resolveStableSubmissionKey,
  submissionOptionKey,
  submissionOptionSummary,
  type StableSubmissionKey,
  type TaskSubmissionOption,
  type TaskSubmissionOptionsResponse,
  uploadFileCompatibility,
  uploadSubmissionSummary,
} from "@/lib/task-submission";
import {
  legacyTaskDetailsHref,
  studentTaskDetailsHref,
  studentTasksHref,
} from "@/lib/student-task-navigation";

const memberName = (member: any) =>
  `${member?.user?.firstName || ""} ${member?.user?.lastName || ""}`.trim();
const userName = (user: any) =>
  `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Group member";
const EMPTY_SUBMISSION_OPTIONS: TaskSubmissionOption[] = [];

export default function ResearchTasksPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { taskId: routeTaskId } = useParams<{ taskId: string }>();
  const [searchParams] = useSearchParams();
  const { activeProjectId: sharedProjectId } = useActiveProjectContext();
  const legacyTaskId = searchParams.get("taskId");
  const requestedTaskId = routeTaskId || legacyTaskId;
  const [file, setFile] = useState<File | null>(null);
  const [submissionKey, setSubmissionKey] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlightRef = useRef(false);
  const preparedTaskIdRef = useRef<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [startedTaskOverride, setStartedTaskOverride] = useState<any | null>(
    null,
  );
  const [workflowCode, setWorkflowCode] = useState("");
  const [activeSection, setActiveSection] = useState<
    "requirements" | "resources"
  >("requirements");

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["student", "workflow-tasks", sharedProjectId],
    queryFn: async () => {
      const [list, enrollmentList] = await Promise.all([
        apiClient.get<{ projects: any[] }>("/api/research"),
        apiClient.get<{ enrollments: any[]; removedWorkflowIds?: string[] }>("/api/workflows/enrollments/me"),
      ]);
      const projects = list.projects || [];
      const project = sharedProjectId
        ? projects.find((candidate: any) => candidate.id === sharedProjectId)
        : projects.length === 1
          ? projects[0]
          : undefined;
      const enrollments = enrollmentList.enrollments || [];
      const activeEnrollment = project
        ? enrollments.find((enrollment: any) => enrollment.workflowId === project.workflowInstance?.workflowId)
        : enrollments[0];
      const stages = activeEnrollment
        ? (project ? project.workflowInstance?.workflow?.stages : activeEnrollment.workflow?.stages) || []
        : [];
      const currentSequence =
        project?.workflowInstance?.currentStage?.sequence || 0;
      const submissions = new Map(
        (project?.taskSubmissions || []).map((submission: any) => [
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
              previewOnly: !project,
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
            previewOnly: !project,
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
            previewOnly: !project,
          },
        ];
      });
      return { project, projects, tasks, enrollments, removedWorkflowIds: enrollmentList.removedWorkflowIds || [] };
    },
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });
  const projectSelection = useActiveProject(data?.projects || []);
  const projectedSelectedTask = requestedTaskId
    ? data?.tasks?.find((task: any) => task.id === requestedTaskId) || null
    : null;
  const selectedTask =
    startedTaskOverride?.id === requestedTaskId
      ? startedTaskOverride
      : projectedSelectedTask;

  const workflowId = data?.project
    ? data.project.workflowAccessRemoved ? undefined : data.project.workflowInstance?.workflowId
    : data?.enrollments?.[0]?.workflowId;
  const { data: workflowResources } = useQuery({
    queryKey: ["workflow-resources", workflowId],
    queryFn: () =>
      apiClient.get<{ resources: any[]; canManage: boolean }>(
        `/api/workflows/${workflowId}/resources`,
      ),
    enabled: Boolean(workflowId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (routeTaskId || !legacyTaskId) return;
    const destination = legacyTaskDetailsHref(
      `?${searchParams.toString()}`,
    );
    if (destination) navigate(destination, { replace: true });
  }, [legacyTaskId, navigate, routeTaskId, searchParams]);

  useEffect(() => {
    if (!selectedTask || preparedTaskIdRef.current === selectedTask.id) return;
    preparedTaskIdRef.current = selectedTask.id;
    setFile(null);
    setSubmissionKey(crypto.randomUUID());
    setNote(selectedTask.submission?.note || "");
    setMessage(null);
  }, [selectedTask]);

  const openTask = (task: any) => {
    setStartedTaskOverride(null);
    navigate(studentTaskDetailsHref(task.id, data?.project?.id));
  };

  const selectSubmissionFile = (nextFile: File | null) => {
    const currentFingerprint = file
      ? `${file.name}:${file.size}:${file.lastModified}`
      : null;
    const nextFingerprint = nextFile
      ? `${nextFile.name}:${nextFile.size}:${nextFile.lastModified}`
      : null;
    if (currentFingerprint !== nextFingerprint) {
      setSubmissionKey(crypto.randomUUID());
    }
    setFile(nextFile);
  };

  const finishSubmission = async (successMessage: string) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["student", "workflow-tasks"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["task-submission-options"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["student-manuscript-workflow"],
      }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ]);
    setFile(null);
    setNote("");
    setMessage(successMessage);
  };

  const submitUploadedRequirement = async () => {
    if (!selectedTask || !data?.project || !file || selectedTask.milestoneOnly)
      throw new Error("Choose a file before submitting.");
    const allowed = String(selectedTask.allowedFileTypes || "PDF,DOCX")
      .split(",")
      .map((type: string) => type.trim().toLowerCase());
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowed.includes(extension))
      throw new Error(
        `Choose one of the allowed formats: ${selectedTask.allowedFileTypes}.`,
      );
    if (!submissionKey)
      throw new Error(
        "The submission session expired. Close and reopen the task.",
      );
    if (submissionInFlightRef.current)
      throw new Error("This submission is already being processed.");
    submissionInFlightRef.current = true;
    setSubmitting(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", `${selectedTask.title} - ${data.project.title}`);
      formData.append("researchId", data.project.id);
      formData.append("idempotencyKey", submissionKey || crypto.randomUUID());
      if (note.trim()) formData.append("note", note.trim());
      await apiClient.upload(
        `/api/workflows/tasks/${selectedTask.id}/submissions/upload`,
        formData,
      );
      await finishSubmission("Requirement submitted for the entire group.");
    } catch (error: any) {
      setMessage(error?.message || "Unable to submit this requirement.");
      throw error;
    } finally {
      submissionInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const submitDocumentRequirement = async (
    option: TaskSubmissionOption,
    idempotencyKey: string,
  ) => {
    if (!selectedTask || !data?.project || selectedTask.milestoneOnly)
      throw new Error("The task submission context is unavailable.");
    if (submissionInFlightRef.current)
      throw new Error("This submission is already being processed.");
    const request = buildDocumentSubmissionRequest(option, {
      taskId: selectedTask.id,
      researchId: data.project.id,
      milestoneId: selectedTask.stage.id,
      idempotencyKey,
      note: note.trim() || undefined,
    });
    submissionInFlightRef.current = true;
    setSubmitting(true);
    setMessage(null);
    try {
      await apiClient.post(request.endpoint, request.body);
      await finishSubmission(
        option.kind === "GOOGLE_DOC_PDF_SNAPSHOT"
          ? "Google document frozen and submitted for faculty review."
          : "Exact document version submitted for faculty review.",
      );
    } catch (error: any) {
      setMessage(error?.message || "Unable to submit this document.");
      throw error;
    } finally {
      submissionInFlightRef.current = false;
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
      setStartedTaskOverride(response.task ? null : startedTask);
      await queryClient.invalidateQueries({
        queryKey: ["student", "workflow-tasks"],
      });
      navigate(studentTaskDetailsHref(startedTask.id, data.project.id), {
        replace: true,
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
    if (!version?.googleDriveFileId)
      return void setMessage("The stored signed PDF is unavailable.");
    try {
      const token = localStorage.getItem("advisio_token");
      const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const response = await fetch(
        `${apiBase}/api/documents/files/${version.googleDriveFileId}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );
      if (!response.ok) throw new Error("Unable to open the signed PDF.");
      const url = URL.createObjectURL(await response.blob());
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error: any) {
      setMessage(error.message || "Unable to open the signed PDF.");
    }
  };

  if (isPending) return <TablePageSkeleton />;
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
  const activeEnrollment = project
    ? enrollments.find((enrollment: any) => enrollment.workflowId === project.workflowInstance?.workflowId)
    : enrollments[0];
  const workflowAccessRemoved = project?.workflowAccessRemoved || (!activeEnrollment && !!data?.removedWorkflowIds?.length);
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

  if (requestedTaskId && workflowAccessRemoved) {
    return <TaskDetailsUnavailable title="Workflow access removed" explanation="Your access to this workflow was removed by the professor. Contact your professor if this was a mistake." backHref={studentTasksHref(project?.id)} />;
  }

  if (requestedTaskId) {
    if (!project) {
      const explanation = projectSelection.invalidRequestedProjectId
        ? "That project is unavailable or you do not have access to it."
        : "Select an authorized research project before opening this milestone.";
      return (
        <TaskDetailsUnavailable
          title="Milestone unavailable"
          explanation={explanation}
          backHref={studentTasksHref(project?.id)}
        />
      );
    }
    if (!selectedTask) {
      return (
        <TaskDetailsUnavailable
          title="Milestone not found"
          explanation="This task is not part of the selected project's assigned workflow."
          backHref={studentTasksHref(project.id)}
        />
      );
    }
    return (
      <MilestoneDetailsWorkspace
        task={selectedTask}
        project={project}
        members={activeMembers}
        adviser={adviser}
        file={file}
        note={note}
        message={message}
        submitting={submitting}
        starting={starting}
        onFile={selectSubmissionFile}
        onNote={setNote}
        onStart={startMilestoneTask}
        onSubmitUpload={submitUploadedRequirement}
        onSubmitDocument={submitDocumentRequirement}
        onOpenSigned={openSubmissionVersion}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <WorkflowAccessInbox/>
      {message && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-3.5 text-sm font-semibold text-blue-900 dark:text-blue-200">
          {message}
        </div>
      )}

      {workflowAccessRemoved && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Your access to this workflow was removed by the professor. Contact your professor if this was a mistake.</div>}

      {acceptedWorkflowName && activeEnrollment && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          <i className="ti ti-circle-check mt-0.5 text-lg" />
          <div>
            <strong className="block">Workflow invitation accepted</strong>
            <span>
              You joined {acceptedWorkflowName}. Its milestones are now
              available in Tasks & Requirements.
            </span>
          </div>
        </div>
      )}

      {invitationDeclined && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <i className="ti ti-info-circle mt-0.5 text-lg" />
          <span>
            The workflow invitation was not accepted. You can use the invitation
            link again while it remains valid.
          </span>
        </div>
      )}

      {(data?.projects?.length || 0) > 1 && (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card-soft)] sm:p-5">
          <label
            htmlFor="task-project"
            className="mb-2 block text-sm font-extrabold uppercase tracking-wider text-slate-500"
          >
            Research project
          </label>
          <select
            id="task-project"
            value={project?.id || ""}
            onChange={(event) => {
              setStartedTaskOverride(null);
              const projectId = event.target.value;
              projectSelection.selectProject(projectId || null);
            }}
            className="h-11 w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-base font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">Select a project</option>
            {data.projects.map((candidate: any) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.groupName || candidate.title}
              </option>
            ))}
          </select>
          {!project && (
            <p className="mt-2 text-base text-slate-500">
              {projectSelection.invalidRequestedProjectId
                ? "That project is unavailable or you do not have access to it. Choose an authorized project."
                : "Choose a project to view its requirements and submission history."}
            </p>
          )}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                Active workflow
              </p>
              {activeEnrollment ? (
                <>
                  <h2 className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">
                    {activeEnrollment.workflow.name}
                  </h2>
                  <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                    {activeEnrollment.workflow.creator
                      ? `Professor: ${`${activeEnrollment.workflow.creator.firstName || ""} ${activeEnrollment.workflow.creator.lastName || ""}`.trim() || activeEnrollment.workflow.creator.email}`
                      : "Professor-created research workflow"}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">
                    {workflowAccessRemoved ? "Workflow access removed" : "No workflow joined yet"}
                  </h2>
                  <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                    {workflowAccessRemoved ? "Contact your professor to discuss access." : "Use the code or invitation link provided by your professor."}
                  </p>
                </>
              )}
            </div>
            <Tag variant={activeEnrollment ? "success" : "info"}>
              {activeEnrollment ? "Active" : workflowAccessRemoved ? "Removed" : "Not joined"}
            </Tag>
          </div>
          {activeEnrollment && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Info
                icon="ti-list-check"
                label="Milestones"
                value={`${activeEnrollment.workflow.stages?.length || 0} stages`}
              />
              <Info
                icon="ti-calendar-check"
                label="Joined"
                value={new Date(activeEnrollment.joinedAt).toLocaleDateString()}
              />
              <Info
                icon="ti-progress"
                label="Current status"
                value={
                  project?.workflowInstance?.currentStage?.name ||
                  "Awaiting project registration"
                }
              />
            </div>
          )}
          {enrollments.length > 1 && (
            <p className="mt-4 text-base font-semibold text-slate-500">
              You have joined {enrollments.length} workflows. The workflow
              linked to your current project is shown first.
            </p>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const code = workflowCode.trim().toUpperCase();
            if (code)
              navigate(`/student/workflows/join/${encodeURIComponent(code)}`);
          }}
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            Join a workflow
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">
            Enter professor invitation code
          </h2>
          <p className="mt-1 text-base leading-5 text-slate-500">
            You will review the invitation before deciding to accept or reject
            it.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={workflowCode}
              onChange={(event) =>
                setWorkflowCode(event.target.value.toUpperCase())
              }
              maxLength={32}
              placeholder="Invitation code"
              className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 font-mono text-base font-bold uppercase text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
            />
            <button
              type="submit"
              disabled={!workflowCode.trim()}
              className="rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Review
            </button>
          </div>
        </form>
      </section>

      <nav
        role="tablist"
        aria-label="Tasks and workflow resources"
        className="flex w-full gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1.5 sm:w-fit"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === "requirements"}
          onClick={() => setActiveSection("requirements")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${activeSection === "requirements" ? "bg-[var(--color-surface)] text-[var(--color-primary)] font-semibold shadow-xs" : "text-slate-500 hover:text-[#0B3A53] dark:text-slate-400 dark:hover:text-white"}`}
        >
          <i className="ti ti-checklist" /> Requirements
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-white/10">
            {tasks.length}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === "resources"}
          onClick={() => setActiveSection("resources")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${activeSection === "resources" ? "bg-[var(--color-surface)] text-[var(--color-primary)] font-semibold shadow-xs" : "text-slate-500 hover:text-[#0B3A53] dark:text-slate-400 dark:hover:text-white"}`}
        >
          <i className="ti ti-books" /> Guides &amp; Templates
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-white/10">
            {workflowResources?.resources?.length || 0}
          </span>
        </button>
      </nav>

      {activeSection === "requirements" ? (
        <>
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

          {!tasks.length ? (
            <Empty
              text={
                activeEnrollment
                  ? "Your professor has not added milestones to this workflow yet."
                  : "Join a professor workflow, then register a project to receive its requirements."
              }
            />
          ) : (
            <section className="space-y-3.5">
              {!project && (
                <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                  <i className="ti ti-eye mt-0.5 text-lg" />
                  <div>
                    <strong className="block">Milestone preview</strong>
                    <span>
                      You can review the professor&apos;s current milestones
                      now. Register or join a research project before starting
                      tasks or submitting files.
                    </span>
                  </div>
                </div>
              )}
              {tasks.map((task: any) => {
                const status = task.previewOnly
                  ? "AWAITING_PROJECT"
                  : task.submission?.status ||
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
                    className={`group cursor-pointer rounded-2xl border p-4 sm:p-5 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--college-focus-ring)] ${
                      status === "IN_PROGRESS"
                        ? "border-[var(--color-primary)] bg-[var(--color-surface)] shadow-xs ring-1 ring-[var(--college-focus-ring)]"
                        : status === "LOCKED"
                          ? "border-[var(--color-border)] bg-[var(--color-surface-subtle)] opacity-80"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card-soft)] hover:border-[var(--color-primary)]"
                    }`}
                  >
                    <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                            {task.stage.topic?.title || "Ungrouped milestones"}{" "}
                            · Stage {task.stage.sequence}
                          </p>
                          {status === "IN_PROGRESS" && (
                            <span className="inline-flex items-center rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
                              Active Milestone
                            </span>
                          )}
                          {status === "LOCKED" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-500">
                              <i className="ti ti-lock text-xs" /> Locked
                            </span>
                          )}
                        </div>
                        <h2 className="mt-1 text-lg font-semibold text-[var(--color-text-primary)] leading-snug">
                          {task.title}
                        </h2>
                        <p className="mt-1 line-clamp-2 text-base text-[var(--color-text-secondary)] leading-relaxed">
                          {task.instructions}
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
                          <span className="rounded-lg bg-[var(--color-surface-muted)] px-2.5 py-1">
                            {formatTaskDeadline(task)}
                          </span>
                          {!task.milestoneOnly && (
                            <span className="rounded-lg bg-[var(--color-surface-muted)] px-2.5 py-1">
                              {task.allowedFileTypes}
                            </span>
                          )}
                          <span className="rounded-lg bg-[var(--color-primary-light)] px-2.5 py-1 text-[var(--color-primary)]">
                            Shared with {activeMembers.length || 1} member
                            {activeMembers.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        {task.submission && (
                          <p className="mt-2.5 text-base font-medium text-[var(--color-text-secondary)]">
                            Submitted by:{" "}
                            <span className="text-[var(--color-primary)] font-semibold">
                              {userName(task.submission.submittedByUser)}
                            </span>{" "}
                            ·{" "}
                            {new Date(
                              task.submission.submittedAt,
                            ).toLocaleString()}
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
                        <span className="text-xs font-semibold text-[var(--color-primary)] group-hover:underline inline-flex items-center gap-0.5">
                          View details
                          <i className="ti ti-chevron-right text-xs transition group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      ) : (
        <WorkflowResourcesCard workflowId={workflowId} />
      )}
    </div>
  );
}

function MilestoneDetailsWorkspace({
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
  onStart,
  onSubmitUpload,
  onSubmitDocument,
  onOpenSigned,
}: any) {
  const [submissionMode, setSubmissionMode] = useState<
    "choose" | "documents" | "upload"
  >("choose");
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(
    null,
  );
  const [documentSubmissionKey, setDocumentSubmissionKey] =
    useState<StableSubmissionKey | null>(null);
  const [confirmation, setConfirmation] = useState<
    "documents" | "upload" | null
  >(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    setSubmissionMode("choose");
    setSelectedOptionKey(null);
    setDocumentSubmissionKey(null);
    setConfirmation(null);
    setSubmissionError(null);
  }, [task.id]);

  const currentSequence =
    project?.workflowInstance?.currentStage?.sequence || 0;
  const status = task.previewOnly
    ? "AWAITING_PROJECT"
    : task.submission?.status ||
      (task.stage.sequence < currentSequence
        ? "COMPLETED"
        : task.locked
          ? "LOCKED"
          : "IN_PROGRESS");
  const canLoadSubmissionOptions =
    Boolean(project) &&
    !task.previewOnly &&
    !task.locked &&
    !task.milestoneOnly &&
    !task.noDocumentRequired;
  const submissionOptionsQuery = useQuery({
    queryKey: ["task-submission-options", project?.id, task.id],
    queryFn: () =>
      apiClient.get<TaskSubmissionOptionsResponse>(
        `/api/workflows/tasks/${task.id}/submission-options?researchId=${encodeURIComponent(project.id)}`,
      ),
    enabled: canLoadSubmissionOptions,
    retry: 1,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const submissionOptions =
    submissionOptionsQuery.data?.options || EMPTY_SUBMISSION_OPTIONS;
  const selectedOption = submissionOptions.find(
    (option) => submissionOptionKey(option) === selectedOptionKey,
  );
  const canSubmit =
    canLoadSubmissionOptions &&
    submissionOptionsQuery.data?.availability.canSubmit === true;
  const canCreateInDocuments = /DOC|DOCX|HTML|TXT/i.test(
    task.allowedFileTypes || "",
  );
  const allowedFileTypes =
    submissionOptionsQuery.data?.task.allowedFileTypes || [];
  const uploadFileTypes = directUploadFileTypes(allowedFileTypes);
  const uploadAccept = allowedUploadExtensions(uploadFileTypes).join(",");
  const canUpload = canSubmit && uploadFileTypes.length > 0;
  const workflowProjectionQuery = useQuery({
    queryKey: ["student-manuscript-workflow", project?.id],
    queryFn: () =>
      apiClient.get<{ milestones: any[]; activity: any[] }>(
        `/api/research/${project.id}/manuscript-workflow`,
      ),
    enabled: Boolean(project?.id),
  });
  const milestoneProgress = workflowProjectionQuery.data?.milestones?.find(
    (milestone: any) => milestone.id === task.stage.id,
  );

  useEffect(() => {
    if (
      selectedOptionKey &&
      !submissionOptions.some(
        (option) => submissionOptionKey(option) === selectedOptionKey,
      )
    ) {
      setSelectedOptionKey(null);
      setDocumentSubmissionKey(null);
    }
  }, [selectedOptionKey, submissionOptions]);

  const chooseDocumentOption = (option: TaskSubmissionOption) => {
    const scope = submissionOptionKey(option);
    setSelectedOptionKey(scope);
    setDocumentSubmissionKey((current) =>
      resolveStableSubmissionKey(current, scope),
    );
    setSubmissionError(null);
  };

  const confirmDocumentSubmission = async () => {
    if (!selectedOption || !documentSubmissionKey || submitting) return;
    setSubmissionError(null);
    try {
      await onSubmitDocument(selectedOption, documentSubmissionKey.value);
    } catch (error: any) {
      setSubmissionError(error?.message || "Unable to submit this document.");
    }
  };

  const openUploadConfirmation = () => {
    if (!file) return;
    const compatibility = uploadFileCompatibility(file.name, uploadFileTypes);
    if (!compatibility.compatible) {
      setSubmissionError(compatibility.message);
      return;
    }
    setSubmissionError(null);
    setConfirmation("upload");
  };

  const confirmUploadSubmission = async () => {
    if (!file || submitting) return;
    setSubmissionError(null);
    try {
      await onSubmitUpload();
    } catch (error: any) {
      setSubmissionError(error?.message || "Unable to submit this file.");
    }
  };
  return (
    <div className="mx-auto w-full max-w-[1360px] p-4 sm:p-6 lg:p-8">
      <Link
        to={studentTasksHref(project.id)}
        className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
      >
        <i className="ti ti-arrow-left" aria-hidden="true" />
        Back to Tasks
      </Link>
      <header className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
        <nav aria-label="Breadcrumb" className="text-xs font-semibold text-[var(--color-text-secondary)]">
          <Link to={studentTasksHref(project.id)} className="hover:text-[var(--color-primary)]">
            Tasks &amp; Milestones
          </Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span aria-current="page">{task.title}</span>
        </nav>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-primary)]">
              Milestone {task.stage.sequence}
            </p>
            <h1
              id="task-details-title"
              className="mt-1 break-words text-2xl font-bold leading-tight text-[var(--color-text-primary)] sm:text-3xl"
            >
              {task.title}
            </h1>
            <p className="mt-2 text-base text-[var(--color-text-secondary)]">
              {task.stage.topic?.title ||
                project.workflowInstance?.workflow?.name ||
                "Research workflow"}
            </p>
          </div>
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
      </header>

      {message && (
        <div
          className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-sm font-semibold text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
          role="status"
        >
          {message}
        </div>
      )}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,2.1fr)_minmax(280px,.9fr)]">
        <main className="min-w-0 space-y-5">
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            Professor instructions
          </h2>
          {task.stage.description && task.stage.description !== task.instructions && (
            <p className="mt-3 whitespace-pre-wrap text-base leading-6 text-[var(--color-text-secondary)]">
              {task.stage.description}
            </p>
          )}
          {task.instructions ? (
            <p className="mt-3 whitespace-pre-wrap border-t border-[var(--color-border)] pt-4 text-base leading-6 text-[var(--color-text-primary)]">
              {task.instructions}
            </p>
          ) : (
            <p className="mt-3 text-base text-[var(--color-text-secondary)]">
              No additional instructions were provided for this milestone.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
            <span className="rounded-lg bg-[var(--color-surface-muted)] px-2.5 py-1.5">
              {task.requiresDocument === false
                ? "No document required"
                : `Accepted: ${task.milestoneOnly ? "PDF, DOCX after starting" : task.allowedFileTypes}`}
            </span>
            {task.isRequired && (
              <span className="rounded-lg bg-[var(--color-primary-light)] px-2.5 py-1.5 text-[var(--color-primary)]">
                Required
              </span>
            )}
          </div>
        </section>
        <StudentMilestoneAttachments stageId={task.stage.id} />
        {task.submission && (
          <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 dark:border-blue-900 dark:bg-blue-950/20 sm:p-6">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              Your submission
            </h2>
            <p className="mt-2 text-base text-slate-700 dark:text-slate-200">
              <strong>Submitted by:</strong>{" "}
              {userName(task.submission.submittedByUser)}
            </p>
            <p className="mt-1 text-base text-slate-500">
              {new Date(task.submission.submittedAt).toLocaleString()} ·{" "}
              {task.submission.document?.title || "Submitted document"}
              {task.submission.documentVersion?.versionNumber
                ? ` · Version ${task.submission.documentVersion.versionNumber}`
                : ""}
            </p>
            {task.submission.documentId && task.submission.documentVersionId && (
              <Link
                to={`/student/documents?projectId=${encodeURIComponent(task.submission.researchId)}&milestoneId=${encodeURIComponent(task.stage.id)}&taskId=${encodeURIComponent(task.id)}&documentId=${encodeURIComponent(task.submission.documentId)}&versionId=${encodeURIComponent(task.submission.documentVersionId)}`}
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
              >
                <i className="ti ti-external-link" aria-hidden="true" />
                Open exact submitted version
              </Link>
            )}
            {(() => {
              const submittedVersion =
                task.submission.document?.versions?.find(
                  (version: any) =>
                    version.id === task.submission.documentVersionId,
                ) || task.submission.document?.versions?.[0];
              const signature = submittedVersion?.signedSignature;
              if (!signature) return null;
              return (
                <div className="mt-3 flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-extrabold text-emerald-800 dark:text-emerald-200">
                      <i className="ti ti-signature mr-1" />
                      Adviser-signed copy available
                    </p>
                    <p className="mt-1 text-base text-emerald-700 dark:text-emerald-300">
                      Verification: {signature.verificationCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenSigned(submittedVersion)}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white"
                  >
                    View signed PDF
                  </button>
                </div>
              );
            })()}
            {task.submission.note && (
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white dark:bg-white/5 p-3 text-base text-slate-600 dark:text-slate-300">
                {task.submission.note}
              </p>
            )}
            {task.submission.attempts?.length > 0 && (
              <div className="mt-4 border-t border-blue-200 pt-4 dark:border-blue-900">
                <h4 className="text-lg font-extrabold uppercase tracking-wider text-slate-500">
                  Submission history
                </h4>
                <ol className="mt-3 space-y-2">
                  {task.submission.attempts.map((attempt: any) => (
                    <li
                      key={attempt.id}
                      className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-bold text-[var(--color-text-primary)]">
                          Attempt {attempt.attemptNumber}
                          {attempt.documentVersion
                            ? ` · Version ${attempt.documentVersion.versionNumber}`
                            : ""}
                        </p>
                        <p className="mt-0.5 text-slate-500">
                          {userName(attempt.submittedByUser)} ·{" "}
                          {new Date(attempt.submittedAt).toLocaleString()}
                        </p>
                        <Link
                          to={`/student/documents?projectId=${encodeURIComponent(task.submission.researchId)}&milestoneId=${encodeURIComponent(task.stage.id)}&taskId=${encodeURIComponent(task.id)}&documentId=${encodeURIComponent(attempt.documentId)}&versionId=${encodeURIComponent(attempt.documentVersionId)}`}
                          className="mt-1 inline-block font-bold text-[var(--color-primary)] hover:underline"
                        >
                          Open exact submitted version
                        </Link>
                      </div>
                      <Tag
                        variant={
                          attempt.status === "APPROVED"
                            ? "success"
                            : attempt.status === "REVISION_REQUIRED" ||
                                attempt.status === "REJECTED"
                              ? "warn"
                              : "info"
                        }
                      >
                        {attempt.status.replace(/_/g, " ")}
                      </Tag>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        )}
        {!task.submission && (
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              Submission history
            </h2>
            <p className="mt-3 text-base text-[var(--color-text-secondary)]">
              No previous submissions. Upload your work or choose an eligible
              document when submission is available.
            </p>
          </section>
        )}
        {task.previewOnly ? (
          <Notice text="This milestone is available for review. Join or register a research project connected to this workflow before starting work or submitting files." />
        ) : task.locked ? (
          <Notice text="This milestone is visible to your group, but submission opens when the preceding milestone is completed." />
        ) : task.milestoneOnly ? (
          <section className="rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary-light)]/30 p-5">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
              Ready to work on this milestone?
            </h3>
            <p className="mt-2 text-base leading-6 text-[var(--color-text-secondary)]">
              {task.requiresDocument === false
                ? "This milestone does not require a file. Start it to review and follow the professor's instructions."
                : "Start the task to choose between creating a document in the workspace or uploading a finished file."}
            </p>
            <button
              onClick={onStart}
              disabled={starting}
              className="mt-4 w-full rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-5 py-3 text-sm font-extrabold text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              <i
                className={`ti ${starting ? "ti-loader-2 animate-spin" : "ti-player-play"} mr-2`}
              />
              {starting ? "Starting task…" : "Start Task"}
            </button>
          </section>
        ) : task.noDocumentRequired ? (
          <Notice text="Task started. No document is required for this milestone. Follow the professor’s instructions; completion is handled through the milestone workflow." />
        ) : submissionOptionsQuery.isPending ? (
          <section
            className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]"
            aria-live="polite"
          >
            <i className="ti ti-loader-2 animate-spin text-lg text-[var(--color-primary)]" />
            Checking the latest submission availability and eligible documents…
          </section>
        ) : submissionOptionsQuery.isError ? (
          <section
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
            role="alert"
          >
            <p className="font-semibold">
              {submissionOptionsQuery.error?.message ||
                "Submission options could not be loaded."}
            </p>
            <button
              type="button"
              onClick={() => submissionOptionsQuery.refetch()}
              className="mt-2 font-bold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
            >
              Retry
            </button>
          </section>
        ) : !submissionOptionsQuery.data?.availability.canSubmit ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-bold">Submission is not currently available</p>
            <p className="mt-1 text-base leading-5">
              {submissionOptionsQuery.data?.availability.reasons[0]?.message ||
                "The current task state does not allow another submission."}
            </p>
          </section>
        ) : submissionMode === "choose" ? (
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
            <h3 className="text-lg font-extrabold text-[var(--color-text-primary)]">
              How would you like to submit?
            </h3>
            <p className="mt-1 text-base leading-5 text-[var(--color-text-secondary)] sm:text-base">
              Eligibility is checked against the active project, milestone,
              required file formats, and current review state.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSubmissionMode("documents")}
                disabled={!submissionOptions.length}
                aria-describedby={
                  !submissionOptions.length ? "no-document-options" : undefined
                }
                className="rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-surface)] p-5 text-left transition hover:bg-[var(--color-primary-light)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:opacity-60"
              >
                <i className="ti ti-folders text-2xl text-[var(--color-primary)]" />
                <span className="mt-3 block font-extrabold text-[var(--color-text-primary)]">
                  Choose from Documents
                </span>
                <span className="mt-1 block text-sm leading-5 text-[var(--color-text-secondary)]">
                  {submissionOptions.length
                    ? `${submissionOptions.length} eligible document option${submissionOptions.length === 1 ? "" : "s"}`
                    : "No eligible project document is available right now."}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSubmissionMode("upload")}
                disabled={!canUpload}
                className="rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-primary-light)]/20 p-5 text-left transition hover:bg-[var(--color-primary-light)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:opacity-60"
              >
                <i className="ti ti-upload text-2xl text-[var(--color-primary)]" />
                <span className="mt-3 block font-extrabold text-[var(--color-text-primary)]">
                  Upload File
                </span>
                <span className="mt-1 block text-sm leading-5 text-[var(--color-text-secondary)]">
                  {canUpload
                    ? `Submit an existing ${uploadFileTypes.join(" or ")} file from your device.`
                    : "This task has no format supported by direct upload."}
                </span>
              </button>
            </div>
            {!submissionOptions.length && (
              <p
                id="no-document-options"
                className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 text-base leading-5 text-[var(--color-text-secondary)]"
              >
                {submissionOptionsQuery.data?.unavailableOptionReasons[0]
                  ?.message ||
                  "Upload a compatible file, or prepare a working copy in Documents."}
              </p>
            )}
            {canCreateInDocuments && (
              <Link
                to={`/student/documents?projectId=${encodeURIComponent(project.id)}&milestoneId=${encodeURIComponent(task.stage.id)}&taskId=${encodeURIComponent(task.id)}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
              >
                <i className="ti ti-external-link" />
                Create or manage a working copy in Documents
              </Link>
            )}
          </section>
        ) : submissionMode === "documents" ? (
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
            <SubmissionBackButton onClick={() => setSubmissionMode("choose")} />
            <h3 className="text-lg font-extrabold text-[var(--color-text-primary)]">
              Choose an exact document version
            </h3>
            <p className="mt-1 text-base leading-5 text-[var(--color-text-secondary)]">
              Only choices approved by the server for this project and task are
              listed. The submitted copy will be frozen for faculty review.
            </p>
            <fieldset className="mt-4 space-y-2.5">
              <legend className="sr-only">Eligible document versions</legend>
              {submissionOptions.map((option) => {
                const optionKey = submissionOptionKey(option);
                const summary = submissionOptionSummary(option);
                const selected = selectedOptionKey === optionKey;
                return (
                  <label
                    key={optionKey}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition focus-within:ring-2 focus-within:ring-[var(--college-focus-ring)] ${
                      selected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]/30"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="document-submission-option"
                      value={optionKey}
                      checked={selected}
                      onChange={() => chooseDocumentOption(option)}
                      className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[var(--color-text-primary)]">
                          {summary.title}
                        </span>
                        <span className="rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs font-bold text-[var(--color-text-secondary)]">
                          {summary.format}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                        {summary.version} · {summary.fileName}
                      </span>
                      {option.kind === "GOOGLE_DOC_PDF_SNAPSHOT" && (
                        <span className="mt-1 block text-xs font-semibold text-[var(--color-primary)]">
                          Live Google Doc · export permission is verified when
                          you submit
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <SubmissionNote value={note} onChange={onNote} />
            {submissionError && <SubmissionError message={submissionError} />}
            <Button
              className="mt-4 w-full"
              size="lg"
              onClick={() => setConfirmation("documents")}
              disabled={!selectedOption || !canSubmit || submitting}
            >
              Review document submission
            </Button>
          </section>
        ) : (
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
            <SubmissionBackButton onClick={() => setSubmissionMode("choose")} />
            <h3 className="text-lg font-extrabold text-[var(--color-text-primary)]">
              {task.submission
                ? "Upload revised group requirement"
                : "Upload group requirement"}
            </h3>
            <p className="mt-1 text-base leading-5 text-[var(--color-text-secondary)]">
              The server will verify the file again before creating the
              immutable submission record.
            </p>
            <label className="mt-4 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-[var(--color-border)] p-6 text-center transition hover:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--college-focus-ring)]">
              <i className="ti ti-upload text-3xl text-[var(--color-primary)]" />
              <span className="mt-2 break-all text-sm font-bold text-[var(--color-text-primary)]">
                {file?.name || "Choose requirement file"}
              </span>
              <span className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Accepted: {uploadFileTypes.join(", ")}
              </span>
              <input
                type="file"
                accept={uploadAccept || undefined}
                className="sr-only"
                onChange={(event) => {
                  onFile(event.target.files?.[0] || null);
                  setSubmissionError(null);
                }}
              />
            </label>
            <SubmissionNote value={note} onChange={onNote} />
            {submissionError && <SubmissionError message={submissionError} />}
            <Button
              className="mt-4 w-full"
              size="lg"
              onClick={openUploadConfirmation}
              disabled={!file || submitting || !canUpload}
            >
              Review file submission
            </Button>
          </section>
        )}

          <FacultyFeedback submission={task.submission} />
        </main>

        <MilestoneInformationPanel
          task={task}
          project={project}
          members={members}
          adviser={adviser}
          status={status}
          progress={milestoneProgress}
          progressLoading={workflowProjectionQuery.isPending}
        />
      </div>

      <SubmissionConfirmation
          mode={confirmation}
          task={task}
          file={file}
          option={selectedOption}
          submitting={submitting}
          error={submissionError}
          onClose={() => {
            if (!submitting) setConfirmation(null);
          }}
          onConfirm={
            confirmation === "documents"
              ? confirmDocumentSubmission
              : confirmUploadSubmission
          }
      />
    </div>
  );
}

type StudentMilestoneAttachment = {
  id: string;
  type: "GUIDE" | "LINK" | "PDF" | "FILE";
  title: string;
  url?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  workflowResource?: {
    id: string;
    fileName?: string | null;
  } | null;
};

function TaskDetailsUnavailable({
  title,
  explanation,
  backHref,
}: {
  title: string;
  explanation: string;
  backHref: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 lg:p-8">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-card-soft)] sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-muted)] text-[var(--color-primary)]">
          <i className="ti ti-file-alert text-2xl" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-[var(--color-text-primary)]">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-base leading-6 text-[var(--color-text-secondary)]">
          {explanation}
        </p>
        <Link
          to={backHref}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Back to Tasks
        </Link>
      </section>
    </div>
  );
}

function StudentMilestoneAttachments({ stageId }: { stageId: string }) {
  const [notice, setNotice] = useState<string | null>(null);
  const attachmentsQuery = useQuery({
    queryKey: ["milestone-attachments", stageId],
    queryFn: () =>
      apiClient.get<{ attachments: StudentMilestoneAttachment[] }>(
        `/api/workflows/stages/${stageId}/attachments`,
      ),
  });
  const attachments = attachmentsQuery.data?.attachments || [];

  const openAttachment = async (attachment: StudentMilestoneAttachment) => {
    setNotice(null);
    if (attachment.type === "LINK" && attachment.url) {
      window.open(attachment.url, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const endpoint =
        attachment.type === "GUIDE" && attachment.workflowResource
          ? `/api/workflows/resources/${attachment.workflowResource.id}/file`
          : `/api/workflows/stage-attachments/${attachment.id}/file`;
      const blob = await apiClient.file(endpoint);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error: any) {
      setNotice(error?.message || "The attachment could not be opened.");
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            Guides and attachments
          </h2>
          <p className="mt-1 text-base text-[var(--color-text-secondary)]">
            Materials attached by faculty to this milestone.
          </p>
        </div>
        {attachments.length > 0 && (
          <span className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
            {attachments.length}
          </span>
        )}
      </div>

      {attachmentsQuery.isPending ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]" role="status">
          <i className="ti ti-loader-2 animate-spin text-[var(--color-primary)]" />
          Loading milestone materials...
        </div>
      ) : attachmentsQuery.isError ? (
        <div className="mt-4 text-sm text-rose-700 dark:text-rose-300" role="alert">
          Milestone materials could not be loaded.{" "}
          <button type="button" onClick={() => attachmentsQuery.refetch()} className="font-semibold underline">
            Retry
          </button>
        </div>
      ) : attachments.length ? (
        <div className="mt-4 divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
          {attachments.map((attachment) => {
            const fileName =
              attachment.workflowResource?.fileName || attachment.fileName;
            const icon =
              attachment.type === "LINK"
                ? "ti-link"
                : attachment.type === "GUIDE"
                  ? "ti-books"
                  : attachment.type === "PDF"
                    ? "ti-file-type-pdf"
                    : "ti-paperclip";
            return (
              <button
                key={attachment.id}
                type="button"
                onClick={() => void openAttachment(attachment)}
                className="flex w-full items-center gap-3 p-3 text-left transition first:rounded-t-xl last:rounded-b-xl hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--college-focus-ring)]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                  <i className={`ti ${icon} text-xl`} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
                    {attachment.title}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-[var(--color-text-secondary)]">
                    {fileName || attachment.url || attachment.type}
                  </span>
                </span>
                <i className="ti ti-external-link shrink-0 text-[var(--color-text-secondary)]" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-base text-[var(--color-text-secondary)]">
          No guides or attachments were added to this milestone.
        </p>
      )}
      {notice && (
        <p className="mt-3 text-base font-semibold text-rose-700 dark:text-rose-300" role="alert">
          {notice}
        </p>
      )}
    </section>
  );
}

function FacultyFeedback({ submission }: { submission: any }) {
  const attemptFeedback = (submission?.attempts || []).filter(
    (attempt: any) => attempt.reviewNote,
  );
  const hasCurrentFeedback =
    submission?.reviewNote &&
    !attemptFeedback.some(
      (attempt: any) => attempt.reviewNote === submission.reviewNote,
    );

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)] sm:p-6">
      <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
        Faculty feedback
      </h2>
      {hasCurrentFeedback && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="whitespace-pre-wrap">{submission.reviewNote}</p>
          {submission.reviewedAt && (
            <p className="mt-2 text-base opacity-75">
              Reviewed {new Date(submission.reviewedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
      {attemptFeedback.length > 0 && (
        <ol className="mt-4 space-y-3">
          {attemptFeedback.map((attempt: any) => (
            <li key={attempt.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base font-semibold text-[var(--color-text-primary)]">
                  Attempt {attempt.attemptNumber}
                  {attempt.documentVersion?.versionNumber
                    ? ` · Version ${attempt.documentVersion.versionNumber}`
                    : ""}
                </p>
                <Tag variant={attempt.status === "APPROVED" ? "success" : "warn"}>
                  {attempt.status.replace(/_/g, " ")}
                </Tag>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-base leading-6 text-[var(--color-text-secondary)]">
                {attempt.reviewNote}
              </p>
              {attempt.reviewedAt && (
                <p className="mt-2 text-base text-[var(--color-text-secondary)]">
                  {new Date(attempt.reviewedAt).toLocaleString()}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      {!hasCurrentFeedback && !attemptFeedback.length && (
        <p className="mt-3 text-base text-[var(--color-text-secondary)]">
          Faculty feedback will appear here when available.
        </p>
      )}
    </section>
  );
}

function MilestoneInformationPanel({
  task,
  project,
  members,
  adviser,
  status,
  progress,
  progressLoading,
}: any) {
  const formats =
    task.requiresDocument === false
      ? "No document required"
      : task.milestoneOnly
        ? "PDF, DOCX after starting"
        : task.allowedFileTypes || "Not configured";
  const progressMeaningful =
    progress && Number(progress.totalRequirements || 0) > 0;

  return (
    <aside className="space-y-5" aria-label="Milestone information">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)]">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
          Milestone information
        </h2>
        <dl className="mt-4 divide-y divide-[var(--color-border)]">
          <InformationRow
            icon="ti-calendar-due"
            label="Deadline"
            value={
              formatTaskDeadline(task)
            }
          />
          <InformationRow icon="ti-file-type-pdf" label="Accepted formats" value={formats} />
          <InformationRow
            icon="ti-user-shield"
            label="Adviser"
            value={adviser ? memberName(adviser) : "No adviser assigned"}
          />
          <InformationRow
            icon="ti-progress-check"
            label="Workflow status"
            value={(progress?.status || status).replace(/_/g, " ")}
          />
        </dl>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)]">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
          Research group
        </h2>
        <p className="mt-1 text-base font-semibold text-[var(--color-primary)]">
          {project.groupName || project.title}
        </p>
        <p className="mt-1 text-base text-[var(--color-text-secondary)]">
          {members.length || 1} active member{members.length === 1 ? "" : "s"}
        </p>
        {members.length > 0 && (
          <ul className="mt-4 space-y-2">
            {members.map((member: any) => (
              <li key={member.id} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-surface-muted)] text-[var(--color-primary)]">
                  <i className="ti ti-user text-sm" aria-hidden="true" />
                </span>
                <span className="min-w-0 truncate">{memberName(member)}</span>
                {member.projectRole === "LEADER" && (
                  <span className="ml-auto text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                    Leader
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card-soft)]">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
          Milestone progress
        </h2>
        {progressLoading ? (
          <p className="mt-3 text-base text-[var(--color-text-secondary)]">Loading progress...</p>
        ) : progressMeaningful ? (
          <>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
              <div
                className="h-full rounded-full bg-[var(--color-primary)]"
                style={{ width: `${Math.max(0, Math.min(100, progress.completionPercent))}%` }}
              />
            </div>
            <p className="mt-2 text-base text-[var(--color-text-secondary)]">
              {progress.completedRequirements} of {progress.totalRequirements} requirements complete ({progress.completionPercent}%)
            </p>
          </>
        ) : (
          <p className="mt-3 text-base text-[var(--color-text-secondary)]">
            Progress will appear when this milestone has configured requirements.
          </p>
        )}
      </section>
    </aside>
  );
}

function InformationRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <i className={`ti ${icon} mt-0.5 text-lg text-[var(--color-primary)]`} aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
          {label}
        </dt>
        <dd className="mt-0.5 break-words text-sm font-semibold text-[var(--color-text-primary)]">
          {value}
        </dd>
      </div>
    </div>
  );
}

function SubmissionBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)]"
    >
      <i className="ti ti-arrow-left" />
      Choose another method
    </button>
  );
}

function SubmissionNote({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-4">
      <label
        htmlFor="task-submission-note"
        className="text-sm font-bold text-[var(--color-text-primary)]"
      >
        Note for faculty <span className="font-normal">(optional)</span>
      </label>
      <textarea
        id="task-submission-note"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Add context for the professor and adviser"
        className="mt-2 w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-base text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--college-focus-ring)] sm:text-base"
      />
    </div>
  );
}

function SubmissionError({ message }: { message: string }) {
  return (
    <p
      className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-base font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
      role="alert"
    >
      {message}
    </p>
  );
}

function SubmissionConfirmation({
  mode,
  task,
  file,
  option,
  submitting,
  error,
  onClose,
  onConfirm,
}: {
  mode: "documents" | "upload" | null;
  task: any;
  file: File | null;
  option?: TaskSubmissionOption;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const optionSummary = option ? submissionOptionSummary(option) : null;
  const uploadSummary = file ? uploadSubmissionSummary(file.name) : null;
  const isDocument = mode === "documents";
  return (
    <Modal
      isOpen={Boolean(mode)}
      onClose={onClose}
      title={isDocument ? "Confirm document submission" : "Confirm file upload"}
      subtitle="Review the exact item before it is sent for faculty review."
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Go back
          </Button>
          <Button
            onClick={onConfirm}
            isLoading={submitting}
            disabled={isDocument ? !option || !optionSummary : !file}
          >
            Confirm submission
          </Button>
        </>
      }
    >
      <dl className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-sm">
        <ConfirmationRow
          label="Document"
          value={
            isDocument
              ? optionSummary?.title || "—"
              : uploadSummary?.title || "—"
          }
        />
        <ConfirmationRow
          label="Version"
          value={
            isDocument
              ? optionSummary?.version || "—"
              : uploadSummary?.version || "—"
          }
        />
        <ConfirmationRow
          label="Format"
          value={
            isDocument
              ? optionSummary?.format || "—"
              : uploadSummary?.format || "—"
          }
        />
        <ConfirmationRow
          label="Destination"
          value={`${task.stage.name} · ${task.title}`}
        />
      </dl>
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <i className="ti ti-lock mt-0.5 shrink-0 text-base" />
        <p>
          The submitted version will be frozen for faculty review. Later
          revisions create a new attempt and do not overwrite this submission.
          {option?.kind === "GOOGLE_DOC_PDF_SNAPSHOT" &&
            " Advisio will verify Google Drive access and export the live document as PDF when you confirm."}
        </p>
      </div>
      {error && <SubmissionError message={error} />}
    </Modal>
  );
}

function ConfirmationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[100px_minmax(0,1fr)]">
      <dt className="text-xs font-semibold text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd className="break-words font-bold text-[var(--color-text-primary)]">
        {value}
      </dd>
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
    <div className="flex items-center gap-3.5 rounded-2xl border border-[#DDE3E8] dark:border-white/10 bg-white dark:bg-[var(--color-surface)] p-5 shadow-xs transition hover:shadow-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0B3A53]/10 text-[#0B3A53] dark:text-[#C9A227]">
        <i className={`ti ${icon} text-xl`} />
      </span>
      <div>
        <p className="text-base font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="text-xl sm:text-2xl font-black text-[var(--color-text-primary)] mt-0.5 tracking-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-[#DDE3E8] dark:border-white/10 bg-white/60 dark:bg-[var(--color-surface)]/60 p-10 text-center flex flex-col items-center justify-center gap-2">
      <i className="ti ti-checklist text-4xl text-slate-300 dark:text-slate-600 mb-1" />
      <p className="font-extrabold text-[var(--color-text-primary)]">
        No milestones deployed yet
      </p>
      <p className="text-base text-slate-500 dark:text-slate-400 max-w-sm">
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
      <p className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
        <i className={`ti ${icon} mr-1 text-[#0B3A53] dark:text-[#C9A227]`} />
        {label}
      </p>
      <p className="mt-1 text-base font-bold text-[#17212B] dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-sm font-semibold text-[var(--color-text-secondary)]">
      <i className="ti ti-info-circle mt-0.5 shrink-0 text-base text-[var(--color-primary)]" />
      <span>{text}</span>
    </div>
  );
}
