import { parseAllowedFileTypes } from "./submission.service.js";

type PublishableTask = {
  isRequired: boolean;
  allowedFileTypes?: string | null;
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

  if (!stages.length)
    issues.push(
      "Add at least one active requirement before publishing this process.",
    );

  for (const stage of stages) {
    if (
      stage.requiresDocument &&
      !stage.tasks.some(
        (task) =>
          task.isRequired &&
          parseAllowedFileTypes(task.allowedFileTypes).size > 0,
      )
    )
      issues.push(
        `“${stage.name}” requires at least one usable required submission item before this process can be published.`,
      );
  }

  return issues;
}
