import { Router, Request, Response } from "express";
import { storageHierarchyService } from "../services/storage-hierarchy.service.js";
import { ManuscriptLifecycleStatus, prisma } from "../lib/prisma.js";
import {
  createWorkflowTopicSchema,
  createWorkflowSchema,
  reorderWorkflowTopicsSchema,
  updateWorkflowTopicSchema,
  workflowTransitionSchema,
  targetCompletionDateSchema,
} from "@research-management/validations";
import { Permissions } from "@research-management/auth";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { getCollegeScope } from "../lib/college-scope.js";
import workflowAccessRoutes, {
  generateWorkflowCode,
  previewWorkflow,
  requestWorkflow,
  lockWorkflowAccess,
} from "./workflow-access.routes.js";
import multer from "multer";
import fs from "node:fs";
import { googleDriveService } from "../services/google-drive.service.js";
import { canReviewTaskSubmission } from "../services/task-submission-access.service.js";
import {
  advanceMilestoneIfSatisfied,
  createNotificationsOnce,
  recordTaskSubmissionAttempt,
} from "../services/research-workflow-integration.service.js";
import {
  submitStoredTaskVersion,
  uploadTaskSubmission,
} from "../services/task-submission-upload.service.js";
import {
  getTaskSubmissionOptions,
  SubmissionIntegrityError,
} from "../services/submission.service.js";

import { hasActiveWorkflowEnrollment } from "../services/workflow-enrollment-access.service.js";
import { synchronizeAdviserMilestone } from "../services/adviser-milestone.service.js";
import { workflowPublicationIssues } from "../services/workflow-publication.service.js";

const router = Router();
router.use(workflowAccessRoutes);
const resourceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    if (!allowed.has(file.mimetype)) {
      callback(new Error("Only PDF, DOC, and DOCX files are allowed."));
      return;
    }
    callback(null, true);
  },
});
const milestoneAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const blockedExtensions = /\.(exe|msi|bat|cmd|com|scr|ps1|sh|js|jar)$/i;
    if (blockedExtensions.test(file.originalname)) {
      callback(new Error("This file type cannot be attached."));
      return;
    }
    callback(null, true);
  },
});

const resourceSelect = {
  id: true,
  workflowId: true,
  title: true,
  description: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  version: true,
  uploadedBy: true,
  createdAt: true,
  updatedAt: true,
  uploader: { select: { firstName: true, lastName: true } },
} as const;

function serializeResource(resource: any) {
  return { ...resource, fileSize: Number(resource.fileSize) };
}

async function workflowAccess(
  workflowId: string,
  user: NonNullable<Request["user"]>,
) {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) return null;
  const researchType = await prisma.researchType.findUnique({
    where: { id: workflow.researchTypeId },
    select: { program: { select: { id: true, collegeId: true } } },
  });
  const program = researchType?.program;
  const scope = getCollegeScope(user);
  const manages =
    user.roles.some((role) =>
      ["RESEARCH_COORDINATOR", "DEAN", "SYSTEM_ADMIN"].includes(role),
    ) &&
    (scope.kind === "institution" ||
      Boolean(
        scope.kind === "college" &&
        program &&
        scope.collegeId === program.collegeId &&
        (!user.programId || user.programId === program.id),
      ));
  if (manages) return { workflow, manages: true };
  if (user.roles.includes("RESEARCHER")) {
    return (await hasActiveWorkflowEnrollment(user.id, workflowId))
      ? { workflow, manages: false }
      : null;
  }
  const [enrollment, membership] = await Promise.all([
    prisma.workflowEnrollment.findFirst({
      where: { workflowId, userId: user.id, status: "ACTIVE" },
      select: { id: true },
    }),
    prisma.researchMember.findFirst({
      where: {
        userId: user.id,
        leftAt: null,
        research: { workflowInstance: { is: { workflowId } } },
      },
      select: { id: true },
    }),
  ]);
  return enrollment || membership ? { workflow, manages: false } : null;
}

async function workflowResourceFolder(workflow: { id: string; name: string }) {
  return googleDriveService.ensureFolderPath([
    { name: "02_WORKFLOW_RESOURCES", key: "workflow-resources" },
    {
      name: workflow.name,
      key: `workflow:${workflow.id}`,
      entityType: "WORKFLOW",
      entityId: workflow.id,
    },
  ]);
}

const stageAttachmentInclude = {
  workflowResource: {
    select: {
      id: true,
      title: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      version: true,
    },
  },
} as const;

async function stageWithAccess(
  stageId: string,
  user: NonNullable<Request["user"]>,
) {
  const stage = await prisma.workflowStage.findUnique({
    where: { id: stageId },
    include: { workflow: true },
  });
  if (!stage) return null;
  const access = await workflowAccess(stage.workflowId, user);
  return access ? { stage, access } : null;
}

// Supporting materials attached to one milestone.
router.get("/stages/:stageId/attachments", requireAuth, async (req, res) => {
  try {
    const context = await stageWithAccess(
      req.params.stageId as string,
      req.user!,
    );
    if (!context)
      return void res.status(404).json({ error: "Milestone not found." });
    const attachments = await prisma.workflowStageAttachment.findMany({
      where: { stageId: context.stage.id },
      orderBy: { createdAt: "asc" },
      include: stageAttachmentInclude,
    });
    res.json({ attachments, canManage: context.access.manages });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || "Failed to load milestone attachments.",
    });
  }
});

router.post(
  "/stages/:stageId/attachments",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  milestoneAttachmentUpload.single("file"),
  async (req, res) => {
    try {
      const context = await stageWithAccess(
        req.params.stageId as string,
        req.user!,
      );
      if (!context?.access.manages)
        return void res.status(404).json({ error: "Milestone not found." });
      const type = String(req.body.type || "").toUpperCase();
      if (!new Set(["GUIDE", "LINK", "PDF", "FILE"]).has(type)) {
        return void res
          .status(400)
          .json({ error: "Choose a valid attachment type." });
      }

      let data: any = {
        stageId: context.stage.id,
        type,
        title: String(req.body.title || "")
          .trim()
          .slice(0, 180),
        uploadedBy: req.user!.id,
      };

      if (type === "GUIDE") {
        const resource = await prisma.workflowResource.findFirst({
          where: {
            id: String(req.body.workflowResourceId || ""),
            workflowId: context.stage.workflowId,
          },
        });
        if (!resource)
          return void res
            .status(400)
            .json({ error: "Choose a guide or template from this workflow." });
        data = {
          ...data,
          title: resource.title,
          workflowResourceId: resource.id,
        };
      } else if (type === "LINK") {
        let parsed: URL;
        try {
          parsed = new URL(String(req.body.url || ""));
        } catch {
          return void res
            .status(400)
            .json({ error: "Enter a valid web link." });
        }
        if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
          return void res
            .status(400)
            .json({ error: "Only HTTP and HTTPS links can be attached." });
        }
        if (!data.title) data.title = parsed.hostname;
        data.url = parsed.toString();
      } else {
        if (!req.file)
          return void res
            .status(400)
            .json({ error: "Choose a file to attach." });
        if (type === "PDF" && req.file.mimetype !== "application/pdf") {
          return void res.status(400).json({ error: "Choose a PDF file." });
        }
        const folderId = await workflowResourceFolder(context.stage.workflow);
        const stored = await googleDriveService.uploadFile({
          folderId,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype || "application/octet-stream",
          buffer: req.file.buffer,
          description: `${data.title || req.file.originalname} — ${context.stage.name}`,
          appProperties: {
            entityType: "WORKFLOW_STAGE_ATTACHMENT",
            stageId: context.stage.id,
          },
        });
        data = {
          ...data,
          title: data.title || req.file.originalname,
          fileName: stored.fileName,
          mimeType: stored.mimeType,
          fileSize: stored.sizeBytes,
          storagePath: stored.storagePath,
          googleDriveFileId: stored.fileId,
        };
      }

      if (!data.title)
        return void res
          .status(400)
          .json({ error: "Enter a title for this attachment." });
      const attachment = await prisma.workflowStageAttachment.create({
        data,
        include: stageAttachmentInclude,
      });
      res.status(201).json({ attachment });
    } catch (error: any) {
      const duplicate = error?.code === "P2002";
      res.status(duplicate ? 409 : 500).json({
        error: duplicate
          ? "That guide is already attached to this milestone."
          : error.message || "Failed to attach this material.",
      });
    }
  },
);

router.get(
  "/stage-attachments/:attachmentId/file",
  requireAuth,
  async (req, res) => {
    try {
      const attachment = await prisma.workflowStageAttachment.findUnique({
        where: { id: req.params.attachmentId as string },
        include: { stage: true },
      });
      if (
        !attachment ||
        !(await workflowAccess(attachment.stage.workflowId, req.user!))
      ) {
        return void res.status(404).json({ error: "Attachment not found." });
      }
      if (!attachment.storagePath || !attachment.fileName) {
        return void res.status(400).json({
          error: "This attachment does not contain an uploaded file.",
        });
      }
      res.setHeader(
        "Content-Type",
        attachment.mimeType || "application/octet-stream",
      );
      res.setHeader(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      );
      if (fs.existsSync(attachment.storagePath))
        return void res.sendFile(attachment.storagePath);
      if (!attachment.googleDriveFileId)
        return void res
          .status(404)
          .json({ error: "The stored file is unavailable." });
      const response = await googleDriveService.getFileStream(
        attachment.googleDriveFileId,
      );
      response.data.pipe(res);
    } catch (error: any) {
      if (!res.headersSent)
        res
          .status(500)
          .json({ error: error.message || "Failed to open attachment." });
    }
  },
);

router.delete(
  "/stage-attachments/:attachmentId",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req, res) => {
    try {
      const attachment = await prisma.workflowStageAttachment.findUnique({
        where: { id: req.params.attachmentId as string },
        include: { stage: true },
      });
      if (
        !attachment ||
        !(await workflowAccess(attachment.stage.workflowId, req.user!))?.manages
      ) {
        return void res.status(404).json({ error: "Attachment not found." });
      }
      await prisma.workflowStageAttachment.delete({
        where: { id: attachment.id },
      });
      if (attachment.googleDriveFileId)
        googleDriveService
          .deleteFile(attachment.googleDriveFileId)
          .catch(() => undefined);
      else if (attachment.storagePath && fs.existsSync(attachment.storagePath))
        fs.unlink(attachment.storagePath, () => undefined);
      res.json({ success: true });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to remove attachment." });
    }
  },
);

