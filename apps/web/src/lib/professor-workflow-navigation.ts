export function resolveProfessorWorkflowId(
  workflows: readonly { id: string }[],
  requestedId: string,
): string {
  return workflows.find((workflow) => workflow.id === requestedId)?.id
    || workflows[0]?.id
    || "";
}

export function professorWorkflowSelectionUrl(search: string, workflowId: string): string {
  const params = new URLSearchParams(search);
  if (workflowId) params.set("workflowId", workflowId);
  else params.delete("workflowId");
  return `/professor/dashboard?${params.toString()}`;
}
