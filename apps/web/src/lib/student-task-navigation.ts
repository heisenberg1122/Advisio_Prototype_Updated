import { withProjectContext } from "./active-project";

function withWorkflowContext(href: string, workflowId?: string | null) {
  if (!workflowId) return href;
  return `${href}${href.includes("?") ? "&" : "?"}workflowId=${encodeURIComponent(workflowId)}`;
}

export function studentTaskDetailsHref(
  taskId: string,
  projectId?: string | null,
  workflowId?: string | null,
) {
  return withWorkflowContext(
    withProjectContext(
      `/student/tasks/${encodeURIComponent(taskId)}`,
      projectId,
    ),
    workflowId,
  );
}

export function studentTasksHref(
  projectId?: string | null,
  workflowId?: string | null,
) {
  return withWorkflowContext(
    withProjectContext("/student/tasks", projectId),
    workflowId,
  );
}

export function legacyTaskDetailsHref(search: string) {
  const params = new URLSearchParams(search);
  const taskId = params.get("taskId");
  if (!taskId) return null;
  const projectId = params.get("projectId") || params.get("researchId");
  return studentTaskDetailsHref(taskId, projectId, params.get("workflowId"));
}
