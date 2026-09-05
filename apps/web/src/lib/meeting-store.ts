// apps/web/src/lib/meeting-store.ts
// Synchronized, Real-Time Consultation & Google Meet Room Store across all roles

export interface MeetingSession {
  groupId: string;
  groupName: string;
  topic: string;
  meetingUrl: string;
  isActive: boolean;
  startedAt?: number;
  participants: Array<{
    id: string;
    name: string;
    role: string;
    email: string;
    joinedAt: string;
  }>;
}

const STORAGE_KEY = "advisio_active_conferencing_session";

// Default shared room link (unified across both Adviser and Student)
export const DEFAULT_SHARED_MEET_URL = "https://meet.google.com/psf-shyj-wxf";

export const getStoredMeetingSession = (): MeetingSession => {
  const emptySession: MeetingSession = {
    groupId: "",
    groupName: "",
    topic: "",
    meetingUrl: "",
    isActive: false,
    participants: [],
  };

  if (typeof window === "undefined") {
    return emptySession;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && !parsed.groupName?.includes("Group AI-CCS-01")) {
        return parsed;
      }
    }
  } catch {
    // Ignore JSON errors
  }

  return emptySession;
};

export const saveMeetingSession = (session: MeetingSession): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    window.dispatchEvent(new Event("storage"));
  } catch {
    // Ignore errors
  }
};
