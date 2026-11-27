import { apiClient, ApiError } from "@/lib/api-client";
import { formatTaskDeadline } from "@/lib/workflow-deadlines";
import {
  listOffline,
  removeOffline,
  writeOffline,
  type OfflineSession,
} from "./store";

export type SavedRequirement = {
  id: string;
  taskId: string;
  projectId?: string;
  workflowId: string;
  title: string;
  group: string;
  milestone: string;
  instructions: string;
  deadline: string;
  status: string;
  fileTypes: string;
  feedback: string[];
};
export type SavedFileOption = {
  projectId?: string;
  workflowId?: string;
  id: string;
  title: string;
  group: string;
  name: string;
  url: string;
  version: string;
  feedback: string[];
};
export type OfflineSnapshot = {
  savedAt: number;
  requirements: SavedRequirement[];
  files: SavedFileOption[];
};

// A draft is local to the researcher and project, rather than shared with the group.
export function taskDraftKey(
  projectId: string | undefined,
  workflowId: string,
  taskId: string,
) {
  return `draft:task:${projectId || workflowId}:${taskId}`;
}

export function summarizeRequirements(
  project: any,
  workflow: any,
  milestones: any[] = [],
): SavedRequirement[] {
  if (!workflow || project?.workflowAccessRemoved) return [];
  const stages =
    project?.workflowInstance?.workflow?.stages || workflow.stages || [];
  const submissions = new Map(
    (project?.taskSubmissions || []).map((submission: any) => [
      submission.taskId,
      submission,
    ]),
  );
  return stages.flatMap((stage: any) => {
    const progress = milestones.find((milestone) => milestone.id === stage.id);
    const tasks = stage.tasks?.length
      ? stage.tasks
      : [
          {
            id: `milestone-${stage.id}`,
            title: stage.name,
            instructions: stage.description,
          },
        ];
    return tasks.map((task: any) => {
      const submission: any = submissions.get(task.id);
      return {
        id: taskDraftKey(project?.id, workflow.id, task.id),
        taskId: task.id,
        projectId: project?.id,
        workflowId: workflow.id,
        title: task.title,
        group: project?.title || workflow.name,
        milestone: stage.name,
        instructions:
          task.instructions ||
          stage.description ||
          "No additional instructions.",
        deadline: formatTaskDeadline({ dueDays: task.dueDays, stage }),
        status: submission?.status || progress?.status || "NOT_STARTED",
        fileTypes:
          task.allowedFileTypes ||
          (stage.requiresDocument === false
            ? "No document required"
            : "See task instructions"),
        feedback: [
          ...new Set<string>(
            [
              submission?.reviewNote,
              ...(submission?.attempts || []).map(
                (attempt: any) => attempt.reviewNote,
              ),
              ...(submission?.documentVersion?.reviews || []).flatMap(
                (review: any) => [
                  review.overallComment,
                  ...(review.comments || []).map(
                    (comment: any) => comment.comment,
                  ),
                ],
              ),
            ].filter(Boolean),
          ),
        ],
      };
    });
  });
}

export function summarizeDocuments(
  documents: any[],
  group: string,
): SavedFileOption[] {
  return documents.flatMap((document: any) =>
    (document.versions || []).map((version: any) => {
      const reviews = [
        ...(version.reviews || []),
        ...(version.reviewerAssignments || []).flatMap((assignment: any) =>
          assignment.review
            ? [{ ...assignment.review, reviewer: assignment.reviewer }]
            : [],
        ),
      ].filter(
        (review: any) => review.status === "SUBMITTED" || review.submittedAt,
      );
      const feedback = [
        ...new Set<string>(
          reviews.flatMap((review: any) => {
            const name = [review.reviewer?.firstName, review.reviewer?.lastName]
              .filter(Boolean)
              .join(" ");
            return [
              review.overallComment,
              ...(review.comments || []).map((comment: any) => comment.comment),
            ]
              .filter(Boolean)
              .map((text: string) => (name ? `${name}: ${text}` : text));
          }),
        ),
      ];
      return {
        id: `document:${version.id}`,
        title: document.title,
        group,
        name: version.fileName,
        url: version.webViewLink || "",
        version: `Version ${version.versionNumber}`,
        feedback,
      };
    }),
  );
}

export async function refreshOfflineSnapshot(
  session: OfflineSession,
): Promise<OfflineSnapshot> {
  // Every refresh passes through normal server authentication and researcher scoping.
  const [research, memberships] = await Promise.all([
    apiClient.get<{ projects: any[] }>("/api/research"),
    apiClient.get<{ enrollments: any[] }>("/api/workflows/enrollments/me"),
  ]);
  const requirements: SavedRequirement[] = [];
  const files: SavedFileOption[] = [];
  const enrollments = memberships.enrollments || [];
  const projects = research.projects || [];
  // Bound concurrent requests for accounts with several projects.
  for (const project of projects) {
    const membership = enrollments.find(
      (entry) => entry.workflowId === project.workflowInstance?.workflowId,
    );
    try {
      const documents = await apiClient.get<{ documents: any[] }>(
        `/api/research/${project.id}/documents`,
      );
      files.push(
        ...summarizeDocuments(documents.documents || [], project.title).map((file) => ({ ...file, projectId: project.id })),
      );
      if (membership && !project.workflowAccessRemoved) {
        const projection = await apiClient.get<{ milestones: any[] }>(
          `/api/research/${project.id}/manuscript-workflow`,
        );
        requirements.push(
          ...summarizeRequirements(
            project,
            { ...membership.workflow, id: membership.workflowId },
            projection.milestones,
          ),
        );
      }
    } catch (error) {
      // Removed project access is omitted, then its downloaded files are pruned below.
      if (
        !(error instanceof ApiError) ||
        ![403, 404].includes(error.statusCode)
      )
        throw error;
    }
  }
  for (const enrollment of enrollments) {
    if (
      !projects.some(
        (project) =>
          !project.workflowAccessRemoved &&
          project.workflowInstance?.workflowId === enrollment.workflowId,
      )
    ) {
      requirements.push(
        ...summarizeRequirements(null, {
          ...enrollment.workflow,
          id: enrollment.workflowId,
        }),
      );
    }
    try {
      const resources = await apiClient.get<{ resources: any[] }>(
        `/api/workflows/${enrollment.workflowId}/resources`,
      );
      files.push(
        ...(resources.resources || []).map((resource) => ({
          // Resource IDs survive replacement; include version so an old blob is never labelled current.
          id: `resource:${resource.id}:${resource.version}`,
          workflowId: enrollment.workflowId,
          title: resource.title,
          group: enrollment.workflow?.name || "Workflow guide",
          name: resource.fileName,
          url: `/api/workflows/resources/${resource.id}/file`,
          version: `Version ${resource.version}`,
          feedback: [],
        })),
      );
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        ![403, 404].includes(error.statusCode)
      )
        throw error;
    }
  }
  const snapshot = { savedAt: Date.now(), requirements, files };
  const allowed = new Set(files.map((file) => `file:${file.id}`));
  for (const saved of await listOffline<any>(session, "file:")) {
    if (!allowed.has(saved.key)) await removeOffline(session, saved.key);
    else {
      const option = files.find((file) => `file:${file.id}` === saved.key)!;
      if (!saved.value.url || (!saved.value.projectId && option.projectId) || (!saved.value.workflowId && option.workflowId)) {
        await writeOffline(session, saved.key, { ...saved.value, url: option.url, projectId: option.projectId, workflowId: option.workflowId });
      }
    }
  }
  await writeOffline(session, "snapshot", snapshot);
  return snapshot;
}
