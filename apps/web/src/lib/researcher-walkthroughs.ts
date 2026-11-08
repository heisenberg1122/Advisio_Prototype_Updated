import type {
  GuidedControlStep,
  GuidedJourney,
} from "@/components/guide/guided-walkthrough-types";
import type {
  ResearcherGuideState,
  ResearcherHelpId,
} from "./researcher-guide";

const fallback =
  "This part of the page is not available right now. You can retry, skip this step, or return to Guide without changing anything.";
const read = (
  id: string,
  title: string,
  text: string,
  ...keys: string[]
): GuidedControlStep => ({
  id,
  title,
  text,
  targets: keys.map((key) => ({ key })),
  fallback,
});
const nav = (
  id: string,
  title: string,
  text: string,
  key: string,
  to: string,
): GuidedControlStep => ({
  id,
  title,
  text,
  targets: [{ key, interaction: "click" }],
  prepare: "sidebar",
  to,
  fallback,
});
const section = (key: string, title: string, text: string) => ({
  ...read(`section-${key}`, title, text, `nav-section-${key}`),
  prepare: "sidebar" as const,
});
const click = (
  id: string,
  title: string,
  text: string,
  key: string,
  options: Partial<GuidedControlStep> = {},
): GuidedControlStep => ({
  id,
  title,
  text,
  targets: [{ key, interaction: "click" }],
  fallback,
  ...options,
});
const groupPage = "/student/dashboard?tab=group&section=my-group";
const projectPage = "/student/dashboard?tab=group";
const tasksPage = "/student/tasks";

