# Local interactive workspace guidance — version 2

## Implementation target and audit

Target: `codex/researcher-workspace-ux-redesign`, based on the already-pushed TAM integration `257b425`. This implementation is local only. No commit, push, deployment, account, consent, questionnaire, respondent record, backend workflow, or authorization change is part of this task.

The current source includes the five-group evaluation application alongside the six institutional workspaces. Render was previously verified to track `codex/qr-evaluation-local` with Auto-Deploy Off; this does not establish the running Render revision. Vercel also generated a Preview through the existing pull request. Neither service is an implementation or test target here.

Inspected: auth roles, workspace definitions, role matrix, all six layouts and their sidebar wrappers, all corresponding dashboards, portal navigation, active-project and dashboard-workspace providers, academic membership context, evaluation session identity, existing Quick Guide, and ProductTour.

- The actual client is Vite/React Router with `next/*` compatibility aliases, not Next.js. The Next.js documentation directory mentioned by `apps/web/AGENTS.md` is absent; Vite configuration and package scripts establish the correct framework.
- Professor and Research Coordinator use one workspace. Legacy STUDENT, PROFESSOR and ADMIN aliases canonicalize to Researcher, Coordinator and Dean. No extra employee-researcher identity is introduced.
- All sidebars use AppSidebar. Shared launcher placement avoids six duplicate integrations.
- The existing ProductTour has no mounted consumers on this TAM-based branch. Its full-screen backdrop prevents interaction with the spotlight; it only looks up a selector once, always centers its tooltip, and stores global completion even when skipped. It is refactored in place into the shared spotlight renderer; no tour dependency is installed.
- WorkspaceHelp was the topbar Quick Guide. It has been replaced by the compact sidebar launcher, and the long FAQ implementation is retired.
- Active context comes from the authenticated profile, approved roles, membership of the active college, current route, and DashboardWorkspaceProvider. Specialized activities require their actual permissions; no permission is granted by a tour.
- All generated routes stay within the current workspace. Researcher links retain project context; Dean links retain `workspace=dean`. No group IDs are invented.
- Normal progress is browser-local and scoped by user, college, workspace and guide version. Runtime authorization also includes the current permission set: revocation ends an active tour without changing its saved completion scope. The launcher is hidden when the active college does not authorize the selected workspace. Evaluation progress is sessionStorage scoped additionally by the evaluation server's session-specific progressKey. Global legacy completion keys are preserved but deliberately not imported across accounts or colleges.

## Coverage plan

Every listed destination is audited against actual navigation. Home uses a five-step workspace introduction. Complex lists and filters use short task mini-tours; simple read-only pages use one anchored contextual explanation. Sensitive management pages receive read-only explanations, never automatic actions.

| Workspace | Introduction priorities | Task mini-tours | Contextual help |
| --- | --- | --- | --- |
| Researcher | Home, Project Overview, Tasks, Documents, restart launcher | Project overview, task requirements/details, document workspace, group files, Calendar | Group & Members, Submission history, Timeline, Defense, My Grades, Consultations, Messages, Inbox |
| Adviser | Home, assigned groups, reviews, consultations, restart launcher | My Advisees, Manuscript Reviews, Calendar | Official Copies, Consultations, Messages, Inbox |
| Panelist | Home, reviews, defense schedule, evaluations, restart launcher | Manuscript Reviews, Evaluations, Defense Schedule, Calendar | Official Copies, Results, Consultations, Messages, Inbox |
| Professor / Coordinator | Home, projects, submissions, progress, restart launcher | Research Projects, Submissions, Class Record, Manuscript Reviews, authorized Workflow, Progress, Defense, Calendar | Announcements, Official Copies, Consultations, Messages, Inbox |
| Dean | Home, groups, risk, defenses, restart launcher | Students, Research Groups, Manuscript Reviews, Progress & Risk, Advisers, Defenses, authorized Reports, Calendar | Official Copies, Faculty Access, Consultations, Announcements, Messages, Inbox |
| System Administration | Home, authorized accounts, college structure, authorized audit, restart launcher | authorized Users, Audit Logs, Calendar | Announcements, College & Programs, Role Permissions, System Configuration, Integrations, Database Backups, Inbox |

