export interface BuilderRequirement {
  id: string;
  title: string;
  sequence: number;
  scope?: string;
  category?: string;
  topicId?: string | null;
  description?: string;
  requiresDocument?: boolean;
  locked?: boolean;
  milestoneType?: string;
  deadlineDays?: number | null;
  targetCompletionDate?: string | null;
  tasks?: Array<{ isRequired?: boolean; allowedFileTypes?: string | null }>;
}
export function activeBuilderRequirements<T extends BuilderRequirement>(
  requirements: T[],
) {
  return requirements
    .filter((item) => (item.scope ?? item.category) !== "Archived")
    .sort((a, b) => a.sequence - b.sequence);
}
// Mirrors the existing server file parser for readiness only; the server is authoritative.
function usableSubmission(value?: string | null) {
  const aliases: Record<string, string> = {
    "application/pdf": "PDF",
    "application/msword": "DOC",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "DOCX",
    "text/plain": "TXT",
  };
  return String(value || "PDF,DOCX")
    .split(/[\s,|;]+/)
    .some((entry) => {
      const normalized = entry.trim().replace(/^\./, "").toUpperCase();
      return ["PDF", "DOC", "DOCX", "TXT"].includes(
        aliases[normalized.toLowerCase()] || normalized,
      );
    });
}
export function processPublicationIssues(requirements: BuilderRequirement[]) {
  const active = activeBuilderRequirements(requirements);
  const issues: string[] = [];
  if (!active.length)
    issues.push(
      "Add at least one active requirement before publishing this process.",
    );
  for (const requirement of active) {
    if (
      requirement.requiresDocument &&
      !requirement.tasks?.some(
        (item) =>
          item.isRequired !== false && usableSubmission(item.allowedFileTypes),
      )
    )
      issues.push(
        `“${requirement.title}” requires at least one usable required submission item before this process can be published.`,
      );
  }
  return issues;
}
export function requirementConditionOptions(
  requirements: BuilderRequirement[],
  editingId?: string,
) {
  const editing = requirements.find((item) => item.id === editingId);
  return activeBuilderRequirements(requirements)
    .filter(
      (item) =>
        item.id !== editingId &&
        item.sequence > 0 &&
        (!editing || item.sequence < editing.sequence),
    )
    .map((item) => ({
      value: item.id,
      label:
        item.milestoneType === "ADVISER_SELECTION"
          ? `Adviser Selection Requirement: ${item.title}`
          : item.title,
    }));
}