export function buildResearcherJourney(
  id: ResearcherHelpId | "introduction",
  state: ResearcherGuideState,
  currentPath: string,
): GuidedJourney {
  let steps: GuidedControlStep[];
  const taskEntry = () =>
    nav(
      "tasks-nav",
      "Find your class requirements",
      "Open Tasks & Requirements here. This is where your professor’s class workflow and its requirements appear.",
      "nav-tasks",
      tasksPage,
    );
  const documentAreas = (): GuidedControlStep[] => [
    {
      ...click(
        "submission-tab",
        "Find past versions",
        "This is Submission history. Open it to see the uploaded versions and statuses recorded in this view.",
        "documents-submissions-tab",
      ),
      to: "/student/dashboard?tab=submissions",
    },
    read(
      "submission-records",
      "A version is not a submission receipt",
      "This view includes stored upload/version history. Check the task’s submission record to confirm what you actually sent.",
      "submission-history-heading",
    ),
    {
      ...click(
        "files-tab",
        "Keep shared attachments separate",
        "Group Files is for shared project attachments. Open it to see how it differs from working documents and task submissions.",
        "documents-files-tab",
      ),
      to: "/student/group-files",
    },
    read(
      "files-content",
      "Your shared group files",
      "Shared attachments live here. Uploading a group file does not automatically complete an academic requirement.",
      "group-files-heading",
    ),
  ];
  const groupSteps = (): GuidedControlStep[] => [
    nav(
      "group-nav",
      "Find Group & Members",
      "Want to check who is in your group? Open Group & Members for the selected project.",
      "nav-group",
      groupPage,
    ),
    state.hasGroup
      ? read(
          "group-identity",
          "Check which group you are viewing",
          "The group name and your role are shown here. Check this context before working with another project or team.",
          "group-identity",
        )
      : read(
          "group-empty",
          "No group in this context yet",
          "You can join a professor’s class without an existing research group. For a group, ask your leader for the real invitation code.",
          "group-empty",
          "group-selection",
        ),
    ...(state.hasGroup && state.memberCount
      ? [
          read(
            "members",
            "Meet your teammates",
            "These are the actual active members. The role labels identify the leader; only authorized leaders get membership-management actions.",
            "group-members",
          ),
        ]
      : []),
  ];
  switch (id) {
    case "project":
      steps = [
        nav(
          "project-nav",
          "Open your project overview",
          "Open Project Overview to check the selected project and its next action.",
          "nav-overview",
          projectPage,
        ),
        read(
          "project-details",
          "Check the project you are viewing",
          state.projectId
            ? "This is your selected project. Check its title, workflow, adviser and next action before continuing your work."
            : "Choose an authorized project, or read the available create/join options when no project exists yet.",
          "researcher-project-summary",
          "project-empty",
        ),
      ];
      break;
    case "class":
      steps = [
        section(
          "workspace",
          "Want to join your professor’s class?",
          "Classes use research workflows in Advisio. Your class access is different from research-group membership.",
        ),
        taskEntry(),
      ];
      if (["pending", "invited", "declined"].includes(state.classAccess)) {
        steps.push(
          read(
            "class-request",
            "Check your actual access status",
            state.classAccess === "pending"
              ? "Your request is waiting for the professor. It is not an active enrollment yet; the guide will not approve or resend it."
              : state.classAccess === "invited"
                ? "There is a workflow invitation here. Read it in Inbox and choose whether to accept or decline yourself; this guide will not respond."
                : "This request was declined. Contact the professor for a valid invitation or advice about access.",
            `class-access-${state.classAccess}`,
          ),
        );
      }
      steps.push(
        read(
          "class-status",
          "Is the workflow already joined?",
          state.classAccess === "joined" ||
            state.classAccess === "no-requirements"
            ? "This is your active class workflow. Its name and professor distinguish it from your research group."
            : state.classAccess === "removed"
              ? "Read the removed-access notice and contact your professor. This guide cannot restore access or assume you are enrolled."
              : "Check the status shown here. An invitation or pending request is different from an active workflow.",
          "class-status",
        ),
      );
      if (["joined", "no-requirements"].includes(state.classAccess)) {
        if (state.enrollmentCount > 1)
          steps.push(
            read(
              "joined-workflows",
              "Working in more than one class?",
              "This selector switches among your joined workflows. Check the selected class before reading its requirements.",
              "class-selector",
            ),
          );
        steps.push(
          read(
            "class-requirements",
            "Find what your professor needs",
            state.classAccess === "no-requirements"
              ? "Your class is joined, but there are no available stages yet. Ask your professor when requirements will be added."
              : "Requirements appear here after class access is available. Open a real milestone to read its instructions and current status.",
            "class-requirements",
          ),
        );
      } else if (["none", "removed"].includes(state.classAccess)) {
        steps.push({
          ...read(
            "class-code",
            "Have a professor invitation code?",
            "This is the actual professor-code field. Use only a code your professor supplies; the guide will not enter one for you.",
            "class-code",
          ),
          targets: [{ key: "class-code", interaction: "input" }],
        });
        steps.push({
          ...click(
            "class-review",
            "Review before requesting access",
            "If you have entered your own code, Review opens its invitation preview. Without a code, finish here and ask your professor.",
            "class-review",
          ),
          targets: [
            { key: "class-review", interaction: "click", optional: true },
          ],
        });
        steps.push(
          read(
            "class-invitation",
            "Approval still matters",
            "Review the professor and access status here. Request to join is a separate action requiring approval; the guide stops before sending it.",
            "class-invitation",
          ),
        );
      }
      break;
    case "group":
      steps = [
        section(
          "workspace",
          "Looking for your research group?",
          "Your group details are in Group & Members. I’ll show you the selected group and its actual member list.",
        ),
        ...groupSteps(),
      ];
      break;
    case "join-group":
      steps = [
        nav(
          "group-start",
          "Joining a group is a separate step",
          "Your professor controls class access. A research-group code comes from the group leader. Start with the existing project area.",
          "nav-overview",
          projectPage,
        ),
        {
          ...read(
            "group-entry",
            "Have a group invitation code?",
            "Use the existing Join a group entry when it is available. I can also take you to the app’s group-code page from here.",
            "group-join-entry",
            "researcher-project-summary",
            "project-empty",
          ),
          targets: [
            { key: "group-join-entry", interaction: "click" },
            { key: "researcher-project-summary" },
            { key: "project-empty" },
          ],
          to: "/student/join-group",
        },
        {
          ...read(
            "group-code",
            "Use your own group code",
            "Type the code your leader gave you. We will only preview the group; nothing is joined or requested by this guide.",
            "group-code",
            "group-preview",
          ),
          targets: [
            { key: "group-code", interaction: "input" },
            {
              key: "group-preview",
              text: "You already have a group preview open. Check its name, leader, and access label before deciding what to do.",
              next: "group-preview",
            },
          ],
        },
        {
          ...click(
            "group-review",
            "Look up the group safely",
            "Review group checks your code without joining. If you do not have a code yet, finish for now and ask your group leader.",
            "group-review",
          ),
          targets: [
            { key: "group-review", interaction: "click", optional: true },
          ],
        },
        read(
          "group-preview",
          "Check the group before deciding",
          "Read the actual group name, leader, and access label. Leader approval required means Request to join is not immediate membership. Finish this guide before choosing Join or Request.",
          "group-preview",
        ),
      ];
      if (currentPath.endsWith("/join-group")) steps = steps.slice(2);
      break;
    case "documents":
      steps = [
        nav(
          "documents-nav",
          "Let’s find your research files",
          "Open Documents & Group Files. These are your project’s working documents, with separate areas for past versions and shared attachments.",
          "nav-documents",
          "/student/documents",
        ),
      ];
      if (state.projectId)
        steps.push({
          ...click(
            "working-tab",
            "Start in Document workspace",
            "This tab opens the working-file area. Preparing a draft here is separate from submitting a requirement.",
            "documents-workspace-tab",
          ),
          to: "/student/documents",
        });
      if (state.projectId && state.hasDocuments)
        steps.push(
          read(
            "document-list",
            "These are your actual documents",
            "Each row is a real file available in the selected project. Check its name and status before opening it.",
            "document-list-heading",
            "document-mobile-list",
          ),
          click(
            "document-open",
            "Open a real document",
            "Select “{name}” to open its existing workspace. The guide will not create a file or edit the draft.",
            "document-open",
          ),
          read(
            "document-viewer",
            "Check the file you opened",
            "This is the document you selected. External open/download controls are separate actions; we will use the local Feedback and Version history views.",
            "document-heading",
          ),
          click(
            "feedback-tab",
            "Find feedback for this file",
            "Open Feedback to check whether a reviewed version has comments or a decision.",
            "id:tab-file-feedback",
          ),
          {
            ...read(
              "feedback-content",
              "Read the feedback state",
              "Feedback available for this version appears here. Check which submitted version and reviewer the comments belong to.",
              "document-feedback",
            ),
            targets: [
              {
                key: "document-feedback",
                emptyText:
                  "There is no feedback for this version yet. The page explains that feedback appears after submission and reviewer assignment; an empty panel is not an approval.",
              },
            ],
          },
          click(
            "versions-tab",
            "Find the saved versions",
            "Version history lets you inspect stored snapshots. Open this tab to see which versions actually exist.",
            "id:tab-file-history",
          ),
          read(
            "versions-content",
            "Keep versions and submissions distinct",
            "Stored versions can include uploads or snapshots. Seeing a version here alone does not prove that an academic task was submitted.",
            "document-versions",
          ),
        );
      else if (!state.projectId)
        steps.push(
          read(
            "documents-empty",
            "Check your project selection",
            "Choose or join an authorized project before looking for project files. Your class access is managed separately in Tasks & Requirements.",
            "document-empty",
            "document-page-heading",
          ),
        );
      else if (!state.documentsKnown)
        steps.push(
          read(
            "documents-unavailable",
            "Check the document workspace",
            "The guide could not verify the file list. Read the workspace’s loading or availability message and try again when the records are ready.",
            "document-page-heading",
          ),
        );
      else
        steps.push(
          read(
            "documents-empty",
            "No working file to open yet",
            "There is no working document here yet. After the guide, use an available upload/create action or check your task instructions.",
            "document-empty",
          ),
        );
      if (state.projectId) steps.push(...documentAreas());
      break;
    case "submit":
      steps = [];
      if (!currentPath.startsWith("/student/tasks/")) {
        if (currentPath !== tasksPage) steps.push(taskEntry());
        if (state.enrollmentCount > 1)
          steps.push({
            ...read(
              "submission-workflow",
              "Check the selected workflow",
              "Choose one of your joined workflows before looking for a requirement. Next takes you to the available milestones for that class.",
              "class-selector",
            ),
            targets: [{ key: "class-selector", interaction: "input" }],
          });
        steps.push(
          click(
            "task-open",
            "Choose the requirement you need",
            "Open “{name}” from the current stage. Check its name and status against what your professor needs.",
            "task-open",
            {
              targets: [
                { key: "task-open", interaction: "click" },
                {
                  key: "task-empty",
                  text: "There are no available milestones here yet. Check your class access and ask your professor about requirements.",
                  next: "finish",
                },
              ],
            },
          ),
        );
      }
      steps.push(
        read(
          "task-instructions",
          "Read what your professor asked for",
          "These instructions and accepted formats apply to this requirement. Read them before choosing a file or document version.",
          "task-instructions",
        ),
        read(
          "task-status",
          "Check the actual task status",
          "This status tells you whether work is pending, under review, approved, or needs revision. A guide completion never changes this status.",
          "task-status",
        ),
        {
          ...read(
            "task-history",
            "Check what was sent",
            "The task’s own record shows what was sent and its review history.",
            "task-submission-record",
          ),
          targets: [
            {
              key: "task-submission-record",
              emptyText:
                "There are no previous submissions recorded for this task. A file saved in Documents alone does not create this record.",
            },
            {
              key: "task-status",
              text: "Read this task’s own status for the latest outcome. Availability depends on the type of requirement.",
            },
          ],
        },
        {
          ...read(
            "task-action",
            "Find the available submission method",
            "Use the app’s available method after checking eligibility. Start Task and submission confirmations can create records, so the guide will not press them.",
            "task-action-info",
          ),
          targets: [
            {
              key: "task-upload-method",
              interaction: "click",
              text: "Upload File opens a local file-choice view. You may open that view now; the guide will not choose or upload a file.",
              optional: true,
            },
            {
              key: "task-documents-method",
              interaction: "click",
              text: "Choose from Documents opens the versions eligible for this task. You can inspect the choices before deciding which version to send.",
              optional: true,
              next: "task-version",
            },
            {
              key: "task-action-info",
              text: "Read the actual availability or prerequisite message here. If submission is locked, wait for its condition to be satisfied; the guide will not start, approve, or submit this task.",
              next: "finish",
            },
          ],
        },
        {
          ...read(
            "task-upload",
            "Stop before sending your work",
            "This is where you would choose a compatible file. After this guide, review your selection and confirm yourself.",
            "task-file-choice",
          ),
          next: "finish",
        },
        read(
          "task-version",
          "Review an eligible version",
          "Check the document and version before you confirm. The task will record the exact version you submit.",
          "task-version-choice",
        ),
      );
      break;
    case "progress":
      steps = [
        nav(
          "timeline-nav",
          "Want to know what comes next?",
          "Open Research Timeline to compare the plan with the actual milestones and recorded activity of your selected project.",
          "nav-timeline",
          "/student/dashboard?tab=milestones",
        ),
        read(
          "timeline-plan",
          "The chart is your planned schedule",
          "The planned Gantt chart is a schedule, not proof that requirements were completed. Follow the actual workflow states as well.",
          "timeline-plan",
          "timeline-empty",
        ),
        read(
          "timeline-stage",
          "Read the actual milestone states",
          "Use these professor-defined stages and statuses. A locked task’s own availability message explains the condition you must meet.",
          "timeline-milestones",
        ),
        nav(
          "timeline-tasks",
          "Open the next requirement when ready",
          "Tasks & Requirements has the instructions and availability for each real requirement. Use it to check what needs your attention next.",
          "nav-tasks",
          tasksPage,
        ),
      ];
      if (!state.projectId)
        steps.splice(
          1,
          2,
          read(
            "timeline-empty",
            "No project progress to show yet",
            "Select or join a project before looking for its progress. Your class workflow can still be available separately under Tasks.",
            "timeline-empty",
          ),
        );
      break;
    case "grades":
      steps = [
        section(
          "academic",
          "Looking for your results?",
          "Your available class and defense results are under Academic Activities. They are separate views of your own records.",
        ),
        nav(
          "grades-nav",
          "Open My Grades",
          "This opens the grade information available to your authenticated account; it does not expose another researcher’s private results.",
          "nav-grades",
          "/student/grades",
        ),
        click(
          "class-grades",
          "Start with Class Grades",
          "Class Grades contains available class records and attendance. Open it and check the class context.",
          "grades-class",
        ),
        read(
          "grade-context",
          "Check the class before reading grades",
          "Select from the classes actually available to you. If none are listed, ask your professor about class access and released records.",
          "student-grade-context",
        ),
        click(
          "defense-grades",
          "Defense results have their own view",
          "Open Defense Grades to check the result available to your selected project. Unavailable or unreleased does not mean a zero grade.",
          "grades-defense",
        ),
        read(
          "defense-result",
          "Read the release state",
          "Use the actual release message or result shown here. The guide never invents scores or releases results.",
          "defense-grade-state",
        ),
      ];
      break;
    case "defense":
      steps = [
        section(
          "academic",
          "Checking your defense schedule?",
          "Academic Activities keeps defense information and grades together. We will look only at the existing information for your project.",
        ),
        nav(
          "defense-nav",
          "Open your defense information",
          "Choose Defense to see the session or readiness information actually available for the selected project.",
          "nav-defense",
          "/student/defense",
        ),
        read(
          "defense-info",
          "Check the session and its status",
          "Read any actual date, venue, meeting details, and readiness message. If no defense is scheduled, ask your professor or coordinator.",
          "researcher-defense-schedule",
          "researcher-defense-info",
          "researcher-defense-empty",
        ),
      ];
      break;
    case "adviser":
      steps = [
        nav(
          "adviser-project",
          "First, check your adviser assignment",
          "Project Overview shows the adviser assigned to this project. We will not invent an adviser conversation or recipient.",
          "nav-overview",
          projectPage,
        ),
        read(
          "adviser-state",
          "Who is assigned to this project?",
          state.hasAdviser
            ? "Read the actual adviser name and assignment information here. Consultations is for meeting requests; group messages are for coordination."
            : "No adviser is assigned in this project context. Ask your professor/coordinator about the assignment; your leader may have adviser-request controls.",
          "adviser-summary",
          "project-empty",
        ),
      ];
      if (state.hasAdviser)
        steps.push(
          nav(
            "consultations-nav",
            "Find your meetings",
            "Open Consultations to review real session status, date, and meeting details. The guide never books a meeting or opens an external meeting link.",
            "nav-consultations",
            "/student/dashboard?tab=consultations",
          ),
          read(
            "consultations",
            "Requests and confirmed meetings differ",
            "Check the status and scheduled details of an actual session. Book a Consultation Session is a separate action for when you are ready to request a meeting.",
            "researcher-consultation-status",
          ),
        );
      break;
    case "theme":
      steps = [
        click(
          "profile",
          "Want to switch the appearance?",
          "Open your profile menu in the topbar. The same menu is available on mobile.",
          "profile-menu-button",
        ),
        {
          ...click(
            "appearance",
            "Here is the actual appearance control",
            "You can click Dark Mode to switch the appearance, or finish without changing it. This saves only your appearance preference; your authorized college and program stay the same.",
            "appearance-toggle",
          ),
          prepare: "profile",
          targets: [
            { key: "appearance-toggle", interaction: "click", optional: true },
          ],
        },
      ];
      break;
    case "communication":
      steps = [
        section(
          "communication",
          "Need to find a message or invitation?",
          "Messages is for group communication; Inbox holds separate messages and invitations. Notifications are application alerts, not a chat.",
        ),
        {
          ...read(
            "messages-nav",
            "Find group communication",
            "Messages opens available group conversations. Choose a real conversation yourself after the guide; no message is sent here.",
            "nav-messages",
          ),
          prepare: "sidebar",
        },
        {
          ...read(
            "inbox-nav",
            "Keep Inbox separate",
            "Inbox holds its own conversations and invitations. Open an invitation yourself when ready; this walkthrough does not accept it or mark it read.",
            "nav-inbox",
          ),
          prepare: "sidebar",
        },
        read(
          "notifications",
          "Look for the notification bell",
          "The bell previews application alerts. Opening an individual alert may mark it read, so this guide only points out the control.",
          "notification-button",
        ),
      ];
      break;
    case "settings":
      steps = [
        nav(
          "settings-nav",
          "Your settings are just below Guide",
          "Open Settings here for the account areas available to you. We will only look at their navigation.",
          "nav-settings",
          "/student/settings",
        ),
        read(
          "settings-areas",
          "Choose the area you need",
          "Choose the account, preferences, appearance, or security area that fits what you want to change.",
          "researcher-settings-navigation",
        ),
      ];
      break;
    case "introduction":
      steps = [
        {
          ...read(
            "welcome",
            "Let’s get you familiar with Advisio",
            "This is where you will keep track of research, requirements, and important updates. We’ll follow the tools you will use most.",
            "researcher-home-heading",
          ),
          route: "/student/dashboard",
        },
        section(
          "workspace",
          "Your research tools are grouped here",
          "Research Workspace holds your project, group, class requirements, documents, and Timeline. Each deeper Guide can show a complete task.",
        ),
        nav(
          "project",
          "Start with the right project",
          "Project Overview is where you check your current project, next action, and adviser. Choose the right project if you have more than one.",
          "nav-overview",
          projectPage,
        ),
        read(
          "project-content",
          "Check your project context",
          state.projectId
            ? "This is the actual selected project. Its details and next action help you decide what to do next."
            : "No project is selected yet. Use the existing options to create/join a group when appropriate; class workflow access is still separate.",
          "researcher-project-summary",
          "project-empty",
        ),
        ...groupSteps(),
        taskEntry(),
        read(
          "class",
          "Your class requirements live here",
          "Check your class workflow and actual access state. The joining-class Guide explains invitations, requests, and prerequisites in more detail.",
          "class-status",
        ),
        nav(
          "documents",
          "Keep your working files together",
          "Document workspace is for preparing and inspecting files. It is not the same as confirming a task submission.",
          "nav-documents",
          "/student/documents",
        ),
        read(
          "files",
          "Start with an actual file or the empty state",
          "Open a real file when one is available. The document Guide shows Feedback, Version history, Submission history and Group Files in context.",
          ...(state.hasDocuments
            ? ["document-list-heading", "document-mobile-list"]
            : [
                state.projectId && state.documentsKnown
                  ? "document-empty"
                  : "document-page-heading",
              ]),
        ),
        nav(
          "timeline",
          "Follow what comes next",
          "Timeline helps you compare planned stages with recorded research progress. Task instructions still determine what you need to complete.",
          "nav-timeline",
          "/student/dashboard?tab=milestones",
        ),
        section(
          "academic",
          "Find defense information and grades",
          "Academic Activities holds your defense information and available grades. Those views depend on what has been assigned and released.",
        ),
        section(
          "communication",
          "Keep coordination in one place",
          "Messages, Inbox and Notifications serve different purposes. Open their specific Guide when you need help choosing the right one.",
        ),
        {
          ...read(
            "guide-return",
            "You’re ready to explore",
            "Need help with something specific? Open Guide anytime. Search a question or choose a deeper walkthrough at your own pace.",
            "guide-launcher",
          ),
          prepare: "sidebar",
        },
      ];
      break;
  }
  return {
    id,
    title: id === "introduction" ? "Explore your research workspace" : id,
    steps,
  };
}
