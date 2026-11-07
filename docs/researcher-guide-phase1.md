# Researcher Guide — Phase 1

## Scope and baseline

This phase improves only the Researcher guide on `codex/researcher-workspace-ux-redesign`. Existing uncommitted work, including the other five workspaces' guides, is preserved. A local file/patch snapshot is in ignored `node_modules/researcher-guide-phase1-baseline`. No commit, push, merge, deployment, backend workflow, authorization, database, consent, questionnaire, or response change is authorized here.

The application is Vite/React Router with `next/*` compatibility aliases; the Next.js documentation directory named in `apps/web/AGENTS.md` is absent. Current source and actual local UI are the implementation targets, not an assumed deployment revision.

## Audit findings

- The previous launcher used a centered, blurred Modal and a long feature directory. Its ProductTour used broad clipped page highlights, lacked a connected arrow, and advanced through descriptions with limited interaction. The Researcher implementation now has its own drawer and interaction renderer.
- Research Workspace expands to Project Overview, Group & Members, Tasks & Requirements, Documents & Group Files and Timeline. Group membership uses `/student/dashboard?tab=group&section=my-group`; it is distinct from `/student/dashboard?tab=group`.
- Class access is workflow enrollment. `/api/workflows/enrollments/me` returns ACTIVE enrollments for PUBLISHED workflows, plus removed workflow IDs. WorkflowAccessInbox shows pending invitations/requests and declined requests. An invitation is handled through Inbox; accepting, declining, requesting and cancelling access are mutations and are not performed by guidance.
- Tasks really does contain a professor invitation-code input when no workflow is joined. Review navigates to `/student/workflows/join/:code`; that page previews access, then separately offers Request to join. No code is invented, entered or submitted by the guide. A pending request is not enrollment. An enrolled workflow with no stages is joined but has no available requirements.
- `/student/join-group` previews a research-group/workspace code with GET. Joining/requesting uses a separate POST. PRIVATE, PUBLIC_OPEN and PUBLIC_APPROVAL have different outcomes; the guide explains the preview's actual access label and never presses the join/request control.
- Group leaders control membership decisions, invitations, registration and adviser requests where those controls are available. Members can inspect their group; the guide does not operate leadership, approval or adviser controls.
- ResearcherDocumentsWorkspace opens an actual authorized file row. Its Preview, Feedback and Version history tabs change the local view. Submission history currently flattens uploaded document versions, including drafts, so the Guide directs students to the task's own submission record to confirm delivery. Group Files holds shared attachments.
- MilestoneDetailsWorkspace exposes instructions, status, availability reasons and submission methods. A locked milestone, adviser gate, preview-only milestone and unavailable submission must use their actual displayed explanation. Guidance stops before uploading or confirming submission.
- Timeline separates the planned Gantt schedule from recorded research events and professor-defined milestone states. It must not invent dates, stage names or completion criteria.
- My Grades has Class Grades and Defense Grades. Results may be unreleased or unavailable; only the authenticated account/project's existing view is used.
- The current researcher topbar does not mount the standalone ThemeToggle. The actual Dark Mode control is in its profile menu on desktop and mobile. A student may click it voluntarily; the guide never toggles it automatically. Appearance updates normally PATCH the authenticated account's appearance preference; only local mocked requests are used for this interaction test.
- Inbox can synchronize institutional messages on entry. The guide does not automatically open an invitation/thread or mark a notification read. Communication choices are explained separately from sending messages or booking meetings.
- Project links use ActiveProjectProvider and stay in `/student`. A single authorized project opens automatically; multiple projects require a selected context. Group-less/workflow-only work remains supported. Account, college, permissions or active-project changes stop an active walkthrough.
- Existing college/program theme tokens, typography, light/dark behavior, and multi-role authorization remain intact.

## Implemented questions and walkthroughs

