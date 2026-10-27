import {
  activeBuilderRequirements,
  type BuilderRequirement,
} from "@/lib/process-builder";
import { formatMilestoneTarget } from "@/lib/workflow-deadlines";

export function ProcessSequencePreview({
  requirements,
  phases,
}: {
  requirements: BuilderRequirement[];
  phases: Array<{ id: string; title: string }>;
}) {
  const ordered = activeBuilderRequirements(requirements);
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Requirements follow their saved sequence. Phases are optional
        organization; actual availability follows your research case and
        existing approval rules.
      </p>
      {!ordered.length && (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] p-5 text-sm">
          No active Requirements yet.
        </p>
      )}
      {ordered.map((requirement) => (
        <article
          key={requirement.id}
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-primary)]">
            {requirement.topicId
              ? `Phase: ${phases.find((phase) => phase.id === requirement.topicId)?.title || "Assigned Phase"}`
              : "Unassigned Requirement · No Phase"}
          </p>
          <h3 className="mt-2 font-bold text-[var(--color-text-primary)]">
            {requirement.sequence}. {requirement.title}
          </h3>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {requirement.description ||
              "Follow the Requirement instructions provided by your research coordinator."}
          </p>
          <p className="mt-2 text-xs font-semibold text-[var(--color-text-muted)]">
            {formatMilestoneTarget(requirement)} ·{" "}
            {requirement.tasks?.length || 0}{" "}
            {requirement.requiresDocument
              ? "Submission Items"
              : "Requirement Items"}{" "}
            ·{" "}
            {requirement.locked
              ? "Faculty approval required"
              : "Existing completion rules"}
          </p>
        </article>
      ))}
    </div>
  );
}
