interface Enrollment {
  workflowId: string;
}

interface Project {
  workflowAccessRemoved?: boolean;
  workflowInstance?: { workflowId: string } | null;
}

// The selected case's pinned instance owns process identity. Enrollment remains
// an independent visibility/authorization requirement, never a process selector.
export function resolveStudentWorkflow<T extends Enrollment, P extends Project>(
  enrollments: T[],
  project?: P | null,
  requestedWorkflowId?: string | null,
  projects: P[] = [],
) {
  const selected = project || (projects.length === 1 ? projects[0] : null);
  const activeEnrollment = !selected?.workflowAccessRemoved
    ? enrollments.find(
        (entry) => entry.workflowId === selected?.workflowInstance?.workflowId,
      )
    : undefined;
  const workflowProject = selected && activeEnrollment ? selected : null;
  return { activeEnrollment, workflowProject };
}
