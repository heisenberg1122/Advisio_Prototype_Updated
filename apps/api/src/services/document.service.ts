import { prisma } from "../lib/prisma.js";
import { googleDriveService } from "./google-drive.service.js";
import { supabaseStorageService } from "./supabase-storage.service.js";
import { storageHierarchyService } from "./storage-hierarchy.service.js";
import crypto from "node:crypto";

export interface CreateDocumentPayload {
  researchId: string;
  title: string;
  documentType: string;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  uploadedBy: string;
}

export interface CreateVersionPayload {
  documentId: string;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  uploadedBy: string;
}

class DocumentService {
  /**
   * Uploads a file to the explicitly configured storage provider and persists Document + DocumentVersion (v1).
   */
  public async createDocumentWithVersion(payload: CreateDocumentPayload) {
    // Google Drive is the institution-level default. Supabase remains an explicit legacy option.
    let storageResult: any = null;
    let provider = (
      process.env.STORAGE_PROVIDER || "GOOGLE_DRIVE"
    ).toUpperCase();

    if (provider === "SUPABASE" && supabaseStorageService.isConfigured()) {
      storageResult = await supabaseStorageService.uploadFile({
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        buffer: payload.fileBuffer,
        folder: payload.researchId,
      });
    }

    if (provider === "GOOGLE_DRIVE") {
      provider = "GOOGLE_DRIVE";
      const taskId = payload.documentType.startsWith("TASK_")
        ? payload.documentType.slice(5)
        : null;
      const destinationFolderId = await storageHierarchyService.resolveFolder({
        researchId: payload.researchId,
        bucket: taskId ? "SUBMISSIONS" : "WORKING",
        taskId,
      });
      storageResult = await googleDriveService.uploadFile({
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        buffer: payload.fileBuffer,
        folderId: destinationFolderId,
        description: `Advisio working document: ${payload.title}`,
        appProperties: {
          advisioManaged: "true",
          advisioResearchId: payload.researchId,
          advisioUploaderId: payload.uploadedBy,
          advisioLifecycle: taskId ? "SUBMITTED" : "WORKING",
          ...(taskId ? { advisioTaskId: taskId } : {}),
          advisioChecksum: crypto
            .createHash("sha256")
            .update(payload.fileBuffer)
            .digest("hex"),
        },
      });
    }
    if (!storageResult)
      throw new Error(
        `The configured storage provider (${provider}) is unavailable.`,
      );

    // 2. Transactionally save Document and DocumentVersion in Prisma PostgreSQL
    return await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          researchId: payload.researchId,
          title: payload.title,
          documentType: payload.documentType,
          currentVersion: 1,
          storageProvider: provider,
          externalFileId: storageResult.fileId,
          createdBy: payload.uploadedBy,
        },
      });

      const version = await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: 1,
          fileName: storageResult.fileName,
          mimeType: storageResult.mimeType,
          fileSize: BigInt(storageResult.sizeBytes),
          storagePath: storageResult.webViewLink || storageResult.storagePath,
          googleDriveFileId:
            provider === "GOOGLE_DRIVE" ? storageResult.fileId : null,
          uploadedBy: payload.uploadedBy,
          status: "ACTIVE",
        },
      });

      return {
        document: doc,
        version: {
          ...version,
          fileSize: Number(version.fileSize),
          webViewLink: storageResult.webViewLink,
          webContentLink: storageResult.webContentLink,
        },
      };
    });
  }

  /**
   * Uploads a new version to the configured provider and persists v2+ in PostgreSQL.
   */
  public async addDocumentVersion(payload: CreateVersionPayload) {
    // 1. Fetch current latest version number
    const existingDoc = await prisma.document.findUnique({
      where: { id: payload.documentId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });

    if (!existingDoc) {
      throw new Error(`Document not found: ${payload.documentId}`);
    }

    const nextVersionNumber = (existingDoc.versions[0]?.versionNumber || 0) + 1;

    // 2. Use the explicitly configured provider.
    let storageResult: any = null;
    let provider = (
      process.env.STORAGE_PROVIDER || "GOOGLE_DRIVE"
    ).toUpperCase();

    if (provider === "SUPABASE" && supabaseStorageService.isConfigured()) {
      storageResult = await supabaseStorageService.uploadFile({
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        buffer: payload.fileBuffer,
        folder: existingDoc.researchId || payload.documentId,
      });
    }

    if (provider === "GOOGLE_DRIVE") {
      provider = "GOOGLE_DRIVE";
      const taskSubmission = await prisma.taskSubmission.findFirst({
        where: { documentId: existingDoc.id },
        orderBy: { updatedAt: "desc" },
        select: { taskId: true, status: true },
      });
      const destinationFolderId = await storageHierarchyService.resolveFolder({
        researchId: existingDoc.researchId,
        bucket: taskSubmission ? "SUBMISSIONS" : "WORKING",
        taskId: taskSubmission?.taskId,
      });
      storageResult = await googleDriveService.uploadFile({
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        buffer: payload.fileBuffer,
        folderId: destinationFolderId,
        description: `Advisio version ${nextVersionNumber}: ${existingDoc.title}`,
        appProperties: {
          advisioManaged: "true",
          advisioResearchId: existingDoc.researchId,
          advisioDocumentId: existingDoc.id,
          advisioUploaderId: payload.uploadedBy,
          advisioVersion: String(nextVersionNumber),
          advisioLifecycle:
            taskSubmission?.status === "REVISION_REQUIRED"
              ? "RESUBMITTED"
              : taskSubmission
                ? "SUBMITTED"
                : "WORKING",
          ...(taskSubmission?.taskId
            ? { advisioTaskId: taskSubmission.taskId }
            : {}),
          advisioChecksum: crypto
            .createHash("sha256")
            .update(payload.fileBuffer)
            .digest("hex"),
        },
      });
    }
    if (!storageResult)
      throw new Error(
        `The configured storage provider (${provider}) is unavailable.`,
      );

    // 3. Mark previous versions as SUPERSEDED and create new version in PostgreSQL
    return await prisma.$transaction(async (tx) => {
      await tx.documentVersion.updateMany({
        where: {
          documentId: payload.documentId,
          status: "ACTIVE",
        },
        data: {
          status: "SUPERSEDED",
        },
      });

      const newVersion = await tx.documentVersion.create({
        data: {
          documentId: payload.documentId,
          versionNumber: nextVersionNumber,
          fileName: storageResult.fileName,
          mimeType: storageResult.mimeType,
          fileSize: BigInt(storageResult.sizeBytes),
          storagePath: storageResult.webViewLink || storageResult.storagePath,
          googleDriveFileId:
            provider === "GOOGLE_DRIVE" ? storageResult.fileId : null,
          uploadedBy: payload.uploadedBy,
          status: "ACTIVE",
        },
      });

      await tx.document.update({
        where: { id: payload.documentId },
        data: {
          currentVersion: nextVersionNumber,
          storageProvider: provider,
          externalFileId: storageResult.fileId,
          updatedAt: new Date(),
        },
      });

      return {
        ...newVersion,
        fileSize: Number(newVersion.fileSize),
        webViewLink: storageResult.webViewLink,
        webContentLink: storageResult.webContentLink,
      };
    });
  }

  /**
   * Retrieves all versions and review remarks for a document from PostgreSQL
   */
  public async getDocumentWithVersions(documentId: string) {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            reviews: {
              include: {
                reviewer: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
                comments: true,
              },
            },
          },
        },
      },
    });

    if (!doc) return null;

    return {
      ...doc,
      versions: doc.versions.map((v) => ({
        ...v,
        fileSize: Number(v.fileSize),
        webViewLink: v.storagePath.startsWith("http")
          ? v.storagePath
          : v.googleDriveFileId
            ? `/api/documents/files/${v.googleDriveFileId}`
            : undefined,
      })),
    };
  }
}

export const documentService = new DocumentService();
