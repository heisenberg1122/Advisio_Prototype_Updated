import { Router, Request, Response } from "express";
import { storageHierarchyService } from "../services/storage-hierarchy.service.js";
import { prisma } from "../lib/prisma.js";
import {
  createWorkflowTopicSchema,
  createWorkflowSchema,
  reorderWorkflowTopicsSchema,
  updateWorkflowTopicSchema,
  workflowTransitionSchema,
} from "@research-management/validations";
import { Permissions } from "@research-management/auth";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { getCollegeScope } from "../lib/college-scope.js";
import { randomBytes } from "node:crypto";
import multer from "multer";
import fs from "node:fs";
import { googleDriveService } from "../services/google-drive.service.js";

const router = Router();
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

async function workflowAccess(workflowId: string, user: NonNullable<Request["user"]>) {
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) return null;
  const researchType = await prisma.researchType.findUnique({
    where: { id: workflow.researchTypeId },
    select: { program: { select: { id: true, collegeId: true } } },
  });
  const program = researchType?.program;
  const scope = getCollegeScope(user);
  const manages = user.roles.some((role) => ["RESEARCH_COORDINATOR", "RPO", "SYSTEM_ADMIN"].includes(role)) &&
    (scope.kind === "institution" || Boolean(scope.kind === "college" && program && scope.collegeId === program.collegeId && (!user.programId || user.programId === program.id)));
  if (manages) return { workflow, manages: true };
  const [enrollment, membership] = await Promise.all([
    prisma.workflowEnrollment.findFirst({ where: { workflowId, userId: user.id, status: "ACTIVE" }, select: { id: true } }),
    prisma.researchMember.findFirst({ where: { userId: user.id, leftAt: null, research: { workflowInstance: { is: { workflowId } } } }, select: { id: true } }),
  ]);
  return enrollment || membership ? { workflow, manages: false } : null;
}

async function workflowResourceFolder(workflow: { id: string; name: string }) {
  return googleDriveService.ensureFolderPath([
    { name: "02_WORKFLOW_RESOURCES", key: "workflow-resources" },
    { name: workflow.name, key: `workflow:${workflow.id}`, entityType: "WORKFLOW", entityId: workflow.id },
  ]);
}

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
}

// Workflow-wide reference files shared with every researcher in the workflow.
router.get("/:id/resources", requireAuth, async (req, res) => {
  try {
    const access = await workflowAccess(req.params.id as string, req.user!);
    if (!access) return void res.status(404).json({ error: "Workflow resources were not found." });
    const resources = await prisma.workflowResource.findMany({
      where: { workflowId: access.workflow.id },
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      select: resourceSelect,
    });
    res.json({ resources: resources.map(serializeResource), canManage: access.manages });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load workflow resources." });
  }
});

