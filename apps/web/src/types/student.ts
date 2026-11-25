// ─── Enums & Variants ──────────────────────────────────────────

export type Role = "student" | "adviser" | "professor" | "dean" | "panelist" | "super_admin";

export type ResearchPhase =
  | "proposal"
  | "chapter_1"
  | "chapter_2"
  | "chapter_3"
  | "chapter_4"
  | "chapter_5"
  | "defense";

export type SubmissionStatus = "approved" | "pending" | "revision";
export type ConsultationStatus = "confirmed" | "pending" | "done" | "cancelled";
export type DefenseEligibility = "eligible" | "not_eligible" | "pending";
export type NotificationType = "success" | "info" | "warning" | "danger";
export type TaskStatus = "pending" | "done";
export type TagVariant = "info" | "success" | "warn" | "danger" | "neutral";
export type AvatarVariant = "info" | "success" | "warning" | "danger";
export type DefenseRequirementStatus = "done" | "pending" | "in_progress";
export type GroupStatus = "active" | "inactive";

// ─── Core Entities ──────────────────────────────────────────────

export interface StudentProfile {
  id: string;
  name: string;
  initials: string;
  role: "student";
  academicYear: string;
  program: string;
  college: string;
}

export interface PhaseStep {
  phase: ResearchPhase;
  label: string;
  status: "done" | "current" | "upcoming";
}

export interface ResearchProgress {
  currentPhase: ResearchPhase;
  currentChapterTitle: string;
  completionPercent: number;
  phases: PhaseStep[];
}

export interface StudentStats {
  submissions: number;
  submissionsPendingReview: number;
  consultations: number;
  consultationsUpcoming: number;
  tasksLeft: number;
  tasksDueThisWeek: number;
  defenseEligibility: DefenseEligibility;
}

export interface Task {
  id: string;
  name: string;
  dueDate: string;
  status: TaskStatus;
  urgency: TagVariant;
}

export interface UpcomingEvent {
  id: string;
  name: string;
  from: string;
  date: string;
  color: "info" | "success" | "warning" | "danger";
}

export interface Notification {
  id: string;
  text: string;
  time: string;
  type: NotificationType;
}

export interface Submission {
  id: string;
  name: string;
  submittedAt: string;
  status: SubmissionStatus;
  reviewer?: string;
}

// ─── Group ──────────────────────────────────────────────────────

export interface GroupMember {
  id: string;
  name: string;
  initials: string;
  role: "leader" | "member";
  colorVariant?: AvatarVariant;
  isYou?: boolean;
}

export interface ResearchGroup {
  id: string;
  name: string;
  researchTitle: string;
  members: GroupMember[];
  status: GroupStatus;
}

// ─── Adviser ────────────────────────────────────────────────────

export interface Adviser {
  id: string;
  name: string;
  initials: string;
  college: string;
  adviseeCount: number;
  adviseeMax: number;
  avgResponseDays: number;
  isAssigned: boolean;
  isFull: boolean;
  colorVariant?: AvatarVariant;
}

// ─── Consultation ────────────────────────────────────────────────

export interface Consultation {
  id: string;
  title: string;
  date: string;
  timeRange: string;
  adviser: string;
  duration: string;
  status: ConsultationStatus;
}

// ─── Defense ─────────────────────────────────────────────────────

export interface DefenseRequirement {
  id: string;
  label: string;
  status: DefenseRequirementStatus;
  hint?: string;
}

// ─── Grades ──────────────────────────────────────────────────────

export interface PanelistScore {
  id: string;
  panelistName: string;
  score: number | null;
  maxScore: number;
  remarks?: string;
}

export interface GradeReport {
  finalGrade: string | null;
  gpa: number | null;
  status: "pending" | "released" | "private";
  panelistScores: PanelistScore[];
}

// ─── Aggregate / Page View Models ───────────────────────────────

export interface StudentOverview {
  profile: StudentProfile;
  progress: ResearchProgress;
  stats: StudentStats;
  pendingTasks: Task[];
  upcomingEvents: UpcomingEvent[];
  recentNotifications: Notification[];
  recentSubmissions: Submission[];
}

export interface StudentDashboardData {
  overview: StudentOverview;
  group: ResearchGroup;
  assignedAdviser: Adviser | null;
  availableAdvisers: Adviser[];
  submissions: Submission[];
  consultations: Consultation[];
  nextConsultation: Consultation | null;
  defenseRequirements: DefenseRequirement[];
  defenseEligibility: DefenseEligibility;
  grades: GradeReport;
  notifications: Notification[];
}
