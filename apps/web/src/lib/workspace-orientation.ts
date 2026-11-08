import type { AssistantWorkspace } from "@research-management/shared/src/researcher-assistant";
import { panelistReviewRoutes } from "@research-management/shared/src/panelist-review-routes";
import type { GuidedControlStep, GuidedTarget } from "@/components/guide/guided-walkthrough-types";

export type OrientationWorkspace = Exclude<AssistantWorkspace, "researcher">;
export type OrientationSample = "advisee" | "defense" | "review";
export interface OrientationStep extends GuidedControlStep {
  route: string;
  sample?: OrientationSample;
  section?: string;
}
interface OrientationChapter {
  id: string;
  title: string;
  steps: OrientationStep[];
  permission?: string;
}

const heading = "css:main[data-workspace-layout] :is(h1,h2,h3)";
const step = (id: string, title: string, text: string, keys: string[] = [heading], extra?: Partial<Pick<OrientationStep, "prepare" | "sample" | "section">>) => ({
  id, title, text, targets: keys.map((key): GuidedTarget => ({ key })),
  fallback: "This item may still be loading, or there may be no available record in this workspace. " + text,
  ...extra,
});
const at = (route: string, item: ReturnType<typeof step>) => ({ ...item, route });
const chapter = (id: string, title: string, route: string, items: (ReturnType<typeof step> & { route?: string })[], permission?: string): OrientationChapter =>
  ({ id, title, permission, steps: items.map(item => ({ ...item, route: item.route ?? route })) });
const dashboard = (prefix: string, tab: string) => prefix + "/dashboard?tab=" + tab;
const co = (tab: string) => dashboard("/professor", tab);
const de = (tab: string) => dashboard("/admin", tab);
const sa = (tab: string) => dashboard("/system-admin", tab);
const ad = (tab: string) => dashboard("/adviser", tab);
const pn = (tab: string) => dashboard("/panelist", tab);
const navigation = (groups: string) => step("sidebar", "Find your way around", "Home shows your overview. " + groups + " Guide and Settings sit at the bottom of the sidebar.", ["css:nav[aria-label='Sidebar Navigation'] a[href]"], { prepare: "sidebar" });
const reviews = (prefix: string) => chapter("reviews", "Manuscript Reviews", prefix + "/reviews", [
  step("queue", "Find your assigned reviews", "The queue lists exact manuscript versions assigned to you. Previous decisions stay separate from work waiting for review.", ["adviser-review-queue", "panelist-review-queue", heading]),
  step("version", "Find the review controls", "Open an assigned version when you need the manuscript preview, page references, overall feedback and a recommendation. Each decision belongs to that version. A defense packet is tied to a session instead.", ["adviser-review-open", "panelist-review-open", "faculty-review-open", heading]),
  step("preview", "Inspect an assigned manuscript version", "Check the version and status before reading the frozen manuscript. Recorded feedback can include a recommendation, an overall comment and references to sections or pages.", ["orientation:review-preview"], { sample: "review" }),
  ...(prefix === "/panelist" ? [at(panelistReviewRoutes.packet, step("packets", "Find defense packets for your sessions", "Defense Packets groups published manuscripts and shared feedback by session. Check the session before opening a document, and use the review filter to find pending work or history.", ["css:nav[aria-label='Manuscript review views'] a[aria-current='page']", heading]))] : []),
]);
const copies = (prefix: string) => chapter("copies", "Official Copies", prefix + "/documents?tab=official", [
  step("files", "Find finalized institutional records", "Choose a permitted research group or defense when prompted. This list may be empty until a copy is signed or released.", ["adviser-official-project", "id:panel-documents-title", "id:adviser-documents-title", heading]),
  step("verify", "Check the project and version", "Compare the title, document type and version before opening or downloading a copy. Use the review or working-file area for drafts.", ["id:panel-documents-title", "id:adviser-documents-title", heading]),
]);
const calendar = (prefix: string) => at(prefix + "/calendar", {
  ...step("calendar", "Find events on your calendar", "Try the date arrow to move through your schedule. A date can contain multiple events. Open an event on your own to check its details."),
  targets: ["css:button[aria-label='Next month']", "css:button[aria-label='Next week']"].map(key => ({ key, interaction: "input" as const })),
});
const consultations = (prefix: string, route = prefix + "/consultations") => [
  at(route, step("consultations", "Review consultation requests", "Check the group, status and scheduled time. Requests awaiting a response are separate from upcoming and completed meetings.", ["id:adviser-consultations-title", "id:consultations-list", heading])),
  at(route, step("meeting", "Find meeting and scheduling details", "A session may show meeting information after scheduling. Check its status before joining, and review the recorded history when it is available.", ["adviser-consultation-list", "id:consultations-list", heading])),
  calendar(prefix),
];
const inbox = (prefix: string) => at(prefix + "/inbox?orientation=1", step("inbox", "Find institutional correspondence", "Inbox keeps formal correspondence separate from group conversations. Use its folders and search to find threads, drafts and attachments.", ["css:input[placeholder*='Search']", heading]));
const communication = (prefix: string, tab = "messages", announcements = false) => chapter("communication", "Communication", dashboard(prefix, tab), [
  ...(announcements ? [at(dashboard(prefix, "announcements"), step("announcements", "Read college announcements", "Announcements share notices with the relevant audience. Check which college or program the notice applies to."))] : []),
  step("messages", "Find your group conversations", "Messages brings together the conversations you can access. Choose the relevant group before reading or replying."),
  inbox(prefix),
  at(prefix + "/notifications", step("notifications", "Follow a notification", "Notifications summarize requests, reviews and schedule changes. An update can take you to its underlying record.")),
]);
const settings = (prefix: string) => chapter("settings", "Settings and Help", prefix + "/settings", [
  step("account", "Find your account preferences", "Use the Settings tabs to review profile information, notifications and account security.", ["css:nav[aria-label='Account settings sections'] button", heading]),
  at(prefix + "/settings?section=appearance", step("appearance", "Find theme and assistant controls", prefix === "/admin"
    ? "Appearance lets you change the display mode. Workspace Assistance controls the Dean’s floating assistant. Guide stays available."
    : "Appearance lets you change the display mode and choose between Advisio and college colors.", ["id:workspace-assistance-heading", "id:display-mode-heading", heading])),
  step("future-help", "Find help when you need it", prefix === "/admin"
    ? "Open Guide to find a task or replay this orientation. The floating Advisio Assistant answers questions about the Dean’s workspace."
    : "Open Guide to search for a task, choose Show me for its walkthrough, or replay this orientation.", ["guide-launcher"], { prepare: "sidebar" }),
]);
const panelistCommunication = {
  ...communication("/panelist"),
  title: "Communication and Settings",
  steps: [...communication("/panelist").steps, ...settings("/panelist").steps],
};

