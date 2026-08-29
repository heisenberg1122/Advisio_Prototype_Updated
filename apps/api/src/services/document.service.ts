import { prisma } from "../lib/prisma.js";
import { googleDriveService } from "./google-drive.service.js";

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
   * Uploads file to Google Drive and creates Document + DocumentVersion (v1) in PostgreSQL
   */
  public async createDocumentWithVersion(payload: CreateDocumentPayload) {
    // 1. Upload to Google Drive
    const driveResult = await googleDriveService.uploadFile({
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      buffer: payload.fileBuffer,
      description: `Manuscript for ${payload.title}`,
    });

    // 2. Transactionally save Document and DocumentVersion in Prisma PostgreSQL
    return await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          researchId: payload.researchId,
          title: payload.title,
          documentType: payload.documentType,
          currentVersion: 1,
          storageProvider: "GOOGLE_DRIVE",
          externalFileId: driveResult.fileId,
          createdBy: payload.uploadedBy,
        },
      });

      const version = await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: 1,
          fileName: driveResult.fileName,
          mimeType: driveResult.mimeType,
          fileSize: BigInt(driveResult.sizeBytes),
          storagePath: driveResult.storagePath,
          googleDriveFileId: driveResult.fileId,
          uploadedBy: payload.uploadedBy,
          status: "ACTIVE",
        },
      });

      return {
        document: doc,
        version: {
          ...version,
          fileSize: Number(version.fileSize),
          webViewLink: driveResult.webViewLink,
          webContentLink: driveResult.webContentLink,
        },
      };
    });
  }

  /**
   * Uploads a new version of an existing document to Google Drive and persists v2+ in PostgreSQL
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

    // 2. Upload to Google Drive
    const driveResult = await googleDriveService.uploadFile({
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      buffer: payload.fileBuffer,
      description: `Version ${nextVersionNumber} for ${existingDoc.title}`,
    });

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
          fileName: driveResult.fileName,
          mimeType: driveResult.mimeType,
          fileSize: BigInt(driveResult.sizeBytes),
          storagePath: driveResult.storagePath,
          googleDriveFileId: driveResult.fileId,
          uploadedBy: payload.uploadedBy,
          status: "ACTIVE",
        },
      });

      await tx.document.update({
        where: { id: payload.documentId },
        data: {
          currentVersion: nextVersionNumber,
          externalFileId: driveResult.fileId,
          updatedAt: new Date(),
        },
      });

      return {
        ...newVersion,
        fileSize: Number(newVersion.fileSize),
        webViewLink: driveResult.webViewLink,
        webContentLink: driveResult.webContentLink,
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
                  select: { id: true, firstName: true, lastName: true, email: true },
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
        webViewLink: v.googleDriveFileId ? `https://drive.google.com/file/d/${v.googleDriveFileId}/view` : undefined,
      })),
    };
  }
}

export const documentService = new DocumentService();
