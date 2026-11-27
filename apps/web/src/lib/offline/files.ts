import { apiClient } from "@/lib/api-client";
import {
  listOffline,
  writeOffline,
  type OfflineFile,
  type OfflineSession,
} from "./store";

export function isOfflineFileUrl(url: string) {
  try {
    const base = new URL(
      import.meta.env.VITE_API_URL || window.location.origin,
    );
    const parsed = new URL(url, base);
    return parsed.origin === base.origin && parsed.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

export async function saveOfflineFile(
  session: OfflineSession,
  file: {
    id: string;
    name: string;
    url: string;
    projectId?: string;
    workflowId?: string;
  },
) {
  if (!isOfflineFileUrl(file.url))
    throw new Error(
      "Live documents need an internet connection. Save a manuscript version to make it available offline.",
    );
  const blob = await apiClient.file(file.url);
  const mime = blob.type.split(";")[0].toLowerCase();
  if (
    !/^(application\/(pdf|msword|vnd\.[a-z0-9.+-]+|octet-stream)|text\/(plain|csv)|image\/(png|jpeg))$/.test(
      mime,
    )
  )
    throw new Error("This file type cannot be saved for offline use.");
  if (blob.size > 25 * 1024 * 1024)
    throw new Error(
      "The offline limit is 25 MB per file. Download this file normally instead.",
    );
  const existing = await listOffline<OfflineFile>(session, "file:");
  const total = existing
    .filter((entry) => entry.key !== `file:${file.id}`)
    .reduce((sum, entry) => sum + entry.value.blob.size, blob.size);
  if (total > 100 * 1024 * 1024)
    throw new Error(
      "Offline files exceed 100 MB. Remove a saved file from Offline settings and try again.",
    );
  await writeOffline<OfflineFile>(session, `file:${file.id}`, {
    name: file.name,
    url: file.url,
    projectId: file.projectId,
    workflowId: file.workflowId,
    blob,
    savedAt: Date.now(),
  });
}

export function exportText(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 80) || "Advisio draft"}.txt`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