| Question | Actual route/controls | Important states |
| --- | --- | --- |
| How do I join a class? | Research Workspace → Tasks; workflow status, invitation/request inbox, professor code preview | Enrolled, pending request, invitation, declined, removed, no invitation, no available stages |
| Where can I see my group? | Group & Members; group identity, actual members, leader/adviser labels | Selected project, multiple projects, workspace-only group, no group |
| How do I join a research group? | Existing Join a group entry / `/student/join-group`; code, Review group, preview/access label | No code, valid preview, approval required, existing group; no automatic request |
| How do I manage my documents? | Document workspace; actual document row, viewer, Feedback, Version history, Submission history, Group Files | Existing files/feedback, empty files, no feedback, no project, restricted actions |
| How do I submit my work? | Tasks; actual requirement card, instructions, status, submission availability/method | Locked, unavailable, existing submission, leader/adviser gate, no tasks; stop before writes |
| How do I view my research progress? | Timeline; actual milestone/current-state/recorded-activity sections, Tasks link | Current/completed/pending states, no project or milestones |
| Where can I see my grades? | Academic Activities → My Grades; Class Grades / Defense Grades | Available, unreleased, no class or project |
| How do I check my defense schedule? | Academic Activities → Defense; existing defense information | Assigned, not scheduled, unavailable project/session |
| How do I contact my adviser? | Assigned adviser information, Consultations, group communication options | Assigned / unassigned adviser; no automatic booking or message |
| How do I change the theme? | Topbar profile button → existing Dark Mode control | Desktop/mobile, light/dark, distinct college branding |
| How do I find messages and notifications? | Communication links and existing notification control | No conversations, notifications; no automatic read/send |
| How do I find my settings? | Settings immediately below Guide; actual settings areas | Account, notifications, appearance, security; no edits |

## Guide interface

The Researcher sidebar now shows **Guide** with a book icon immediately above Settings. It opens a 400px right drawer with current-page help, four frequent questions, collapsed help categories, question search, and a compact introduction entry. The drawer supports ordinary page interaction, keyboard focus, Escape, and close-button focus restoration.

Written answers explain prerequisites and offer **Show me**. Search supports conversational questions, aliases, case differences, partial words and small spelling errors. Unmatched searches show a clear empty result.

Walkthroughs use stable identifiers on actual controls, an adjacent tooltip, a connected SVG arrow, and a subtle spotlight. Safe navigation, document selection, local view tabs, code previews and the existing appearance control respond to the student's own clicks. The renderer waits for dynamically loaded controls and handles responsive document lists. It offers Back, Next, Skip, Exit, Finish, Retry, and help-topic exploration.

The introduction follows Home, project context, group membership, class requirements, working files, Timeline, academic activities, communication and Guide. Successful completion offers Replay guided tour. Skipped and dismissed runs retain their own guidance status.

## Routes and controls

| Route | Verified Guide targets |
| --- | --- |
| `/student/dashboard` | Home greeting, sidebar sections, Guide |
| `/student/dashboard?tab=group` | Project title, selected project, adviser summary, existing Join a group entry |
| `/student/dashboard?tab=group&section=my-group` | Actual group identity, membership roster, selection and empty messages |
| `/student/tasks` | Class/workflow status, access notices, invitation code, Review, requirements tab, current-stage milestone |
| `/student/workflows/join/:code` | Existing invitation preview and its approval explanation |
| `/student/join-group` | Code input, Review group, actual preview and leader-approval label |
| `/student/documents?projectId=p1` | Documents navigation, Document workspace, responsive list, real file row, viewer title, Feedback, Version history |
| `/student/dashboard?tab=submissions` | Uploaded-version history heading |
| `/student/group-files` | Shared Group Files heading |
| `/student/tasks/:taskId` | Instructions, actual status, submission history/empty state, availability, safe Upload File method and file-choice view |
| `/student/dashboard?tab=milestones` | Planned Gantt heading, milestone details and Tasks navigation |
| `/student/grades` | Class Grades, class selector, Defense Grades and available release message |
| `/student/defense` | Assigned session's schedule/venue section or existing readiness/empty information |
| `/student/dashboard?tab=consultations` | Actual session-status area |
| `/student/settings` | Settings navigation |
| Researcher topbar and Communication | Profile menu, existing Dark Mode button, Messages, Inbox, notification bell |