const coordinator = [
  chapter("home", "Home", "/professor/dashboard", [
    step("welcome", "Welcome to Research Coordination", "Home helps you oversee research projects, coursework and defenses. Start here to see what is in progress and where your attention is needed.", ["id:coordinator-home-title"]),
    step("metrics", "Understand the summary", "The cards count monitored students, active projects and milestones. Use them to identify which area to review in more detail.", ["css:[aria-label='Coordination metrics'] button", "id:coordinator-monitoring-title"]),
    step("attention", "See what needs attention", "The progress and submission panels summarize recent work. Quick actions open views such as submissions and group monitoring.", ["id:coordinator-attention-title", "id:coordinator-monitoring-title"]),
    navigation("Course Workspace groups projects, submissions, class records and workflows. Academic Activities holds defenses, consultations and the calendar. Communication contains Messages, Inbox and Notifications."),
  ]),
  chapter("announcements", "Announcements", co("announcements"), [
    step("audience", "Read notices for your college", "Check the audience and date of each notice so you can tell whether it applies to your class or research activities."),
    step("publish", "Find publication controls", "When the form is available, choose the intended workflow and review the audience and message before using Publish to workflow.", ["css:main form textarea", heading]),
  ]),
  chapter("projects", "Research Projects", co("monitoring"), [
    step("find", "Find a group you supervise", "Search by title, group or adviser and narrow the workflow scope. Groups can start requirements before their title is registered.", ["co-project-search", heading]),
    step("details", "Read the group’s research status", "Use the adviser, current stage and progress to decide which group to follow up with. Open project details for requirements and member context.", ["css:main table thead th", "co-project-search", heading]),
  ]),
  chapter("submissions", "Submissions", co("submissions"), [
    step("queue", "Find work awaiting review", "Review Queue lists submitted requirements. Use the workflow, search and status filters to locate the right submission.", ["co-review-queue"]),
    step("version", "Read the exact version and its feedback", "Open a submission to check its version and instructions. Approval or revision applies to that submission. Grades are released separately in Class Record.", ["co-submission-search", "co-review-queue"]),
    at(co("submissions") + "&submissionView=deadlines", step("deadlines", "Compare the deadline view", "Deadline Tracker includes requirements with no submission yet. It helps distinguish upcoming work from overdue work.", ["css:button[role='tab'][aria-selected='true']", "co-review-queue"])),
  ]),
  chapter("class-record", "Class Record", "/professor/class-record", [
    step("class", "Choose a class and grading period", "The class picker determines the roster. Prelim, Midterm and Finals each have their own records.", ["co-class-select", heading]),
    step("views", "Understand the record views", "Grades shows activities and scores. Attendance tracks dates and presence. History lists releases and corrections when available.", ["co-grade-tab", "css:[aria-label='Grading period']", "co-class-select"]),
    {
      ...step("attendance", "Compare the attendance view", "Try Attendance to see the session dates and attendance status for the selected period. Grades returns you to activity scores."),
      targets: [{ key: "co-attendance-tab", interaction: "input" as const }, { key: "co-class-select" }],
    },
    {
      ...step("history", "Find releases and corrections", "Try History to see recorded releases and corrections for the selected period. Return to Grades to see any current draft and its release controls."),
      targets: [{ key: "orientation:class-history", interaction: "input" as const }, { key: "co-class-select" }],
    },
    step("release", "Keep drafts and released grades separate", "Check calculation policies and weights before saving a private draft. Release makes an eligible record visible to researchers.", ["co-release-period", "co-grade-tab", "co-class-select"]),
  ]),
  reviews("/professor"),
  copies("/professor"),
  chapter("workflow", "Workflow", co("builder"), [
    step("existing", "Start with an existing workflow", "Use the workflow picker to see existing topics, milestones and resources. The status next to the title shows whether it is draft or published.", ["css:.workflow-builder-selector select", heading]),
    step("requirements", "Read the milestone structure", "Topics organize milestones. Milestones contain instructions, submission requirements and completion or approval conditions. The order sets the researcher’s sequence.", ["id:workflow-tab-milestones", "css:.workflow-builder-selector select"]),
    at(co("builder") + "&workflowView=participants", step("participants", "See who can use this workflow", "Participants shows enrolled researchers and access requests. Invitation tools belong to the selected workflow. Pending requests are separate from active enrollment.", ["co-participant-roster", "id:workflow-tab-participants"])),
    at(co("builder") + "&workflowView=resources", step("resources", "Find guides and attachments", "Guides & Templates contains workflow-wide resources. Attachments for a specific requirement belong in its milestone.", ["id:workflow-tab-resources", "css:.workflow-builder-selector select"])),
    step("publication", "Check publication readiness", "Published workflows become available to the relevant researchers. Check the draft requirements and student preview before making a workflow available.", ["co-workflow-publish"]),
    step("create", "Find the creation control for later", "Create workflow starts an empty draft when you need one. Next, see how existing groups move through their requirements.", ["co-workflow-new", "css:.workflow-builder-selector select"]),
  ], "workflow.edit"),
  chapter("progress", "Progress", co("tracking"), [
    step("completion", "Compare stages and completion", "Use Progress to find outstanding requirements and groups needing follow-up. Verify the status in the related project or submission before acting."),
  ]),
  chapter("defense", "Defense", co("defense"), [
    step("readiness", "Check eligibility and readiness", "Defense brings together eligible groups, events and panel responses. Check clearance and the Dean’s signed letter before arranging a session.", ["co-defense-create", heading]),
    step("schedule", "Understand an event and its sessions", "An event groups sessions under one schedule. Review the venue, date and panel invitations. Awaiting replies is different from a confirmed session.", ["co-defense-event", heading]),
    step("results", "Follow evaluation and result status", "After a defense, evaluation tracking shows available submissions. The official decision is a separate release step after required evaluations and checks.", ["co-defense-event", heading]),
  ]),
  chapter("schedule", "Consultations and Calendar", "/professor/consultations", consultations("/professor")),
  communication("/professor"),
  settings("/professor"),
];