async function normalizeWorkflowStageSequences(tx: any, workflowId: string) {
  const stages = await tx.workflowStage.findMany({
    where: { workflowId },
    orderBy: [{ sequence: "asc" }, { id: "asc" }],
    select: { id: true, category: true },
  });
  // Move every row into a temporary range first to avoid unique collisions
  // while compacting active milestones back to 1..n.
  for (let index = 0; index < stages.length; index += 1) {
    await tx.workflowStage.update({
      where: { id: stages[index].id },
      data: { sequence: 1_000_000 + index },
    });
  }
  let activeSequence = 1;
  let archivedSequence = -1;
  for (const stage of stages) {
    const archived = stage.category === "Archived";
    await tx.workflowStage.update({
      where: { id: stage.id },
      data: {
        sequence: archived ? archivedSequence-- : activeSequence++,
      },
    });
  }
  const finalStage = await tx.workflowStage.findFirst({
    where: { workflowId, category: { not: "Archived" } },
    orderBy: [{ sequence: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  await tx.workflowStage.updateMany({
    where: { workflowId, category: { not: "Archived" } },
    data: { isFinal: false },
  });
  if (finalStage) {
    await tx.workflowStage.update({
      where: { id: finalStage.id },
      data: { isFinal: true },
    });
  }
}

async function normalizeWorkflowTopicSequences(tx: any, workflowId: string) {
  const topics = await tx.workflowTopic.findMany({
    where: { workflowId },
    orderBy: [{ sequence: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  for (let index = 0; index < topics.length; index += 1) {
    await tx.workflowTopic.update({
      where: { id: topics[index].id },
      data: { sequence: 1_000_000 + index },
    });
  }
  for (let index = 0; index < topics.length; index += 1) {
    await tx.workflowTopic.update({
      where: { id: topics[index].id },
      data: { sequence: index + 1 },
    });
  }
}

async function recordPublishedWorkflowChange(
  workflowId: string,
  actorId: string,
  summary: string,
  entityType: string,
  entityId: string,
) {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: {
        name: true,
        status: true,
        enrollments: {
          where: { status: "ACTIVE" },
          select: { userId: true },
        },
        instances: {
          select: {
            research: {
              select: {
                members: {
                  where: { leftAt: null },
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });
    if (!workflow || workflow.status !== "PUBLISHED") return;
    const changedAt = new Date();
    await prisma.workflow.update({
      where: { id: workflowId },
      data: { updatedAt: changedAt },
    });

    const recipients = new Set(
      workflow.enrollments.map(({ userId }) => userId),
    );
    for (const instance of workflow.instances)
      for (const member of instance.research?.members || [])
        recipients.add(member.userId);

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entityType,
          entityId,
          newValues: { workflowId, summary },
        },
      });
      await createNotificationsOnce(
        tx,
        Array.from(recipients).map((recipientId) => ({
          recipientId,
          type: "WORKFLOW_CHANGED",
          title: "Published workflow updated",
          message: `${workflow.name}: ${summary}`,
          entityType: "Workflow",
          entityId: workflowId,
          actionUrl: "/student/tasks",
          audience: "researcher",
          deduplicationKey: `workflow:${workflowId}:change:${entityType}:${entityId}:${changedAt.toISOString()}:${recipientId}`,
        })),
      );
    });
  } catch (error) {
    // The academic change has already committed. Notification delivery must
    // never turn a successful, authoritative update into a false UI error.
    console.error("Published workflow change notification failed", error);
  }
}

async function resequenceWorkflowStagesByTopics(tx: any, workflowId: string) {
  const [topics, stages] = await Promise.all([
    tx.workflowTopic.findMany({
      where: { workflowId },
      orderBy: [{ sequence: "asc" }, { id: "asc" }],
      select: { id: true },
    }),
    tx.workflowStage.findMany({
      where: { workflowId },
      orderBy: [{ sequence: "asc" }, { id: "asc" }],
      select: { id: true, topicId: true, category: true },
    }),
  ]);
  const active = stages.filter((stage: any) => stage.category !== "Archived");
  const archived = stages.filter((stage: any) => stage.category === "Archived");
  // Keep legacy ungrouped milestones first so adding the first topic does not
  // unexpectedly move an existing research process behind newly added work.
  const orderedActive = [
    ...active.filter((stage: any) => !stage.topicId),
    ...topics.flatMap((topic: any) =>
      active.filter((stage: any) => stage.topicId === topic.id),
    ),
  ];
  const ordered = [...orderedActive, ...archived];
  for (let index = 0; index < ordered.length; index += 1) {
    await tx.workflowStage.update({
      where: { id: ordered[index].id },
      data: { sequence: 2_000_000 + index },
    });
  }
  for (let index = 0; index < orderedActive.length; index += 1) {
    await tx.workflowStage.update({
      where: { id: orderedActive[index].id },
      data: { sequence: index + 1 },
    });
  }
  for (let index = 0; index < archived.length; index += 1) {
    await tx.workflowStage.update({
      where: { id: archived[index].id },
      data: { sequence: -(index + 1) },
    });
  }
  await tx.workflowStage.updateMany({
    where: { workflowId, category: { not: "Archived" } },
    data: { isFinal: false },
  });
  const finalStage = orderedActive.at(-1);
  if (finalStage) {
    await tx.workflowStage.update({
      where: { id: finalStage.id },
      data: { isFinal: true },
    });
  }
}

async function positionWorkflowStageWithinTopic(
  tx: any,
  workflowId: string,
  stageId: string,
  requestedPosition?: number | null,
) {
  if (!requestedPosition) return;
  const stage = await tx.workflowStage.findUnique({
    where: { id: stageId },
    select: { topicId: true },
  });
  if (!stage) return;
  const active = await tx.workflowStage.findMany({
    where: { workflowId, category: { not: "Archived" } },
    orderBy: [{ sequence: "asc" }, { id: "asc" }],
    select: { id: true, topicId: true },
  });
  const withoutStage = active.filter((item: any) => item.id !== stageId);
  const siblings = withoutStage.filter(
    (item: any) => item.topicId === stage.topicId,
  );
  const position = Math.max(
    1,
    Math.min(requestedPosition, siblings.length + 1),
  );
  let insertionIndex: number;
  if (siblings.length && position <= siblings.length) {
    insertionIndex = withoutStage.findIndex(
      (item: any) => item.id === siblings[position - 1].id,
    );
  } else if (siblings.length) {
    insertionIndex =
      withoutStage.findIndex(
        (item: any) => item.id === siblings[siblings.length - 1].id,
      ) + 1;
  } else {
    const currentIndex = active.findIndex((item: any) => item.id === stageId);
    insertionIndex = Math.min(currentIndex, withoutStage.length);
  }
  const ordered = [...withoutStage];
  ordered.splice(insertionIndex, 0, { id: stageId, topicId: stage.topicId });
  for (let index = 0; index < ordered.length; index += 1) {
    await tx.workflowStage.update({
      where: { id: ordered[index].id },
      data: { sequence: 3_000_000 + index },
    });
  }
  for (let index = 0; index < ordered.length; index += 1) {
    await tx.workflowStage.update({
      where: { id: ordered[index].id },
      data: { sequence: index + 1, isFinal: index === ordered.length - 1 },
    });
  }
}

// Workflow-wide reference files shared with every researcher in the workflow.
router.get("/:id/resources", requireAuth, async (req, res) => {
  try {
    const access = await workflowAccess(req.params.id as string, req.user!);
    if (!access)
      return void res
        .status(404)
        .json({ error: "Workflow resources were not found." });
    const resources = await prisma.workflowResource.findMany({
      where: { workflowId: access.workflow.id },
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      select: resourceSelect,
    });
    res.json({
      resources: resources.map(serializeResource),
      canManage: access.manages,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to load workflow resources." });
  }
});

router.post(
  "/:id/resources",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  resourceUpload.single("file"),
  async (req, res) => {
    try {
      const access = await workflowAccess(req.params.id as string, req.user!);
      if (!access?.manages)
        return void res
          .status(404)
          .json({ error: "Workflow not found in your academic scope." });
      if (!req.file)
        return void res
          .status(400)
          .json({ error: "Select a PDF, DOC, or DOCX file." });
      const title = String(req.body.title || "").trim();
      if (!title || title.length > 180)
        return void res
          .status(400)
          .json({ error: "Enter a resource title of up to 180 characters." });
      const description =
        String(req.body.description || "")
          .trim()
          .slice(0, 2000) || null;
      const folderId = await workflowResourceFolder(access.workflow);
      const stored = await googleDriveService.uploadFile({
        folderId,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
        description: `${title} — ${access.workflow.name}`,
        appProperties: {
          entityType: "WORKFLOW_RESOURCE",
          workflowId: access.workflow.id,
        },
      });
      const resource = await prisma.$transaction(async (tx) => {
        const created = await tx.workflowResource.create({
          data: {
            workflowId: access.workflow.id,
            title,
            description,
            fileName: stored.fileName,
            mimeType: stored.mimeType,
            fileSize: BigInt(stored.sizeBytes),
            storagePath: stored.storagePath,
            googleDriveFileId: stored.fileId,
            uploadedBy: req.user!.id,
          },
          select: resourceSelect,
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "CREATE",
            entityType: "WorkflowResource",
            entityId: created.id,
            newValues: {
              workflowId: access.workflow.id,
              title,
              fileName: stored.fileName,
              version: 1,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
        const recipients = await tx.workflowEnrollment.findMany({
          where: { workflowId: access.workflow.id, status: "ACTIVE" },
          select: { userId: true },
          distinct: ["userId"],
        });
        if (recipients.length)
          await tx.notification.createMany({
            data: recipients.map(({ userId }) => ({
              audience: "researcher",
              recipientId: userId,
              type: "WORKFLOW_CHANGED" as const,
              title: "New workflow resource",
              message: `${title} was added to ${access.workflow.name}.`,
              entityType: "WORKFLOW_RESOURCE",
              entityId: created.id,
            })),
          });
        return created;
      });
      res.status(201).json({ resource: serializeResource(resource) });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to upload workflow resource.",
      });
    }
  },
);

router.patch(
  "/resources/:resourceId",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req, res) => {
    try {
      const existing = await prisma.workflowResource.findUnique({
        where: { id: req.params.resourceId as string },
      });
      if (!existing)
        return void res
          .status(404)
          .json({ error: "Workflow resource not found." });
      const access = await workflowAccess(existing.workflowId, req.user!);
      if (!access?.manages)
        return void res
          .status(404)
          .json({ error: "Workflow resource not found." });
      const title = String(req.body.title || "").trim();
      if (!title || title.length > 180)
        return void res
          .status(400)
          .json({ error: "Enter a resource title of up to 180 characters." });
      const description =
        String(req.body.description || "")
          .trim()
          .slice(0, 2000) || null;
      const resource = await prisma.$transaction(async (tx) => {
        const updated = await tx.workflowResource.update({
          where: { id: existing.id },
          data: { title, description },
          select: resourceSelect,
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "UPDATE",
            entityType: "WorkflowResource",
            entityId: existing.id,
            oldValues: {
              title: existing.title,
              description: existing.description,
            },
            newValues: { title, description },
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
        return updated;
      });
      res.json({ resource: serializeResource(resource) });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to update workflow resource.",
      });
    }
  },
);

router.post(
  "/resources/:resourceId/replace",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  resourceUpload.single("file"),
  async (req, res) => {
    try {
      const existing = await prisma.workflowResource.findUnique({
        where: { id: req.params.resourceId as string },
        include: { workflow: true },
      });
      if (!existing)
        return void res
          .status(404)
          .json({ error: "Workflow resource not found." });
      const access = await workflowAccess(existing.workflowId, req.user!);
      if (!access?.manages)
        return void res
          .status(404)
          .json({ error: "Workflow resource not found." });
      if (!req.file)
        return void res
          .status(400)
          .json({ error: "Select a replacement PDF, DOC, or DOCX file." });
      const folderId = await workflowResourceFolder(existing.workflow);
      const stored = await googleDriveService.uploadFile({
        folderId,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
        description: `${existing.title} — ${existing.workflow.name}`,
        appProperties: {
          entityType: "WORKFLOW_RESOURCE",
          workflowId: existing.workflowId,
        },
      });
      const nextVersion = existing.version + 1;
      const resource = await prisma.$transaction(async (tx) => {
        const updated = await tx.workflowResource.update({
          where: { id: existing.id },
          data: {
            fileName: stored.fileName,
            mimeType: stored.mimeType,
            fileSize: BigInt(stored.sizeBytes),
            storagePath: stored.storagePath,
            googleDriveFileId: stored.fileId,
            uploadedBy: req.user!.id,
            version: nextVersion,
          },
          select: resourceSelect,
        });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "UPDATE",
            entityType: "WorkflowResource",
            entityId: existing.id,
            oldValues: {
              fileName: existing.fileName,
              version: existing.version,
            },
            newValues: { fileName: stored.fileName, version: nextVersion },
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
        const recipients = await tx.workflowEnrollment.findMany({
          where: { workflowId: existing.workflowId, status: "ACTIVE" },
          select: { userId: true },
          distinct: ["userId"],
        });
        if (recipients.length)
          await tx.notification.createMany({
            data: recipients.map(({ userId }) => ({
              audience: "researcher",
              recipientId: userId,
              type: "WORKFLOW_CHANGED" as const,
              title: "Workflow resource updated",
              message: `${existing.title} was updated to Version ${nextVersion}.`,
              entityType: "WORKFLOW_RESOURCE",
              entityId: existing.id,
            })),
          });
        return updated;
      });
      if (existing.googleDriveFileId)
        googleDriveService
          .deleteFile(existing.googleDriveFileId)
          .catch(() => undefined);
      res.json({ resource: serializeResource(resource) });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to replace workflow resource.",
      });
    }
  },
);

router.get("/resources/:resourceId/file", requireAuth, async (req, res) => {
  try {
    const resource = await prisma.workflowResource.findUnique({
      where: { id: req.params.resourceId as string },
    });
    if (!resource || !(await workflowAccess(resource.workflowId, req.user!)))
      return void res
        .status(404)
        .json({ error: "Workflow resource not found." });
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "DOWNLOAD",
        entityType: "WorkflowResource",
        entityId: resource.id,
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || null,
      },
    });
    const disposition = req.query.download === "1" ? "attachment" : "inline";
    res.setHeader("Content-Type", resource.mimeType);
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename*=UTF-8''${encodeURIComponent(resource.fileName)}`,
    );
    if (fs.existsSync(resource.storagePath))
      return void res.sendFile(resource.storagePath);
    if (!resource.googleDriveFileId)
      return void res
        .status(404)
        .json({ error: "The stored file is unavailable." });
    const response = await googleDriveService.getFileStream(
      resource.googleDriveFileId,
    );
    response.data.pipe(res);
  } catch (error: any) {
    if (!res.headersSent)
      res
        .status(500)
        .json({ error: error.message || "Failed to open workflow resource." });
  }
});

router.delete(
  "/resources/:resourceId",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req, res) => {
    try {
      const existing = await prisma.workflowResource.findUnique({
        where: { id: req.params.resourceId as string },
      });
      if (!existing)
        return void res
          .status(404)
          .json({ error: "Workflow resource not found." });
      const access = await workflowAccess(existing.workflowId, req.user!);
      if (!access?.manages)
        return void res
          .status(404)
          .json({ error: "Workflow resource not found." });
      await prisma.$transaction([
        prisma.workflowResource.delete({ where: { id: existing.id } }),
        prisma.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "DELETE",
            entityType: "WorkflowResource",
            entityId: existing.id,
            oldValues: {
              workflowId: existing.workflowId,
              title: existing.title,
              fileName: existing.fileName,
              version: existing.version,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        }),
      ]);
      if (existing.googleDriveFileId)
        googleDriveService
          .deleteFile(existing.googleDriveFileId)
          .catch(() => undefined);
      else if (fs.existsSync(existing.storagePath))
        fs.unlink(existing.storagePath, () => undefined);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to remove workflow resource.",
      });
    }
  },
);

// GET /api/workflows
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { researchTypeId } = req.query;
    const scope = getCollegeScope(req.user!);
    if (scope.kind === "unassigned") {
      res.status(403).json({
        error:
          "Your account has not been assigned to a college or school. Contact the System Administrator.",
      });
      return;
    }
    const scopedResearchTypeIds =
      scope.kind === "college"
        ? (
            await prisma.researchType.findMany({
              where: {
                program: {
                  collegeId: scope.collegeId,
                  ...(req.user!.programId && { id: req.user!.programId }),
                },
              },
              select: { id: true },
            })
          ).map((item) => item.id)
        : null;

    const workflows = await prisma.workflow.findMany({
      where: {
        AND: [
          ...(req.user!.roles.includes("RESEARCHER")
            ? [
                {
                  status: "PUBLISHED" as const,
                  enrollments: {
                    some: { userId: req.user!.id, status: "ACTIVE" },
                  },
                },
              ]
            : []),
          ...(researchTypeId
            ? [{ researchTypeId: String(researchTypeId) }]
            : []),
          ...(scopedResearchTypeIds
            ? [{ researchTypeId: { in: scopedResearchTypeIds } }]
            : []),
        ],
      },
      include: {
        topics: { orderBy: { sequence: "asc" } },
        stages: {
          where: { category: { not: "Archived" } },
          orderBy: { sequence: "asc" },
          include: { topic: true, tasks: { orderBy: { sequence: "asc" } } },
        },
      },
    });

    res.json({ workflows });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch workflows" });
  }
});

// POST /api/workflows/:id/topics — create a grouping section for milestones.
router.post(
  "/:id/topics",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  validateBody(createWorkflowTopicSchema),
  async (req: Request, res: Response) => {
    try {
      const workflowId = req.params.id as string;
      const access = await workflowAccess(workflowId, req.user!);
      if (!access?.manages) {
        return void res
          .status(404)
          .json({ error: "Workflow not found in your academic scope." });
      }
      const duplicate = await prisma.workflowTopic.findFirst({
        where: {
          workflowId,
          title: { equals: req.body.title, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicate) {
        return void res.status(409).json({
          error: "A topic with this title already exists in the workflow.",
        });
      }
      const topic = await prisma.$transaction(async (tx) => {
        await normalizeWorkflowTopicSequences(tx, workflowId);
        const lastTopic = await tx.workflowTopic.findFirst({
          where: { workflowId },
          orderBy: { sequence: "desc" },
          select: { sequence: true },
        });
        return tx.workflowTopic.create({
          data: {
            workflowId,
            title: req.body.title,
            description: req.body.description || null,
            sequence: (lastTopic?.sequence || 0) + 1,
          },
        });
      });
      await recordPublishedWorkflowChange(
        workflowId,
        req.user!.id,
        `A new phase, ${topic.title}, was added.`,
        "WorkflowTopic",
        topic.id,
      );
      res.status(201).json({ topic });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to create workflow topic." });
    }
  },
);

router.patch(
  "/topics/:topicId",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  validateBody(updateWorkflowTopicSchema),
  async (req: Request, res: Response) => {
    try {
      const existing = await prisma.workflowTopic.findUnique({
        where: { id: req.params.topicId as string },
      });
      if (
        !existing ||
        !(await workflowAccess(existing.workflowId, req.user!))?.manages
      ) {
        return void res
          .status(404)
          .json({ error: "Workflow topic not found." });
      }
      if (req.body.title) {
        const duplicate = await prisma.workflowTopic.findFirst({
          where: {
            workflowId: existing.workflowId,
            id: { not: existing.id },
            title: { equals: req.body.title, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (duplicate) {
          return void res.status(409).json({
            error: "A topic with this title already exists in the workflow.",
          });
        }
      }
      const topic = await prisma.workflowTopic.update({
        where: { id: existing.id },
        data: {
          ...(req.body.title !== undefined && { title: req.body.title }),
          ...(req.body.description !== undefined && {
            description: req.body.description || null,
          }),
        },
      });
      await recordPublishedWorkflowChange(
        existing.workflowId,
        req.user!.id,
        `The ${topic.title} phase was updated.`,
        "WorkflowTopic",
        topic.id,
      );
      res.json({ topic });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to update workflow topic." });
    }
  },
);

router.patch(
  "/:id/topics/reorder",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  validateBody(reorderWorkflowTopicsSchema),
  async (req: Request, res: Response) => {
    try {
      const workflowId = req.params.id as string;
      const access = await workflowAccess(workflowId, req.user!);
      if (!access?.manages) {
        return void res
          .status(404)
          .json({ error: "Workflow not found in your academic scope." });
      }
      const topics = await prisma.workflowTopic.findMany({
        where: { workflowId },
        select: { id: true },
      });
      const existingIds = new Set(topics.map((topic) => topic.id));
      const requestedIds = req.body.topicIds as string[];
      if (
        requestedIds.length !== existingIds.size ||
        new Set(requestedIds).size !== requestedIds.length ||
        requestedIds.some((id) => !existingIds.has(id))
      ) {
        return void res.status(400).json({
          error: "Topic order must contain every workflow topic exactly once.",
        });
      }
      await prisma.$transaction(async (tx) => {
        for (let index = 0; index < requestedIds.length; index += 1) {
          await tx.workflowTopic.update({
            where: { id: requestedIds[index] },
            data: { sequence: 1_000_000 + index },
          });
        }
        for (let index = 0; index < requestedIds.length; index += 1) {
          await tx.workflowTopic.update({
            where: { id: requestedIds[index] },
            data: { sequence: index + 1 },
          });
        }
        await resequenceWorkflowStagesByTopics(tx, workflowId);
      });
      await recordPublishedWorkflowChange(
        workflowId,
        req.user!.id,
        "The order of research phases and milestones changed.",
        "Workflow",
        workflowId,
      );
      res.json({ success: true });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to reorder workflow topics." });
    }
  },
);

router.delete(
  "/topics/:topicId",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const topic = await prisma.workflowTopic.findUnique({
        where: { id: req.params.topicId as string },
        include: {
          stages: {
            where: { category: { not: "Archived" } },
            select: { id: true },
          },
        },
      });
      if (
        !topic ||
        !(await workflowAccess(topic.workflowId, req.user!))?.manages
      ) {
        return void res
          .status(404)
          .json({ error: "Workflow topic not found." });
      }
      if (topic.stages.length > 0) {
        return void res
          .status(409)
          .json({ error: "Move the topic's milestones before deleting it." });
      }
      await prisma.$transaction(async (tx) => {
        await tx.workflowTopic.delete({ where: { id: topic.id } });
        await normalizeWorkflowTopicSequences(tx, topic.workflowId);
      });
      await recordPublishedWorkflowChange(
        topic.workflowId,
        req.user!.id,
        `The empty ${topic.title} phase was removed.`,
        "WorkflowTopic",
        topic.id,
      );
      res.status(204).send();
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to delete workflow topic." });
    }
  },
);

// POST /api/workflows
router.post(
  "/",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_CREATE),
  validateBody(createWorkflowSchema),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { researchTypeId, name, description, stages = [] } = req.body;
      const scope = getCollegeScope(req.user);
      if (scope.kind === "unassigned") {
        res.status(403).json({
          error:
            "Your account has not been assigned to a college or school. Contact the System Administrator.",
        });
        return;
      }

      const researchType = await prisma.researchType.findFirst({
        where: {
          id: researchTypeId,
          isActive: true,
          ...(scope.kind === "college" && {
            program: {
              collegeId: scope.collegeId,
              ...(req.user.programId && { id: req.user.programId }),
            },
          }),
        },
        include: { program: { include: { college: true } } },
      });
      if (!researchType) {
        res.status(403).json({
          error:
            "The selected research type is outside your assigned department or program.",
        });
        return;
      }

      const departmentResearchTypeIds = (
        await prisma.researchType.findMany({
          where: { programId: researchType.programId },
          select: { id: true },
        })
      ).map((item) => item.id);
      const duplicate = await prisma.workflow.findFirst({
        where: {
          name: { equals: name.trim(), mode: "insensitive" },
          researchTypeId: { in: departmentResearchTypeIds },
        },
        select: { id: true },
      });
      if (duplicate) {
        res.status(409).json({
          error:
            "A workflow with this name already exists in your department or program.",
        });
        return;
      }

      const latestVersion = await prisma.workflow.aggregate({
        where: { researchTypeId },
        _max: { version: true },
      });

      const workflow = await prisma.workflow.create({
        data: {
          researchTypeId,
          name: name.trim(),
          description:
            typeof description === "string" && description.trim()
              ? description.trim()
              : null,
          version: (latestVersion._max.version || 0) + 1,
          status: "DRAFT",
          createdBy: req.user.id,
          stages: {
            create: stages.map((s: any) => ({
              name: s.name,
              description: s.description || null,
              category: s.category || "Milestone",
              sequence: s.sequence,
              responsibleRoleId: s.responsibleRoleId,
              requiresApproval: s.requiresApproval,
              requiresDocument:
                s.milestoneType === "ADVISER_SELECTION"
                  ? false
                  : s.requiresDocument,
              deadlineDays:
                s.targetCompletionDate !== undefined
                  ? null
                  : (s.deadlineDays ?? null),
              targetCompletionDate: s.targetCompletionDate
                ? new Date(`${s.targetCompletionDate}T00:00:00.000Z`)
                : null,
              isFinal: s.isFinal,
              submissionMode:
                s.milestoneType === "ADVISER_SELECTION"
                  ? "GROUP"
                  : s.submissionMode,
              milestoneType: s.milestoneType,
            })),
          },
        },
        include: {
          stages: {
            orderBy: { sequence: "asc" },
          },
        },
      });

      res.status(201).json({ workflow });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to create workflow" });
    }
  },
);

// DELETE /api/workflows/:id — only unused workflows can be permanently removed.
// A draft is private until this endpoint makes it authoritative. Publication
// updates the research type's shared pointer; project instances and immutable
// submission history are preserved in place.
router.post(
  "/:id/publish",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_PUBLISH),
  async (req: Request, res: Response) => {
    try {
      const workflowId = req.params.id as string;
      const access = await workflowAccess(workflowId, req.user!);
      if (!access?.manages)
        return void res
          .status(404)
          .json({ error: "Workflow not found in your academic scope." });
      if (access.workflow.status === "ARCHIVED")
        return void res
          .status(409)
          .json({ error: "Archived workflows cannot be published." });

      const result = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workflow-publish:${workflowId}`}))`;
          const current = await tx.workflow.findUnique({
            where: { id: workflowId },
            include: {
              topics: { orderBy: { sequence: "asc" } },
              stages: {
                orderBy: { sequence: "asc" },
                include: { tasks: { orderBy: { sequence: "asc" } } },
              },
            },
          });
          if (!current)
            throw Object.assign(new Error("Workflow not found."), {
              statusCode: 404,
            });
          if (current.status === "PUBLISHED")
            return { workflow: current, alreadyPublished: true, recipients: 0 };

          const issues = workflowPublicationIssues(current);
          if (issues.length)
            throw Object.assign(
              new Error("Complete the workflow before publishing."),
              { statusCode: 409, issues },
            );

          await resequenceWorkflowStagesByTopics(tx, workflowId);
          const publishedAt = new Date();
          const workflow = await tx.workflow.update({
            where: { id: workflowId },
            data: { status: "PUBLISHED", publishedAt },
            include: {
              topics: { orderBy: { sequence: "asc" } },
              stages: {
                where: { category: { not: "Archived" } },
                orderBy: { sequence: "asc" },
                include: {
                  topic: true,
                  tasks: { orderBy: { sequence: "asc" } },
                },
              },
            },
          });
          await tx.researchType.update({
            where: { id: workflow.researchTypeId },
            data: { workflowId: workflow.id },
          });

          const [enrollments, projects] = await Promise.all([
            tx.workflowEnrollment.findMany({
              where: { workflowId, status: "ACTIVE" },
              select: { userId: true },
            }),
            tx.researchProject.findMany({
              where: { workflowInstance: { is: { workflowId } } },
              select: {
                members: {
                  where: { leftAt: null },
                  select: { userId: true },
                },
              },
            }),
          ]);
          const recipients = new Set(enrollments.map(({ userId }) => userId));
          for (const project of projects)
            for (const member of project.members) recipients.add(member.userId);

          await createNotificationsOnce(
            tx,
            Array.from(recipients).map((recipientId) => ({
              recipientId,
              type: "WORKFLOW_CHANGED",
              title: "Research workflow published",
              message: `${workflow.name} is now available. Review your milestones, deadlines, and submission requirements.`,
              entityType: "Workflow",
              entityId: workflow.id,
              actionUrl: "/student/tasks",
              audience: "researcher",
              deduplicationKey: `workflow:${workflow.id}:published:${publishedAt.toISOString()}:${recipientId}`,
            })),
          );
          await tx.auditLog.create({
            data: {
              userId: req.user!.id,
              action: "UPDATE",
              entityType: "Workflow",
              entityId: workflow.id,
              oldValues: { status: current.status },
              newValues: {
                status: workflow.status,
                version: workflow.version,
                publishedAt,
              },
            },
          });
          return {
            workflow,
            alreadyPublished: false,
            recipients: recipients.size,
          };
        },
        { isolationLevel: "Serializable" },
      );

      res.json(result);
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({
        error: error.message || "Workflow could not be published.",
        ...(error?.issues ? { issues: error.issues } : {}),
      });
    }
  },
);

router.delete(
  "/:id",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!(await workflowAccess(id, req.user!))?.manages) {
        return void res.status(404).json({ error: "Workflow not found." });
      }
      await prisma.$transaction(async (tx) => {
        await lockWorkflowAccess(tx, id);
        const workflow = await tx.workflow.findUnique({ where: { id } });
        if (!workflow) {
          throw Object.assign(new Error("Workflow not found."), {
            statusCode: 404,
          });
        }
        if (req.body?.confirmation !== `sudo delete "${workflow.name}"`) {
          throw Object.assign(
            new Error(
              "Type the exact confirmation text, including the workflow name and quotation marks.",
            ),
            { statusCode: 400 },
          );
        }
        if (await tx.workflowInstance.count({ where: { workflowId: id } })) {
          throw Object.assign(
            new Error(
              "This workflow is linked to research projects and cannot be deleted. Academic records must be preserved.",
            ),
            { statusCode: 409 },
          );
        }
        await tx.workflow.delete({ where: { id } });
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "DELETE",
            entityType: "Workflow",
            entityId: id,
            oldValues: {
              name: workflow.name,
              researchTypeId: workflow.researchTypeId,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
      });
      res.json({ deleted: true });
    } catch (error: any) {
      if (error?.code === "P2025") {
        return void res.status(404).json({ error: "Workflow not found." });
      }
      if (error?.code === "P2003") {
        return void res.status(409).json({
          error:
            "This workflow is in use and cannot be deleted. Academic records must be preserved.",
        });
      }
      res.status(error.statusCode || 500).json({
        error: error.statusCode
          ? error.message
          : "Workflow could not be deleted. Please retry.",
      });
    }
  },
);

router.post("/:id/invitation", requireAuth, generateWorkflowCode);
router.get("/invitation/:code", requireAuth, previewWorkflow);
router.post("/join/:code", requireAuth, requestWorkflow);

router.get(
  "/enrollments/me",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const enrollments = await prisma.workflowEnrollment.findMany({
        where: {
          userId: req.user!.id,
          status: "ACTIVE",
          workflow: { status: "PUBLISHED" },
        },
        include: {
          workflow: {
            include: {
              creator: {
                select: { firstName: true, lastName: true, email: true },
              },
              stages: {
                where: { category: { not: "Archived" } },
                orderBy: { sequence: "asc" },
                include: {
                  topic: true,
                  tasks: { orderBy: { sequence: "asc" } },
                },
              },
            },
          },
        },
        orderBy: { joinedAt: "desc" },
      });
      const removedEnrollments = await prisma.workflowEnrollment.findMany({
        where: { userId: req.user!.id, status: "REVOKED" },
        select: { workflowId: true },
      });
      res.json({
        enrollments,
        removedWorkflowIds: removedEnrollments.map((item) => item.workflowId),
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to load workflow enrollments.",
      });
    }
  },
);

// GET /api/workflows/enrollments — accepted researchers in the professor's scope.
router.get(
  "/enrollments",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const scope = getCollegeScope(req.user!);
      if (scope.kind === "unassigned") {
        return void res.status(403).json({
          error: "Your account has not been assigned to a college or school.",
        });
      }

      const scopedResearchTypeIds =
        scope.kind === "college"
          ? (
              await prisma.researchType.findMany({
                where: {
                  program: {
                    collegeId: scope.collegeId,
                    ...(req.user!.programId && { id: req.user!.programId }),
                  },
                },
                select: { id: true },
              })
            ).map((item) => item.id)
          : null;

      const enrollments = await prisma.workflowEnrollment.findMany({
        where: {
          status: "ACTIVE",
          ...(scopedResearchTypeIds && {
            workflow: { researchTypeId: { in: scopedResearchTypeIds } },
          }),
        },
        include: {
          user: {
            select: {
              id: true,
              universityId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          workflow: { select: { id: true, name: true } },
        },
        orderBy: { joinedAt: "desc" },
      });

      res.json({ enrollments });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to load accepted researchers.",
      });
    }
  },
);

// DELETE /api/workflows/enrollments/:id — revoke a researcher's workflow enrollment.
router.delete(
  "/enrollments/:id",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const reason =
        typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (reason.length < 5 || reason.length > 500) {
        return void res.status(400).json({
          error: "Provide a removal reason between 5 and 500 characters.",
        });
      }
      const scope = getCollegeScope(req.user!);
      if (scope.kind === "unassigned") {
        return void res.status(403).json({
          error: "Your account has not been assigned to a college or school.",
        });
      }

      const scopedResearchTypeIds =
        scope.kind === "college"
          ? (
              await prisma.researchType.findMany({
                where: {
                  program: {
                    collegeId: scope.collegeId,
                    ...(req.user!.programId && { id: req.user!.programId }),
                  },
                },
                select: { id: true },
              })
            ).map((item) => item.id)
          : null;

      const enrollment = await prisma.workflowEnrollment.findFirst({
        where: {
          id: req.params.id as string,
          ...(scopedResearchTypeIds && {
            workflow: { researchTypeId: { in: scopedResearchTypeIds } },
          }),
        },
        include: {
          workflow: { select: { id: true, name: true } },
          user: {
            select: {
              id: true,
              universityId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!enrollment) {
        return void res.status(404).json({
          error: "Workflow enrollment was not found in your academic scope.",
        });
      }

      await prisma.$transaction(async (tx) => {
        await lockWorkflowAccess(tx, enrollment.workflowId);
        await tx.workflowAccessEntry.updateMany({
          where: {
            workflowId: enrollment.workflowId,
            userId: enrollment.userId,
            status: "PENDING",
          },
          data: {
            status: "REVOKED",
            decidedAt: new Date(),
            decidedBy: req.user!.id,
          },
        });
        await Promise.all([
          tx.workflowEnrollment.update({
            where: { id: enrollment.id },
            data: { status: "REVOKED" },
          }),
          tx.notification.create({
            data: {
              audience: "account",
              recipientId: enrollment.user.id,
              type: "WORKFLOW_CHANGED",
              title: "Workflow access removed",
              message: `Your enrollment in ${enrollment.workflow.name} was removed by the research coordinator. Reason: ${reason}`,
              entityType: "WORKFLOW_ENROLLMENT",
              entityId: enrollment.id,
            },
          }),
          tx.auditLog.create({
            data: {
              userId: req.user!.id,
              action: "UPDATE",
              entityType: "WorkflowEnrollment",
              entityId: enrollment.id,
              oldValues: {
                workflowId: enrollment.workflowId,
                workflowName: enrollment.workflow.name,
                researcherId: enrollment.userId,
                researcherName:
                  `${enrollment.user.firstName || ""} ${enrollment.user.lastName || ""}`.trim(),
                studentNumber: enrollment.user.universityId,
                researcherEmail: enrollment.user.email,
                status: enrollment.status,
                joinedAt: enrollment.joinedAt.toISOString(),
              },
              newValues: { status: "REVOKED", removalReason: reason },
              ipAddress: req.ip,
              userAgent: req.get("user-agent") || null,
            },
          }),
        ]);
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to remove the workflow enrollment.",
      });
    }
  },
);

// POST /api/workflows/deadlines/reminders — notify researchers selected from the professor deadline tracker.
router.post(
  "/deadlines/reminders",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const items = Array.isArray(req.body?.items)
        ? req.body.items.slice(0, 100)
        : [];
      if (!items.length) {
        return void res.status(400).json({
          error: "Select at least one deadline before sending reminders.",
        });
      }
      const researchIds: string[] = Array.from(
        new Set<string>(
          items
            .map((item: any) => String(item.researchId || ""))
            .filter((value: string) => Boolean(value)),
        ),
      );
      const taskIds: string[] = Array.from(
        new Set<string>(
          items
            .map((item: any) => String(item.taskId || ""))
            .filter((value: string) => Boolean(value)),
        ),
      );
      const [projects, tasks] = await Promise.all([
        prisma.researchProject.findMany({
          where: {
            id: { in: researchIds },
            status: { not: "ARCHIVED" },
            workflowInstance: { isNot: null },
          },
          select: {
            id: true,
            title: true,
            workflowInstance: { select: { workflowId: true } },
            members: {
              where: {
                leftAt: null,
                projectRole: { in: ["LEADER", "MEMBER"] },
              },
              select: { userId: true },
            },
          },
        }),
        prisma.workflowTask.findMany({
          where: { id: { in: taskIds } },
          select: {
            id: true,
            title: true,
            stage: { select: { workflowId: true } },
          },
        }),
      ]);
      const projectById = new Map(
        projects.map((project) => [project.id, project]),
      );
      const taskById = new Map(tasks.map((task) => [task.id, task]));
      const workflowIds = Array.from(
        new Set(
          projects
            .map((project) => project.workflowInstance?.workflowId)
            .filter(Boolean),
        ),
      ) as string[];
      const accessResults = await Promise.all(
        workflowIds.map((workflowId) => workflowAccess(workflowId, req.user!)),
      );
      const manageableWorkflowIds = new Set(
        accessResults
          .filter((result) => result?.manages)
          .map((result) => result!.workflow.id),
      );
      const notifications = new Map<string, any>();

      for (const item of items) {
        const project = projectById.get(String(item.researchId || ""));
        const task = taskById.get(String(item.taskId || ""));
        const workflowId = project?.workflowInstance?.workflowId;
        if (
          !project ||
          !task ||
          !workflowId ||
          task.stage.workflowId !== workflowId ||
          !manageableWorkflowIds.has(workflowId)
        )
          continue;
        for (const member of project.members) {
          notifications.set(`${member.userId}:${task.id}`, {
            recipientId: member.userId,
            type: "DEADLINE_APPROACHING" as const,
            title: `Reminder: ${task.title}`,
            message: `${project.title}: ${task.title} still needs your attention. Please check the workflow deadline tracker for the current schedule.`,
            entityType: "WorkflowTask",
            entityId: task.id,
          });
        }
      }

      if (!notifications.size) {
        return void res.status(400).json({
          error:
            "No eligible researchers were found for the selected deadlines.",
        });
      }
      const result = await prisma.notification.createMany({
        data: Array.from(notifications.values()).map((notification) => ({
          ...notification,
          audience: "researcher",
        })),
      });
      res.json({ success: true, recipientCount: result.count });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to send deadline reminders." });
    }
  },
);

// POST /api/workflows/:id/stages
router.post(
  "/:id/stages",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const workflowId = req.params.id as string;
      const access = await workflowAccess(workflowId, req.user!);
      if (!access?.manages) {
        return void res
          .status(404)
          .json({ error: "Workflow not found in your academic scope." });
      }
      const {
        name,
        description,
        topicId,
        category = "Milestone",
        deadlineDays,
        targetCompletionDate,
        requiresApproval = false,
        requiresDocument = true,
        submissionMode = "EITHER",
        isFinal = false,
        milestoneType = "STANDARD",
        position,
      } = req.body;
      if (!["STANDARD", "ADVISER_SELECTION"].includes(milestoneType)) {
        return void res
          .status(400)
          .json({ error: "Choose a valid milestone type." });
      }
      if (!["INDIVIDUAL", "GROUP", "EITHER"].includes(submissionMode)) {
        return void res
          .status(400)
          .json({ error: "Choose a valid milestone submission mode." });
      }

      if (!name || typeof name !== "string" || name.trim().length < 3) {
        res.status(400).json({
          error: "Milestone name must be at least 3 characters long.",
        });
        return;
      }

      const targetDate =
        targetCompletionDateSchema.safeParse(targetCompletionDate);
      if (!targetDate.success) {
        return void res.status(400).json({
          error: "Choose a valid target completion date (YYYY-MM-DD).",
        });
      }

      const deadline =
        targetCompletionDate !== undefined ||
        deadlineDays == null ||
        deadlineDays === ""
          ? null
          : Number(deadlineDays);
      if (
        deadline !== null &&
        (!Number.isInteger(deadline) || deadline < 0 || deadline > 3650)
      ) {
        res.status(400).json({
          error: "Deadline must be a whole number between 0 and 3650 days.",
        });
        return;
      }

      const [researcherRole, topic] = await Promise.all([
        prisma.role.findUnique({ where: { name: "RESEARCHER" } }),
        topicId
          ? prisma.workflowTopic.findFirst({
              where: { id: topicId, workflowId },
            })
          : Promise.resolve(null),
      ]);
      if (!researcherRole) {
        res.status(500).json({ error: "Researcher role is not configured." });
        return;
      }
      if (!topicId || !topic) {
        res
          .status(400)
          .json({ error: "Choose a valid topic for this milestone." });
        return;
      }

      const requestedPosition =
        position === null || position === undefined || position === ""
          ? null
          : Number(position);
      if (
        requestedPosition !== null &&
        (!Number.isInteger(requestedPosition) || requestedPosition < 1)
      ) {
        return void res.status(400).json({
          error: "Milestone position must be a positive whole number.",
        });
      }

      const stage = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workflowId}))`;
          await normalizeWorkflowStageSequences(tx, workflowId);
          if (milestoneType === "ADVISER_SELECTION") {
            const existingAdviserMilestone = await tx.workflowStage.findFirst({
              where: { workflowId, milestoneType: "ADVISER_SELECTION" },
              select: { id: true },
            });
            if (existingAdviserMilestone)
              throw Object.assign(
                new Error("This workflow already has an Adviser Milestone."),
                { statusCode: 409 },
              );
          }
          const lastStage = await tx.workflowStage.findFirst({
            where: { workflowId, category: { not: "Archived" } },
            orderBy: { sequence: "desc" },
          });
          const createdStage = await tx.workflowStage.create({
            data: {
              workflowId,
              topicId: topic.id,
              name: name.trim(),
              description:
                typeof description === "string" && description.trim()
                  ? description.trim()
                  : null,
              category: ["Milestone", "Compliance", "Pre-requisite"].includes(
                category,
              )
                ? category
                : "Milestone",
              sequence: (lastStage?.sequence || 0) + 1,
              responsibleRoleId: researcherRole.id,
              requiresApproval:
                milestoneType === "ADVISER_SELECTION"
                  ? true
                  : Boolean(requiresApproval),
              requiresDocument:
                milestoneType === "ADVISER_SELECTION"
                  ? false
                  : Boolean(requiresDocument),
              deadlineDays: deadline,
              targetCompletionDate: targetDate.data
                ? new Date(`${targetDate.data}T00:00:00.000Z`)
                : null,
              isFinal: Boolean(isFinal),
              submissionMode:
                milestoneType === "ADVISER_SELECTION"
                  ? "GROUP"
                  : submissionMode,
              milestoneType,
            },
          });
          if (
            createdStage.milestoneType !== "ADVISER_SELECTION" &&
            createdStage.requiresDocument
          ) {
            await tx.workflowTask.create({
              data: {
                stageId: createdStage.id,
                title: name.trim(),
                instructions: `Submit the required deliverable for ${name.trim()}.`,
                sequence: 1,
                dueDays: deadline,
                allowedFileTypes: "PDF,DOCX",
                isRequired: true,
              },
            });
          }
          await resequenceWorkflowStagesByTopics(tx, workflowId);
          await positionWorkflowStageWithinTopic(
            tx,
            workflowId,
            createdStage.id,
            requestedPosition,
          );
          return tx.workflowStage.findUniqueOrThrow({
            where: { id: createdStage.id },
          });
        },
        { isolationLevel: "Serializable" },
      );

      const assignedProjects = await prisma.researchProject.findMany({
        where: { workflowInstance: { is: { workflowId } } },
        select: {
          id: true,
          workflowInstance: {
            select: { id: true, currentStage: { select: { sequence: true } } },
          },
        },
      });
      let adviserSynchronizationFailures = 0;
      if (stage.milestoneType === "ADVISER_SELECTION") {
        const synchronization = await Promise.allSettled(
          assignedProjects.map((project) =>
            prisma.$transaction(async (tx) => {
              if (
                project.workflowInstance?.currentStage &&
                stage.sequence <= project.workflowInstance.currentStage.sequence
              ) {
                await tx.workflowInstance.update({
                  where: { id: project.workflowInstance.id },
                  data: { currentStageId: stage.id },
                });
              }
              return synchronizeAdviserMilestone(tx, {
                researchId: project.id,
                actorId: req.user!.id,
                workflowStageId: stage.id,
              });
            }),
          ),
        );
        adviserSynchronizationFailures = synchronization.filter(
          (result) => result.status === "rejected",
        ).length;
      }
      await recordPublishedWorkflowChange(
        workflowId,
        req.user!.id,
        `A new milestone, ${stage.name}, was added and is now visible in the shared research process.`,
        "WorkflowStage",
        stage.id,
      );
      res.status(201).json({
        stage,
        adviserSynchronizationFailures,
        storageProvisioning: {
          assignedGroups: assignedProjects.length,
          status: assignedProjects.length ? "QUEUED" : "NOT_REQUIRED",
        },
      });

      // Google Drive provisioning continues after the response so milestone
      // creation never waits for external storage calls.
      if (stage.milestoneType !== "ADVISER_SELECTION")
        void (async () => {
          let failedGroups = 0;
          const concurrency = 3;
          for (
            let index = 0;
            index < assignedProjects.length;
            index += concurrency
          ) {
            const batch = assignedProjects.slice(index, index + concurrency);
            const results = await Promise.allSettled(
              batch.map((project) =>
                storageHierarchyService.provisionStage(project.id, stage.id),
              ),
            );
            failedGroups += results.filter(
              (result) => result.status === "rejected",
            ).length;
          }
          if (failedGroups)
            console.error(
              `Milestone ${stage.id} storage provisioning failed for ${failedGroups} group(s).`,
            );
        })();
    } catch (error: any) {
      const duplicateAdviserMilestone =
        error?.statusCode === 409 ||
        (error?.code === "P2002" &&
          String(error?.meta?.target || "").includes("adviser_selection"));
      res.status(duplicateAdviserMilestone ? 409 : 500).json({
        error: error.message || "Failed to create workflow milestone",
      });
    }
  },
);