Profile, account settings, and notification pages keep their existing labels and instructions; they do not need another tutorial. Dynamic task details receive a contextual submission mini-tour at the current real task URL. Data-dependent targets must wait for rendering and offer Retry / Skip step if unavailable. Skipping a missing step does not record successful completion.

## Safety and interaction

Tour-controlled actions are internal navigation and browser-local guide state only. Inbox is an exception: its existing page entry synchronizes institutional messages, so an off-page Inbox tutorial highlights its actual navigation link without visiting the page. Existing Inbox synchronization remains unchanged. Calendar month navigation, report type selection, and list filters are the only interactive spotlights. Review, task, evaluation and administrative surfaces remain read-only while highlighted. Existing business actions become available again after exiting the tour.

The overlay uses four surrounding panels, leaving a real opening for explicitly safe controls. Keyboard navigation includes those controls and tooltip actions only; Escape exits. Tours end when the workspace, college, account or current route changes externally. Existing dirty-form checks and guide-local input snapshots prevent guided navigation away from unfinished edits. Same-page explanations remain available without navigating away. Reduced motion disables the guide entrance animation.

No TAM respondent group is added. Evaluation activities and existing walkthrough links remain intact. If deployed later, evaluate this as guidance version 2 and distinguish it from responses collected on the previous version; this task changes no collected data.

## Verification

Completed local verification is recorded below. The full matrix distinguishes navigation/page guidance from consequential record actions, which were not executed.

## Verified page-by-page coverage

The following matrix is checked against the runtime registry and real browser results for the final local build. Desktop uses 1366×844 in light mode; mobile uses 390×844 in dark mode. Each workspace introduction also completes all five steps at both sizes.