const dean = [
  chapter("home", "Home", "/admin/dashboard", [
    step("welcome", "Welcome to the Dean’s Office", "Home summarizes research across the active college. Counts and program summaries help identify where oversight is needed.", ["orientation:dean-pipeline", heading]),
    step("scope", "Choose the oversight scope", "Academic year and program filters narrow the displayed records within your active college.", ["css:main select"]),
    step("pipeline", "Read the pipeline and pending issues", "The pipeline shows where groups sit in the research process. Attention and activity show pending issues and recent changes.", ["orientation:dean-pipeline", heading]),
    navigation("Research Oversight groups students, projects, advisers and defenses. Reports summarizes activity. Academic Activities and Communication hold schedules and updates."),
  ]),
  chapter("students", "Students", de("students"), [
    step("registry", "Find a student in the college", "Filter by program, academic year or search text. Check the student’s status, program and group before following up.", ["de-monitor-search", heading]),
    step("status", "Read program and group information", "The registry can include students without an assigned research group. Review the recorded status and program together.", ["css:main table thead th", "de-monitor-search", heading]),
  ]),
  chapter("research", "Research Groups", de("research"), [
    step("groups", "Find groups and check their stage", "Filter by program or year. Read the group’s adviser, research stage and progress together before deciding what needs follow-up.", ["de-monitor-search", heading]),
    step("details", "Use project-level details", "Open the relevant record to confirm the underlying group and status before interpreting progress.", ["css:main table thead th", "de-monitor-search", heading]),
  ]),
  reviews("/admin"),
  copies("/admin"),
  chapter("risk", "Progress & Risk", de("progress"), [
    step("risk-list", "Identify projects that need attention", "Risk indicators identify recorded reasons to check a group. Use the scope filters, then inspect the related stage or requirement before following up.", ["de-monitor-search", heading]),
  ]),
  chapter("advisers", "Advisers", de("advisers"), [
    step("workload", "Compare adviser workloads", "The directory shows assigned groups, capacity and request availability. Consider all three when evaluating workload.", ["adviser-workload"]),
  ]),
  chapter("faculty", "Faculty Access", "/admin/faculty-access", [
    step("requests", "Review faculty invitations and requests", "Faculty Access tracks invitations and access requests for your college. Check status before treating an invited role as approved."),
    step("invite", "Check the role and college", "Invite or request access opens the applicable form. Verify the person, role and scope before sending anything.", ["dean-faculty-access", heading]),
  ]),
  chapter("defenses", "Defenses", de("defenses"), [
    step("scope", "Oversee the college defense schedule", "Filter defenses by scope, status or dates. Check readiness and panel confirmations before following up.", ["css:main [aria-label='Defense filters'] select", heading]),
    step("outcomes", "Distinguish schedules from released outcomes", "Scheduled sessions, recorded evaluations and released outcomes describe different stages. Personal panel assignments appear when your account has access.", ["css:[aria-label='Defense views'] button", heading]),
  ]),
  chapter("reports", "Reports", de("reports"), [
    step("type", "Choose a report and scope", "Select a category and narrow the report to the relevant active-college records.", ["report-selection", heading]),
    step("preview", "Check the preview before exporting", "Compare the preview and matching record count. PDF and CSV exports apply the selected filters and can include more than the visible page.", ["de-report-export", "report-selection", heading]),
  ], "dean.report"),
  chapter("schedule", "Consultations and Calendar", "/admin/consultations", consultations("/admin")),
  communication("/admin", "messages", true),
  settings("/admin"),
];

