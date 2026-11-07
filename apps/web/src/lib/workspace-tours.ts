import { canonicalizeRole, getEligibleWorkspaces, type DashboardWorkspaceId } from "@research-management/auth";
import type { UserProfile } from "@/providers/auth-provider";

export const TOUR_VERSION = 2;
export type TourPage = {
  id: string; label: string; href: string; description: string;
  kind: "context" | "task"; target?: string; permission?: string;
};
export type GuidedStep = {
  title: string; content: string; href: string; target: string;
  interactive?: boolean; fallback?: string;
};
export type WorkspaceTour = { id: string; title: string; version: number; steps: GuidedStep[] };

const page = (id: string, label: string, href: string, description: string, target?: string, permission?: string): TourPage =>
  ({ id, label, href, description, kind: target ? "task" : "context", target, permission });
const calendar = (prefix: string) => page("calendar", "Calendar", `${prefix}/calendar`, "Review dates assigned to you; select an event to read its details.", "calendar-navigation");
const reviews = (prefix: string) => page("reviews", "Manuscript Reviews", `${prefix}/reviews`, "Read assigned manuscripts and their versions before recording feedback in the review controls.", "review-records");
const official = (prefix: string) => page("official", "Official Copies", `${prefix}/documents?tab=official`, "Find official research copies available to your role and current assignments.");
const inbox = (prefix: string) => page("inbox", "Inbox", `${prefix}/inbox`, "Read received messages and check the recipient before composing a reply.");
const consultations = (prefix: string, tab = false) => page("consultations", "Consultations", tab ? `${prefix}/dashboard?tab=consultations` : `${prefix}/consultations`, "Check session status, dates, and meeting details before booking or joining a consultation.");
const home = (prefix: string) => page("overview", "Home", `${prefix}/dashboard`, "Start with your overview to find updates and work needing your attention.");
const messages = (prefix: string, tab = "messages") => page("messages", "Messages", `${prefix}/dashboard?tab=${tab}`, "Choose an existing conversation to read its history before sending a message.");