// DELETE /api/workflows/stages/:stageId
router.delete(
  "/stages/:stageId",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const stageId = req.params.stageId as string;
      const stage = await prisma.workflowStage.findUnique({
        where: { id: stageId },
        include: { tasks: { select: { id: true } } },
      });
      if (!stage)
        return void res
          .status(404)
          .json({ error: "Workflow milestone not found." });
      if (!(await workflowAccess(stage.workflowId, req.user!))?.manages)
        return void res
          .status(404)
          .json({ error: "Workflow milestone not found." });

      const taskIds = stage.tasks.map((task) => task.id);
      const [activeUsage, submissions, transitions] = await Promise.all([
        prisma.workflowInstance.count({ where: { currentStageId: stageId } }),
        taskIds.length
          ? prisma.taskSubmission.count({ where: { taskId: { in: taskIds } } })
          : 0,
        prisma.workflowTransition.count({
          where: { OR: [{ fromStageId: stageId }, { toStageId: stageId }] },
        }),
      ]);

      if (!activeUsage && !submissions && !transitions) {
        await prisma.workflowStage.delete({ where: { id: stageId } });
        await recordPublishedWorkflowChange(
          stage.workflowId,
          req.user!.id,
          `The unused milestone ${stage.name} was removed.`,
          "WorkflowStage",
          stage.id,
        );
        res.status(204).send();
        return;
      }

      const replacement =
        (await prisma.workflowStage.findFirst({
          where: {
            workflowId: stage.workflowId,
            category: { not: "Archived" },
            sequence: { lt: stage.sequence },
          },
          orderBy: { sequence: "desc" },
        })) ||
        (await prisma.workflowStage.findFirst({
          where: {
            workflowId: stage.workflowId,
            category: { not: "Archived" },
            sequence: { gt: stage.sequence },
          },
          orderBy: { sequence: "asc" },
        }));

      await prisma.$transaction(async (tx) => {
        await tx.workflowInstance.updateMany({
          where: { currentStageId: stageId },
          data: { currentStageId: replacement?.id || null },
        });
        await tx.workflowStage.update({
          where: { id: stageId },
          data: { category: "Archived" },
        });
        await normalizeWorkflowStageSequences(tx, stage.workflowId);
      });
      await recordPublishedWorkflowChange(
        stage.workflowId,
        req.user!.id,
        `The milestone ${stage.name} was retired. Existing submissions and review history were preserved.`,
        "WorkflowStage",
        stage.id,
      );
      res.status(200).json({
        archived: true,
        preservedSubmissions: submissions,
        reassignedGroups: activeUsage,
        replacementStage: replacement
          ? { id: replacement.id, name: replacement.name }
          : null,
      });
    } catch (error: any) {
      if (error?.code === "P2025") {
        res.status(404).json({ error: "Workflow milestone not found." });
        return;
      }
      res.status(500).json({
        error: error.message || "Failed to delete workflow milestone",
      });
    }
  },
);

