import { createClient, SupabaseClient } from "@supabase/supabase-js";
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
  private client: SupabaseClient | null = null;
  private bucketName: string = process.env.SUPABASE_STORAGE_BUCKET || "manuscripts";

  constructor() {
    this.init();
  }

  private init() {
    const url = process.env.SUPABASE_URL || "https://lodfsclvqiyaqidycyhq.supabase.co";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (url && key) {
      this.client = createClient(url, key, {
        auth: {
          persistSession: false,
        },
      });
    }
  }

  public isConfigured(): boolean {
    return !!this.client;
  }

  public async uploadFile(options: StorageUploadOptions): Promise<StorageFileResult | null> {
    if (!this.client) return null;

    try {
      const fileId = crypto.randomUUID();
      const safeName = options.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = options.folder ? `${options.folder}/${fileId}-${safeName}` : `${fileId}-${safeName}`;

      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .upload(filePath, options.buffer, {
          contentType: options.mimeType,
          upsert: true,
        });

      if (error) {
        console.error("[SupabaseStorage] Upload error:", error.message);
        return null;
      }

      const { data: publicUrlData } = this.client.storage
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
}

export const supabaseStorageService = new SupabaseStorageService();