const systemAdmin = [
  chapter("home", "Home", "/system-admin/dashboard", [
    step("welcome", "Welcome to System Administration", "Home summarizes account registrations, academic structure and institutional activity. Use the summary to decide where to investigate.", ["css:main[data-workspace-layout] h1", heading]),
    step("attention", "Review alerts and recent activity", "Attention flags work to check. Recent activity helps locate relevant events. Verify the underlying account or audit record before acting.", ["id:attention-heading", "id:activity-heading", heading]),
    navigation("Administration groups users, academic structure, role access, configuration and operations. Calendar and Inbox hold events and institutional messages."),
  ]),
  chapter("announcements", "Announcements", sa("announcements"), [
    step("visibility", "Read institutional notices", "Check each announcement’s audience, date and publication status. Review the intended scope before publishing a notice on your own."),
  ]),
  chapter("users", "Users", sa("users"), [
    step("directory", "Find an account", "Search by name, email or identifier and filter by role or status. Pending registrations are separate from active accounts.", ["sa-user-search", heading]),
    step("lifecycle", "Understand invitations and account status", "Account details show the existing role and college assignment. An invitation begins a different path from approving a pending registration.", ["sa-invite-user", "sa-user-search", heading]),
  ], "user.manage"),
  chapter("structure", "College & Programs", sa("onboarding"), [
    step("colleges", "Understand the academic hierarchy", "Colleges contain programs and programs can contain majors. Verify the selected college before reviewing its programs and archived records.", ["sa-college-name", heading]),
  ], "system.configure"),
  chapter("roles", "Role Permissions", sa("roles"), [
    step("matrix", "Read the role permission matrix", "The matrix summarizes role capabilities. Approved college membership determines which workspace and data a person can access.", ["sa-role-matrix", heading]),
  ], "role.manage"),
  chapter("configuration", "System Configuration", sa("config"), [
    step("global", "Read platform configuration status", "The view describes global maintenance and cache information. College-scoped access and personal preferences are managed separately.", ["sa-system-config", heading]),
    at(sa("settings"), step("portal", "Find Portal Settings", "Portal Settings describes platform preferences. Personal display and account controls are in Settings in the sidebar.")),
  ], "system.configure"),
  chapter("integrations", "Integrations", sa("integrations"), [
    step("drive", "Check document storage health", "Review Google Drive connection status and the last check. Confirm the intended account before using any connection controls.", ["sa-drive-status", heading]),
  ], "system.configure"),
  chapter("audit", "Audit Logs", sa("logs"), [
    step("filter", "Narrow the audit trail", "Use category, outcome, dates or event type to locate the activity you want to investigate.", ["audit-filters", heading]),
    step("detail", "Read the event before drawing conclusions", "Event details show the action, recorded actor, scope and outcome. Use them to trace the underlying record.", ["sa-audit-details", "audit-filters", heading]),
  ], "audit.view"),
  chapter("backup", "Database Backups", sa("backups"), [
    step("status", "Understand the backup notice", "This page displays the automated snapshot notice. Backup creation and recovery follow the approved infrastructure procedure.", ["sa-backup-status", heading]),
  ], "system.configure"),
  chapter("calendar-inbox", "Calendar and Inbox", "/system-admin/calendar", [calendar("/system-admin"), inbox("/system-admin")]),
  settings("/system-admin"),
];

