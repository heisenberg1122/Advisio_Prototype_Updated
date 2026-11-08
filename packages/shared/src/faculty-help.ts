export type FacultyHelpWorkspace = "coordinator" | "dean" | "system-admin";
export type FacultyHelpId = `co-${string}` | `de-${string}` | `sa-${string}`;

interface HelpControl {
  key: string;
  text: string;
  interaction?: "click";
  state?: { empty?: string; disabled?: string };
}

interface FacultyHelpTopic {
  id: FacultyHelpId;
  walkthrough: FacultyHelpId;
  question: string;
  category: string;
  section: string;
  keywords: string[];
  answer: string[];
  href: string;
  permission?: string;
  requirements: string;
  fallback: string;
  controls: HelpControl[];
}

const missing =
  "This control may still be loading, require a selected record, or be unavailable with your current access. Check the page and retry or skip.";
const control = (
  key: string,
  text: string,
  interaction?: "click",
  state?: HelpControl["state"],
): HelpControl => ({ key, text, interaction, state });
const topic = (
  id: FacultyHelpId,
  section: string,
  question: string,
  href: string,
  keywords: string[],
  answer: string,
  controls: HelpControl[],
  permission?: string,
): FacultyHelpTopic => ({
  id,
  walkthrough: id,
  category: section,
  section,
  question,
  href,
  keywords,
  answer: [answer],
  permission,
  requirements:
    "Use your active workspace and the controls available to your account.",
  fallback: missing,
  controls,
});

const professor = "/professor/dashboard?tab=";
const dean = (tab: string) => "/admin/dashboard?workspace=dean&tab=" + tab;
const admin = (tab: string) => "/system-admin/dashboard?tab=" + tab;

const assistance = (
  id: FacultyHelpId,
  href: string,
  workspace: FacultyHelpWorkspace,
) =>
  topic(
    id,
    "Account settings",
    "How do I hide the floating assistant?",
    href,
    [
      "hide assistant",
      "assistant settings",
      "workspace assistance",
      "show assistant",
    ],
    "Open Settings → Appearance → Workspace Assistance. Turn Show floating AI Assistant off to hide the launcher. Guide stays available. The choice is saved for this account in the current browser.",
    [
      control(
        workspace + "-assistant-switch",
        "Use this switch to show or hide the assistant. Guide stays in the sidebar.",
      ),
    ],
  );

