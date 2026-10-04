import { google, drive_v3 } from "googleapis";
import { Readable } from "node:stream";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const PROVIDER = "GOOGLE_DRIVE";
const ROOT_FOLDER_NAME = "ADVISIO_TEST_STORAGE";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const SERVICE_ACCOUNT_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export interface DriveUploadOptions {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  folderId?: string;
  description?: string;
  appProperties?: Record<string, string>;
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
type DriveHealthStatus =
  | "DISCONNECTED"
  | "HEALTHY"
  | "DEGRADED"
  | "ACTION_REQUIRED"
  | "FOLDER_INACCESSIBLE"
  | "MISCONFIGURED";

function oauthConfiguration() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      "http://localhost:5000/api/integrations/google-drive/callback",
  };
}

function integrationSecret(): string {
  return (
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    process.env.AUTH_SECRET ||
    "advisio-dev-integration-key-change-in-production"
  );
}

function encryptionKey(): Buffer {
  return crypto.createHash("sha256").update(integrationSecret()).digest();
}

function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function decryptSecret(value: string): string {
  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart)
    throw new Error("Stored Google Drive credentials are invalid");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

// Google Drive limits each app-property key + value pair to 124 UTF-8 bytes.
// Trim by bytes (not JavaScript character count) so accented names remain safe.
function driveAppProperties(properties?: Record<string, string>) {
  if (!properties) return undefined;
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => {
      const availableBytes = Math.max(0, 124 - Buffer.byteLength(key, "utf8"));
      let safeValue = String(value);
      while (Buffer.byteLength(safeValue, "utf8") > availableBytes) {
        safeValue = safeValue.slice(0, -1);
      }
      return [key, safeValue];
    }),
  );
}

function safeDriveError(error: any): {
  status: DriveHealthStatus;
  code: string;
  message: string;
} {
  const httpStatus = Number(error?.response?.status || error?.code || 0);
  const reason =
    error?.response?.data?.error?.errors?.[0]?.reason || "drive_error";
  if (
    httpStatus === 401 ||
    reason === "authError" ||
    String(error?.message).includes("invalid_grant")
  ) {
    return {
      status: "ACTION_REQUIRED",
      code: "AUTHORIZATION_EXPIRED",
      message:
        "Google authorization expired or was revoked. Reconnect the account.",
    };
  }
  if (httpStatus === 404)
    return {
      status: "FOLDER_INACCESSIBLE",
      code: "ROOT_FOLDER_NOT_FOUND",
      message: "The Advisio storage folder is missing or inaccessible.",
    };
  if (httpStatus === 403 || httpStatus === 429)
    return {
      status: "DEGRADED",
      code: String(reason).toUpperCase(),
      message:
        "Google Drive is temporarily limiting or denying storage requests.",
    };
  return {
    status: "DEGRADED",
    code: "DRIVE_API_ERROR",
    message: "Google Drive could not complete the health check.",
  };
}

class GoogleDriveService {
  private escapeDriveQuery(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  public isOAuthConfigured(): boolean {
    const config = oauthConfiguration();
    return Boolean(
      config.clientId && config.clientSecret && config.redirectUri,
    );
  }

  private oauthClient() {
    const config = oauthConfiguration();
    if (!config.clientId || !config.clientSecret)
      throw new Error("Google OAuth client credentials are not configured");
    return new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    );
  }

  public createAuthorizationUrl(adminUserId: string): string {
    const state = jwt.sign(
      {
        purpose: "google-drive-connect",
        userId: adminUserId,
        nonce: crypto.randomUUID(),
      },
      integrationSecret(),
      {
        expiresIn: "10m",
        issuer: "advisio-api",
        audience: "google-drive-oauth",
      },
    );
    return this.oauthClient().generateAuthUrl({
      access_type: "offline",
      prompt: "consent select_account",
      include_granted_scopes: true,
      scope: [DRIVE_SCOPE],
      state,
    });
  }

