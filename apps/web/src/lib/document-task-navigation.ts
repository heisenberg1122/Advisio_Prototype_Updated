import { studentTaskDetailsHref } from "./student-task-navigation";

export type TaskPortal =
  | "student"
  | "adviser"
  | "professor"
  | "panelist"
  | "admin";

export function documentTaskDetailsHref(
  portal: TaskPortal,
  taskId: string,
  projectId: string,
) {
  if (portal === "student") return studentTaskDetailsHref(taskId, projectId);
  return `/${portal}/tasks/${encodeURIComponent(taskId)}?projectId=${encodeURIComponent(projectId)}`;
}

export function taskDocumentsHref(
  portal: TaskPortal,
  projectId: string,
  documentId?: string | null,
  versionId?: string | null,
) {
  const params = new URLSearchParams({
    tab: documentId ? "workspace" : "milestones",
    projectId,
  });
  if (documentId) params.set("documentId", documentId);
  if (versionId) params.set("versionId", versionId);
  return `/${portal}/documents?${params}`;
}
