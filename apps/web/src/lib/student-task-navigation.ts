import { withProjectContext } from "./active-project";

export function studentTaskDetailsHref(
  taskId: string,
  projectId?: string | null,
) {
  return withProjectContext(
    `/student/tasks/${encodeURIComponent(taskId)}`,
    projectId,
  );
}

export function studentTasksHref(projectId?: string | null) {
  return withProjectContext("/student/tasks", projectId);
}

export function legacyTaskDetailsHref(search: string) {
  const params = new URLSearchParams(search);
  const taskId = params.get("taskId");
  if (!taskId) return null;
  const projectId = params.get("projectId") || params.get("researchId");
  return studentTaskDetailsHref(taskId, projectId);
}