router.post("/:id/resources", requireAuth, requirePermission(Permissions.WORKFLOW_EDIT), resourceUpload.single("file"), async (req, res) => {
  try {
    const access = await workflowAccess(req.params.id as string, req.user!);
    if (!access?.manages) return void res.status(404).json({ error: "Workflow not found in your academic scope." });
    if (!req.file) return void res.status(400).json({ error: "Select a PDF, DOC, or DOCX file." });
    const title = String(req.body.title || "").trim();
    if (!title || title.length > 180) return void res.status(400).json({ error: "Enter a resource title of up to 180 characters." });
    const description = String(req.body.description || "").trim().slice(0, 2000) || null;
    const folderId = await workflowResourceFolder(access.workflow);
    const stored = await googleDriveService.uploadFile({
      folderId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
      description: `${title} — ${access.workflow.name}`,
      appProperties: { entityType: "WORKFLOW_RESOURCE", workflowId: access.workflow.id },
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
      await tx.auditLog.create({ data: { userId: req.user!.id, action: "CREATE", entityType: "WorkflowResource", entityId: created.id, newValues: { workflowId: access.workflow.id, title, fileName: stored.fileName, version: 1 }, ipAddress: req.ip, userAgent: req.get("user-agent") || null } });
      const recipients = await tx.workflowEnrollment.findMany({ where: { workflowId: access.workflow.id, status: "ACTIVE" }, select: { userId: true }, distinct: ["userId"] });
      if (recipients.length) await tx.notification.createMany({ data: recipients.map(({ userId }) => ({ recipientId: userId, type: "WORKFLOW_CHANGED" as const, title: "New workflow resource", message: `${title} was added to ${access.workflow.name}.`, entityType: "WORKFLOW_RESOURCE", entityId: created.id })) });
      return created;
    });
    res.status(201).json({ resource: serializeResource(resource) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to upload workflow resource." });
  }
});

router.patch("/resources/:resourceId", requireAuth, requirePermission(Permissions.WORKFLOW_EDIT), async (req, res) => {
  try {
    const existing = await prisma.workflowResource.findUnique({ where: { id: req.params.resourceId as string } });
    if (!existing) return void res.status(404).json({ error: "Workflow resource not found." });
    const access = await workflowAccess(existing.workflowId, req.user!);
    if (!access?.manages) return void res.status(404).json({ error: "Workflow resource not found." });
    const title = String(req.body.title || "").trim();
    if (!title || title.length > 180) return void res.status(400).json({ error: "Enter a resource title of up to 180 characters." });
    const description = String(req.body.description || "").trim().slice(0, 2000) || null;
    const resource = await prisma.$transaction(async (tx) => {
      const updated = await tx.workflowResource.update({ where: { id: existing.id }, data: { title, description }, select: resourceSelect });
      await tx.auditLog.create({ data: { userId: req.user!.id, action: "UPDATE", entityType: "WorkflowResource", entityId: existing.id, oldValues: { title: existing.title, description: existing.description }, newValues: { title, description }, ipAddress: req.ip, userAgent: req.get("user-agent") || null } });
      return updated;
    });
    res.json({ resource: serializeResource(resource) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update workflow resource." });
  }
});

router.post("/resources/:resourceId/replace", requireAuth, requirePermission(Permissions.WORKFLOW_EDIT), resourceUpload.single("file"), async (req, res) => {
  try {
    const existing = await prisma.workflowResource.findUnique({ where: { id: req.params.resourceId as string }, include: { workflow: true } });
    if (!existing) return void res.status(404).json({ error: "Workflow resource not found." });
    const access = await workflowAccess(existing.workflowId, req.user!);
    if (!access?.manages) return void res.status(404).json({ error: "Workflow resource not found." });
    if (!req.file) return void res.status(400).json({ error: "Select a replacement PDF, DOC, or DOCX file." });
    const folderId = await workflowResourceFolder(existing.workflow);
    const stored = await googleDriveService.uploadFile({ folderId, fileName: req.file.originalname, mimeType: req.file.mimetype, buffer: req.file.buffer, description: `${existing.title} — ${existing.workflow.name}`, appProperties: { entityType: "WORKFLOW_RESOURCE", workflowId: existing.workflowId } });
    const nextVersion = existing.version + 1;
    const resource = await prisma.$transaction(async (tx) => {
      const updated = await tx.workflowResource.update({ where: { id: existing.id }, data: { fileName: stored.fileName, mimeType: stored.mimeType, fileSize: BigInt(stored.sizeBytes), storagePath: stored.storagePath, googleDriveFileId: stored.fileId, uploadedBy: req.user!.id, version: nextVersion }, select: resourceSelect });
      await tx.auditLog.create({ data: { userId: req.user!.id, action: "UPDATE", entityType: "WorkflowResource", entityId: existing.id, oldValues: { fileName: existing.fileName, version: existing.version }, newValues: { fileName: stored.fileName, version: nextVersion }, ipAddress: req.ip, userAgent: req.get("user-agent") || null } });
      const recipients = await tx.workflowEnrollment.findMany({ where: { workflowId: existing.workflowId, status: "ACTIVE" }, select: { userId: true }, distinct: ["userId"] });
      if (recipients.length) await tx.notification.createMany({ data: recipients.map(({ userId }) => ({ recipientId: userId, type: "WORKFLOW_CHANGED" as const, title: "Workflow resource updated", message: `${existing.title} was updated to Version ${nextVersion}.`, entityType: "WORKFLOW_RESOURCE", entityId: existing.id })) });
      return updated;
    });
    if (existing.googleDriveFileId) googleDriveService.deleteFile(existing.googleDriveFileId).catch(() => undefined);
    res.json({ resource: serializeResource(resource) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to replace workflow resource." });
  }
});

router.get("/resources/:resourceId/file", requireAuth, async (req, res) => {
  try {
    const resource = await prisma.workflowResource.findUnique({ where: { id: req.params.resourceId as string } });
    if (!resource || !(await workflowAccess(resource.workflowId, req.user!))) return void res.status(404).json({ error: "Workflow resource not found." });
    await prisma.auditLog.create({ data: { userId: req.user!.id, action: "DOWNLOAD", entityType: "WorkflowResource", entityId: resource.id, ipAddress: req.ip, userAgent: req.get("user-agent") || null } });
    const disposition = req.query.download === "1" ? "attachment" : "inline";
    res.setHeader("Content-Type", resource.mimeType);
    res.setHeader("Content-Disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(resource.fileName)}`);
    if (fs.existsSync(resource.storagePath)) return void res.sendFile(resource.storagePath);
    if (!resource.googleDriveFileId) return void res.status(404).json({ error: "The stored file is unavailable." });
    const response = await googleDriveService.getFileStream(resource.googleDriveFileId);
    response.data.pipe(res);
  } catch (error: any) {
    if (!res.headersSent) res.status(500).json({ error: error.message || "Failed to open workflow resource." });
  }
});

router.delete("/resources/:resourceId", requireAuth, requirePermission(Permissions.WORKFLOW_EDIT), async (req, res) => {
  try {
    const existing = await prisma.workflowResource.findUnique({ where: { id: req.params.resourceId as string } });
    if (!existing) return void res.status(404).json({ error: "Workflow resource not found." });
    const access = await workflowAccess(existing.workflowId, req.user!);
    if (!access?.manages) return void res.status(404).json({ error: "Workflow resource not found." });
    await prisma.$transaction([
      prisma.workflowResource.delete({ where: { id: existing.id } }),
      prisma.auditLog.create({ data: { userId: req.user!.id, action: "DELETE", entityType: "WorkflowResource", entityId: existing.id, oldValues: { workflowId: existing.workflowId, title: existing.title, fileName: existing.fileName, version: existing.version }, ipAddress: req.ip, userAgent: req.get("user-agent") || null } }),
    ]);
    if (existing.googleDriveFileId) googleDriveService.deleteFile(existing.googleDriveFileId).catch(() => undefined);
    else if (fs.existsSync(existing.storagePath)) fs.unlink(existing.storagePath, () => undefined);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to remove workflow resource." });
  }
});

// GET /api/workflows
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { researchTypeId } = req.query;
    const scope = getCollegeScope(req.user!);
    if (scope.kind === "unassigned") {
      res.status(403).json({ error: "Your account has not been assigned to a college or school. Contact the System Administrator." });
      return;
    }
    const scopedResearchTypeIds = scope.kind === "college"
      ? (await prisma.researchType.findMany({
          where: {
            program: {
              collegeId: scope.collegeId,
              ...(req.user!.programId && { id: req.user!.programId }),
            },
          },
          select: { id: true },
        })).map((item) => item.id)
      : null;

    const workflows = await prisma.workflow.findMany({
      where: {
        AND: [
          ...(researchTypeId ? [{ researchTypeId: String(researchTypeId) }] : []),
          ...(scopedResearchTypeIds ? [{ researchTypeId: { in: scopedResearchTypeIds } }] : []),
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
        return void res.status(404).json({ error: "Workflow not found in your academic scope." });
      }
      const duplicate = await prisma.workflowTopic.findFirst({
        where: { workflowId, title: { equals: req.body.title, mode: "insensitive" } },
        select: { id: true },
      });
      if (duplicate) {
        return void res.status(409).json({ error: "A topic with this title already exists in the workflow." });
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
      res.status(201).json({ topic });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create workflow topic." });
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
      const existing = await prisma.workflowTopic.findUnique({ where: { id: req.params.topicId as string } });
      if (!existing || !(await workflowAccess(existing.workflowId, req.user!))?.manages) {
        return void res.status(404).json({ error: "Workflow topic not found." });
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
          return void res.status(409).json({ error: "A topic with this title already exists in the workflow." });
        }
      }
      const topic = await prisma.workflowTopic.update({
        where: { id: existing.id },
        data: {
          ...(req.body.title !== undefined && { title: req.body.title }),
          ...(req.body.description !== undefined && { description: req.body.description || null }),
        },
      });
      res.json({ topic });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update workflow topic." });
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
        return void res.status(404).json({ error: "Workflow not found in your academic scope." });
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
        return void res.status(400).json({ error: "Topic order must contain every workflow topic exactly once." });
      }
      await prisma.$transaction(async (tx) => {
        for (let index = 0; index < requestedIds.length; index += 1) {
          await tx.workflowTopic.update({ where: { id: requestedIds[index] }, data: { sequence: 1_000_000 + index } });
        }
        for (let index = 0; index < requestedIds.length; index += 1) {
          await tx.workflowTopic.update({ where: { id: requestedIds[index] }, data: { sequence: index + 1 } });
        }
        await resequenceWorkflowStagesByTopics(tx, workflowId);
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to reorder workflow topics." });
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
      if (!topic || !(await workflowAccess(topic.workflowId, req.user!))?.manages) {
        return void res.status(404).json({ error: "Workflow topic not found." });
      }
      if (topic.stages.length > 0) {
        return void res.status(409).json({ error: "Move the topic's milestones before deleting it." });
      }
      await prisma.$transaction(async (tx) => {
        await tx.workflowTopic.delete({ where: { id: topic.id } });
        await normalizeWorkflowTopicSequences(tx, topic.workflowId);
      });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete workflow topic." });
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
        res.status(403).json({ error: "Your account has not been assigned to a college or school. Contact the System Administrator." });
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
        res.status(403).json({ error: "The selected research type is outside your assigned department or program." });
        return;
      }

      const departmentResearchTypeIds = (await prisma.researchType.findMany({
        where: { programId: researchType.programId },
        select: { id: true },
      })).map((item) => item.id);
      const duplicate = await prisma.workflow.findFirst({
        where: {
          name: { equals: name.trim(), mode: "insensitive" },
          researchTypeId: { in: departmentResearchTypeIds },
        },
        select: { id: true },
      });
      if (duplicate) {
        res.status(409).json({ error: "A workflow with this name already exists in your department or program." });
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
          description: typeof description === "string" && description.trim() ? description.trim() : null,
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
              deadlineDays: s.deadlineDays || null,
              isFinal: s.isFinal,
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

// POST /api/workflows/:id/invitation — generate or rotate a researcher invitation.
router.post("/:id/invitation", requireAuth, requirePermission(Permissions.WORKFLOW_EDIT), async (req: Request, res: Response) => {
  try {
    const workflow = await prisma.workflow.findUnique({ where: { id: req.params.id as string } });
    if (!workflow) return void res.status(404).json({ error: "Workflow not found." });
    const researchType = await prisma.researchType.findUnique({ where: { id: workflow.researchTypeId }, include: { program: true } });
    if (!researchType) return void res.status(404).json({ error: "Workflow research type was not found." });
    const scope = getCollegeScope(req.user!);
    if (scope.kind !== "institution" && (scope.kind !== "college" || scope.collegeId !== researchType.program.collegeId || (req.user!.programId && req.user!.programId !== researchType.programId))) {
      return void res.status(404).json({ error: "Workflow not found in your department scope." });
    }
    const inviteCode = randomBytes(5).toString("hex").toUpperCase();
    const inviteExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const updated = await prisma.workflow.update({ where: { id: workflow.id }, data: { inviteCode, inviteExpiresAt }, select: { id: true, inviteCode: true, inviteExpiresAt: true } });
    res.json({ invitation: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to generate workflow invitation." });
  }
});

// POST /api/workflows/join/:code — researcher joins a workflow before formal project creation.
router.get("/invitation/:code", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user!.roles.includes("RESEARCHER")) {
      return void res.status(403).json({ error: "Researcher access is required to view this invitation." });
    }
    const code = String(req.params.code || "").trim().toUpperCase();
    const workflow = await prisma.workflow.findUnique({
      where: { inviteCode: code },
      select: {
        id: true,
        name: true,
        description: true,
        inviteExpiresAt: true,
        creator: { select: { firstName: true, lastName: true, email: true } },
        stages: {
          where: { category: { not: "Archived" } },
          orderBy: { sequence: "asc" },
          select: { id: true, name: true, submissionMode: true, topic: { select: { id: true, title: true } } },
        },
        enrollments: {
          where: { userId: req.user!.id, status: "ACTIVE" },
          select: { id: true },
        },
      },
    });
    if (!workflow || !workflow.inviteExpiresAt || workflow.inviteExpiresAt <= new Date()) {
      return void res.status(404).json({ error: "This workflow invitation is invalid or expired." });
    }
    res.json({
      invitation: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        expiresAt: workflow.inviteExpiresAt,
        professor: workflow.creator,
        stages: workflow.stages,
        alreadyJoined: workflow.enrollments.length > 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load the workflow invitation." });
  }
});

router.post("/join/:code", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user!.roles.includes("RESEARCHER")) return void res.status(403).json({ error: "Researcher access is required." });
    const code = String(req.params.code || "").trim().toUpperCase();
    const workflow = await prisma.workflow.findUnique({ where: { inviteCode: code }, include: { stages: { where: { category: { not: "Archived" } }, orderBy: { sequence: "asc" }, include: { topic: true, tasks: true } } } });
    if (!workflow || !workflow.inviteExpiresAt || workflow.inviteExpiresAt <= new Date()) return void res.status(404).json({ error: "This workflow invitation is invalid or expired." });
    const researchType = await prisma.researchType.findUnique({ where: { id: workflow.researchTypeId }, include: { program: true } });
    if (!researchType || req.user!.collegeId !== researchType.program.collegeId || req.user!.programId !== researchType.programId) return void res.status(403).json({ error: "This workflow belongs to a different department or program." });
    const enrollment = await prisma.workflowEnrollment.upsert({
      where: { workflowId_userId: { workflowId: workflow.id, userId: req.user!.id } },
      update: { status: "ACTIVE", joinedAt: new Date() },
      create: { workflowId: workflow.id, userId: req.user!.id },
    });
    await prisma.notification.createMany({ data: [
      { recipientId: req.user!.id, type: "WORKFLOW_CHANGED", title: "Workflow joined", message: `You joined ${workflow.name}. Its milestones are now available on your dashboard.`, entityType: "WORKFLOW_ENROLLMENT", entityId: enrollment.id },
      { recipientId: workflow.createdBy, type: "WORKFLOW_CHANGED", title: "Researcher joined workflow", message: `${req.user!.firstName || req.user!.email} joined ${workflow.name}.`, entityType: "WORKFLOW_ENROLLMENT", entityId: enrollment.id },
    ] });
    res.status(201).json({ enrollment, workflow });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to join workflow." });
  }
});

router.get("/enrollments/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const enrollments = await prisma.workflowEnrollment.findMany({
      where: { userId: req.user!.id, status: "ACTIVE" },
      include: {
        workflow: {
          include: {
            creator: {
              select: { firstName: true, lastName: true, email: true },
            },
            stages: {
              where: { category: { not: "Archived" } },
              orderBy: { sequence: "asc" },
              include: { topic: true, tasks: { orderBy: { sequence: "asc" } } },
            },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });
    res.json({ enrollments });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load workflow enrollments." });
  }
});

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

      await prisma.$transaction([
        prisma.workflowEnrollment.delete({ where: { id: enrollment.id } }),
        prisma.notification.create({
          data: {
            recipientId: enrollment.user.id,
            type: "WORKFLOW_CHANGED",
            title: "Workflow access removed",
            message: `Your enrollment in ${enrollment.workflow.name} was removed by the research coordinator. Reason: ${reason}`,
            entityType: "WORKFLOW_ENROLLMENT",
            entityId: enrollment.id,
          },
        }),
        prisma.auditLog.create({
          data: {
            userId: req.user!.id,
            action: "DELETE",
            entityType: "WorkflowEnrollment",
            entityId: enrollment.id,
            oldValues: {
              workflowId: enrollment.workflowId,
              workflowName: enrollment.workflow.name,
              researcherId: enrollment.userId,
              researcherName: `${enrollment.user.firstName || ""} ${enrollment.user.lastName || ""}`.trim(),
              studentNumber: enrollment.user.universityId,
              researcherEmail: enrollment.user.email,
              status: enrollment.status,
              joinedAt: enrollment.joinedAt.toISOString(),
            },
            newValues: { removalReason: reason },
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        }),
      ]);

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
      const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 100) : [];
      if (!items.length) {
        return void res.status(400).json({ error: "Select at least one deadline before sending reminders." });
      }
      const researchIds: string[] = Array.from(new Set<string>(items.map((item: any) => String(item.researchId || "")).filter((value: string) => Boolean(value))));
      const taskIds: string[] = Array.from(new Set<string>(items.map((item: any) => String(item.taskId || "")).filter((value: string) => Boolean(value))));
      const [projects, tasks] = await Promise.all([
        prisma.researchProject.findMany({
          where: { id: { in: researchIds }, status: { not: "ARCHIVED" }, workflowInstance: { isNot: null } },
          select: {
            id: true,
            title: true,
            workflowInstance: { select: { workflowId: true } },
            members: {
              where: { leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] } },
              select: { userId: true },
            },
          },
        }),
        prisma.workflowTask.findMany({
          where: { id: { in: taskIds } },
          select: { id: true, title: true, stage: { select: { workflowId: true } } },
        }),
      ]);
      const projectById = new Map(projects.map((project) => [project.id, project]));
      const taskById = new Map(tasks.map((task) => [task.id, task]));
      const workflowIds = Array.from(new Set(projects.map((project) => project.workflowInstance?.workflowId).filter(Boolean))) as string[];
      const accessResults = await Promise.all(workflowIds.map((workflowId) => workflowAccess(workflowId, req.user!)));
      const manageableWorkflowIds = new Set(accessResults.filter((result) => result?.manages).map((result) => result!.workflow.id));
      const notifications = new Map<string, any>();

      for (const item of items) {
        const project = projectById.get(String(item.researchId || ""));
        const task = taskById.get(String(item.taskId || ""));
        const workflowId = project?.workflowInstance?.workflowId;
        if (!project || !task || !workflowId || task.stage.workflowId !== workflowId || !manageableWorkflowIds.has(workflowId)) continue;
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
        return void res.status(400).json({ error: "No eligible researchers were found for the selected deadlines." });
      }
      const result = await prisma.notification.createMany({ data: Array.from(notifications.values()) });
      res.json({ success: true, recipientCount: result.count });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send deadline reminders." });
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
        return void res.status(404).json({ error: "Workflow not found in your academic scope." });
      }
      const {
        name,
        description,
        topicId,
        category = "Milestone",
        deadlineDays,
        requiresApproval = false,
        requiresDocument = true,
        submissionMode = "EITHER",
        isFinal = false,
      } = req.body;
      if (!["INDIVIDUAL", "GROUP", "EITHER"].includes(submissionMode)) {
        return void res.status(400).json({ error: "Choose a valid milestone submission mode." });
      }

      if (!name || typeof name !== "string" || name.trim().length < 3) {
        res.status(400).json({
          error: "Milestone name must be at least 3 characters long.",
        });
        return;
      }

      const deadline =
        deadlineDays === null ||
        deadlineDays === undefined ||
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
          ? prisma.workflowTopic.findFirst({ where: { id: topicId, workflowId } })
          : Promise.resolve(null),
      ]);
      if (!researcherRole) {
        res.status(500).json({ error: "Researcher role is not configured." });
        return;
      }
      if (!topicId || !topic) {
        res.status(400).json({ error: "Choose a valid topic for this milestone." });
        return;
      }

      const stage = await prisma.$transaction(async (tx) => {
        await normalizeWorkflowStageSequences(tx, workflowId);
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
            requiresApproval: Boolean(requiresApproval),
            requiresDocument: Boolean(requiresDocument),
            deadlineDays: deadline,
            isFinal: Boolean(isFinal),
            submissionMode,
          },
        });
        if (createdStage.requiresDocument) {
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
        return tx.workflowStage.findUniqueOrThrow({ where: { id: createdStage.id } });
      });

      const assignedProjects = await prisma.researchProject.findMany({
        where: { workflowInstance: { is: { workflowId } } },
        select: { id: true },
      });
      res.status(201).json({
        stage,
        storageProvisioning: {
          assignedGroups: assignedProjects.length,
          status: assignedProjects.length ? "QUEUED" : "NOT_REQUIRED",
        },
      });

      // Google Drive provisioning continues after the response so milestone
      // creation never waits for external storage calls.
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
      res.status(500).json({
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

      const targetStage = await prisma.workflowStage.findUnique({
        where: { id: toStageId },
      });

      if (!targetStage) {
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
        requiresApproval,
        requiresDocument,
        isFinal,
        submissionMode,
      } = req.body;

      const existing = await prisma.workflowStage.findUnique({ where: { id: stageId } });
      if (!existing || !(await workflowAccess(existing.workflowId, req.user!))?.manages) {
        return void res.status(404).json({ error: "Workflow milestone not found." });
      }
      if (topicId !== undefined) {
        const topic = topicId
          ? await prisma.workflowTopic.findFirst({ where: { id: topicId, workflowId: existing.workflowId } })
          : null;
        if (!topic) {
          return void res.status(400).json({ error: "Choose a valid topic for this milestone." });
        }
      }

      const stage = await prisma.$transaction(async (tx) => {
        await tx.workflowStage.update({
          where: { id: stageId },
          data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(topicId !== undefined && { topicId }),
          ...(category !== undefined && { category }),
          ...(deadlineDays !== undefined && {
            deadlineDays: deadlineDays ? Number(deadlineDays) : null,
          }),
          ...(requiresApproval !== undefined && {
            requiresApproval: Boolean(requiresApproval),
          }),
          ...(requiresDocument !== undefined && {
            requiresDocument: Boolean(requiresDocument),
          }),
          ...(isFinal !== undefined && { isFinal: Boolean(isFinal) }),
          ...(submissionMode !== undefined && ["INDIVIDUAL", "GROUP", "EITHER"].includes(submissionMode) && { submissionMode }),
          },
        });
        if (topicId !== undefined && topicId !== existing.topicId) {
          await resequenceWorkflowStagesByTopics(tx, existing.workflowId);
        }
        return tx.workflowStage.findUniqueOrThrow({ where: { id: stageId } });
      });

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
          dueDays: deadline,
          allowedFileTypes: String(
            allowedFileTypes || "PDF,DOCX",
          ).toUpperCase(),
          isRequired: Boolean(isRequired),
        },
      });
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

      const stage = await prisma.workflowStage.findFirst({
        where: { id: stageId, workflowId: project.workflowInstance.workflowId },
      });
      if (!stage)
        return void res.status(404).json({
          error: "This milestone is not part of the project workflow.",
        });
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
          dueDays: stage.deadlineDays,
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
      const submissions = await prisma.taskSubmission.count({
        where: { taskId },
      });
      if (submissions)
        return void res.status(409).json({
          error: "A task with student submissions cannot be deleted.",
        });
      await prisma.workflowTask.delete({ where: { id: taskId } });
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