// POST /api/workflows/instances/:id/transition
router.post(
  "/instances/:id/transition",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  validateBody(workflowTransitionSchema),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const id = req.params.id as string;
      const { toStageId, remarks } = req.body;

      const instance = await prisma.workflowInstance.findUnique({
        where: { id },
        include: {
          currentStage: true,
          research: true,
        },
      });

      if (!instance) {
        res.status(404).json({ error: "Workflow instance not found" });
        return;
      }
      if (!(await workflowAccess(instance.workflowId, req.user!))?.manages) {
        res.status(404).json({ error: "Workflow instance not found" });
        return;
      }

      const targetStage = await prisma.workflowStage.findUnique({
        where: { id: toStageId },
      });

      if (!targetStage || targetStage.workflowId !== instance.workflowId) {
        res.status(404).json({ error: "Target workflow stage not found" });
        return;
      }

      // Record transition and advance stage in transaction
      const updatedInstance = await prisma.$transaction(async (tx) => {
        await tx.workflowTransition.create({
          data: {
            workflowInstanceId: instance.id,
            fromStageId: instance.currentStageId,
            toStageId: targetStage.id,
            performedBy: req.user!.id,
            remarks: remarks || null,
          },
        });

        const updated = await tx.workflowInstance.update({
          where: { id: instance.id },
          data: {
            currentStageId: targetStage.id,
            ...(targetStage.isFinal && { completedAt: new Date() }),
          },
          include: {
            currentStage: true,
            transitions: {
              orderBy: { createdAt: "desc" },
            },
          },
        });

        // If target stage is final, update research project status
        if (targetStage.isFinal) {
          await tx.researchProject.update({
            where: { id: instance.researchId },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
            },
          });
        }

        return updated;
      });

      res.json({ workflowInstance: updatedInstance });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Failed to execute workflow transition",
      });
    }
  },
);