| Workspace | Page | Route | Guidance and reason | Desktop | Mobile |
| --- | --- | --- | --- | --- | --- |
| Researcher | Home | `/student/dashboard` | **Introduction + contextual help.** Start with your overview to find updates and work needing your attention. | Passed | Passed |
| Researcher | Project Overview | `/student/dashboard?tab=group` | **Task mini-tour.** Check your research stage, assigned adviser, and next action for this project. | Passed | Passed |
| Researcher | Group & Members | `/student/dashboard?tab=group&section=my-group` | **Contextual help.** Check the members and adviser assigned to your selected research project. | Passed | Passed |
| Researcher | Tasks & Requirements | `/student/tasks` | **Task mini-tour.** Read each requirement’s instructions, deadline, and status before preparing a submission. | Passed | Passed |
| Researcher | Document workspace | `/student/documents` | **Task mini-tour.** Prepare drafts and read feedback here; submitting a task is a separate action. | Passed | Passed |
| Researcher | Submission history | `/student/dashboard?tab=submissions` | **Contextual help.** Review the versions sent for your requirements and check their recorded feedback. | Passed | Passed |
| Researcher | Group Files | `/student/group-files` | **Task mini-tour.** Keep shared project attachments here; group files do not automatically complete a requirement. | Passed | Passed |
| Researcher | Research Timeline | `/student/dashboard?tab=milestones` | **Contextual help.** Follow milestone order and check which requirements are complete, current, or still pending. | Passed | Passed |
| Researcher | Defense | `/student/defense` | **Contextual help.** Read your assigned defense schedule, readiness information, and available research records. | Passed | Passed |
| Researcher | My Grades | `/student/grades` | **Contextual help.** Check released grades and attendance for the selected class and grading period. | Passed | Passed |
| Researcher | Consultations | `/student/dashboard?tab=consultations` | **Contextual help.** Check session status, dates, and meeting details before booking or joining a consultation. | Passed | Passed |
| Researcher | Calendar | `/student/calendar` | **Task mini-tour.** Review dates assigned to you; select an event to read its details. | Passed | Passed |
| Researcher | Messages | `/student/dashboard?tab=group-chats` | **Contextual help.** Choose an existing conversation to read its history before sending a message. | Passed | Passed |
| Researcher | Inbox | `/student/inbox` | **Contextual help.** Read received messages and check the recipient before composing a reply. | Passed | Passed |
| Adviser | Home | `/adviser/dashboard` | **Introduction + contextual help.** Start with your overview to find updates and work needing your attention. | Passed | Passed |
| Adviser | My Advisees | `/adviser/dashboard?tab=advisees` | **Task mini-tour.** Find an assigned group, then inspect its members, requirements, and research progress. | Passed | Passed |
| Adviser | Manuscript Reviews | `/adviser/reviews` | **Task mini-tour.** Read assigned manuscripts and their versions before recording feedback in the review controls. | Passed | Passed |
| Adviser | Official Copies | `/adviser/documents?tab=official` | **Contextual help.** Find official research copies available to your role and current assignments. | Passed | Passed |
| Adviser | Consultations | `/adviser/dashboard?tab=consultations` | **Contextual help.** Check session status, dates, and meeting details before booking or joining a consultation. | Passed | Passed |
| Adviser | Calendar | `/adviser/calendar` | **Task mini-tour.** Review dates assigned to you; select an event to read its details. | Passed | Passed |
| Adviser | Messages | `/adviser/dashboard?tab=group-chats` | **Contextual help.** Choose an existing conversation to read its history before sending a message. | Passed | Passed |
| Adviser | Inbox | `/adviser/inbox` | **Contextual help.** Read received messages and check the recipient before composing a reply. | Passed | Passed |
| Panelist | Home | `/panelist/dashboard` | **Introduction + contextual help.** Start with your overview to find updates and work needing your attention. | Passed | Passed |
| Panelist | Manuscript Reviews | `/panelist/reviews` | **Task mini-tour.** Read assigned manuscripts and their versions before recording feedback in the review controls. | Passed | Passed |
| Panelist | Official Copies | `/panelist/documents?tab=official` | **Contextual help.** Find official research copies available to your role and current assignments. | Passed | Passed |
| Panelist | Evaluations | `/panelist/dashboard?tab=evaluation` | **Task mini-tour.** Review your assigned defense and rubric; this tour never enters or submits scores. | Passed | Passed |
| Panelist | Results | `/panelist/dashboard?tab=grades` | **Contextual help.** Review completed evaluation records available under your current defense assignments. | Passed | Passed |
| Panelist | Defense Schedule | `/panelist/dashboard?tab=schedule` | **Task mini-tour.** Check invitation status, defense time, and meeting details for your assigned defenses. | Passed | Passed |
| Panelist | Consultations | `/panelist/consultations` | **Contextual help.** Check session status, dates, and meeting details before booking or joining a consultation. | Passed | Passed |
| Panelist | Calendar | `/panelist/calendar` | **Task mini-tour.** Review dates assigned to you; select an event to read its details. | Passed | Passed |
| Panelist | Messages | `/panelist/dashboard?tab=messages` | **Contextual help.** Choose an existing conversation to read its history before sending a message. | Passed | Passed |
| Panelist | Inbox | `/panelist/inbox` | **Contextual help.** Read received messages and check the recipient before composing a reply. | Passed | Passed |
| Professor / Coordinator | Home | `/professor/dashboard` | **Introduction + contextual help.** Start with your overview to find updates and work needing your attention. | Passed | Passed |
| Professor / Coordinator | Announcements | `/professor/dashboard?tab=announcements` | **Contextual help.** Read course announcements; verify the audience before publishing a notice. | Passed | Passed |
| Professor / Coordinator | Research Projects | `/professor/dashboard?tab=monitoring` | **Task mini-tour.** Find supervised research groups and inspect their stage, adviser, and current progress. | Passed | Passed |
| Professor / Coordinator | Submissions | `/professor/dashboard?tab=submissions` | **Task mini-tour.** Find submitted requirements and review the relevant version before recording a decision. | Passed | Passed |
| Professor / Coordinator | Class Record | `/professor/class-record` | **Task mini-tour.** Select a class and grading period to inspect attendance and grade entries. | Passed | Passed |
| Professor / Coordinator | Manuscript Reviews | `/professor/reviews` | **Task mini-tour.** Read assigned manuscripts and their versions before recording feedback in the review controls. | Passed | Passed |
| Professor / Coordinator | Official Copies | `/professor/documents?tab=official` | **Contextual help.** Find official research copies available to your role and current assignments. | Passed | Passed |
| Professor / Coordinator | Workflow | `/professor/dashboard?tab=builder` | **Task mini-tour.** Inspect milestones and requirements; editing and publishing depend on your current permissions. Requires workflow.edit. | Passed | Passed |
| Professor / Coordinator | Progress | `/professor/dashboard?tab=tracking` | **Task mini-tour.** Check research progress against workflow requirements and follow up on incomplete work. | Passed | Passed |
| Professor / Coordinator | Defense | `/professor/dashboard?tab=defense` | **Task mini-tour.** Review defense schedules and readiness before using any coordination controls. | Passed | Passed |
| Professor / Coordinator | Consultations | `/professor/consultations` | **Contextual help.** Check session status, dates, and meeting details before booking or joining a consultation. | Passed | Passed |
| Professor / Coordinator | Calendar | `/professor/calendar` | **Task mini-tour.** Review dates assigned to you; select an event to read its details. | Passed | Passed |
| Professor / Coordinator | Messages | `/professor/dashboard?tab=messages` | **Contextual help.** Choose an existing conversation to read its history before sending a message. | Passed | Passed |
| Professor / Coordinator | Inbox | `/professor/inbox` | **Contextual help.** Read received messages and check the recipient before composing a reply. | Passed | Passed |
| Dean’s Office | Home | `/admin/dashboard?workspace=dean` | **Introduction + contextual help.** Start with your overview to find updates and work needing your attention. | Passed | Passed |
| Dean’s Office | Students | `/admin/dashboard?tab=students&workspace=dean` | **Task mini-tour.** Use program and academic-year filters to find students within your active college. | Passed | Passed |
| Dean’s Office | Research Groups | `/admin/dashboard?tab=research&workspace=dean` | **Task mini-tour.** Use program and academic-year filters to find research groups in your college. | Passed | Passed |
| Dean’s Office | Manuscript Reviews | `/admin/reviews?workspace=dean` | **Task mini-tour.** Read assigned manuscripts and their versions before recording feedback in the review controls. | Passed | Passed |
| Dean’s Office | Official Copies | `/admin/documents?tab=official&workspace=dean` | **Contextual help.** Find official research copies available to your role and current assignments. | Passed | Passed |
| Dean’s Office | Progress & Risk | `/admin/dashboard?tab=progress&workspace=dean` | **Task mini-tour.** Review projects flagged for follow-up, then inspect their stage and adviser details. | Passed | Passed |
| Dean’s Office | Advisers | `/admin/dashboard?tab=advisers&workspace=dean` | **Task mini-tour.** Review adviser assignments and workload before deciding whether a group needs follow-up. | Passed | Passed |
| Dean’s Office | Faculty Access | `/admin/faculty-access?workspace=dean` | **Contextual help.** Inspect approved college roles; this tour does not change anyone’s access. | Passed | Passed |
| Dean’s Office | Defenses | `/admin/dashboard?tab=defenses&workspace=dean` | **Task mini-tour.** Check defense status and schedules for research groups within your selected college. | Passed | Passed |
| Dean’s Office | Reports | `/admin/dashboard?tab=reports&workspace=dean` | **Task mini-tour.** Choose a report and scope to inspect research progress, defense outcomes, or adviser workload. Requires dean.report. | Passed | Passed |
| Dean’s Office | Consultations | `/admin/consultations?workspace=dean` | **Contextual help.** Check session status, dates, and meeting details before booking or joining a consultation. | Passed | Passed |
| Dean’s Office | Calendar | `/admin/calendar?workspace=dean` | **Task mini-tour.** Review dates assigned to you; select an event to read its details. | Passed | Passed |
| Dean’s Office | Announcements | `/admin/dashboard?tab=announcements&workspace=dean` | **Contextual help.** Read college announcements and check the audience before publishing any new notice. | Passed | Passed |
| Dean’s Office | Messages | `/admin/dashboard?tab=messages&workspace=dean` | **Contextual help.** Choose an existing conversation to read its history before sending a message. | Passed | Passed |
| Dean’s Office | Inbox | `/admin/inbox?workspace=dean` | **Contextual help.** Read received messages and check the recipient before composing a reply. | Passed | Passed |
| System Administration | Home | `/system-admin/dashboard` | **Introduction + contextual help.** Start with your overview to find updates and work needing your attention. | Passed | Passed |
| System Administration | Announcements | `/system-admin/dashboard?tab=announcements` | **Contextual help.** Review institutional notices; publishing a notice is outside this read-only tour. | Passed | Passed |
| System Administration | Users | `/system-admin/dashboard?tab=users` | **Task mini-tour.** Search accounts and inspect their status and roles before considering access changes. Requires user.manage. | Passed | Passed |
| System Administration | College & Programs | `/system-admin/dashboard?tab=onboarding` | **Contextual help.** Review colleges, programs, and majors; no records are created or changed during this tour. | Passed | Passed |
| System Administration | Role Permissions | `/system-admin/dashboard?tab=roles` | **Contextual help.** Inspect the permission matrix; this tour does not grant or remove permissions. | Passed | Passed |
| System Administration | System Configuration | `/system-admin/dashboard?tab=config` | **Contextual help.** Review available system settings; no configuration is changed during this tour. | Passed | Passed |
| System Administration | Integrations | `/system-admin/dashboard?tab=integrations` | **Contextual help.** Inspect storage connection status; connecting or disconnecting services is outside this tour. | Passed | Passed |
| System Administration | Audit Logs | `/system-admin/dashboard?tab=logs` | **Task mini-tour.** Narrow the audit trail by category, outcome, and date to inspect recorded activity. Requires audit.view. | Passed | Passed |
| System Administration | Database Backups | `/system-admin/dashboard?tab=backups` | **Contextual help.** Inspect the backup interface; never create or restore a backup as a tutorial action. | Passed | Passed |
| System Administration | Calendar | `/system-admin/calendar` | **Task mini-tour.** Review dates assigned to you; select an event to read its details. | Passed | Passed |
| System Administration | Inbox | `/system-admin/inbox` | **Contextual help.** Read received messages and check the recipient before composing a reply. | Passed | Passed |