// This inventory follows actual sidebar destinations, including query-based tabs.
export const TOUR_PAGES: Record<DashboardWorkspaceId, TourPage[]> = {
  researcher: [
    home("/student"),
    page("project", "Project Overview", "/student/dashboard?tab=group", "Check your research stage, assigned adviser, and next action for this project.", "researcher-project-summary"),
    page("members", "Group & Members", "/student/dashboard?tab=group&section=my-group", "Check the members and adviser assigned to your selected research project."),
    page("tasks", "Tasks & Requirements", "/student/tasks", "Read each requirement’s instructions, deadline, and status before preparing a submission.", "task-records"),
    page("documents", "Document workspace", "/student/documents", "Prepare drafts and read feedback here; submitting a task is a separate action.", "document-records"),
    page("submissions", "Submission history", "/student/dashboard?tab=submissions", "Review the versions sent for your requirements and check their recorded feedback."),
    page("files", "Group Files", "/student/group-files", "Keep shared project attachments here; group files do not automatically complete a requirement.", "file-records"),
    page("timeline", "Research Timeline", "/student/dashboard?tab=milestones", "Follow milestone order and check which requirements are complete, current, or still pending."),
    page("defense", "Defense", "/student/defense", "Read your assigned defense schedule, readiness information, and available research records."),
    page("grades", "My Grades", "/student/grades", "Check released grades and attendance for the selected class and grading period."),
    consultations("/student", true), calendar("/student"), messages("/student", "group-chats"), inbox("/student"),
  ],
  adviser: [home("/adviser"),
    page("advisees", "My Advisees", "/adviser/dashboard?tab=advisees", "Find an assigned group, then inspect its members, requirements, and research progress.", "advisee-records"),
    reviews("/adviser"), official("/adviser"), consultations("/adviser", true), calendar("/adviser"), messages("/adviser", "group-chats"), inbox("/adviser")],
  panelist: [home("/panelist"), reviews("/panelist"), official("/panelist"),
    page("evaluations", "Evaluations", "/panelist/dashboard?tab=evaluation", "Review your assigned defense and rubric; this tour never enters or submits scores.", "evaluation-records"),
    page("results", "Results", "/panelist/dashboard?tab=grades", "Review completed evaluation records available under your current defense assignments."),
    page("schedule", "Defense Schedule", "/panelist/dashboard?tab=schedule", "Check invitation status, defense time, and meeting details for your assigned defenses.", "defense-records"),
    consultations("/panelist"), calendar("/panelist"), messages("/panelist"), inbox("/panelist")],
  coordinator: [home("/professor"),
    page("announcements", "Announcements", "/professor/dashboard?tab=announcements", "Read course announcements; verify the audience before publishing a notice."),
    page("projects", "Research Projects", "/professor/dashboard?tab=monitoring", "Find supervised research groups and inspect their stage, adviser, and current progress.", "page-filter"),
    page("submissions", "Submissions", "/professor/dashboard?tab=submissions", "Find submitted requirements and review the relevant version before recording a decision.", "page-filter"),
    page("class-record", "Class Record", "/professor/class-record", "Select a class and grading period to inspect attendance and grade entries.", "class-selection"),
    reviews("/professor"), official("/professor"),
    page("workflow", "Workflow", "/professor/dashboard?tab=builder", "Inspect milestones and requirements; editing and publishing depend on your current permissions.", "workflow-structure", "workflow.edit"),
    page("progress", "Progress", "/professor/dashboard?tab=tracking", "Check research progress against workflow requirements and follow up on incomplete work.", "progress-records"),
    page("defense", "Defense", "/professor/dashboard?tab=defense", "Review defense schedules and readiness before using any coordination controls.", "defense-records"),
    consultations("/professor"), calendar("/professor"), messages("/professor"), inbox("/professor")],
  dean: [home("/admin"),
    page("students", "Students", "/admin/dashboard?tab=students", "Use program and academic-year filters to find students within your active college.", "page-filter"),
    page("research", "Research Groups", "/admin/dashboard?tab=research", "Use program and academic-year filters to find research groups in your college.", "page-filter"),
    reviews("/admin"), official("/admin"),
    page("progress", "Progress & Risk", "/admin/dashboard?tab=progress", "Review projects flagged for follow-up, then inspect their stage and adviser details.", "page-filter"),
    page("advisers", "Advisers", "/admin/dashboard?tab=advisers", "Review adviser assignments and workload before deciding whether a group needs follow-up.", "adviser-workload"),
    page("faculty", "Faculty Access", "/admin/faculty-access", "Inspect approved college roles; this tour does not change anyone’s access."),
    page("defenses", "Defenses", "/admin/dashboard?tab=defenses", "Check defense status and schedules for research groups within your selected college.", "page-filter"),
    page("reports", "Reports", "/admin/dashboard?tab=reports", "Choose a report and scope to inspect research progress, defense outcomes, or adviser workload.", "report-selection", "dean.report"),
    consultations("/admin"), calendar("/admin"),
    page("announcements", "Announcements", "/admin/dashboard?tab=announcements", "Read college announcements and check the audience before publishing any new notice."),
    messages("/admin"), inbox("/admin")],
  "system-admin": [home("/system-admin"),
    page("announcements", "Announcements", "/system-admin/dashboard?tab=announcements", "Review institutional notices; publishing a notice is outside this read-only tour."),
    page("users", "Users", "/system-admin/dashboard?tab=users", "Search accounts and inspect their status and roles before considering access changes.", "page-filter", "user.manage"),
    page("colleges", "College & Programs", "/system-admin/dashboard?tab=onboarding", "Review colleges, programs, and majors; no records are created or changed during this tour."),
    page("roles", "Role Permissions", "/system-admin/dashboard?tab=roles", "Inspect the permission matrix; this tour does not grant or remove permissions."),
    page("configuration", "System Configuration", "/system-admin/dashboard?tab=config", "Review available system settings; no configuration is changed during this tour."),
    page("integrations", "Integrations", "/system-admin/dashboard?tab=integrations", "Inspect storage connection status; connecting or disconnecting services is outside this tour."),
    page("audit", "Audit Logs", "/system-admin/dashboard?tab=logs", "Narrow the audit trail by category, outcome, and date to inspect recorded activity.", "audit-filters", "audit.view"),
    page("backups", "Database Backups", "/system-admin/dashboard?tab=backups", "Inspect the backup interface; never create or restore a backup as a tutorial action."),
    calendar("/system-admin"), inbox("/system-admin")],
};

