import { Link } from "react-router-dom";

export function JoinedWorkflows({ enrollments }: { enrollments: any[] }) {
  if (!enrollments.length) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="font-bold">Joined workflows</h2>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Browse your professor’s milestones and materials. Starting tasks and
        submitting files requires a research project linked to that workflow.
      </p>
      {enrollments.map((enrollment) => (
        <Link
          key={enrollment.workflowId}
          to={`/student/tasks?workflowId=${encodeURIComponent(enrollment.workflowId)}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3 font-semibold text-[var(--color-primary)]"
        >
          <span>{enrollment.workflow.name}</span>
          <span className="text-sm">View workflow →</span>
        </Link>
      ))}
    </section>
  );
}
