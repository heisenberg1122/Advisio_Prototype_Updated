import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FolderPlus,
  MessageSquare,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

export type MilestoneStatus = "completed" | "current" | "upcoming";
export type ResearchMilestone = {
  id: string;
  label: string;
  meta: string;
  eyebrow: string;
  title: string;
  badge: string;
  tone?: "revision" | "success";
  icon: LucideIcon;
  fields: readonly (readonly [string, string])[];
  note?: string;
};

// Local illustration only. Real projects use their assigned, configurable workflow.
export const illustrativeMilestones: readonly ResearchMilestone[] = [
  {
    id: "project",
    label: "Research project created",
    meta: "Project setup",
    eyebrow: "Project setup",
    title: "A place for the research",
    badge: "Created",
    icon: FolderPlus,
    fields: [
      ["Research project", "Advisio"],
      ["Workflow", "Assigned"],
      ["Team", "3 researchers"],
    ],
    note: "The project, team, and assigned workflow start together.",
  },
  {
    id: "adviser",
    label: "Adviser assignment",
    meta: "Guidance connected",
    eyebrow: "Adviser",
    title: "Dr. Evelyn Vance",
    badge: "Assigned",
    icon: UserCheck,
    fields: [
      ["Adviser request", "Accepted"],
      ["Next step", "Initial consultation"],
      ["Project access", "Active"],
    ],
    note: "Advising stays connected to the research record.",
  },
  {
    id: "proposal",
    label: "Proposal / initial submission",
    meta: "Research proposal · v1.2",
    eyebrow: "Documents",
    title: "Research proposal",
    badge: "Submitted",
    icon: FileText,
    fields: [
      ["Document version", "v1.2"],
      ["Submission", "Recorded"],
      ["Next review", "Adviser review"],
    ],
    note: "A versioned submission keeps its place in the journey.",
  },
  {
    id: "review",
    label: "Adviser review",
    meta: "Feedback in context",
    eyebrow: "Review",
    title: "Research proposal v1.2",
    badge: "Needs revision",
    tone: "revision",
    icon: MessageSquare,
    fields: [
      ["Adviser feedback", "3 annotations"],
      ["Recommendation", "Revise methodology"],
      ["Review status", "Needs revision"],
    ],
    note: "Clarify the sampling criteria in Section 3.2.",
  },
  {
    id: "consultation",
    label: "Consultation & revision",
    meta: "Chapter 3 / Methodology",
    eyebrow: "Current milestone",
    title: "Chapter 3 / Methodology",
    badge: "Needs revision",
    tone: "revision",
    icon: CalendarDays,
    fields: [
      ["Document version", "v1.3"],
      ["Adviser feedback", "3 annotations"],
      ["Next consultation", "Oct 29 · 2:00 PM"],
    ],
    note: "The latest feedback and the next conversation, in one place.",
  },
  {
    id: "panel",
    label: "Panel evaluation",
    meta: "Presentation & rubric",
    eyebrow: "Panel evaluation",
    title: "Research presentation",
    badge: "Evaluation pending",
    icon: ClipboardCheck,
    fields: [
      ["Presentation", "Nov 13 · 9:00 AM"],
      ["Assigned panelists", "3 panelists"],
      ["Evaluation", "Pending"],
    ],
    note: "Assigned panelists review the work and record their evaluations.",
  },
  {
    id: "processing",
    label: "Required processing",
    meta: "Institutional requirements",
    eyebrow: "Institutional process",
    title: "Required processing",
    badge: "In progress",
    icon: ShieldCheck,
    fields: [
      ["Requirements", "3 of 4 complete"],
      ["Current activity", "Review / approval"],
      ["Workflow", "Institution configured"],
    ],
    note: "Required processing follows the workflow assigned to this project.",
  },
  {
    id: "complete",
    label: "Research completion",
    meta: "Final research record",
    eyebrow: "Research complete",
    title: "Every required milestone, complete.",
    badge: "Completed",
    tone: "success",
    icon: CheckCircle2,
    fields: [
      ["Final submission", "Recorded"],
      ["Required milestones", "Completed"],
      ["Research status", "Completed"],
    ],
    note: "The final record stays connected to the work that led here.",
  },
];

export function milestoneStatus(
  index: number,
  active: number,
): MilestoneStatus {
  return index < active
    ? "completed"
    : index === active
      ? "current"
      : "upcoming";
}
