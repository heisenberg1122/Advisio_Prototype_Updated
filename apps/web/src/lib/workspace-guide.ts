import { portalPrefixForPath, type PortalPrefix } from "./portal-navigation";

type GuideStep = { title: string; description: string; href: string; action: string };
type GuideQuestion = { question: string; answer: string };
type Guide = { role: string; introduction: string; steps: GuideStep[]; questions: GuideQuestion[] };

const guides: Record<PortalPrefix, Guide> = {
  "/student": {
    role: "Researcher",
    introduction: "Follow your project’s next action, complete requirements, and stay in touch with your adviser.",
    steps: [
      { title: "Check your project", description: "Open Project Overview to see your current stage, progress, and next action. Use Group to check your members and adviser.", href: "/student/dashboard?tab=group", action: "Open Project Overview" },
      { title: "Complete a requirement", description: "Open Tasks & Requirements, choose a task, and read its instructions and deadline. Open the task’s submission options when your document is ready.", href: "/student/tasks", action: "Open Tasks & Requirements" },
      { title: "Prepare and track documents", description: "Use Document workspace for drafts and feedback. Submission history shows versions you have sent; Group Files holds shared project attachments.", href: "/student/documents", action: "Open Documents" },
      { title: "Meet your adviser", description: "Open Consultations to review your sessions or book a meeting. Check Calendar for upcoming dates.", href: "/student/dashboard?tab=consultations", action: "Open Consultations" },
    ],
    questions: [
      { question: "Does uploading a draft complete my task?", answer: "Uploading prepares the document. Open the related task, review the submission options, and submit the required version when the task is available. Check its status and feedback afterward." },
      { question: "How do I choose my project?", answer: "A single assigned project opens automatically. If you belong to multiple projects, use the project selector in the work area. Your selected project follows you between research pages." },
      { question: "Why can’t I submit yet?", answer: "Read the task’s availability message and check its required document type. A task may need an eligible document or an earlier workflow step to be completed. Ask your adviser or coordinator if the requirement is unclear." },
    ],
  },
  "/adviser": {
    role: "Adviser",
    introduction: "Find your advisees, review assigned work, and manage your consultation schedule.",
    steps: [
      { title: "Find an advisee group", description: "Open My Advisees, then select a project to review its members, requirements, and progress.", href: "/adviser/dashboard?tab=advisees", action: "Open My Advisees" },
      { title: "Review assigned work", description: "Open Reviews, choose an assigned document, read the submission, and use its review controls to record feedback.", href: "/adviser/reviews", action: "Open Reviews" },
      { title: "Check your meetings", description: "Open Consultations to review requests and scheduled sessions. Calendar brings your assigned dates together.", href: "/adviser/dashboard?tab=consultations", action: "Open Consultations" },
    ],
    questions: [{ question: "Why is a project or review missing?", answer: "This workspace shows projects and reviews assigned to you. Check that you are in the correct college and Adviser dashboard. Ask the coordinator to verify your assignment if it is still missing." }],
  },
  "/panelist": {
    role: "Panelist",
    introduction: "Review assigned manuscripts, check defense schedules, and complete your evaluations.",
    steps: [
      { title: "Check your defense schedule", description: "Review your assigned defenses and any invitations that need a response. Check the scheduled time and available meeting details.", href: "/panelist/dashboard?tab=schedule", action: "Open Defense Schedule" },
      { title: "Read the manuscript", description: "Open Manuscript Reviews to find your assigned review work and record feedback using the available review controls.", href: "/panelist/reviews", action: "Open Manuscript Reviews" },
      { title: "Complete an evaluation", description: "Open Evaluations and select the available defense evaluation. Follow its rubric and review your entries before submitting. Results shows completed evaluation records.", href: "/panelist/dashboard?tab=evaluation", action: "Open Evaluations" },
    ],
    questions: [{ question: "Why can’t I see every defense or evaluation?", answer: "Panelist access follows your assignments. An evaluation also depends on the defense’s current status. Check your invitation and ask the coordinator to confirm your panel assignment if needed." }],
  },
  "/professor": {
    role: "Professor Coordinator",
    introduction: "Organize research requirements, monitor projects, and review submitted work.",
    steps: [
      { title: "Check research projects", description: "Open Research Projects to find the groups in your scope and inspect their current work.", href: "/professor/dashboard?tab=monitoring", action: "Open Research Projects" },
      { title: "Review the workflow", description: "Use Workflow to organize milestones and requirements. Check instructions and deadlines before making changes for researchers.", href: "/professor/dashboard?tab=builder", action: "Open Workflow" },
      { title: "Review submissions", description: "Use Submissions to open submitted requirements and record the appropriate review. Manuscript Reviews contains separately assigned document reviews.", href: "/professor/dashboard?tab=submissions", action: "Open Submissions" },
      { title: "Check grades and attendance", description: "Open Class Record and select the relevant class and period. Review entries before saving or releasing results.", href: "/professor/class-record", action: "Open Class Record" },
    ],
    questions: [{ question: "Where are project progress and deadlines?", answer: "Use Research Projects for individual groups, Progress for workflow tracking, and Calendar for assigned dates. Check your selected workflow or class when a list appears empty." }],
  },
  "/admin": {
    role: "Dean’s Office",
    introduction: "Monitor your college’s research activity, identify groups that need attention, and review defenses and reports.",
    steps: [
      { title: "Find a research group", description: "Open Research Groups and use the program, academic-year, and search filters to locate a project in your college.", href: "/admin/dashboard?tab=research&workspace=dean", action: "Open Research Groups" },
      { title: "Review groups that need attention", description: "Use Progress & Risk to identify projects that need follow-up. Check the group’s stage and assigned adviser before deciding the next action.", href: "/admin/dashboard?tab=progress&workspace=dean", action: "Open Progress & Risk" },
      { title: "Review defenses and reports", description: "Use Defenses for schedules and defense status. Reports provides research-progress, defense-outcome, and adviser-workload views.", href: "/admin/dashboard?tab=defenses&workspace=dean", action: "Open Defenses" },
    ],
    questions: [{ question: "Why do the records change when I filter?", answer: "College scope and the selected program and academic year determine the records shown. Clear or adjust filters when looking for a project outside the current selection." }],
  },
  "/system-admin": {
    role: "System Administration",
    introduction: "Manage institutional access and structure, then use the audit trail to review recorded activity.",
    steps: [
      { title: "Find an account", description: "Open Users to search accounts and check their status and assigned roles before making an access change.", href: "/system-admin/dashboard?tab=users", action: "Open Users" },
      { title: "Check academic structure", description: "Open College & Programs to review colleges, programs, and majors. Confirm the correct college before editing its records.", href: "/system-admin/dashboard?tab=onboarding", action: "Open College & Programs" },
      { title: "Review recorded activity", description: "Use Audit Logs to filter recorded changes and security summaries. Open Details to inspect an event.", href: "/system-admin/dashboard?tab=logs", action: "Open Audit Logs" },
    ],
    questions: [{ question: "Where can I check the document-storage connection?", answer: "Open System Administration → Integrations to review the Google Drive connection and storage status. The page shows available connection and status controls." }],
  },
};

