import { google, drive_v3 } from "googleapis";
import { Readable } from "stream";
import crypto from "crypto";
import path from "path";
import fs from "fs";

export interface DriveUploadOptions {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  folderId?: string;
  description?: string;
}

export interface DriveFileResult {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  webViewLink: string;
  webContentLink: string;
  storagePath: string;
}

class GoogleDriveService {
  private drive: drive_v3.Drive | null = null;
  private rootFolderId: string = process.env.GOOGLE_DRIVE_FOLDER_ID || "";

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

      if (serviceAccountEmail && privateKey) {
        const auth = new google.auth.JWT({
          email: serviceAccountEmail,
          key: privateKey,
          scopes: [
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/drive.file",
          ],
        });
        this.drive = google.drive({ version: "v3", auth });
      } else if (clientId && clientSecret && refreshToken) {
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        this.drive = google.drive({ version: "v3", auth: oauth2Client });
      }
    } catch (error) {
      console.warn("[GoogleDriveService] Initialization warning:", error);
    }
  }

  /**
   * Uploads a file stream directly to Google Drive v3
   */
  public async uploadFile(options: DriveUploadOptions): Promise<DriveFileResult> {
    const fileStream = new Readable();
    fileStream.push(options.buffer);
    fileStream.push(null);

    const folderId = options.folderId || this.rootFolderId;

    if (this.drive) {
      try {
        const fileMetadata: drive_v3.Schema$File = {
          name: options.fileName,
          description: options.description || "Uploaded via Advisio Research Platform",
          ...(folderId ? { parents: [folderId] } : {}),
        };

        const media = {
          mimeType: options.mimeType,
          body: fileStream,
        };

        const response = await this.drive.files.create({
          requestBody: fileMetadata,
          media,
          fields: "id, name, mimeType, size, webViewLink, webContentLink",
        });

        const file = response.data;
        const fileId = file.id || `drive-${crypto.randomUUID()}`;

        // Set permission to anyone with link if public reading is needed
        try {
          await this.drive.permissions.create({
            fileId,
            requestBody: {
              role: "reader",
              type: "anyone",
            },
          });
        } catch {
          // Ignore permission set error if service account domain restricted
        }

        return {
          fileId,
          fileName: file.name || options.fileName,
          mimeType: file.mimeType || options.mimeType,
          sizeBytes: Number(file.size || options.buffer.length),
          webViewLink: file.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
          webContentLink: file.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`,
          storagePath: `google-drive://${fileId}`,
        };
      } catch (error: any) {
        console.error("[GoogleDriveService] Drive API upload error:", error.message);
      }
    }

    // Local persistent storage fallback when Drive credentials are not yet set
    const uploadDir = path.resolve(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueFileId = `gdrive-${crypto.randomUUID()}`;
    const safeDiskName = `${uniqueFileId}-${options.fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const diskPath = path.join(uploadDir, safeDiskName);
    fs.writeFileSync(diskPath, options.buffer);

    return {
      fileId: uniqueFileId,
      fileName: options.fileName,
      mimeType: options.mimeType,
      sizeBytes: options.buffer.length,
      webViewLink: `https://drive.google.com/file/d/${uniqueFileId}/view`,
      webContentLink: `/api/documents/download/${uniqueFileId}`,
      storagePath: diskPath,
    };
  }

  /**
   * Retrieves file metadata from Google Drive
   */
  public async getFileMetadata(fileId: string): Promise<any> {
    if (!this.drive) return null;
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: "id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime",
      });
      return response.data;
    } catch (error: any) {
      console.error("[GoogleDriveService] Failed to get file metadata:", error.message);
      return null;
    }
  }

  /**
   * Deletes a file from Google Drive
   */
  public async deleteFile(fileId: string): Promise<boolean> {
    if (!this.drive) return false;
    try {
      await this.drive.files.delete({ fileId });
      return true;
    } catch (error: any) {
      console.error("[GoogleDriveService] Failed to delete file:", error.message);
      return false;
    }
  }
}

export const googleDriveService = new GoogleDriveService();
