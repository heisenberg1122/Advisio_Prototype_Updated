export function safeStorageName(value: string, fallback: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|#%{}~]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return normalized || fallback;
}

// Position belongs to the workflow, never to a folder's identity or name.
export const milestoneFolderName = (name: string) =>
  safeStorageName(name, "Milestone");