### Dynamic detail pages and simple utilities

| Page | Guidance | Reason / limit |
| --- | --- | --- |
| Researcher task details at the current task URL | Submission preparation mini-tour | Reads instructions and feedback; retains the actual task/project. Uploading and submitting are not performed. |
| Adviser assigned-project details at the current project URL | Contextual help | Keeps the selected assigned group rather than redirecting to another group or generating an ID. |
| Panelist defense workspace at the current defense URL | Contextual help | Explains schedule, participants, manuscript and readiness; does not respond, score or submit. |
| Profile, account settings and notifications | No additional guidance needed | Existing labels and instructions describe these simple pages. The shared launcher remains available for workspace orientation. |
| Inbox launched from a different page | Anchored navigation explanation | Avoids automatically mounting Inbox’s institutional-message synchronization. Same-page Inbox help is available. |

## Changed files and responsibilities

| Files | Change |
| --- | --- |
| `apps/web/src/lib/workspace-tours.ts` and its test | Six-workspace registry, 72 page entries, dynamic details, permissions, safe routes and scoped progress. |
| `apps/web/src/components/shared/ProductTour.tsx`, its stylesheet and test | Refactored existing component into anchored, keyboard-accessible spotlights with real control interaction, loading and recovery. |
| `apps/web/src/providers/workspace-tour-provider.tsx` | Shared launcher, non-blocking invitation, navigation, dirty-input guard, evaluation-session isolation and persistence. |
| `App.tsx`, `AppSidebar.tsx`, `AppTopbar.tsx`, `AppWorkspaceFrame.tsx`, `NavItem.tsx` | Shared integration; Take a Tour above Settings; retired the long topbar guide. |
| Researcher, adviser, panelist, coordinator and Dean pages plus shared calendar/document/grading/monitoring/audit/user components | Stable target attributes on verified existing elements; no underlying business action changes. |
| Removed `WorkspaceHelp.tsx`, `workspace-guide.ts`, `workspace-guide.test.ts` | Retired unused long Quick Guide and its old FAQ implementation after replacement. |
| This report | Repository audit, coverage rationale, local-only version record, verification and limitations. |