// PATCH /api/workflows/stages/:stageId
router.patch(
  "/stages/:stageId",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const stageId = req.params.stageId as string;
      const {
        name,
        description,
        topicId,
        category,
        deadlineDays,
        targetCompletionDate,
        requiresApproval,
        requiresDocument,
        isFinal,
        submissionMode,
      } = req.body;

      const existing = await prisma.workflowStage.findUnique({
        where: { id: stageId },
      });
      if (
        !existing ||
        !(await workflowAccess(existing.workflowId, req.user!))?.manages
      ) {
        return void res
          .status(404)
          .json({ error: "Workflow milestone not found." });
      }
      if (
        existing.milestoneType === "ADVISER_SELECTION" &&
        ((requiresDocument !== undefined && Boolean(requiresDocument)) ||
          (requiresApproval !== undefined && !Boolean(requiresApproval)) ||
          (submissionMode !== undefined && submissionMode !== "GROUP"))
      ) {
        return void res.status(400).json({
          error:
            "An Adviser Milestone is completed only by official adviser acceptance and must remain a group approval gate without document uploads.",
        });
      }
      if (topicId !== undefined) {
        const topic = topicId
          ? await prisma.workflowTopic.findFirst({
              where: { id: topicId, workflowId: existing.workflowId },
            })
          : null;
        if (!topic) {
          return void res
            .status(400)
            .json({ error: "Choose a valid topic for this milestone." });
        }
      }

      const targetDate =
        targetCompletionDateSchema.safeParse(targetCompletionDate);
      if (!targetDate.success) {
        return void res.status(400).json({
          error: "Choose a valid target completion date (YYYY-MM-DD).",
        });
      }
      const deadline =
        deadlineDays == null || deadlineDays === ""
          ? null
          : Number(deadlineDays);
      if (
        targetCompletionDate === undefined &&
        deadlineDays !== undefined &&
        deadline !== null &&
        (!Number.isInteger(deadline) || deadline < 0 || deadline > 3650)
      ) {
        return void res.status(400).json({
          error: "Deadline must be a whole number between 0 and 3650 days.",
        });
      }

      const stage = await prisma.$transaction(async (tx) => {
        await tx.workflowStage.update({
          where: { id: stageId },
          data: {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(topicId !== undefined && { topicId }),
            ...(category !== undefined && { category }),
            ...(targetCompletionDate !== undefined
              ? {
                  targetCompletionDate: targetDate.data
                    ? new Date(`${targetDate.data}T00:00:00.000Z`)
                    : null,
                  deadlineDays: null,
                }
              : deadlineDays !== undefined && { deadlineDays: deadline }),
            ...(requiresApproval !== undefined && {
              requiresApproval:
                existing.milestoneType === "ADVISER_SELECTION"
                  ? true
                  : Boolean(requiresApproval),
            }),
            ...(requiresDocument !== undefined && {
              requiresDocument:
                existing.milestoneType === "ADVISER_SELECTION"
                  ? false
                  : Boolean(requiresDocument),
            }),
            ...(isFinal !== undefined && { isFinal: Boolean(isFinal) }),
            ...(submissionMode !== undefined &&
              ["INDIVIDUAL", "GROUP", "EITHER"].includes(submissionMode) && {
                submissionMode:
                  existing.milestoneType === "ADVISER_SELECTION"
                    ? "GROUP"
                    : submissionMode,
              }),
          },
        });
        // Earlier creation copied the milestone's relative target into its tasks.
        // Remove those inherited offsets when explicitly replacing/clearing it.
        if (
          targetCompletionDate !== undefined &&
          existing.deadlineDays !== null
        ) {
          await tx.workflowTask.updateMany({
            where: { stageId, dueDays: existing.deadlineDays },
            data: { dueDays: null },
          });
        }
        if (topicId !== undefined && topicId !== existing.topicId) {
          await resequenceWorkflowStagesByTopics(tx, existing.workflowId);
        }
        return tx.workflowStage.findUniqueOrThrow({ where: { id: stageId } });
      });

      await recordPublishedWorkflowChange(
        existing.workflowId,
        req.user!.id,
        `The milestone ${stage.name} was updated.`,
        "WorkflowStage",
        stage.id,
      );
      res.json({ stage });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to update workflow stage" });
    }
  },
);

