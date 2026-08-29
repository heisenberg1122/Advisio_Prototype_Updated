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
  if (typeof window === "undefined") {
    return {
      groupId: "g1",
      groupName: "Group AI-CCS-01",
      topic: "Methodology & Neural Network Architecture",
      meetingUrl: DEFAULT_SHARED_MEET_URL,
      isActive: false,
      participants: [],
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore JSON errors
  }

  return {
    groupId: "g1",
    groupName: "Group AI-CCS-01",
    topic: "Methodology & Neural Network Architecture",
    meetingUrl: DEFAULT_SHARED_MEET_URL,
    isActive: false,
    participants: [],
  };
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