  public verifyAuthorizationState(state: string): { userId: string } {
    const payload = jwt.verify(state, integrationSecret(), {
      issuer: "advisio-api",
      audience: "google-drive-oauth",
    }) as { purpose?: string; userId?: string };
    if (payload.purpose !== "google-drive-connect" || !payload.userId)
      throw new Error("Invalid Google Drive authorization state");
    return { userId: payload.userId };
  }

  private async ensureRootFolder(
    drive: drive_v3.Drive,
    preferredFolderId?: string | null,
  ) {
    if (preferredFolderId) {
      try {
        const existing = await drive.files.get({
          fileId: preferredFolderId,
          fields:
            "id,name,mimeType,trashed,driveId,capabilities(canAddChildren)",
          supportsAllDrives: true,
        });
        if (
          !existing.data.trashed &&
          existing.data.mimeType === "application/vnd.google-apps.folder"
        )
          return existing.data;
      } catch {
        /* Create or locate a replacement below. */
      }
    }
    const found = await drive.files.list({
      q: `name = '${ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      spaces: "drive",
      fields: "files(id,name,mimeType,driveId,capabilities(canAddChildren))",
      pageSize: 10,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (found.data.files?.[0]) return found.data.files[0];
    const created = await drive.files.create({
      requestBody: {
        name: ROOT_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id,name,mimeType,driveId,capabilities(canAddChildren)",
      supportsAllDrives: true,
    });
    return created.data;
  }

  public async completeAuthorization(code: string, state: string) {
    const { userId } = this.verifyAuthorizationState(state);
    const client = this.oauthClient();
    const { tokens } = await client.getToken(code);
    const existing = await prisma.storageIntegration.findUnique({
      where: { provider: PROVIDER },
    });
    const refreshToken =
      tokens.refresh_token ||
      (existing?.encryptedRefreshToken
        ? decryptSecret(existing.encryptedRefreshToken)
        : null);
    if (!refreshToken)
      throw new Error(
        "Google did not issue a refresh token. Reconnect and approve access again.",
      );
    client.setCredentials({ ...tokens, refresh_token: refreshToken });
    const drive = google.drive({ version: "v3", auth: client });
    const about = await drive.about.get({
      fields:
        "user(displayName,emailAddress,photoLink),storageQuota,maxUploadSize",
    });
    const folder = await this.ensureRootFolder(
      drive,
      existing?.rootFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID,
    );
    const now = new Date();
    const data = {
      authenticationType: "OAUTH",
      status: "HEALTHY" as const,
      accountEmail: about.data.user?.emailAddress || null,
      accountDisplayName: about.data.user?.displayName || null,
      accountPhotoUrl: about.data.user?.photoLink || null,
      encryptedRefreshToken: encryptSecret(refreshToken),
      rootFolderId: folder.id || null,
      rootFolderName: folder.name || ROOT_FOLDER_NAME,
      sharedDriveId: folder.driveId || null,
      connectedBy: userId,
      connectedAt: now,
      lastCheckedAt: now,
      lastHealthyAt: now,
      lastErrorCode: null,
      lastErrorMessage: null,
    };
    const integration = await prisma.storageIntegration.upsert({
      where: { provider: PROVIDER },
      create: { provider: PROVIDER, ...data },
      update: data,
    });
    await prisma.auditLog.create({
      data: {
        userId,
        action: "UPDATE",
        entityType: "STORAGE_INTEGRATION",
        entityId: integration.id,
        newValues: {
          provider: PROVIDER,
          accountEmail: integration.accountEmail,
          rootFolderId: integration.rootFolderId,
        },
      },
    });
    return integration;
  }

  private async connectedClient() {
    const integration = await prisma.storageIntegration.findUnique({
      where: { provider: PROVIDER },
    });
    if (integration?.encryptedRefreshToken) {
      const client = this.oauthClient();
      client.setCredentials({
        refresh_token: decryptSecret(integration.encryptedRefreshToken),
      });
      return {
        drive: google.drive({ version: "v3", auth: client }),
        integration,
      };
    }
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (serviceAccountEmail && privateKey) {
      const auth = new google.auth.JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: [SERVICE_ACCOUNT_DRIVE_SCOPE],
      });
      return {
        drive: google.drive({ version: "v3", auth }),
        integration: null,
      };
    }
    if (this.isOAuthConfigured() && process.env.GOOGLE_REFRESH_TOKEN) {
      const client = this.oauthClient();
      client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      });
      return {
        drive: google.drive({ version: "v3", auth: client }),
        integration: null,
      };
    }
    return null;
  }

  public async getStatus() {
    const integration = await prisma.storageIntegration.findUnique({
      where: { provider: PROVIDER },
    });
    const aggregate = await prisma.documentVersion.aggregate({
      where: { googleDriveFileId: { not: null } },
      _count: { _all: true },
      _sum: { fileSize: true },
    });
    return {
      oauthConfigured: this.isOAuthConfigured(),
      encryptionConfigured: Boolean(process.env.INTEGRATION_ENCRYPTION_KEY),
      connected: Boolean(integration?.encryptedRefreshToken),
      status:
        integration?.status ||
        (this.isOAuthConfigured() ? "DISCONNECTED" : "MISCONFIGURED"),
      account: integration
        ? {
            email: integration.accountEmail,
            displayName: integration.accountDisplayName,
            photoUrl: integration.accountPhotoUrl,
          }
        : null,
      rootFolder: integration?.rootFolderId
        ? {
            id: integration.rootFolderId,
            name: integration.rootFolderName,
            sharedDriveId: integration.sharedDriveId,
          }
        : null,
      connectedAt: integration?.connectedAt || null,
      lastCheckedAt: integration?.lastCheckedAt || null,
      lastHealthyAt: integration?.lastHealthyAt || null,
      error: integration?.lastErrorCode
        ? {
            code: integration.lastErrorCode,
            message: integration.lastErrorMessage,
          }
        : null,
      managedStorage: {
        fileCount: aggregate._count._all,
        bytes: Number(aggregate._sum.fileSize || 0),
      },
    };
  }

  public async healthCheck() {
    const connection = await this.connectedClient();
    if (!connection?.integration)
      throw new Error(
        "Google Drive is not connected through System Administration",
      );
    const { drive, integration } = connection;
    const now = new Date();
    try {
      const about = await drive.about.get({
        fields:
          "user(displayName,emailAddress,photoLink),storageQuota,maxUploadSize",
      });
      if (!integration.rootFolderId)
        throw Object.assign(new Error("Root folder is not configured"), {
          code: 404,
        });
      const folder = await drive.files.get({
        fileId: integration.rootFolderId,
        fields: "id,name,mimeType,trashed,driveId,capabilities(canAddChildren)",
        supportsAllDrives: true,
      });
      if (
        folder.data.trashed ||
        folder.data.mimeType !== "application/vnd.google-apps.folder"
      )
        throw Object.assign(new Error("Root folder is unavailable"), {
          code: 404,
        });
      if (folder.data.capabilities?.canAddChildren === false)
        throw Object.assign(new Error("Root folder is read-only"), {
          code: 403,
        });
      await prisma.storageIntegration.update({
        where: { provider: PROVIDER },
        data: {
          status: "HEALTHY",
          accountEmail:
            about.data.user?.emailAddress || integration.accountEmail,
          accountDisplayName:
            about.data.user?.displayName || integration.accountDisplayName,
          accountPhotoUrl:
            about.data.user?.photoLink || integration.accountPhotoUrl,
          rootFolderName: folder.data.name || integration.rootFolderName,
          sharedDriveId: folder.data.driveId || integration.sharedDriveId,
          lastCheckedAt: now,
          lastHealthyAt: now,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      return {
        ...(await this.getStatus()),
        quota: about.data.storageQuota || null,
        maxUploadSize: about.data.maxUploadSize || null,
      };
    } catch (error: any) {
      const safe = safeDriveError(error);
      await prisma.storageIntegration.update({
        where: { provider: PROVIDER },
        data: {
          status: safe.status,
          lastCheckedAt: now,
          lastErrorCode: safe.code,
          lastErrorMessage: safe.message,
        },
      });
      return { ...(await this.getStatus()), quota: null, maxUploadSize: null };
    }
  }

  public async disconnect(userId: string) {
    const connection = await this.connectedClient();
    const integration = connection?.integration;
    if (!integration) return this.getStatus();
    try {
      const token = decryptSecret(integration.encryptedRefreshToken!);
      await this.oauthClient().revokeToken(token);
    } catch {
      /* Token may already be invalid. */
    }
    await prisma.storageIntegration.update({
      where: { provider: PROVIDER },
      data: {
        status: "DISCONNECTED",
        encryptedRefreshToken: null,
        lastCheckedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId,
        action: "UPDATE",
        entityType: "STORAGE_INTEGRATION",
        entityId: integration.id,
        newValues: { status: "DISCONNECTED" },
      },
    });
    return this.getStatus();
  }

  /**
   * Resolves an Advisio folder path below the connected storage root. Missing
   * folders are created once and their Drive IDs are persisted for later use.
   */
  public async ensureFolderPath(
    segments: Array<{
      name: string;
      key: string;
      entityType?: string;
      entityId?: string;
    }>,
  ): Promise<string> {
    const connection = await this.connectedClient();
    const rootFolderId =
      connection?.integration?.rootFolderId ||
      process.env.GOOGLE_DRIVE_FOLDER_ID ||
      "";
    if (!connection?.drive || !rootFolderId)
      throw new Error(
        "Google Drive is not connected. A System Administrator must connect storage before folders can be provisioned.",
      );

    let parentFolderId = rootFolderId;
    const accumulatedKeys: string[] = [];
    for (const segment of segments) {
      accumulatedKeys.push(segment.key);
      const pathKey = accumulatedKeys.join("/");
      const mappedRows = await prisma.$queryRaw<
        Array<{ externalFolderId: string }>
      >`SELECT "external_folder_id" AS "externalFolderId"
        FROM "storage_folders"
        WHERE "provider" = ${PROVIDER} AND "path_key" = ${pathKey}
        LIMIT 1`;
      const mapped = mappedRows[0];
      if (mapped) {
        // Folder mappings are authoritative during normal requests. Their
        // health is checked separately by administration/recovery workflows,
        // avoiding a Google API round-trip for every parent on every upload.
        parentFolderId = mapped.externalFolderId;
        continue;
      }

      const queryName = this.escapeDriveQuery(segment.name);
      const found = await connection.drive.files.list({
        q: `'${parentFolderId}' in parents and name = '${queryName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        spaces: "drive",
        fields: "files(id,name)",
        pageSize: 2,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const folder =
        found.data.files?.[0] ||
        (
          await connection.drive.files.create({
            requestBody: {
              name: segment.name,
              mimeType: "application/vnd.google-apps.folder",
              parents: [parentFolderId],
              appProperties: driveAppProperties({
                advisioManaged: "true",
                advisioPathKey: pathKey,
                ...(segment.entityType
                  ? { advisioEntityType: segment.entityType }
                  : {}),
                ...(segment.entityId
                  ? { advisioEntityId: segment.entityId }
                  : {}),
              }),
            },
            fields: "id,name",
            supportsAllDrives: true,
          })
        ).data;
      if (!folder.id)
        throw new Error(
          `Google Drive did not return an ID for ${segment.name}`,
        );

      const storedName = folder.name || segment.name;
      const entityType = segment.entityType || null;
      const entityId = segment.entityId || null;
      await prisma.$executeRaw`INSERT INTO "storage_folders"
        ("provider", "path_key", "external_folder_id", "parent_folder_id", "name", "entity_type", "entity_id", "updated_at")
        VALUES (${PROVIDER}, ${pathKey}, ${folder.id}, ${parentFolderId}, ${storedName}, ${entityType}, ${entityId}, CURRENT_TIMESTAMP)
        ON CONFLICT ("provider", "path_key") DO UPDATE SET
          "external_folder_id" = EXCLUDED."external_folder_id",
          "parent_folder_id" = EXCLUDED."parent_folder_id",
          "name" = EXCLUDED."name",
          "entity_type" = EXCLUDED."entity_type",
          "entity_id" = EXCLUDED."entity_id",
          "updated_at" = CURRENT_TIMESTAMP`;
      parentFolderId = folder.id;
    }
    return parentFolderId;
  }

  public async moveFile(fileId: string, destinationFolderId: string) {
    const connection = await this.connectedClient();
    if (!connection?.drive) throw new Error("Google Drive is not connected");
    const current = await connection.drive.files.get({
      fileId,
      fields: "id,parents",
      supportsAllDrives: true,
    });
    const oldParents = (current.data.parents || [])
      .filter((id) => id !== destinationFolderId)
      .join(",");
    await connection.drive.files.update({
      fileId,
      addParents: destinationFolderId,
      ...(oldParents ? { removeParents: oldParents } : {}),
      requestBody: {},
      fields: "id,parents",
      supportsAllDrives: true,
    });
  }

  public async uploadFile(
    options: DriveUploadOptions,
  ): Promise<DriveFileResult> {
    const connection = await this.connectedClient();
    const folderId =
      options.folderId ||
      connection?.integration?.rootFolderId ||
      process.env.GOOGLE_DRIVE_FOLDER_ID ||
      "";
    if (connection?.drive && folderId) {
      const response = await connection.drive.files.create({
        requestBody: {
          name: options.fileName,
          description:
            options.description || "Uploaded via Advisio Research Platform",
          parents: [folderId],
          appProperties: driveAppProperties(options.appProperties),
        },
        media: {
          mimeType: options.mimeType,
          body: Readable.from(options.buffer),
        },
        fields: "id,name,mimeType,size",
        supportsAllDrives: true,
      });
      const file = response.data;
      if (!file.id)
        throw new Error("Google Drive did not return a file identifier");
      return {
        fileId: file.id,
        fileName: file.name || options.fileName,
        mimeType: file.mimeType || options.mimeType,
        sizeBytes: Number(file.size || options.buffer.length),
        webViewLink: `/api/documents/files/${file.id}`,
        webContentLink: `/api/documents/files/${file.id}?download=1`,
        storagePath: `google-drive://${file.id}`,
      };
    }
    if (process.env.ALLOW_LOCAL_STORAGE_FALLBACK !== "true")
      throw new Error(
        "Google Drive is not connected. A System Administrator must connect storage before uploads can continue.",
      );
    const uploadDir = path.resolve(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const uniqueFileId = `gdrive-${crypto.randomUUID()}`;
    const diskPath = path.join(
      uploadDir,
      `${uniqueFileId}-${options.fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
    );
    fs.writeFileSync(diskPath, options.buffer);
    return {
      fileId: uniqueFileId,
      fileName: options.fileName,
      mimeType: options.mimeType,
      sizeBytes: options.buffer.length,
      webViewLink: `/api/documents/files/${uniqueFileId}`,
      webContentLink: `/api/documents/files/${uniqueFileId}?download=1`,
      storagePath: diskPath,
    };
  }

  public async getFileMetadata(fileId: string) {
    const connection = await this.connectedClient();
    if (!connection?.drive) return null;
    return (
      await connection.drive.files.get({
        fileId,
        fields: "id,name,mimeType,size,createdTime,modifiedTime",
        supportsAllDrives: true,
      })
    ).data;
  }

  public async getFileStream(fileId: string) {
    const connection = await this.connectedClient();
    if (!connection?.drive) throw new Error("Google Drive is not connected");
    return connection.drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" },
    );
  }

  public async deleteFile(fileId: string): Promise<boolean> {
    const connection = await this.connectedClient();
    if (!connection?.drive) return false;
    await connection.drive.files.delete({ fileId, supportsAllDrives: true });
    return true;
  }
}

export const googleDriveService = new GoogleDriveService();