// POST /api/workflows/stages/:stageId/toggle-lock
router.post(
  "/stages/:stageId/toggle-lock",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const stageId = req.params.stageId as string;

      const currentStage = await prisma.workflowStage.findUnique({
        where: { id: stageId },
      });

      if (!currentStage) {
        res.status(404).json({ error: "Workflow stage not found" });
        return;
      }
      if (
        !(await workflowAccess(currentStage.workflowId, req.user!))?.manages
      ) {
        res.status(404).json({ error: "Workflow stage not found" });
        return;
      }
      if (currentStage.milestoneType === "ADVISER_SELECTION") {
        return void res.status(409).json({
          error:
            "The Adviser Milestone remains locked until an eligible adviser accepts the group's request.",
        });
      }

      const updated = await prisma.workflowStage.update({
        where: { id: stageId },
        data: {
          requiresApproval: !currentStage.requiresApproval,
        },
      });

      res.json({ stage: updated, locked: updated.requiresApproval });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to toggle stage lock" });
    }
  },
);

// POST /api/workflows/stages/:stageId/tasks — professor creates a requirement under a milestone.
router.post(
  "/stages/:stageId/tasks",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const stageId = req.params.stageId as string;
      const {
        title,
        instructions,
        dueDays,
        allowedFileTypes = "PDF,DOCX",
        isRequired = true,
      } = req.body;
      if (!title || typeof title !== "string" || title.trim().length < 3)
        return void res
          .status(400)
          .json({ error: "Task title must be at least 3 characters." });
      const deadline =
        dueDays === null || dueDays === undefined || dueDays === ""
          ? null
          : Number(dueDays);
      if (
        deadline !== null &&
        (!Number.isInteger(deadline) || deadline < 0 || deadline > 3650)
      )
        return void res
          .status(400)
          .json({ error: "Due days must be between 0 and 3650." });
      const stage = await prisma.workflowStage.findUnique({
        where: { id: stageId },
      });
      if (!stage)
        return void res
          .status(404)
          .json({ error: "Workflow milestone not found." });
      if (!(await workflowAccess(stage.workflowId, req.user!))?.manages)
        return void res
          .status(404)
          .json({ error: "Workflow milestone not found." });
      if (stage.milestoneType === "ADVISER_SELECTION") {
        return void res.status(409).json({
          error:
            "Adviser Milestones do not accept submission requirements. They are completed automatically by adviser acceptance.",
        });
      }
      const lastTask = await prisma.workflowTask.findFirst({
        where: { stageId },
        orderBy: { sequence: "desc" },
      });
      const task = await prisma.workflowTask.create({
        data: {
          stageId,
          title: title.trim(),
          instructions: instructions?.trim() || null,
          sequence: (lastTask?.sequence || 0) + 1,
          dueDays: stage.targetCompletionDate ? null : deadline,
          allowedFileTypes: String(
            allowedFileTypes || "PDF,DOCX",
          ).toUpperCase(),
          isRequired: Boolean(isRequired),
        },
      });
      await recordPublishedWorkflowChange(
        stage.workflowId,
        req.user!.id,
        `A submission requirement was added to ${stage.name}.`,
        "WorkflowTask",
        task.id,
      );
      res.status(201).json({ task });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to create workflow task" });
    }
  },
);