The existing group-code page was registered only at `/join-group`. Moving into that path remounted the session query provider because its cache is separated by the first URL segment. This reset an active walkthrough. The same protected page now also has the requested `/student/join-group` route. The Researcher entry and Guide use that route with project context. Existing `/join-group` invitations still open the original protected page.

## State and interaction handling

- Authorized project IDs determine the selected context. An invalid requested project never falls back to another project's private records. A single project opens directly, while multiple projects require selection.
- Class guidance distinguishes ACTIVE enrollment, pending request, pending invitation, declined request, removed access, no enrollment and an enrolled workflow with no stages.
- Group guidance distinguishes a selected group, workspace-only membership, no group and an unresolved project selection. It points to actual members only when present.
- Document guidance distinguishes verified empty data from a failed context request. Feedback explains its actual empty state. Stored versions and academic submission records have separate explanations.
- Task guidance starts with a real milestone in the current stage. It reads instructions, status and existing submission history. Available methods can open a local file-choice or eligible-version view. Locked and unavailable cases use the page's actual message.
- Adviser guidance uses the displayed assignment and takes an assigned student to Consultations. An unassigned student gets assignment guidance.
- Theme guidance locates the actual profile-menu Dark Mode control in both appearances and on narrow screens.
- Guidance progress uses a separate v3 key scoped to the account, college, session, topic and applicable project. Evaluation progress uses session storage. Account/college/permission/context changes stop an active run.
- Back restores the prior step's route. Browser Back and independent navigation pause the active walkthrough. Existing dirty-form reporting and detected field edits prevent a guide from taking an edited form to another page.
- Dynamic targets have a loading state followed by Retry and Skip. An absent or hidden target has no arrow. Keyboard focus cycles through the safe highlighted control and walkthrough controls.

## Verification

- Chrome acceptance passed **41 of 41 scenarios**, using local sample records and isolated browser contexts. The run checked each of the 12 questions, full desktop and mobile introductions, skip/completion, native keyboard interaction, focus cycling, Escape, Back across routes, collapsed navigation, actual arrow endpoints, empty and loading states, multiple-project selection, group-code preview and task file-choice boundaries.
- Coverage included 1366px desktop, 768px tablet and 390px/320px narrow screens. Desktop and mobile document journeys opened the actual sample file and all relevant local tabs. Both light-to-dark and dark-to-light appearance changes passed through the real control with a stateless local response.
- The five existing workspace introductions passed browser regression checks. Their role-specific pages and the existing tour renderer/catalog matched the pre-phase file snapshot.
- The browser recorded **zero page exceptions and zero unexpected write attempts**. Non-GET requests were blocked by the test harness, apart from the two explicit user-click appearance changes fulfilled inside that harness. All network requests were restricted to the local preview.
- The full frontend suite passed **564 tests across 69 files**, including 23 Researcher Guide regression tests. TypeScript checking, ESLint and the local Vite build passed. Vite continues to report the existing large-chunk advisory.
- The final local review uses branch `codex/researcher-workspace-ux-redesign` at `257b4257b1550d4b1cae5a8dd5e773b642f010c6`, with the phase edits in the working tree.

