import { prisma } from "../lib/prisma.js";
import { googleDriveService } from "./google-drive.service.js";

export type WorkspaceBucket = "WORKING" | "SUBMISSIONS" | "FEEDBACK";

const BUCKETS: Array<{ bucket: WorkspaceBucket; name: string }> = [
  { bucket: "WORKING", name: "01-Working-Documents" },
  { bucket: "SUBMISSIONS", name: "02-Submissions" },
  { bucket: "FEEDBACK", name: "03-Feedback" },
];

function safeName(value: string, fallback: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|#%{}~]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return normalized || fallback;
}

function prefixed(prefix: string, code: string, name?: string | null) {
  const codePart = safeName(code, "UNSPECIFIED").toUpperCase();
  const namePart = name ? safeName(name, "") : "";
  return namePart && namePart.toUpperCase() !== codePart
    ? `${prefix}-${codePart}_${namePart}`
    : `${prefix}-${codePart}`;
}

class StorageHierarchyService {
  private async projectContext(researchId: string) {
    const project = await prisma.researchProject.findUnique({
      where: { id: researchId },
      include: {
        academicYear: true,
        college: true,
        program: true,
        workflowInstance: {
          include: {
            currentStage: true,
            workflow: {
              include: {
                stages: {
                  where: { category: { not: "Archived" } },
                  orderBy: { sequence: "asc" },
                },
              },
            },
          },
        },
      },
    });
    if (!project) throw new Error("Research project not found");
    return project;
  }

  private baseSegments(
    project: Awaited<ReturnType<typeof this.projectContext>>,
  ) {
    const ay = safeName(project.academicYear.name, "UNASSIGNED");
    const shortId = project.id.replace(/-/g, "").slice(0, 8).toUpperCase();
    const groupLabel = safeName(
      project.groupName || project.title,
      "Untitled-Research",
    );
    return [
      { name: "01_GROUP_WORKSPACES", key: "group-workspaces" },
      {
        name: ay.toUpperCase().startsWith("AY-") ? ay : `AY-${ay}`,
        key: `academic-year:${project.academicYearId}`,
        entityType: "ACADEMIC_YEAR",
        entityId: project.academicYearId,
      },
      {
        name: prefixed("COL", project.college.code, project.college.name),
        key: `college:${project.collegeId}`,
        entityType: "COLLEGE",
        entityId: project.collegeId,
      },
      {
        name: prefixed("PRG", project.program.code, project.program.name),
        key: `program:${project.programId}`,
        entityType: "PROGRAM",
        entityId: project.programId,
      },
      {
        name: `GRP-${shortId}_${groupLabel}`,
        key: `research:${project.id}`,
        entityType: "RESEARCH_PROJECT",
        entityId: project.id,
      },
    ];
  }

  private bucketSegments(bucket: WorkspaceBucket) {
    const definition = BUCKETS.find((item) => item.bucket === bucket)!;
    return definition.name.split("/").map((name, index) => ({
      name,
      key: `bucket:${bucket.toLowerCase()}:${index}`,
    }));
  }

  private stageSegment(stage: { id: string; name: string; sequence: number }) {
    return {
      name: `${String(stage.sequence).padStart(2, "0")}-${safeName(stage.name, "Milestone")}`,
      key: `stage:${stage.id}`,
      entityType: "WORKFLOW_STAGE",
      entityId: stage.id,
    };
  }

  /** Creates the complete group hierarchy, including every configured milestone. */
  public async provisionProject(researchId: string) {
    const project = await this.projectContext(researchId);
    const base = this.baseSegments(project);
    const stages = project.workflowInstance?.workflow.stages || [];
    const effectiveStages = stages.length
      ? stages
      : [
          {
            id: `general-${project.id}`,
            name: "General-Documents",
            sequence: 1,
          },
        ];
    for (const stage of effectiveStages) {
      const milestone = [...base, this.stageSegment(stage)];
      for (const definition of BUCKETS) {
        await googleDriveService.ensureFolderPath([
          ...milestone,
          ...this.bucketSegments(definition.bucket),
        ]);
      }
    }
    return { project, stages: effectiveStages };
  }

  /** Adds one newly configured milestone to an existing group's workspace. */
  public async provisionStage(researchId: string, stageId: string) {
    const project = await this.projectContext(researchId);
    const stage = project.workflowInstance?.workflow.stages.find(
      (item) => item.id === stageId,
    );
    if (!stage)
      throw new Error("The milestone is not assigned to this research group");
    const milestone = [...this.baseSegments(project), this.stageSegment(stage)];
    for (const definition of BUCKETS) {
      await googleDriveService.ensureFolderPath([
        ...milestone,
        ...this.bucketSegments(definition.bucket),
      ]);
    }
  }

  public async resolveFolder(options: {
    researchId: string;
    bucket: WorkspaceBucket;
    taskId?: string | null;
    stageId?: string | null;
  }) {
    const project = await this.projectContext(options.researchId);
    let stage = options.stageId
      ? project.workflowInstance?.workflow.stages.find(
          (item) => item.id === options.stageId,
        )
      : undefined;
    if (!stage && options.taskId) {
      const task = await prisma.workflowTask.findUnique({
        where: { id: options.taskId },
        include: { stage: true },
      });
      if (
        task &&
        task.stage.workflowId === project.workflowInstance?.workflowId
      )
        stage = task.stage;
    }
    stage ||=
      project.workflowInstance?.currentStage ||
      project.workflowInstance?.workflow.stages[0];
    const effectiveStage =
      stage ||
      ({
        id: `general-${project.id}`,
        name: "General-Documents",
        sequence: 1,
      } as const);
    return googleDriveService.ensureFolderPath([
      ...this.baseSegments(project),
      this.stageSegment(effectiveStage),
      ...this.bucketSegments(options.bucket),
    ]);
  }

  /** Dean signature requests are institutional correspondence, not working
   * drafts tied to the project's current milestone. Keep them in a stable,
   * project-level folder so sending does not depend on workflow-stage routing. */
  public async resolveDeanApprovalsFolder(researchId: string, dean?: { id: string; name: string }) {
    const project = await this.projectContext(researchId);
    return googleDriveService.ensureFolderPath([
      ...this.baseSegments(project),
      { name: "04-Dean-Approvals", key: "bucket:dean-approvals" },
      ...(dean ? [{ name: `DEAN-${dean.id.replace(/-/g, "").slice(0, 8).toUpperCase()}_${safeName(dean.name, "Dean")}`, key: `dean:${dean.id}`, entityType: "DEAN", entityId: dean.id }] : []),
    ]);
  }

  public async moveDocumentCurrentVersion(options: {
    documentId: string;
    bucket: WorkspaceBucket;
    taskId?: string | null;
    stageId?: string | null;
  }) {
    const document = await prisma.document.findUnique({
      where: { id: options.documentId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    const fileId = document?.versions[0]?.googleDriveFileId;
    if (!document || !fileId) return;
    const folderId = await this.resolveFolder({
      researchId: document.researchId,
      bucket: options.bucket,
      taskId: options.taskId,
      stageId: options.stageId,
    });
    await googleDriveService.moveFile(fileId, folderId);
  }
}

export const storageHierarchyService = new StorageHierarchyService();