const adviser = [
  chapter("home", "Home", "/adviser/dashboard", [
    step("welcome", "Welcome to the Adviser workspace", "Home summarizes assigned groups, manuscript work and consultation activity. Use it to decide which group or task to review next.", ["id:adviser-home-title"]),
    step("attention", "Check requests and workload", "Needs your attention shows items such as pending requests. The assigned-group area summarizes your advising work.", ["adviser-attention", "id:adviser-groups-title"]),
    navigation("Advising work includes My Advisees, Group Progress, Reviews and Official Copies. Schedule and communication sections hold consultations, meetings and updates."),
  ]),
  chapter("advisees", "My Advisees", ad("advisees"), [
    step("assigned", "Find assigned research groups", "Each row shows a group or research title, status and available progress. Pending requests remain separate until accepted.", ["adviser-group-list", "id:adviser-advisees-title"]),
    step("members", "See the group and its members", "An assigned group’s workspace shows members and role assignments. Use its tabs to inspect the part of the record you need.", ["adviser-group-overview-content", "adviser-group-overview", heading], { sample: "advisee" }),
    step("documents", "Check documents and version history", "Documents shows records available for this group. Version history identifies stored copies and their review status.", ["adviser-group-version-history", "adviser-group-documents-content", "adviser-group-documents"], { sample: "advisee", section: "documents" }),
    step("milestones", "Read requirements and progress", "Milestones shows the current stage and remaining work. Activity records changes, while the other tabs link the group’s related records.", ["adviser-group-milestones-content", "adviser-group-milestones"], { sample: "advisee", section: "milestones" }),
    at(ad("progress"), step("progress", "Compare progress across groups", "Group Progress summarizes approved, in-progress and unsubmitted requirements. Choose a group to inspect its progress before opening the full workspace.", ["adviser-progress-group", "adviser-progress-empty", "id:adviser-progress-title"])),
  ]),
  reviews("/adviser"),
  copies("/adviser"),
  chapter("consultations", "Consultations", ad("consultations"), consultations("/adviser", ad("consultations")).slice(0, 2)),
  chapter("calendar", "Calendar", "/adviser/calendar", [calendar("/adviser")]),
  communication("/adviser", "group-chats"),
  settings("/adviser"),
];