export function workspaceGuide(pathname: string, search = "") {
  const prefix = portalPrefixForPath(pathname);
  const guide = guides[prefix];
  const tab = new URLSearchParams(search).get("tab") || "overview";
  let page = { title: "Finding your way around", description: "Use Home for an overview. Expand a navigation section to see its pages; the selected page is highlighted. On a small screen, open the navigation menu at the top left." };
  if (pathname.endsWith("/calendar")) page = { title: "Using your calendar", description: "Use the previous and next month buttons to change dates, or Today to return to this month. Select an event to read its details. The calendar shows events within your account’s assigned scope." };
  else if (pathname.includes("/tasks")) page = { title: "Working on a requirement", description: "Select a task to read its instructions, deadline, and status. Use the task’s available actions to view feedback or prepare a submission." };
  else if (pathname.includes("/documents") || pathname.includes("/group-files") || ["submissions", "submission", "version-control"].includes(tab)) page = { title: "Working with documents", description: prefix === "/student" ? "Prepare drafts in Document workspace, review sent versions in Submission history, and keep shared attachments in Group Files. Open the related task when you are ready to submit a requirement." : "Open the relevant document or submission to inspect its available versions and actions. Your role and assignments determine which records and controls are available." };
  else if (pathname.endsWith("/reviews")) page = { title: "Reviewing assigned work", description: "Select an assigned review to open the document and its review controls. Read the version you are reviewing and check your feedback before submitting it." };
  else if (pathname.endsWith("/consultations") || tab === "consultations") page = { title: "Finding your consultations", description: "Review the session status, date, and time. Use the available filters to find a session, then open its details or meeting link. Researchers can use Book a Consultation Session to request a meeting." };
  else if (pathname.endsWith("/inbox") || ["messages", "group-chats"].includes(tab)) page = { title: "Keeping in touch", description: "Choose a conversation or available recipient to review messages. Check the recipient and message before sending. Messages and Inbox are available from Communication in the navigation." };
  else if (tab === "logs") page = { title: "Reading the audit trail", description: "Use the category, action, outcome, and date filters to narrow the list. Select Details to inspect a recorded event. Audit timestamps use Philippine Time." };
  else if (tab === "announcements") page = { title: "Reviewing announcements", description: "Read recent announcements here. If your role can publish, review the audience and notice before publishing; publishing sends the announcement to its intended recipients." };
  else if (prefix === "/panelist" && tab === "schedule") page = { title: "Checking a defense assignment", description: "Review your invitation status, defense date, and meeting details. Respond to an invitation using its available controls. Ask the coordinator if your assigned defense is missing or needs clarification." };
  else if (prefix === "/panelist" && tab === "evaluation") page = { title: "Completing an evaluation", description: "Select an available defense evaluation, read its rubric, and enter your scores and feedback. Review the full evaluation before submitting. Availability depends on your assignment and the defense status." };
  else if (pathname.endsWith("/class-record") || pathname.endsWith("/grades")) page = { title: "Understanding grades and attendance", description: "Select the relevant class and grading period. Researchers can view released results; authorized faculty can manage entries using the available class-record controls." };
  else if (prefix === "/professor" && tab === "builder") page = { title: "Organizing a research workflow", description: "Select the workflow you want to work with, then review its milestones, requirements, and deadlines. Check the affected research groups before changing workflow requirements." };
  else if (prefix === "/system-admin" && tab === "users") page = { title: "Finding an account", description: "Search or filter the user list, then review the account’s status, college, and roles. Confirm the correct person and scope before changing access." };
  else if (prefix === "/system-admin" && tab === "onboarding") page = { title: "Reviewing colleges and programs", description: "Find the relevant college, then expand its programs and majors. Check existing records and active or archived status before creating or editing an entry." };
  else if (prefix === "/student" && ["group", "my-group", "milestones", "progress"].includes(tab)) page = { title: "Understanding your research workspace", description: "Use Overview, Group, Tasks, Documents, and Timeline to move between parts of the same project. Start with the current stage and next action on Project Overview." };

  return { ...guide, page, navigationQuestion: { question: "How do I find a page or change dashboards?", answer: "Expand a section in the navigation, or use the search bar to find a page. Open your profile menu for account settings and college details. If your account has multiple roles, its dashboard switcher appears there too." }, support: prefix === "/student" ? "Still unsure? Ask your adviser or professor coordinator and mention the project, task, and page you are working on." : "Still unsure? Contact your college coordinator or system administrator and mention the page and record you are working with." };
}