// POST /api/workflows/tasks/:taskId/submissions — group links an uploaded document to a valid workflow task.
router.post(
  "/tasks/:taskId/submissions",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.user)
        return void res.status(401).json({ error: "Unauthorized" });
      const taskId = req.params.taskId as string;
      const { researchId, documentId, note } = req.body;
      if (!researchId || !documentId)
        return void res
          .status(400)
          .json({ error: "researchId and documentId are required." });
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
        include: {
          members: {
            where: { leftAt: null },
            select: { userId: true, projectRole: true },
          },
          workflowInstance: {
            include: { workflow: { select: { createdBy: true } } },
          },
        },
      });
      if (!project)
        return void res.status(403).json({
          error: "You are not an active member of this research group.",
        });
      const task = await prisma.workflowTask.findFirst({
        where: {
          id: taskId,
          stage: { workflowId: project.workflowInstance?.workflowId },
        },
      });
      if (!task)
        return void res
          .status(400)
          .json({ error: "This task is not part of the project workflow." });
      const document = await prisma.document.findFirst({
        where: { id: documentId, researchId },
      });
      if (!document)
        return void res.status(400).json({
          error: "The uploaded document does not belong to this project.",
        });
      const submission = await prisma.taskSubmission.upsert({
        where: { researchId_taskId: { researchId, taskId } },
        update: {
          documentId,
          submittedBy: req.user.id,
          note: note?.trim() || null,
          status: "SUBMITTED",
          submittedAt: new Date(),
          reviewedAt: null,
          reviewNote: null,
        },
        create: {
          researchId,
          taskId,
          documentId,
          submittedBy: req.user.id,
          note: note?.trim() || null,
        },
        include: {
          document: true,
          task: true,
          submittedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              universityId: true,
            },
          },
        },
      });

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
      if (candidateRecipientIds.size) {
        try {
          const validRecipients = await prisma.user.findMany({
            where: {
              id: { in: Array.from(candidateRecipientIds) },
              status: "ACTIVE",
            },
            select: { id: true },
          });
          if (validRecipients.length) {
            await prisma.notification.createMany({
              data: validRecipients.map(({ id: recipientId }) => ({
                recipientId,
                type: "DOCUMENT_UPLOADED" as const,
                title: "Research task submitted",
                message: `${project.title}: ${task.title} was submitted for review.`,
                entityType: "TaskSubmission",
                entityId: submission.id,
              })),
            });
          }
        } catch (notificationError) {
          console.error(
            "Task submission saved, but reviewer notifications failed:",
            notificationError,
          );
        }
      }
      res.status(201).json({ submission });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to submit task requirement" });
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
          task: { include: { stage: true } },
          research: {
            include: {
              members: {
                where: { leftAt: null },
                select: { userId: true, projectRole: true },
              },
              workflowInstance: { include: { currentStage: true } },
            },
          },
        },
      });
      if (!existing)
        return void res
          .status(404)
          .json({ error: "Task submission not found." });
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.taskSubmission.update({
          where: { id: submissionId },
          data: {
            status,
            reviewNote: reviewNote?.trim() || null,
            reviewedAt: new Date(),
          },
        });
        let progression: {
          advanced: boolean;
          completed: boolean;
          nextStageName?: string;
        } = { advanced: false, completed: false };

        const instance = existing.research.workflowInstance;
        const reviewedStage = existing.task.stage;
        if (
          status === "APPROVED" &&
          instance?.currentStageId === reviewedStage.id
        ) {
          const requiredTasks = await tx.workflowTask.findMany({
            where: { stageId: reviewedStage.id, isRequired: true },
            select: { id: true },
          });
          const approvedTaskCount = await tx.taskSubmission.count({
            where: {
              researchId: existing.researchId,
              taskId: { in: requiredTasks.map((task) => task.id) },
              status: "APPROVED",
            },
          });

          if (
            requiredTasks.length > 0 &&
            approvedTaskCount === requiredTasks.length
          ) {
            if (reviewedStage.isFinal) {
              const completedAt = new Date();
              await tx.workflowInstance.update({
                where: { id: instance.id },
                data: { completedAt },
              });
              await tx.researchProject.update({
                where: { id: existing.researchId },
                data: { status: "COMPLETED", completedAt },
              });
              progression = { advanced: true, completed: true };
            } else {
              const nextStage = await tx.workflowStage.findFirst({
                where: {
                  workflowId: reviewedStage.workflowId,
                  category: { not: "Archived" },
                  sequence: { gt: reviewedStage.sequence },
                },
                orderBy: { sequence: "asc" },
              });
              if (nextStage) {
                await tx.workflowTransition.create({
                  data: {
                    workflowInstanceId: instance.id,
                    fromStageId: reviewedStage.id,
                    toStageId: nextStage.id,
                    performedBy: req.user!.id,
                    remarks: `Advanced automatically after all required submissions for ${reviewedStage.name} were approved.`,
                  },
                });
                await tx.workflowInstance.update({
                  where: { id: instance.id },
                  data: { currentStageId: nextStage.id },
                });
                progression = {
                  advanced: true,
                  completed: false,
                  nextStageName: nextStage.name,
                };
              }
            }
          }
        }

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
          await tx.notification.createMany({
            data: Array.from(recipients).map((recipientId) => ({
              recipientId,
              type:
                status === "REVISION_REQUIRED" || status === "REJECTED"
                  ? ("REVISION_REQUESTED" as const)
                  : ("DOCUMENT_REVIEWED" as const),
              title: `Task ${String(status).toLowerCase().replace(/_/g, " ")}`,
              message: `${existing.task.title} for ${existing.research.title} is now ${String(status).toLowerCase().replace(/_/g, " ")}.`,
              entityType: "TaskSubmission",
              entityId: updated.id,
            })),
          });
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
