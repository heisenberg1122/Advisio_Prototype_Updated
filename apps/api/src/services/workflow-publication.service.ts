type PublishableTask = {
  isRequired: boolean;
};

type PublishableStage = {
  name: string;
  topicId: string | null;
  category: string;
  requiresDocument: boolean;
  tasks: PublishableTask[];
};

export type PublishableWorkflow = {
  topics: Array<{ id: string }>;
  stages: PublishableStage[];
};

/**
 * Publication is deliberately stricter than draft editing. Drafts may be
 * incomplete, while anything exposed to researchers must describe a usable,
 * sequential academic process.
 */
export function workflowPublicationIssues(workflow: PublishableWorkflow) {
  const stages = workflow.stages.filter(
    (stage) => stage.category !== "Archived",
  );
  const issues: string[] = [];

  if (!workflow.topics.length) issues.push("Add at least one workflow topic.");
  if (!stages.length) issues.push("Add at least one milestone.");

  for (const stage of stages) {
    if (!stage.topicId)
      issues.push(`Assign “${stage.name}” to a workflow topic.`);
    if (stage.requiresDocument && !stage.tasks.some((task) => task.isRequired))
      issues.push(`Add at least one required submission to “${stage.name}”.`);
  }

  return issues;
}