// POST /api/workflows/stages/:stageId/start — initialize an older milestone as a shared group task.
router.post(
  "/stages/:stageId/start",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Unauthorized" });
      const stageId = req.params.stageId as string;
      const { researchId } = req.body;
      if (!researchId)
        return void res.status(400).json({ error: "researchId is required." });

      const project = await prisma.researchProject.findFirst({
        where: {
          id: researchId,
          members: {
            some: {
              userId: req.user.id,
              projectRole: { in: ["LEADER", "MEMBER"] },
              leftAt: null,
            },
          },
        },
        include: { workflowInstance: { include: { currentStage: true } } },
      });
      if (!project?.workflowInstance)
        return void res.status(403).json({
          error: "You are not an active member of this research group.",
        });

      if (
        !(await hasActiveWorkflowEnrollment(
          req.user.id,
          project.workflowInstance.workflowId,
        ))
      ) {
        return void res.status(403).json({
          error: "Your access to this workflow was removed by the professor.",
        });
      }
      const stage = await prisma.workflowStage.findFirst({
        where: { id: stageId, workflowId: project.workflowInstance.workflowId },
      });
      if (!stage)
        return void res.status(404).json({
          error: "This milestone is not part of the project workflow.",
        });
      if (stage.milestoneType === "ADVISER_SELECTION") {
        return void res.status(409).json({
          error:
            "Use the Adviser Pool to complete this milestone. Only the group leader may send an adviser request.",
        });
      }
      if (
        project.workflowInstance.currentStage &&
        stage.sequence > project.workflowInstance.currentStage.sequence &&
        stage.requiresApproval
      ) {
        return void res.status(409).json({
          error: "Complete the preceding milestone before starting this task.",
        });
      }

      if (!stage.requiresDocument) {
        res.status(200).json({ task: null, requiresDocument: false, stage });
        return;
      }

      const task = await prisma.workflowTask.upsert({
        where: { stageId_sequence: { stageId, sequence: 1 } },
        update: {},
        create: {
          stageId,
          title: stage.name,
          instructions:
            stage.description ||
            `Complete the ${stage.name} milestone and submit the required deliverable.`,
          sequence: 1,
          dueDays: stage.targetCompletionDate ? null : stage.deadlineDays,
          allowedFileTypes: "PDF,DOCX",
          isRequired: true,
        },
      });
      res.status(201).json({ task, requiresDocument: true, stage });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to start milestone task" });
    }
  },
);