The browser evidence is in [browser-results.json](<C:/Users/Nicole Andrea/.codex/visualizations/2026/11/06/01a1aea5-5e50-7910-a636-0f88912987e6/researcher-guide-phase1/browser-results.json>). The preview is available at [the local Researcher dashboard](http://127.0.0.1:4178/preview/student).

## Screenshots

- [Desktop drawer in light mode](<C:/Users/Nicole Andrea/.codex/visualizations/2026/11/06/01a1aea5-5e50-7910-a636-0f88912987e6/researcher-guide-phase1/drawer-desktop-light.png>)
- [Mobile drawer in light mode](<C:/Users/Nicole Andrea/.codex/visualizations/2026/11/06/01a1aea5-5e50-7910-a636-0f88912987e6/researcher-guide-phase1/drawer-mobile-light.png>)
- [Mobile drawer in dark mode](<C:/Users/Nicole Andrea/.codex/visualizations/2026/11/06/01a1aea5-5e50-7910-a636-0f88912987e6/researcher-guide-phase1/drawer-mobile-dark.png>)
- [Connected arrow on the actual document row](<C:/Users/Nicole Andrea/.codex/visualizations/2026/11/06/01a1aea5-5e50-7910-a636-0f88912987e6/researcher-guide-phase1/document-row-arrow.png>)
- [Mobile navigation arrow](<C:/Users/Nicole Andrea/.codex/visualizations/2026/11/06/01a1aea5-5e50-7910-a636-0f88912987e6/researcher-guide-phase1/mobile-tour-arrow.png>)
- [Actual Dark Mode control in dark appearance](<C:/Users/Nicole Andrea/.codex/visualizations/2026/11/06/01a1aea5-5e50-7910-a636-0f88912987e6/researcher-guide-phase1/theme-control-dark.png>)

## Files changed in this phase

New Researcher implementation files are `GuideDrawer.tsx`, `GuidedWalkthrough.tsx`, `guided-walkthrough-types.ts`, `guide-geometry.ts`, and `researcher-guide.css` under `apps/web/src/components/guide`, plus `hooks/use-researcher-guide-state.ts`, `lib/researcher-guide.ts`, `lib/researcher-walkthroughs.ts`, `lib/researcher-guide.test.ts`, and `providers/researcher-guide-provider.tsx`.

Integration changes are in `App.tsx`, `routes.tsx` and `providers/workspace-tour-provider.tsx`. Shared navigation/settings components accept optional Researcher targets in `AppSidebar.tsx`, `AppTopbar.tsx`, `NavItem.tsx`, `NotificationPopover.tsx`, `AccountSettingsPage.tsx` and `ClassRecordWorkspace.tsx`. `WorkflowAccessInbox.tsx` identifies the actual class-access state.

Researcher targets are added in `StudentSidebar.tsx`, `StudentProjectOverview.tsx`, `StudentGanttChart.tsx`, `overview/ResearchCommandCenter.tsx`, and the student dashboard, documents, tasks, grades, group-files, defense, settings, join-group and workflow invitation pages. `ResearcherDocumentsWorkspace.tsx` and `ResearcherDefenseRecord.tsx` identify their actual controls. This report is the remaining documentation file.

The baseline snapshot distinguishes these phase edits from the pre-existing uncommitted six-workspace tour work. Hash comparison confirms the five other dashboard pages, their role-specific targets, the original ProductTour renderer and the six-role tour catalog match that snapshot.

## Cases that require additional environment support

- The group preview API does not expose a persistent pending-request status for the current requester. The Guide explains the actual approval label and the page's request-result behavior. A pending group membership is never inferred from the approval mode.
- Accepting a workflow invitation, requesting class/group access, creating a task, uploading/submitting work, booking consultations and sending/reading messages require real account state changes. Verification stops at their documented boundaries.
- The browser acceptance environment uses local fixtures. It confirms navigation and guidance behavior, including sample scheduled and unreleased records. Real faculty approval, private records, real feedback content and end-to-end submission remain dependent on their existing services.
- Arrow geometry on uncommon custom embedded controls remains covered by the missing-target fallback. Additional user-created workflow layouts can be assessed with their authorized local data.

## Applying the reusable Guide to Adviser next

Use the drawer, connected-arrow renderer, geometry and safe control identifiers as the shared shell. Build a separate Adviser question registry and journeys from actual assigned-advisee, review, feedback and consultation behavior. Carry over the no-assignment, unavailable review and prerequisite states, then verify the real Adviser interactions before moving to Panelist.
