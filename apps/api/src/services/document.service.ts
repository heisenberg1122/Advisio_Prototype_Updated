import { prisma } from "../lib/prisma.js";
import { googleDriveService } from "./google-drive.service.js";
import { supabaseStorageService } from "./supabase-storage.service.js";
import { storageHierarchyService } from "./storage-hierarchy.service.js";
import crypto from "node:crypto";

export interface CreateDocumentPayload {
  researchId: string;
  milestoneId?: string | null;
  title: string;
  documentType: string;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  uploadedBy: string;
  deanRecipient?: { id: string; name: string };
}

export interface CreateVersionPayload {
  documentId: string;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  uploadedBy: string;
}

class DocumentService {
  public async storeDocumentFile(payload: CreateDocumentPayload) {
    let storageResult: any = null;
    let provider = (process.env.STORAGE_PROVIDER || "GOOGLE_DRIVE").toUpperCase();

    if (provider === "SUPABASE" && supabaseStorageService.isConfigured()) {
      storageResult = await supabaseStorageService.uploadFile({
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        buffer: payload.fileBuffer,
        folder: payload.researchId,
      });
    }

    if (provider === "GOOGLE_DRIVE") {
      const taskId = payload.documentType.startsWith("TASK_")
        ? payload.documentType.slice(5)
        : null;
      const destinationFolderId =
        payload.documentType === "DEAN_DEFENSE_APPROVAL"
          ? await storageHierarchyService.resolveDeanApprovalsFolder(
              payload.researchId,
              payload.deanRecipient,
            )
          : await storageHierarchyService.resolveFolder({
              researchId: payload.researchId,
              bucket: taskId ? "SUBMISSIONS" : "WORKING",
              taskId,
              stageId: payload.milestoneId,
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
          advisioLifecycle:
            payload.documentType === "DEAN_DEFENSE_APPROVAL"
              ? "DEAN_APPROVAL_REQUEST"
              : taskId
                ? "SUBMITTED"
                : "WORKING",
          ...(taskId ? { advisioTaskId: taskId } : {}),
          advisioChecksum: crypto.createHash("sha256").update(payload.fileBuffer).digest("hex"),
        },
      });
    }
    if (!storageResult) {
      throw new Error(`The configured storage provider (${provider}) is unavailable.`);
    }
    return { provider, storageResult };
  }

  public async cleanupStoredFile(provider: string, storageResult: any) {
    try {
      if (provider === "GOOGLE_DRIVE") {
        return await googleDriveService.deleteStoredFile(storageResult.fileId);
      }
      if (provider === "SUPABASE") {
        return await supabaseStorageService.deleteStoredFile(storageResult.storagePath);
      }
    } catch (error) {
      console.error("Unable to clean up an uncommitted document upload:", error);
    }
    return false;
  }

  /**
   * Uploads a file to the explicitly configured storage provider and persists Document + DocumentVersion (v1).
   */
  public async createDocumentWithVersion(payload: CreateDocumentPayload) {
    const { provider, storageResult } = await this.storeDocumentFile(payload);

    // 2. Transactionally save Document and DocumentVersion in Prisma PostgreSQL
    try {
      return await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          researchId: payload.researchId,
          milestoneId: payload.milestoneId || null,
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
          milestoneId: payload.milestoneId || null,
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

      await tx.auditLog.create({
        data: {
          userId: payload.uploadedBy,
          action: "CREATE",
          entityType: "DocumentVersion",
          entityId: version.id,
          newValues: {
            documentId: doc.id,
            researchId: payload.researchId,
            versionNumber: 1,
            fileName: version.fileName,
          },
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
    } catch (error) {
      await this.cleanupStoredFile(provider, storageResult);
      throw error;
    }
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

      await tx.auditLog.create({
        data: {
          userId: payload.uploadedBy,
          action: "CREATE",
          entityType: "DocumentVersion",
          entityId: newVersion.id,
          newValues: {
            documentId: payload.documentId,
            versionNumber: nextVersionNumber,
            fileName: newVersion.fileName,
          },
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
