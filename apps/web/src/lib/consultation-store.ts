// apps/web/src/lib/consultation-store.ts
// Synchronized consultation repository store across portals & browsers

export interface ConsultationTranscriptMessage {
  id: string;
  sender: string;
  time: string;
  content: string;
}

export interface ConsultationItem {
  id: string;
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

export const INITIAL_CONSULTATIONS: ConsultationItem[] = [
  {
    id: "c1",
    groupName: "Group AI-CCS-01",
    topic: "Methodology & Neural Network Architecture",
    date: "2026-07-03",
    time: "10:00 AM",
    mode: "Google Meet",
    meetingUrl: "https://meet.google.com/psf-shyj-wxf",
    status: "scheduled",
  },
  {
    id: "c2",
    groupName: "Group AI-CCS-01",
    topic: "Introduction Outline Review",
    date: "2026-06-24",
    time: "02:00 PM",
    mode: "In-Person (CL3)",
    status: "completed",
  },
];

export const getStoredConsultations = (): ConsultationItem[] => {
  if (typeof window === "undefined") return INITIAL_CONSULTATIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore JSON errors
  }
  return INITIAL_CONSULTATIONS;
};

export const saveStoredConsultations = (items: ConsultationItem[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("storage"));
  } catch {
    // Ignore storage errors
  }
};

export const addStoredConsultation = (item: ConsultationItem): ConsultationItem[] => {
  const current = getStoredConsultations();
  const exists = current.some((c) => c.id === item.id);
  const updated = exists ? current.map((c) => (c.id === item.id ? item : c)) : [item, ...current];
  saveStoredConsultations(updated);
  return updated;
};

export const updateStoredConsultationStatus = (id: string, status: string): ConsultationItem[] => {
  const current = getStoredConsultations();
  const updated = current.map((c) => (c.id === id ? { ...c, status } : c));
  saveStoredConsultations(updated);
  return updated;
};

export const updateStoredConsultationNotes = (
  id: string,
  notes: string,
  actionItems: string[],
  transcript: ConsultationTranscriptMessage[]
): ConsultationItem[] => {
  const current = getStoredConsultations();
  const updated = current.map((c) =>
    c.id === id
      ? {
          ...c,
          notes,
          actionItems,
          transcript,
        }
      : c
  );
  saveStoredConsultations(updated);
  return updated;
};
