interface Enrollment {
  workflowId: string;
}

interface Project {
  workflowAccessRemoved?: boolean;
  workflowInstance?: { workflowId: string } | null;
}

// Enrollment controls visibility; a matching project controls submission access.
export function resolveStudentWorkflow<T extends Enrollment, P extends Project>(
  enrollments: T[],
  project?: P | null,
  requestedWorkflowId?: string | null,
  projects: P[] = [],
) {
  const activeEnrollment =
    enrollments.find((entry) => entry.workflowId === requestedWorkflowId) ||
    enrollments.find(
      (entry) => entry.workflowId === project?.workflowInstance?.workflowId,
    ) ||
    enrollments[0];
  const matches = projects.filter(
    (candidate) =>
      !candidate.workflowAccessRemoved &&
      candidate.workflowInstance?.workflowId === activeEnrollment?.workflowId,
  );
  const workflowProject =
    activeEnrollment &&
    !project?.workflowAccessRemoved &&
    project?.workflowInstance?.workflowId === activeEnrollment.workflowId
      ? project
      : matches.length === 1 && activeEnrollment
        ? matches[0]
        : null;
  return { activeEnrollment, workflowProject };
}