export function pageRouteKey(href: string) {
  const url = new URL(href, "https://advisio.local");
  let pathname = url.pathname.replace(/\/$/, "");
  let tab = url.searchParams.get("tab") || "overview";
  let section = url.searchParams.get("section") || "";
  if (pathname === "/student/consultations") { pathname = "/student/dashboard"; tab = "consultations"; }
  if (pathname.startsWith("/student/tasks/")) pathname = "/student/tasks";
  if (pathname.startsWith("/student/defense/")) pathname = "/student/defense";
  if (pathname.startsWith("/adviser/advisees/")) { pathname = "/adviser/dashboard"; tab = "advisees"; }
  if (pathname === "/student/dashboard") {
    if (["workspace", "documents"].includes(tab)) return pageRouteKey("/student/documents");
    if (["submission", "version-control"].includes(tab)) tab = "submissions";
    if (tab === "my-group") { tab = "group"; section = "my-group"; }
    if (tab === "progress") tab = "milestones";
    if (["chat", "messages"].includes(tab)) tab = "group-chats";
  }
  return `${pathname}:${tab}:${section}`;
}

export function eligibleTourWorkspace(user: Pick<UserProfile, "roles" | "college" | "collegeMemberships"> | null, pathname: string): DashboardWorkspaceId | null {
  if (!user) return null;
  let roles = user.roles;
  if (user.collegeMemberships?.length) {
    const membership = user.collegeMemberships.find(entry => entry.college.id === user.college?.id);
    roles = [...(membership?.roleNames || []), ...user.roles.filter(role => canonicalizeRole(role) === "SYSTEM_ADMIN")];
  }
  return getEligibleWorkspaces(roles).find(workspace => pathname === workspace.routePrefix || pathname.startsWith(workspace.routePrefix + "/"))?.id || null;
}

export function availableTourPages(workspace: DashboardWorkspaceId, permissions: string[]) {
  return TOUR_PAGES[workspace].filter(entry => !entry.permission || permissions.includes(entry.permission));
}

export function currentTourPage(pages: TourPage[], href: string) {
  const url = new URL(href, "https://advisio.local");
  if (url.pathname.startsWith("/student/tasks/")) return page("task-details", "Prepare a task submission", href, "Read this task’s instructions and feedback, then check eligibility before choosing a document version.", "task-details");
  if (url.pathname.startsWith("/adviser/advisees/")) return page("advisee-details", "Advisee project", href, "Inspect this assigned group’s members, requirements, and progress before deciding what needs follow-up.");
  if (url.pathname.startsWith("/panelist/defenses/")) return page("defense-details", "Defense workspace", href, "Read the assigned defense’s schedule, participants, manuscript, and readiness information before acting.");
  return pages.find(entry => pageRouteKey(entry.href) === pageRouteKey(href));
}

