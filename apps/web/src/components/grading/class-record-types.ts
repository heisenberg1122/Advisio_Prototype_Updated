export const recordPeriods = ["PRELIM", "MIDTERM", "FINALS"] as const;
export const periodLabels: Record<string, string> = {
  PRELIM: "Prelim",
  MIDTERM: "Midterm",
  FINALS: "Finals",
};
export type RecordWeights = {
  MILESTONE: number;
  INDIVIDUAL: number;
  ATTENDANCE: number;
};
export type RecordItem = {
  id: string;
  title: string;
  kind: "MILESTONE" | "INDIVIDUAL";
  maxPoints: number;
  taskId: string | null;
};
export type RecordEntry = {
  itemId: string;
  title: string;
  kind: string;
  maxPoints: number;
  score: number | null;
  state: string;
  sourceNote: string | null;
  source: {
    submissionId: string;
    documentVersionId: string;
    taskId: string;
  } | null;
};
export type AttendanceEntry = {
  sessionId: string;
  title: string;
  date: string;
  status: string | null;
};
export type PeriodCalculation = {
  score: number | null;
  complete: boolean;
  graded: number;
  activityCount: number;
  attendance: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    unmarked: number;
    percentage: number | null;
  };
};
export type RecordSnapshot = {
  period: string;
  studentName: string;
  universityId: string;
  entries: RecordEntry[];
  attendance: AttendanceEntry[];
  calculation: PeriodCalculation;
  weights: RecordWeights | null;
  overallWeight: number | null;
  lateCredit: number;
  reason: string;
};
export type RecordRow = {
  id: string;
  name: string;
  universityId: string;
  projects: { id: string; name: string }[];
  entries: RecordEntry[];
  attendance: AttendanceEntry[];
  calculation: PeriodCalculation;
  lastRelease: {
    id: string;
    releasedAt: string;
    snapshot: RecordSnapshot;
  } | null;
};
export type RecordPeriod = {
  id: string;
  code: string;
  revision: number;
  weights: RecordWeights | null;
  lateCredit: number;
  overallWeight: number | null;
  sourceToken: string;
  items: RecordItem[];
  sessions: { id: string; title: string; date: string }[];
  rows: RecordRow[];
};
export type TeacherRecord = {
  workflow: { id: string; name: string };
  periods: RecordPeriod[];
  availableTasks: {
    id: string;
    title: string;
    maxPoints: number;
    stage: { name: string };
  }[];
  history: {
    id: string;
    eventType: string;
    createdAt: string;
    newValues: {
      actorName?: string;
      period?: string;
      reason?: string;
      [key: string]: unknown;
    };
  }[];
};
export type StudentRecord = {
  workflow: { id: string; name: string };
  periods: {
    code: string;
    release: {
      id: string;
      releasedAt: string;
      releasedByName: string;
      snapshot: RecordSnapshot;
    } | null;
  }[];
  overall: number | null;
  history: {
    id: string;
    releasedAt: string;
    releasedByName: string;
    period: string;
    score: number;
  }[];
};
export type RecordClass = {
  id: string;
  name: string;
  professor: string;
  status: string;
  ready: boolean;
};
