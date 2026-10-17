import { StorageClient } from "@supabase/storage-js";
import crypto from "crypto";

export interface StorageUploadOptions {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  folder?: string;
}

export interface StorageFileResult {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  webViewLink: string;
  webContentLink: string;
  storagePath: string;
}

class SupabaseStorageService {
  private client: StorageClient | null = null;
  private bucketName: string =
    process.env.SUPABASE_STORAGE_BUCKET || "manuscripts";

  constructor() {
    this.init();
  }

  private init() {
    const url = (
      process.env.SUPABASE_URL || "https://lodfsclvqiyaqidycyhq.supabase.co"
    ).replace(/\/$/, "");
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (url && key) {
      this.client = new StorageClient(`${url}/storage/v1`, {
        apikey: key,
        Authorization: `Bearer ${key}`,
      });
    }
  }

  public isConfigured(): boolean {
    return !!this.client;
  }

  public async uploadFile(
    options: StorageUploadOptions,
  ): Promise<StorageFileResult | null> {
    if (!this.client) return null;

    try {
      const fileId = crypto.randomUUID();
      const safeName = options.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = options.folder
        ? `${options.folder}/${fileId}-${safeName}`
        : `${fileId}-${safeName}`;

      const { data, error } = await this.client
        .from(this.bucketName)
        .upload(filePath, options.buffer, {
          contentType: options.mimeType,
          upsert: true,
        });

      if (error) {
        console.error("[SupabaseStorage] Upload error:", error.message);
        return null;
      }

      const { data: publicUrlData } = this.client
        .from(this.bucketName)
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      return {
        fileId,
        fileName: options.fileName,
        mimeType: options.mimeType,
        sizeBytes: options.buffer.length,
        webViewLink: publicUrl,
        webContentLink: publicUrl,
        storagePath: `supabase://${this.bucketName}/${filePath}`,
      };
    } catch (err: any) {
      console.error("[SupabaseStorage] Exception during upload:", err);
      return null;
    }
  }

  public async deleteStoredFile(storagePath: string): Promise<boolean> {
    if (!this.client) return false;
    const prefix = `supabase://${this.bucketName}/`;
    if (!storagePath.startsWith(prefix)) return false;
    const filePath = storagePath.slice(prefix.length);
    if (!filePath) return false;
    const { error } = await this.client
      .from(this.bucketName)
      .remove([filePath]);
    if (error) throw new Error(error.message);
    return true;
  }

  public async downloadStoredFile(storagePath: string): Promise<Buffer> {
    if (!this.client) throw new Error("Supabase storage is not configured.");
    const prefix = `supabase://${this.bucketName}/`;
    let filePath = storagePath.startsWith(prefix)
      ? storagePath.slice(prefix.length)
      : "";
    if (!filePath) {
      const configuredUrl = new URL(
        process.env.SUPABASE_URL || "https://lodfsclvqiyaqidycyhq.supabase.co",
      );
      const publicUrl = new URL(storagePath);
      const publicPrefix = `/storage/v1/object/public/${this.bucketName}/`;
      if (
        publicUrl.origin !== configuredUrl.origin ||
        !publicUrl.pathname.startsWith(publicPrefix)
      )
        throw new Error("The stored Supabase file path is invalid.");
      filePath = decodeURIComponent(
        publicUrl.pathname.slice(publicPrefix.length),
      );
    }
    if (!filePath) throw new Error("The stored Supabase file path is empty.");
    const { data, error } = await this.client
      .from(this.bucketName)
      .download(filePath);
    if (error || !data)
      throw new Error(
        error?.message || "The stored file could not be downloaded.",
      );
    return Buffer.from(await data.arrayBuffer());
  }
}

export const supabaseStorageService = new SupabaseStorageService();