export function pageTour(workspace: DashboardWorkspaceId, entry: TourPage): WorkspaceTour {
  const href = workspace === "dean" ? `${entry.href}${entry.href.includes("?") ? "&" : "?"}workspace=dean` : entry.href;
  const steps: GuidedStep[] = [{ title: entry.label, content: entry.description, href, target: "workspace-content" }];
  if (entry.target) {
    const details: Record<string, { title: string; content: string }> = {
      "evaluation-records": { title: "Read the evaluation first", content: "An available evaluation follows your defense assignment; inspect its rubric before entering any scores." },
      "defense-records": { title: "Check the defense details", content: "Review the schedule, participants, and current status before responding or changing any defense information." },
      "workflow-structure": { title: "Understand the milestone order", content: "Read each stage and requirement before editing; publishing can affect researchers assigned to this workflow." },
      "progress-records": { title: "Find unfinished requirements", content: "Compare milestone completion across your assigned projects, then inspect a group that needs follow-up." },
      "class-selection": { title: "Choose the right class", content: "The selected class determines whose attendance and grades appear; review that scope before editing entries." },
      "adviser-workload": { title: "Check assigned workload", content: "Review each adviser’s assigned-group count and availability before considering a new assignment." },
      "task-details": { title: "Read instructions and feedback", content: "Check eligibility and previous feedback before choosing the version you intend to submit after this tour." },
    };
    steps.push({ title: entry.target.includes("filter") ? "Narrow the list" : entry.target === "calendar-navigation" ? "Choose a month" : "Find the right record",
      content: entry.target === "calendar-navigation" ? "Try the month arrows or Today; these controls only change the calendar view."
        : entry.target.includes("filter") ? "Try the available filters to narrow this list without changing any saved records."
        : entry.target === "report-selection" ? "Choose a report type to inspect the corresponding records within your college scope."
        : "Read the available records and statuses before opening a particular item for more detail.",
      href, target: entry.target,
      interactive: ["page-filter", "calendar-navigation", "audit-filters", "report-selection"].includes(entry.target),
      fallback: "This control has not loaded or there are no available records. Retry or skip this step.",
      ...details[entry.target] });
  }
  if (entry.kind === "task") steps.push({ title: "Check before acting", content: "Your permissions and record status determine available actions; finish this tour before making changes.", href, target: "workspace-content" });
  return { id: `${workspace}:${entry.id}`, title: entry.label, version: TOUR_VERSION, steps };
}

const INTRO_PAGES: Record<DashboardWorkspaceId, string[]> = {
  researcher: ["overview", "project", "tasks", "documents"],
  adviser: ["overview", "advisees", "reviews", "consultations"],
  panelist: ["overview", "reviews", "schedule", "evaluations"],
  coordinator: ["overview", "projects", "submissions", "progress"],
  dean: ["overview", "research", "progress", "defenses"],
  "system-admin": ["overview", "users", "colleges", "audit"],
};
export function introductionTour(workspace: DashboardWorkspaceId, pages: TourPage[]): WorkspaceTour {
  const selected = INTRO_PAGES[workspace].map(id => pages.find(entry => entry.id === id)).filter((entry): entry is TourPage => Boolean(entry));
  // Use other authorized pages if a specialized permission is unavailable.
  for (const entry of pages) if (selected.length < 4 && !selected.includes(entry)) selected.push(entry);
  const steps = selected.slice(0, 4).map(entry => pageTour(workspace, entry).steps[0]);
  const href = steps[steps.length - 1]?.href || pages[0].href;
  steps.push({ title: "Come back any time", content: "Choose Take a Tour above Settings to revisit this introduction or learn a specific task.", href, target: "tour-launcher" });
  return { id: `${workspace}:introduction`, title: "Workspace introduction", version: TOUR_VERSION, steps };
}

export type TourScope = { userId: string; collegeId: string; workspace: DashboardWorkspaceId; evaluationSession?: string };
export function tourStorageKey(scope: TourScope, tourId: string) {
  return `advisio:tour:v${TOUR_VERSION}:` + [scope.userId, scope.collegeId, scope.workspace, scope.evaluationSession || "account", tourId].map(encodeURIComponent).join(":");
}
export type TourProgress = "completed" | "dismissed";
export function readTourProgress(storage: Pick<Storage, "getItem">, key: string): TourProgress | null {
  try { const value = storage.getItem(key); return value === "completed" || value === "dismissed" ? value : null; } catch { return null; }
}
export function saveTourProgress(storage: Pick<Storage, "setItem">, key: string, progress: TourProgress) {
  try { storage.setItem(key, progress); } catch { /* Guidance remains usable when browser storage is unavailable. */ }
}