## Verification scope and limitations

- Frontend: 541 tests across 68 files pass. Type-check, ESLint, production-mode frontend build and Git diff whitespace checks pass. Vite still reports its existing large-chunk advisory.
- Browser coverage: 156 checks pass (12 introductory flows and 144 page flows). All catalog targets were found; zero missing-target skips were needed in this coverage run.
- Browser network policy blocks every non-GET/HEAD request and every non-local origin. No tour-triggered write requests were observed. Normal Professor Inbox entry attempted its existing synchronization POST during baseline page navigation; the runner blocked it. Off-page Inbox tours were separately tested to stay on the current page.
- Browser automation used the already-installed Playwright/Chrome runtime because agent-browser is not installed. Only the isolated local server and sample API fixtures were used.
- The local fixture contains limited sample assignments. Actual manuscript submission, feedback publication, live scoring, signatures, role changes, integrations, database backup/restore, and live service workflows are intentionally not executed. Explaining those screens is not a claim that every consequential action has been exercised.
- Multi-role, college and evaluation-session browser scenarios use controlled local profile/session responses. Existing backend authorization is unchanged and is not re-certified by these fixture tests.
- Live Vercel and Render deployments have not received this guide version. No push, commit, merge, deployment, database operation, questionnaire change, consent change or response change was performed.

