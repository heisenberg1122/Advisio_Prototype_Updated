export type MonitoringOption = {
  id: string;
  name: string;
  code?: string;
  isCurrent?: boolean;
};
export type MonitoringScope = {
  college: MonitoringOption;
  programs: MonitoringOption[];
  academicYears: MonitoringOption[];
  stages: MonitoringOption[];
  defenseStages: MonitoringOption[];
  researchTypes: MonitoringOption[];
};
export type DefenseRow = {
  id: string;
  researchId: string;
  title: string;
  groupName: string | null;
  program: string;
  academicYear: string;
  stage: string;
  cycle: string;
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  venue: string | null;
  meetingUrl: string | null;
  adviser: string;
  panelAccepted: number;
  panelRequired: number;
  panel: { name: string; role: string; status: string; required: boolean }[];
  preparation: string;
  evaluationsSubmitted: number;
  evaluationsRequired: number;
  releasedAt: string | null;
  decision: string | null;
  revisionStatus: string;
  attention: string[];
  revisionInstructions?: string;
  preparationChecks?: { label: string; status: string }[];
  myAssignment: { status: string; canEvaluate: boolean } | null;
};
export type DefenseResponse = {
  scope: MonitoringScope;
  generatedAt: string;
  timezone: string;
  cards: {
    upcoming: number;
    awaitingPanel: number;
    rescheduling: number;
    awaitingRelease: number;
  };
  rows: DefenseRow[];
  total: number;
  page: number;
  pageSize: number;
  myAssignments: DefenseRow[];
};
export type ReportType =
  | "research-progress"
  | "defense-outcomes"
  | "adviser-workload";
export type ReportCell = string | number | null;
export type ReportTable = {
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, ReportCell>[];
};
export type DeanReport = {
  type: ReportType;
  title: string;
  scope: MonitoringScope;
  generatedAt: string;
  timezone: string;
  filters: Record<string, string>;
  definitions: string[];
  columns: { key: string; label: string }[];
  rows: Record<string, ReportCell>[];
  summary: { label: string; value: number | string }[];
  total: number;
  page: number;
  pageSize: number;
  breakdowns?: ReportTable[];
};
