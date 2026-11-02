import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import {
  taskDocumentsHref,
  type TaskPortal,
} from "@/lib/document-task-navigation";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tag } from "@/components/ui/Tag";
import { TaskDetailsSkeleton } from "@/components/ui/Skeleton";

type Attempt = {
  id: string;
  attemptNumber: number;
  status: string;
  submittedAt: string;
  reviewedAt?: string | null;
};
type Task = {
  id: string;
  title: string;
  isRequired: boolean;
  status?: string | null;
  documentId?: string | null;
  documentVersionId?: string | null;
  attempts: Attempt[];
};
type Milestone = { id: string; name: string; tasks: Task[] };
type Project = {
  title: string;
  groupName?: string;
  workflowInstance?: {
    workflow?: {
      stages?: Array<{
        tasks?: Array<{ id: string; description?: string | null }>;
      }>;
    };
  };
};
const readable = (value?: string | null) =>
  (value || "Not started").replace(/_/g, " ");
const date = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));

export default function FacultyTaskDetailsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [params] = useSearchParams();
  const projectId = params.get("projectId");
  const portal = useLocation().pathname.split("/")[1] as TaskPortal;
  const query = useQuery({
    queryKey: [portal, "task-details", projectId, taskId],
    enabled: Boolean(projectId && taskId),
    queryFn: async () => {
      // Existing research endpoints enforce the account's project access.
      const [project, workflow] = await Promise.all([
        apiClient.get<{ project: Project }>(
          `/api/research/${encodeURIComponent(projectId!)}`,
        ),
        apiClient.get<{ milestones: Milestone[] }>(
          `/api/research/${encodeURIComponent(projectId!)}/manuscript-workflow`,
        ),
      ]);
      return { project: project.project, milestones: workflow.milestones };
    },
  });
  const milestone = query.data?.milestones.find((stage) =>
    stage.tasks.some((task) => task.id === taskId),
  );
  const task = milestone?.tasks.find((item) => item.id === taskId);
  const definition = query.data?.project.workflowInstance?.workflow?.stages
    ?.flatMap((stage) => stage.tasks || [])
    .find((item) => item.id === taskId);
  const back = taskDocumentsHref(portal, projectId || "");

  return (
    <PageContainer>
      <Link
        to={back}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-primary)]"
      >
        ← Back to files by milestone
      </Link>
      {!projectId || !taskId ? (
        <p role="alert">
          This task link is missing its project or task. Return to Documents and
          open it again.
        </p>
      ) : query.isPending ? (
        <TaskDetailsSkeleton backLink={false} className="max-w-none p-0 sm:p-0 lg:p-0" />
      ) : query.isError ? (
        <section
          role="alert"
          className="rounded-2xl border border-[var(--color-border)] p-6"
        >
          <h1 className="text-xl font-semibold">Task unavailable</h1>
          <p className="mt-2">
            The task could not be loaded. Your existing project access is
            required.
          </p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-4 min-h-11 rounded-lg border border-[var(--color-border)] px-4"
          >
            Try again
          </button>
        </section>
      ) : !task ? (
        <section role="alert">
          <h1 className="text-xl font-semibold">Task not found</h1>
          <p className="mt-2">
            This task is not part of the selected project's current workflow.
          </p>
        </section>
      ) : (
        <>
          <PageHeader
            title={task.title}
            subtitle={`${query.data?.project.groupName || query.data?.project.title} · ${milestone?.name}`}
            category="Task details"
          />
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="flex flex-wrap items-center gap-3">
              <Tag>{readable(task.status)}</Tag>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {task.isRequired ? "Required task" : "Optional task"} ·{" "}
                {task.attempts.length} submission attempts
              </span>
            </div>
            <h2 className="mt-6 text-lg font-semibold">Requirement</h2>
            <p className="mt-2 whitespace-pre-wrap text-[var(--color-text-secondary)]">
              {definition?.description || task.title}
            </p>
            {task.documentId && (
              <Link
                to={taskDocumentsHref(
                  portal,
                  projectId,
                  task.documentId,
                  task.documentVersionId,
                )}
                className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-[var(--color-border)] px-4 font-semibold text-[var(--color-primary)]"
              >
                Open submitted document →
              </Link>
            )}
          </section>
          <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <h2 className="p-6 text-lg font-semibold">Submission attempts</h2>
            {task.attempts.length ? (
              <ol className="divide-y divide-[var(--color-border)]">
                {[...task.attempts]
                  .sort((a, b) => b.attemptNumber - a.attemptNumber)
                  .map((attempt) => (
                    <li
                      key={attempt.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                    >
                      <div>
                        <p className="font-semibold">
                          Attempt {attempt.attemptNumber}
                        </p>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          Submitted {date(attempt.submittedAt)}
                          {attempt.reviewedAt
                            ? ` · Reviewed ${date(attempt.reviewedAt)}`
                            : ""}
                        </p>
                      </div>
                      <Tag>{readable(attempt.status)}</Tag>
                    </li>
                  ))}
              </ol>
            ) : (
              <p className="px-6 pb-6 text-[var(--color-text-secondary)]">
                No submission attempts yet.
              </p>
            )}
          </section>
        </>
      )}
    </PageContainer>
  );
}