## Additional executed checks

| Check group | Passed | Detail |
| --- | ---: | --- |
| Workspace introductions, narrow phone and tablet | 12 | All six workspaces at 320×844 and 768×844. |
| Guide behavior and session boundaries | 12 | Dismissal/restart, browser Back, collapsed sidebar, focus return, desktop/mobile calendar interaction, missing target and Retry, off-page Inbox safety, permission filtering, multi-role/college switch, unsaved draft protection, current real task route, and evaluation-session isolation. Some scenarios combine multiple related assertions. |
| College/program palettes | 58 | All 29 palettes, including the default, in light and dark mode; selected palette and readable distinct foreground/background checked. |
| Permission refresh | 1 | Active tour closes and the revoked Workflow tutorial disappears. |
| Adviser/panelist detail-page help | 2 | Current project/defense URL retained; contextual explanation tested in the local unavailable-record state. Actual assigned-record operations are outside this fixture check. |

Together with the 156 coverage cases, 241 browser scenarios passed. No runtime errors or tour-triggered write requests were recorded in the successful runs. This is not an assistive-technology certification or a production deployment check.

Local screenshots were visually reviewed for desktop, mobile dark mode, and Dean workspace placement. They are exported to the Codex visualization artifacts alongside machine-readable results. The code remains uncommitted on `codex/researcher-workspace-ux-redesign`.