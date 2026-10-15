// apps/web/src/lib/consultation-store.ts
// Read-only compatibility source for importing legacy browser consultations.

export interface ConsultationTranscriptMessage {
  id: string;
  sender: string;
  time: string;
  content: string;
}

export interface ConsultationItem {
  id: string;
  researchId?: string;
  groupName?: string;
  topic: string;
  date: string;
  time: string;
  mode: string;
  meetingUrl?: string;
  status: string;
  createdBy?: string;
  notes?: string;
  actionItems?: string[];
  transcript?: ConsultationTranscriptMessage[];
}

const STORAGE_KEY = "advisio_consultations_store";
const IMPORT_RECEIPTS_KEY = "advisio_consultation_import_receipts";

export function shouldImportLegacyConsultation(
  item: ConsultationItem,
  researchId: string,
  receipts: Record<string, string>,
) {
  const isDatabaseId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id);
  if (isDatabaseId) return false;
  if (item.researchId && item.researchId !== researchId) return false;

  // Older items did not store their project. Once one is acknowledged by any
  // project, do not copy it into another project when the user switches context.
  return !Object.keys(receipts).some((key) => key.endsWith(`:${item.id}`));
}

const getStoredConsultations = (): ConsultationItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out legacy prototype dummy consultations
        const filtered = parsed.filter((c: any) => c.id !== "c1" && c.id !== "c2" && !c.groupName?.includes("Group AI-CCS-01"));
        return filtered;
      }
    }
  } catch {
    // Ignore JSON errors
  }
  return [];
};

export const getPendingConsultationImports = (
  researchId: string,
): ConsultationItem[] => {
  if (typeof window === "undefined" || !researchId) return [];
  try {
    const receipts = JSON.parse(
      localStorage.getItem(IMPORT_RECEIPTS_KEY) || "{}",
    ) as Record<string, string>;
    return getStoredConsultations().filter((item) =>
      shouldImportLegacyConsultation(item, researchId, receipts),
    );
  } catch {
    return [];
  }
};

export const recordConsultationImportReceipts = (
  researchId: string,
  receipts: Array<{ clientId: string; consultationId: string }>,
): void => {
  if (typeof window === "undefined") return;
  try {
    const current = JSON.parse(
      localStorage.getItem(IMPORT_RECEIPTS_KEY) || "{}",
    ) as Record<string, string>;
    receipts.forEach((receipt) => {
      current[`${researchId}:${receipt.clientId}`] = receipt.consultationId;
    });
    localStorage.setItem(IMPORT_RECEIPTS_KEY, JSON.stringify(current));
    // The legacy store is intentionally retained until the user removes it.
  } catch {
    // A failed receipt write leaves the idempotent import eligible for retry.
  }
};