export const facultyHelp: Record<FacultyHelpWorkspace, FacultyHelpTopic[]> = {
  coordinator: [
    topic(
      "co-workflow",
      "Workflows",
      "How do I create a workflow?",
      professor + "builder",
      ["create workflow", "new workflow", "workflow setup"],
      "Open Workflow and choose Create workflow. Give the draft a name and verify the assigned college and department shown in the form. Add milestones and requirements before publishing.",
      [
        control(
          "co-workflow-new",
          "Open the workflow form to see where a draft starts.",
          "click",
        ),
        control(
          "id:workflow-name",
          "Name the draft and verify the department shown above. Save it yourself when ready to add milestones.",
        ),
      ],
      "workflow.edit",
    ),
    topic(
      "co-milestone",
      "Workflows",
      "How do I configure a milestone?",
      professor + "builder",
      ["add milestone", "configure milestone", "submission requirement"],
      "Select the draft workflow and a topic. Open Create to see milestone choices. Check the instructions, submission requirements and completion rules before saving.",
      [
        control(
          "co-workflow-create",
          "Select a topic first if Create is unavailable. Use this menu to choose the type of milestone or requirement.",
        ),
      ],
      "workflow.edit",
    ),
    topic(
      "co-publish",
      "Workflows",
      "How do I publish a workflow?",
      professor + "builder",
      ["publish workflow", "workflow publication", "workflow readiness"],
      "Select the workflow and check its milestone and requirement setup. Open Publish to review readiness and scope. Confirm publication yourself only when ready for researchers to use it.",
      [
        control(
          "co-workflow-publish",
          "This opens the publication confirmation. Check the workflow name and any missing requirements before you decide to publish.",
          undefined,
          {
            disabled:
              "Publish is unavailable while a workflow is unselected, already published, or being published. Check its current status.",
          },
        ),
      ],
      "workflow.edit",
    ),
    topic(
      "co-participants",
      "Workflows",
      "How do I manage workflow participants?",
      professor + "builder",
      [
        "manage participants",
        "workflow participants",
        "join requests",
        "workflow code",
      ],
      "Select the workflow and open Participants. Review its roster and join requests, and use the invitation tools for that workflow. A pending request still needs a decision.",
      [
        control(
          "co-workflow-participants",
          "Open Participants to inspect the roster for this workflow.",
          "click",
        ),
        control(
          "co-participant-roster",
          "Use this search to find an enrolled researcher. A pending request does not grant enrollment.",
          undefined,
          {
            empty:
              "The selected workflow has no enrolled researchers yet. Check its join requests and invitation options.",
          },
        ),
      ],
      "workflow.edit",
    ),
    topic(
      "co-submissions",
      "Review and progress",
      "How do I find a submission that needs review?",
      professor + "submissions",
      [
        "review submission",
        "review queue",
        "deadline tracker",
        "pending submissions",
      ],
      "Use Review Queue to find submitted work. Choose the workflow and narrow the results, then verify the exact submitted version before recording feedback. Deadline Tracker also shows work that has not been submitted.",
      [
        control(
          "co-review-queue",
          "Choose Review Queue for work already submitted.",
          "click",
        ),
        control(
          "co-submission-search",
          "Search for a requirement or group. Clear this filter if the expected submission is missing.",
        ),
      ],
    ),
    topic(
      "co-manuscript",
      "Review and progress",
      "How do I review an assigned manuscript?",
      "/professor/reviews",
      ["assigned manuscript", "manuscript review", "version feedback"],
      "Open an active assignment and confirm its version. Add feedback for that version and review your recommendation before submitting. Completed and inactive assignments belong in history.",
      [
        control(
          "faculty-review-open",
          "Open an active assignment to inspect its exact version and review form.",
          "click",
        ),
        control(
          "faculty-review-feedback",
          "Use overall feedback to explain the next step. Review the version and recommendation before submitting yourself.",
        ),
      ],
    ),
    topic(
      "co-monitor",
      "Review and progress",
      "How do I find a research group?",
      professor + "monitoring",
      ["research projects", "find research group", "monitor project"],
      "Search Research Projects by title or group and check the selected scope. Open the matching record to inspect its progress and adviser assignment.",
      [
        control(
          "co-project-search",
          "Search for the group here. If it is missing, clear the search and check its workflow assignment.",
        ),
      ],
    ),
    topic(
      "co-class",
      "Class records",
      "How do I enter class grades?",
      "/professor/class-record",
      ["class record", "class grades", "grading period"],
      "Choose the class and grading period. Inspect the activities and milestone scores in Grades. Save changes as a private draft until the record is ready for release.",
      [
        control(
          "co-class-select",
          "Verify the selected class. The class and period determine which researchers and grades you see.",
          undefined,
          {
            empty:
              "No classes are available in this workspace. Check your assigned workflows before entering grades.",
          },
        ),
        control(
          "co-grade-tab",
          "Open Grades to inspect the current period.",
          "click",
        ),
      ],
    ),
    topic(
      "co-attendance",
      "Class records",
      "How do I record attendance?",
      "/professor/class-record",
      ["attendance", "attendance date", "record attendance"],
      "Choose the class and grading period, then open Attendance. Confirm the attendance date before entering statuses. Review and save the record yourself.",
      [
        control(
          "co-class-select",
          "Choose the class before editing attendance.",
        ),
        control(
          "co-attendance-tab",
          "Open Attendance to see dates and statuses.",
          "click",
        ),
      ],
    ),
    topic(
      "co-grade-release",
      "Class records",
      "How do I release grades?",
      "/professor/class-record",
      ["release grades", "release period", "publish grades"],
      "Choose the class and period. Save the draft and check missing scores before releasing a learner or the entire period. Researchers see the released snapshot.",
      [
        control(
          "co-grade-tab",
          "Open Grades to check what is saved in this period.",
          "click",
        ),
        control(
          "co-release-period",
          "Review the release control and any validation. Confirm release yourself only after checking the class and scores.",
          undefined,
          {
            disabled:
              "Release may be unavailable while a draft is unsaved, rows are incomplete, or a request is in progress. Check the period status first.",
          },
        ),
      ],
    ),
    topic(
      "co-defense",
      "Defenses",
      "How do I prepare a defense and invite panelists?",
      professor + "defense",
      [
        "prepare defense",
        "invite panelists",
        "schedule defense",
        "panel invitations",
      ],
      "Use Create defense event to prepare the schedule, select eligible groups, and review panel assignments. Check date, availability, and invitation recipients before using Create event & invite.",
      [
        control(
          "co-defense-create",
          "Open the event setup here when ready. Check the schedule and assigned groups before sending invitations.",
          undefined,
          {
            disabled:
              "No eligible group is currently available to schedule. Check defense eligibility and the Dean’s signed letter.",
          },
        ),
      ],
    ),
    assistance(
      "co-assistance",
      "/professor/settings?section=appearance",
      "coordinator",
    ),
    topic(
      "co-results",
      "Defenses",
      "Where do I check defense results?",
      professor + "defense",
      ["defense results", "release results", "evaluation outcomes"],
      "Find the defense event and inspect its sessions and evaluation status. Check the completed evaluations and applicable release gates before using the results controls available to your role.",
      [
        control(
          "co-defense-event",
          "Find the matching event code and read the sessions beneath it. A pending or missing evaluation can affect release readiness.",
        ),
      ],
    ),
  ],
  dean: [
    topic(
      "de-research",
      "College oversight",
      "How do I monitor research groups?",
      dean("research"),
      ["research groups", "monitor groups", "college research"],
      "Filter Research Groups by program or academic year within the active college. Check the group’s stage, adviser, and status before deciding whether to follow up.",
      [
        control(
          "de-monitor-search",
          "Narrow the college’s list here. Clear the filters before assuming the group is missing.",
        ),
      ],
    ),
    topic(
      "de-risk",
      "College oversight",
      "How do I find groups that need follow-up?",
      dean("progress"),
      ["risk indicators", "progress and risk", "at risk groups"],
      "Use Progress & Risk to find flagged records. Inspect the underlying requirements and stage before treating a flag as an academic judgment.",
      [
        control(
          "de-monitor-search",
          "Narrow Progress & Risk to the relevant program, year, or project. Verify the recorded reason for any flag.",
        ),
      ],
    ),
    topic(
      "de-workload",
      "College oversight",
      "How do I check adviser workload?",
      dean("advisers"),
      ["adviser workload", "adviser capacity", "adviser directory"],
      "Compare assigned groups, capacity, and availability in Advisers. A group count alone does not determine whether an adviser is accepting new requests.",
      [
        control(
          "adviser-workload",
          "Use this directory to compare recorded assignments and availability within your college.",
        ),
      ],
    ),
    topic(
      "de-faculty",
      "College oversight",
      "Where do I review faculty access?",
      "/admin/faculty-access?workspace=dean",
      ["faculty access", "invite adviser", "faculty roles"],
      "Open Faculty Access and check existing invitations and requests. Confirm the intended role and college before using Invite or request access. Pending access is not an approved role.",
      [
        control(
          "de-faculty-invite",
          "This opens the faculty access form. Verify the identity, requested role, and college before sending anything.",
        ),
      ],
    ),
    topic(
      "de-defenses",
      "College oversight",
      "How do I oversee defense schedules?",
      dean("defenses"),
      ["defense oversight", "defense schedule", "college defenses"],
      "Filter Defenses to the relevant program or project. Check readiness, status and date before following up. Scheduled defenses and released outcomes are separate states.",
      [
        control(
          "de-monitor-search",
          "Filter the defense list to find the relevant group without changing its schedule.",
        ),
      ],
    ),
    assistance(
      "de-assistance",
      "/admin/settings?workspace=dean&section=appearance",
      "dean",
    ),
    topic(
      "de-reports",
      "Reports",
      "How do I view or export a college report?",
      dean("reports"),
      [
        "college report",
        "export report",
        "reports",
        "download csv",
        "export pdf",
      ],
      "Choose a report type, then check filters and matching records. Export CSV or PDF only after verifying the report scope. The export can include more than the rows on the current page.",
      [
        control(
          "report-selection",
          "Select the report type and check the filters for the active college.",
        ),
        control(
          "de-report-export",
          "Review the matching record count before choosing an export. You control whether to download it.",
        ),
      ],
      "dean.report",
    ),
  ],
  "system-admin": [
    topic(
      "sa-users",
      "Accounts and access",
      "How do I find and inspect a user account?",
      admin("users"),
      ["find user", "manage users", "search account", "account status"],
      "Search Users and confirm the account’s identity, role and college. Use the record details to inspect its status before considering any access change.",
      [
        control(
          "sa-user-search",
          "Search by account identity. Clear the role or status filter if the account does not appear.",
        ),
      ],
      "user.manage",
    ),
    topic(
      "sa-invite",
      "Accounts and access",
      "How do I invite a new user?",
      admin("users"),
      ["invite user", "account invitation", "pending invitation"],
      "Use Invite user, then confirm the recipient, college and authorized role. Check invitation status separately from account activation.",
      [
        control(
          "sa-invite-user",
          "This opens the invitation form. Check the email, college and role before sending.",
        ),
      ],
      "user.manage",
    ),
    topic(
      "sa-roles",
      "Accounts and access",
      "Where do I check role permissions?",
      admin("roles"),
      ["role permissions", "permission matrix", "access rights"],
      "Read the Role Permissions matrix to see what each role can do. Check the user’s approved college membership separately before diagnosing their access.",
      [
        control(
          "sa-role-matrix",
          "Inspect this role permission matrix before changing access in the appropriate account workflow.",
        ),
      ],
      "role.manage",
    ),
    topic(
      "sa-colleges",
      "Configuration",
      "Where do I manage colleges and programs?",
      admin("onboarding"),
      [
        "college structure",
        "colleges and programs",
        "academic programs",
        "majors",
      ],
      "Find the relevant college in College & Programs. Review the programs and majors listed under it before adding or archiving a record.",
      [
        control(
          "sa-college-name",
          "Confirm the college name before reviewing its programs and majors below.",
        ),
      ],
      "system.configure",
    ),
    topic(
      "sa-integrations",
      "Configuration",
      "How do I check Google Drive integration?",
      admin("integrations"),
      ["google drive", "storage connection", "integrations"],
      "Check the connected account and storage status in Integrations. Review the expected account and connection health before any reconnect or disconnect.",
      [
        control(
          "sa-drive-status",
          "Inspect the connected account and latest connection check here.",
        ),
      ],
      "system.configure",
    ),
    topic(
      "sa-settings",
      "Configuration",
      "Where are institutional system settings?",
      admin("config"),
      ["system settings", "system configuration", "institutional settings"],
      "Open System Configuration to read the displayed maintenance and cache status. Personal appearance and assistant preferences are under account Settings.",
      [
        control(
          "sa-system-config",
          "Review this configuration area and its current settings before editing.",
        ),
      ],
      "system.configure",
    ),
    topic(
      "sa-audit",
      "Operations",
      "How do I investigate an audit event?",
      admin("logs"),
      ["audit log", "audit trail", "audit event", "activity logs"],
      "Narrow Audit Logs by category, outcome and date, then inspect the matching event. Verify the recorded actor and scope before drawing conclusions.",
      [
        control(
          "audit-filters",
          "Filter by the type, outcome and date of the event you are investigating.",
        ),
        control(
          "sa-audit-details",
          "Open an event’s details to inspect the recorded scope and outcome.",
          "click",
        ),
      ],
      "audit.view",
    ),
    assistance(
      "sa-assistance",
      "/system-admin/settings?section=appearance",
      "system-admin",
    ),
    topic(
      "sa-backups",
      "Operations",
      "Where do I check database backups?",
      admin("backups"),
      ["database backup", "restore backup", "backup history"],
      "Database Backups shows the automated snapshot notice. The dashboard has no working create or restore control. Use the established infrastructure procedure to verify snapshots or perform a recovery.",
      [
        control(
          "sa-backup-status",
          "This disabled control is a status notice. Check the infrastructure before creating or restoring a snapshot.",
        ),
      ],
      "system.configure",
    ),
  ],
};

export const facultyPopular: Record<FacultyHelpWorkspace, FacultyHelpId[]> = {
  coordinator: ["co-workflow", "co-submissions", "co-class", "co-defense"],
  dean: ["de-research", "de-risk", "de-workload", "de-reports"],
  "system-admin": ["sa-users", "sa-invite", "sa-audit", "sa-backups"],
};
