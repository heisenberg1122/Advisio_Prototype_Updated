import { Router, Request, Response } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { googleDriveService } from "../services/google-drive.service.js";
import { storageHierarchyService } from "../services/storage-hierarchy.service.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
});

const BLOCKED_EXTENSIONS = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "ps1", "sh", "jar",
]);

function cleanName(value: unknown, max = 255) {
  return String(value || "").trim().replace(/[\\/:*?"<>|]/g, "-").slice(0, max);
}

async function membership(researchId: string, userId: string) {
  return prisma.researchMember.findFirst({
    where: { researchId, userId, leftAt: null },
    select: { projectRole: true },
  });
}

async function requireMember(req: Request, res: Response, researchId: string) {
  const member = await membership(researchId, req.user!.id);
  if (!member) {
    res.status(403).json({ error: "Only active research group members can access these files." });
    return null;
  }
  return member;
}

async function folderBelongsToResearch(folderId: string | null, researchId: string) {
  if (!folderId) return true;
  return Boolean(await prisma.groupFolder.findFirst({
    where: { id: folderId, researchId, deletedAt: null },
    select: { id: true },
  }));
}

router.get("/research/:researchId/group-files", requireAuth, async (req, res) => {
  try {
    const researchId = String(req.params.researchId);
    if (!(await requireMember(req, res, researchId))) return;
    const folderId = req.query.folderId ? String(req.query.folderId) : null;
    if (!(await folderBelongsToResearch(folderId, researchId))) {
      return void res.status(404).json({ error: "Folder not found." });
    }

    const [folders, files, usage] = await Promise.all([
      prisma.groupFolder.findMany({
        where: { researchId, parentId: folderId, deletedAt: null },
        orderBy: { name: "asc" },
      }),
      prisma.groupFile.findMany({
        where: { researchId, folderId, deletedAt: null },
        include: { uploader: { select: { firstName: true, lastName: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.groupFile.aggregate({
        where: { researchId, deletedAt: null },
        _sum: { fileSize: true },
        _count: { id: true },
      }),
    ]);

    const breadcrumbs: Array<{ id: string; name: string }> = [];
    let currentId = folderId;
    while (currentId) {
      const current = await prisma.groupFolder.findFirst({
        where: { id: currentId, researchId }, select: { id: true, name: true, parentId: true },
      });
      if (!current) break;
      breadcrumbs.unshift({ id: current.id, name: current.name });
      currentId = current.parentId;
    }

    res.json({
      folders,
      files: files.map((file) => ({ ...file, fileSize: Number(file.fileSize) })),
      breadcrumbs,
      usage: { bytes: Number(usage._sum.fileSize || 0), files: usage._count.id, limitBytes: 5 * 1024 ** 3 },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unable to load group files." });
  }
});

router.post("/research/:researchId/group-folders", requireAuth, async (req, res) => {
  try {
    const researchId = String(req.params.researchId);
    if (!(await requireMember(req, res, researchId))) return;
    const name = cleanName(req.body.name, 120);
    const parentId = req.body.parentId ? String(req.body.parentId) : null;
    if (!name) return void res.status(400).json({ error: "Folder name is required." });
    if (!(await folderBelongsToResearch(parentId, researchId))) {
      return void res.status(400).json({ error: "The destination folder is invalid." });
    }
    const duplicate = await prisma.groupFolder.findFirst({
      where: { researchId, parentId, name: { equals: name, mode: "insensitive" }, deletedAt: null },
    });
    if (duplicate) return void res.status(409).json({ error: "A folder with that name already exists here." });
    const folder = await prisma.groupFolder.create({ data: { researchId, parentId, name, createdBy: req.user!.id } });
    res.status(201).json({ folder });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unable to create folder." });
  }
});

router.patch("/research/:researchId/group-folders/:folderId", requireAuth, async (req, res) => {
  try {
    const researchId = String(req.params.researchId);
    const member = await requireMember(req, res, researchId);
    if (!member) return;
    const folder = await prisma.groupFolder.findFirst({ where: { id: String(req.params.folderId), researchId, deletedAt: null } });
    if (!folder) return void res.status(404).json({ error: "Folder not found." });
    if (member.projectRole !== "LEADER" && folder.createdBy !== req.user!.id) {
      return void res.status(403).json({ error: "Only the group leader or folder creator can change this folder." });
    }
    const name = req.body.name === undefined ? folder.name : cleanName(req.body.name, 120);
    const parentId = req.body.parentId === undefined ? folder.parentId : (req.body.parentId || null);
    if (!name) return void res.status(400).json({ error: "Folder name is required." });
    if (parentId === folder.id || !(await folderBelongsToResearch(parentId, researchId))) {
      return void res.status(400).json({ error: "The destination folder is invalid." });
    }
    const updated = await prisma.groupFolder.update({ where: { id: folder.id }, data: { name, parentId } });
    res.json({ folder: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unable to update folder." });
  }
});

router.delete("/research/:researchId/group-folders/:folderId", requireAuth, async (req, res) => {
  try {
    const researchId = String(req.params.researchId);
    const member = await requireMember(req, res, researchId);
    if (!member) return;
    const folder = await prisma.groupFolder.findFirst({ where: { id: String(req.params.folderId), researchId, deletedAt: null } });
    if (!folder) return void res.status(404).json({ error: "Folder not found." });
    if (member.projectRole !== "LEADER" && folder.createdBy !== req.user!.id) {
      return void res.status(403).json({ error: "Only the group leader or folder creator can delete this folder." });
    }
    const contents = await prisma.$transaction([
      prisma.groupFolder.count({ where: { parentId: folder.id, deletedAt: null } }),
      prisma.groupFile.count({ where: { folderId: folder.id, deletedAt: null } }),
    ]);
    if (contents[0] || contents[1]) return void res.status(409).json({ error: "Move or delete the folder contents first." });
    await prisma.groupFolder.update({ where: { id: folder.id }, data: { deletedAt: new Date() } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unable to delete folder." });
  }
});

router.post("/research/:researchId/group-files", requireAuth, upload.array("files", 10), async (req, res) => {
  try {
    const researchId = String(req.params.researchId);
    if (!(await requireMember(req, res, researchId))) return;
    const files = (req.files as Express.Multer.File[]) || [];
    const folderId = req.body.folderId ? String(req.body.folderId) : null;
    if (!files.length) return void res.status(400).json({ error: "Select at least one file to upload." });
    if (!(await folderBelongsToResearch(folderId, researchId))) {
      return void res.status(400).json({ error: "The destination folder is invalid." });
    }
    const blocked = files.find((file) => BLOCKED_EXTENSIONS.has(file.originalname.split(".").pop()?.toLowerCase() || ""));
    if (blocked) return void res.status(400).json({ error: `${blocked.originalname} is not an allowed file type.` });

    const destinationFolderId = await storageHierarchyService.resolveFolder({ researchId, bucket: "WORKING" });
    const created = [];
    for (const file of files) {
      const stored = await googleDriveService.uploadFile({
        fileName: file.originalname,
        mimeType: file.mimetype || "application/octet-stream",
        buffer: file.buffer,
        folderId: destinationFolderId,
        description: `Advisio group file: ${file.originalname}`,
        appProperties: {
          advisioManaged: "true", advisioResearchId: researchId,
          advisioUploaderId: req.user!.id, advisioLifecycle: "GROUP_FILE",
          advisioChecksum: crypto.createHash("sha256").update(file.buffer).digest("hex"),
        },
      });
      const record = await prisma.groupFile.create({
        data: {
          researchId, folderId, name: cleanName(file.originalname), originalName: file.originalname,
          mimeType: stored.mimeType, fileSize: BigInt(stored.sizeBytes), storageProvider: "GOOGLE_DRIVE",
          externalFileId: stored.fileId, storagePath: stored.storagePath,
          description: req.body.description ? String(req.body.description).trim().slice(0, 1000) : null,
          milestoneId: req.body.milestoneId || null, uploadedBy: req.user!.id,
        },
        include: { uploader: { select: { firstName: true, lastName: true } } },
      });
      created.push({ ...record, fileSize: Number(record.fileSize) });
    }
    res.status(201).json({ files: created });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unable to upload group files." });
  }
});

router.get("/group-files/:fileId/content", requireAuth, async (req, res) => {
  try {
    const file = await prisma.groupFile.findFirst({ where: { id: String(req.params.fileId), deletedAt: null } });
    if (!file || !(await membership(file.researchId, req.user!.id))) return void res.status(404).json({ error: "File not found." });
    res.type(file.mimeType);
    res.setHeader("Content-Disposition", `${req.query.download === "1" ? "attachment" : "inline"}; filename="${file.name.replace(/"/g, "")}"`);
    if (!file.externalFileId.startsWith("gdrive-")) {
      const stream = await googleDriveService.getFileStream(file.externalFileId);
      stream.data.pipe(res);
      return;
    }
    const uploadDir = path.resolve(process.cwd(), "uploads");
    const diskName = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).find((name) => name.startsWith(`${file.externalFileId}-`)) : undefined;
    if (!diskName) return void res.status(404).json({ error: "Stored file is unavailable." });
    res.sendFile(path.resolve(uploadDir, diskName));
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unable to open file." });
  }
});

router.patch("/research/:researchId/group-files/:fileId", requireAuth, async (req, res) => {
  try {
    const researchId = String(req.params.researchId);
    const member = await requireMember(req, res, researchId);
    if (!member) return;
    const file = await prisma.groupFile.findFirst({ where: { id: String(req.params.fileId), researchId, deletedAt: null } });
    if (!file) return void res.status(404).json({ error: "File not found." });
    if (member.projectRole !== "LEADER" && file.uploadedBy !== req.user!.id) {
      return void res.status(403).json({ error: "Only the group leader or uploader can change this file." });
    }
    const folderId = req.body.folderId === undefined ? file.folderId : (req.body.folderId || null);
    if (!(await folderBelongsToResearch(folderId, researchId))) return void res.status(400).json({ error: "The destination folder is invalid." });
    const name = req.body.name === undefined ? file.name : cleanName(req.body.name);
    if (!name) return void res.status(400).json({ error: "File name is required." });
    const updated = await prisma.groupFile.update({ where: { id: file.id }, data: { name, folderId, description: req.body.description === undefined ? file.description : String(req.body.description || "").trim().slice(0, 1000) || null } });
    res.json({ file: { ...updated, fileSize: Number(updated.fileSize) } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unable to update file." });
  }
});

router.delete("/research/:researchId/group-files/:fileId", requireAuth, async (req, res) => {
  try {
    const researchId = String(req.params.researchId);
    const member = await requireMember(req, res, researchId);
    if (!member) return;
    const file = await prisma.groupFile.findFirst({ where: { id: String(req.params.fileId), researchId, deletedAt: null } });
    if (!file) return void res.status(404).json({ error: "File not found." });
    if (member.projectRole !== "LEADER" && file.uploadedBy !== req.user!.id) {
      return void res.status(403).json({ error: "Only the group leader or uploader can delete this file." });
    }
    await prisma.groupFile.update({ where: { id: file.id }, data: { deletedAt: new Date() } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unable to delete file." });
  }
});

router.post("/research/:researchId/group-files/:fileId/promote", requireAuth, async (req, res) => {
  try {
    const researchId = String(req.params.researchId);
    if (!(await requireMember(req, res, researchId))) return;
    const file = await prisma.groupFile.findFirst({ where: { id: String(req.params.fileId), researchId, deletedAt: null } });
    if (!file) return void res.status(404).json({ error: "File not found." });
    if (file.promotedDocumentId) return void res.status(409).json({ error: "This file is already in Documents.", documentId: file.promotedDocumentId });
    const result = await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({ data: { researchId, title: file.name, documentType: "GROUP_FILE", currentVersion: 1, storageProvider: file.storageProvider, externalFileId: file.externalFileId, createdBy: req.user!.id } });
      await tx.documentVersion.create({ data: { documentId: document.id, versionNumber: 1, fileName: file.name, mimeType: file.mimeType, fileSize: file.fileSize, storagePath: file.storagePath, googleDriveFileId: file.storageProvider === "GOOGLE_DRIVE" ? file.externalFileId : null, uploadedBy: req.user!.id, status: "ACTIVE" } });
      await tx.groupFile.update({ where: { id: file.id }, data: { promotedDocumentId: document.id } });
      return document;
    });
    res.status(201).json({ document: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unable to add file to Documents." });
  }
});

export default router;