const panelist = [
  chapter("home", "Home", "/panelist/dashboard", [
    step("welcome", "Welcome to the Panelist workspace", "Home summarizes assigned projects, upcoming defenses and evaluations that need attention.", ["id:pe-greeting"]),
    step("queue", "Find evaluation work and upcoming defenses", "The queue lists work waiting for your score. Upcoming defenses shows scheduled activity and Recent evaluation activity summarizes work already recorded.", ["id:pe-queue", "id:pe-defenses"]),
    step("assignments", "Understand project assignments", "Assigned projects are linked to the panels you serve on. Defense Schedule contains invitations and session details.", ["id:pe-projects", "id:pe-activity"]),
    navigation("Review work contains Manuscript Reviews, Official Copies, Evaluations and Results. Academic Activities contains Defense Schedule, Consultations and Calendar."),
  ]),
  reviews("/panelist"),
  copies("/panelist"),
  chapter("evaluations", "Evaluations", pn("evaluation"), [
    step("queue", "Understand which evaluations are available", "Evaluation access follows the session, packet and assignment. The current status explains when scoring is awaiting a live session or is unavailable.", ["id:pv-title", "panelist-evaluation-not-live", "panelist-save-draft", heading]),
    step("modes", "Use the criteria for the assigned mode", "Structured evaluations use criteria and response fields. PDF evaluations use the assigned document and markup tools. Some sessions use the legacy rubric.", ["panelist-evaluation-structured-preview", "panelist-evaluation-pdf-preview", "panelist-final-evaluation", "id:pv-title", heading]),
    step("draft", "Distinguish a private draft from a locked record", "A saved draft remains private while editing is open. Final submission locks the evaluation. The official outcome is released separately.", ["panelist-save-draft", "panelist-evaluation-locked", "id:pv-submitted", "id:pv-title", heading]),
  ]),
  chapter("results", "Results", pn("grades"), [
    step("personal", "Find your completed evaluation", "Results shows completed evaluation records and any available preview. Your evaluation is separate from the official decision.", ["panelist-completed-evaluation", "id:pr-title"]),
    step("release", "Read the official release state", "Awaiting release means the official decision is still pending. Released decisions appear after the responsible role completes the release.", ["panelist-release-status", "id:pr-awaiting", "id:pr-released", "id:pr-empty"]),
  ]),
  chapter("defense", "Defense Schedule", pn("schedule"), [
    step("schedule", "Check defense dates and invitations", "Check the session date, venue or meeting details and invitation status. A changed schedule can require a new response.", ["id:ps-waiting", "id:ps-upcoming", "id:ps-empty", "id:ps-title"]),
    step("session", "Explore an assigned defense", "A session brings together the schedule, research group, packet and evaluation readiness. The packet may be unavailable until published and permitted for your assignment.", ["id:pw-title"], { sample: "defense" }),
    step("response", "Find response and readiness information", "When a response is needed, the invitation controls appear here. Confirmed sessions can show manuscript and evaluation steps. Check the date before responding on your own.", ["id:pw-response", "id:pw-documents", "id:pw-evaluation", "id:pw-title"], { sample: "defense" }),
  ]),
  chapter("schedule", "Consultations and Calendar", "/panelist/consultations", consultations("/panelist")),
  panelistCommunication,
];

const orientations: Record<OrientationWorkspace, OrientationChapter[]> = {
  coordinator, dean, "system-admin": systemAdmin, adviser, panelist,
};

export function orientationRoute(workspace: OrientationWorkspace, destination: string) {
  if (workspace !== "dean") return destination;
  const url = new URL(destination, "https://advisio.local");
  url.searchParams.set("workspace", "dean");
  return url.pathname + url.search;
}

export function workspaceOrientation(workspace: OrientationWorkspace, permissions: readonly string[]) {
  return orientations[workspace]
    .filter(({ permission }) => !permission || permissions.includes(permission))
    .map(({ steps, ...chapter }) => ({
      ...chapter,
      steps: steps.map(item => ({
        ...item,
        id: chapter.id + ":" + item.id,
        route: orientationRoute(workspace, item.route),
      })),
    }));
}