router.delete(
  "/tasks/:taskId",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const taskId = req.params.taskId as string;
      const task = await prisma.workflowTask.findUnique({
        where: { id: taskId },
        select: {
          title: true,
          stage: { select: { workflowId: true, name: true } },
        },
      });
      if (
        !task ||
        !(await workflowAccess(task.stage.workflowId, req.user!))?.manages
      )
        return void res.status(404).json({ error: "Workflow task not found." });
      const submissions = await prisma.taskSubmission.count({
        where: { taskId },
      });
      if (submissions)
        return void res.status(409).json({
          error: "A task with student submissions cannot be deleted.",
        });
      await prisma.workflowTask.delete({ where: { id: taskId } });
      await recordPublishedWorkflowChange(
        task.stage.workflowId,
        req.user!.id,
        `The ${task.title} requirement was removed from ${task.stage.name}.`,
        "WorkflowTask",
        taskId,
      );
      res.status(204).send();
    } catch (error: any) {
      if (error?.code === "P2025")
        return void res.status(404).json({ error: "Workflow task not found." });
      res
        .status(500)
        .json({ error: error.message || "Failed to delete workflow task" });
    }
  },
);

// GET /api/workflows/tasks/:taskId/submission-options
// Returns only eligible project-owned document choices. All POST routes
// revalidate these policies against current server state.
router.get(
  "/tasks/:taskId/submission-options",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const researchId =
        typeof req.query.researchId === "string"
          ? req.query.researchId.trim()
          : "";
      if (!researchId) {
        return void res.status(400).json({
          error: "researchId is required.",
          code: "RESEARCH_ID_REQUIRED",
        });
      }
      const result = await getTaskSubmissionOptions({
        user: req.user!,
        researchId,
        taskId: req.params.taskId as string,
      });
      res.json(result);
    } catch (error: any) {
      if (error instanceof SubmissionIntegrityError) {
        return void res
          .status(error.statusCode)
          .json({ error: error.message, code: error.code });
      }
      res.status(500).json({
        error: error?.message || "Failed to load task submission options.",
      });
    }
  },
);

// One authoritative operation uploads the blob and commits all related
// submission records. The existing link route below remains backward compatible.
router.post(
  "/tasks/:taskId/submissions/upload",
  requireAuth,
  resourceUpload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file)
        return void res
          .status(400)
          .json({ error: "Choose a PDF, DOC, or DOCX file." });
      const researchId = String(req.body.researchId || "");
      const clientKey = String(req.body.idempotencyKey || "")
        .trim()
        .slice(0, 100);
      const title = String(req.body.title || req.file.originalname)
        .trim()
        .slice(0, 255);
      if (!researchId || !clientKey || !title)
        return void res.status(400).json({
          error: "researchId, idempotencyKey, and title are required.",
        });
      if (
        req.file.mimetype === "application/pdf" &&
        req.file.buffer.subarray(0, 5).toString() !== "%PDF-"
      )
        return void res
          .status(400)
          .json({ error: "The uploaded file is not a valid PDF." });

      const result = await uploadTaskSubmission({
        user: req.user!,
        researchId,
        taskId: String(req.params.taskId),
        clientKey,
        title,
        note: String(req.body.note || "").trim() || null,
        file: req.file,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error: any) {
      res
        .status(error?.statusCode || 500)
        .json({ error: error.message || "Failed to upload task submission." });
    }
  },
);

router.post(
  "/tasks/:taskId/submissions",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Unauthorized" });
      const taskId = req.params.taskId as string;
      const { researchId, documentId, documentVersionId, note } = req.body;
      if (!researchId || !documentId)
        return void res
          .status(400)
          .json({ error: "researchId and documentId are required." });
      const result = await submitStoredTaskVersion({
        user: req.user,
        researchId,
        taskId,
        documentId,
        documentVersionId,
        note,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      const { project, task, submission } = result;

      // Notifications are best-effort and must never roll back a valid group submission.
      const candidateRecipientIds = new Set<string>();
      const workflowOwnerId = project.workflowInstance?.workflow.createdBy;
      if (workflowOwnerId && workflowOwnerId !== req.user.id)
        candidateRecipientIds.add(workflowOwnerId);
      project.members
        .filter((member) => member.projectRole === "ADVISER")
        .forEach((member) => {
          if (member.userId !== req.user!.id)
            candidateRecipientIds.add(member.userId);
        });
      if (!result.duplicate && candidateRecipientIds.size) {
        try {
          const validRecipients = await prisma.user.findMany({
            where: {
              id: { in: Array.from(candidateRecipientIds) },
              status: "ACTIVE",
            },
            select: { id: true },
          });
          if (validRecipients.length) {
            await createNotificationsOnce(
              prisma,
              validRecipients.map(({ id: recipientId }) => ({
                recipientId,
                type: "DOCUMENT_UPLOADED",
                title: "Research task submitted",
                message: `${project.title}: ${task.title} was submitted for review.`,
                entityType: "TaskSubmission",
                entityId: submission.id,
                actionUrl: `/research/manuscript?projectId=${researchId}&milestoneId=${task.stageId}&taskId=${task.id}&documentId=${documentId}&versionId=${result.snapshotVersionId}`,
                deduplicationKey: `task-attempt:${submission.documentVersionId}:submitted:${recipientId}`,
              })),
            );
          }
        } catch (notificationError) {
          console.error(
            "Task submission saved, but reviewer notifications failed:",
            notificationError,
          );
        }
      }
      res.status(result.duplicate ? 200 : 201).json({ submission });
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({
        error: error.message || "Failed to submit task requirement",
        ...(error?.code ? { code: error.code } : {}),
      });
    }
  },
);

router.patch(
  "/tasks/submissions/:submissionId/review",
  requireAuth,
  requirePermission(Permissions.WORKFLOW_EDIT),
  async (req: Request, res: Response) => {
    try {
      const { status, reviewNote } = req.body;
      const allowed = [
        "UNDER_REVIEW",
        "REVISION_REQUIRED",
        "APPROVED",
        "REJECTED",
      ];
      if (!allowed.includes(status))
        return void res
          .status(400)
          .json({ error: "Invalid task review status." });
      if (
        ["REVISION_REQUIRED", "REJECTED"].includes(status) &&
        (!reviewNote || !String(reviewNote).trim())
      ) {
        return void res.status(400).json({
          error:
            "Feedback is required when requesting a revision or rejecting a submission.",
        });
      }
      const submissionId = req.params.submissionId as string;
      const existing = await prisma.taskSubmission.findUnique({
        where: { id: submissionId },
        include: {
          task: {
            include: {
              stage: {
                include: {
                  responsible: { select: { name: true } },
                  workflow: { select: { createdBy: true } },
                },
              },
            },
          },
          research: {
            include: {
              members: {
                where: { leftAt: null },
                select: { userId: true, projectRole: true },
              },
              workflowInstance: { include: { currentStage: true } },
            },
          },
          documentVersion: {
            select: {
              id: true,
              isImmutable: true,
              manuscriptStatus: true,
              reviewerAssignments: {
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      });
      if (!existing)
        return void res
          .status(404)
          .json({ error: "Task submission not found." });
      if (existing.documentVersion?.reviewerAssignments.length)
        return void res.status(409).json({
          error:
            "This task is synchronized with the formal manuscript review workflow. Submit the assigned exact-version reviewer decision instead.",
        });
      if (
        !req.user ||
        !canReviewTaskSubmission(req.user, {
          submittedBy: existing.submittedBy,
          researchCollegeId: existing.research.collegeId,
          workflowOwnerId: existing.task.stage.workflow.createdBy,
          responsibleRole: existing.task.stage.responsible.name,
        })
      ) {
        return void res.status(403).json({
          error:
            "You are not assigned to review this project's task submission.",
        });
      }
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.taskSubmission.update({
          where: { id: submissionId },
          data: {
            status,
            reviewNote: reviewNote?.trim() || null,
            reviewedAt: new Date(),
          },
        });
        if (existing.documentVersionId)
          await tx.taskSubmissionAttempt.updateMany({
            where: {
              taskSubmissionId: existing.id,
              documentVersionId: existing.documentVersionId,
            },
            data: {
              status,
              reviewNote: reviewNote?.trim() || null,
              reviewedAt: new Date(),
            },
          });
        const progression =
          status === "APPROVED"
            ? await advanceMilestoneIfSatisfied(tx, {
                researchId: existing.researchId,
                milestoneId: existing.task.stage.id,
                actorId: req.user!.id,
              })
            : { advanced: false, completed: false };

        const recipients = new Set(
          existing.research.members
            .filter(
              (member) =>
                ["LEADER", "MEMBER", "ADVISER"].includes(member.projectRole) &&
                member.userId !== req.user!.id,
            )
            .map((member) => member.userId),
        );
        if (recipients.size) {
          await createNotificationsOnce(
            tx,
            Array.from(recipients).map((recipientId) => ({
              recipientId,
              type:
                status === "REVISION_REQUIRED" || status === "REJECTED"
                  ? ("REVISION_REQUESTED" as const)
                  : ("DOCUMENT_REVIEWED" as const),
              title: `Task ${String(status).toLowerCase().replace(/_/g, " ")}`,
              message: `${existing.task.title} for ${existing.research.title} is now ${String(status).toLowerCase().replace(/_/g, " ")}.`,
              entityType: "TaskSubmission",
              entityId: updated.id,
              actionUrl: `/research/manuscript?projectId=${existing.researchId}&milestoneId=${existing.task.stage.id}&taskId=${existing.task.id}&documentId=${existing.documentId}${existing.documentVersionId ? `&versionId=${existing.documentVersionId}` : ""}`,
              deduplicationKey: `task:${updated.id}:review:${status}:${recipientId}`,
            })),
          );
        }
        return { submission: updated, progression };
      });
      res.json(result);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to review task submission" });
    }
  },
);

export default router;
