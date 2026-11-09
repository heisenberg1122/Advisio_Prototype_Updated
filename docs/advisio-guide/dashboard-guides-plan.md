# ADVISIO dashboard tours and feature guides

Planning draft based on the current working tree. The six workspace sections contain the proposed user-facing tour stops and searchable Guide copy. Navigation and feature availability were reviewed in source. The mobile walkthrough placement change has separate browser verification below.

## What the audit found

| Workspace | Current help | What the next revision adds |
| --- | --- | --- |
| Researcher | Searchable Guide, contextual walkthroughs and optional introduction | Separate help for adviser requests, title proposals, task eligibility, submission history, group files, consultations, defense outcomes and class grades. Split broad topics into questions people can find directly. |
| Adviser | Searchable Guide with advisees, requests, manuscript decisions and consultations | Group workspace tabs, task feedback versus formal manuscript decisions, defense readiness, annotation sharing and account help. Update the milestone-approval answer after checking the live controls. |
| Panelist | Searchable Guide with invitations, reviews, scoring and results | Separate walkthroughs for structured, direct PDF and legacy rubric evaluations, including draft and final states. Add private versus shared annotations, invitation changes and released results. |
| Professor Coordinator | Take a Tour menu with a five-step introduction and page-level guidance | Searchable task guides for workflow setup, access, title decisions, submissions, class records, defense setup, all evaluation modes, result release and badges. |
| Dean’s Office | Take a Tour menu with college monitoring, defenses and reports | Searchable help for student and project monitoring, faculty invitations and access, adviser workload, signed approvals, defense oversight, personal panel assignments and reports. |
| System Administration | Take a Tour menu with account, structure, integration and audit page descriptions | Searchable help for invitations, account lifecycle, permissions, academic structure, Drive and audit. Add the omitted Portal Settings tab and distinguish informational surfaces from live controls. |

The active launcher is chosen by `workspace-tour-provider.tsx`. `researcher-guide-provider.tsx` supplies the richer Guide for the first three workspaces. The remaining three use `workspace-tours.ts`, which often highlights a page or filter without explaining the record-level workflow. The public evaluation guide and role videos are separate surfaces.

## Implementation plan

1. **Map coverage to real entry points.** For each topic below, record the role, approved college, route or tab, any permission, the record state that unlocks the action, and the visible control to highlight. Use the sidebar, protected routes, page components and API authorization as the sources of truth. Map nested task, advisee, review and defense pages to their current-page help.
2. **Use one sidebar entry across the six workspaces.** Put **Guide** above Settings and move **Start guided tour** or **Replay guided tour** inside the existing drawer. Keep the first tour short. Use searchable questions, categories, and **On this page** for the full catalog. Preserve existing usable topics and improve them in place.
3. **Reuse the Guide drawer and walkthrough renderer.** Make the provider select a catalog using the active workspace and approved college. Keep Guide eligibility separate from the existing floating Assistant eligibility. For the three current Assistant workspaces, reuse the vetted topic metadata where appropriate. Keep Guide search and walkthroughs available when the Assistant is unavailable.
4. **Use the right depth for each topic.** Add a brief explanation to read-only screens and a short **Show me** sequence for multi-step tasks. Highlight an actual control or status. Let users operate safe filters and tabs. Keep actions that send, submit, publish, approve, sign, grade, invite, suspend, archive, configure or delete behind the normal user-initiated workflow.
5. **Handle context and missing records.** Keep the selected project and college, retain the Dean workspace query, and resolve record links from records the current user can access. Explain the specific reason when known, such as a draft packet or missing assignment. Provide a useful page-level explanation and Retry, Skip or Exit when a target is unavailable. Recheck context when the role, college, record or permissions change. Honor dirty forms, restore focus, and preserve completion, dismissal and replay by account, college, workspace and evaluation session where applicable.
6. **Roll out in three slices.** Expand Researcher, Adviser and Panelist content first. Add Professor Coordinator and Dean’s Office catalogs next. Add System Administration and shared account help last, then retire the older launcher after checking equivalent coverage. Keep the video walkthroughs and public evaluation flows separate from this change.
7. **Verify every catalog entry.** Use demo or isolated fixtures with populated, empty, loading, denied and locked states. For each topic verify search, current-page placement, route, anchor, permission and recovery. Check keyboard use, focus, responsive layout and light/dark themes. Test direct navigation, college/role changes, dirty forms, replay and cross-college denial. Exercise Guide interactions without issuing consequential writes. Run focused Guide and routing tests, then the web build. If pushed, verify GitHub Actions and deployment for that commit and report them separately from local checks.

## Mobile walkthrough placement

- Use the same placement rules in **Guide** and **Take a Tour**. Attach the arrow and spotlight to a real, visible control or section. Recalculate after the page scrolls, the viewport changes size, or a step loads its target.
- Keep the help box within the viewport. Use an adjacent position with enough room for a readable card, and allow the card to scroll when the explanation is long. Keep navigation buttons at least 44 pixels tall.
- On a short screen with a large target, place the card at the screen edge with more free space and hide the arrow. Keep most of the highlight visible. Use the smallest meaningful target for steps that ask the user to interact.
- When the target is missing or off-screen, hide the arrow and spotlight. Use the existing loading and recovery actions so the user can retry, skip or exit.
- Verify portrait phone widths of 320, 390 and 430 pixels and a short landscape viewport. In the browser, check alignment before and after scrolling or resizing, the large-target fallback and recovery from a missing target. Capture screenshots of representative states using sample records.

Local Edge simulation verified the introductory step in Researcher at 390 × 844, Adviser in dark mode at 430 × 820, and Professor Coordinator at 320 × 720. The Adviser arrow followed its target after scrolling. At 640 × 360, a simulated tall target used a compact card with Next visible and the arrow hidden. At 390 × 640, a hidden target displayed Retry and Skip without a spotlight or arrow. Retry restored the anchor when the target returned. Five screenshots were captured from these scenarios.

## Shared Guide copy

Applies wherever the corresponding control is present. Each workspace introduction ends at **Guide** with “Open Guide whenever you want to look up a task or replay this tour.”

| Search question | Proposed answer |
| --- | --- |
| How do I switch dashboards or colleges? | Choose an approved dashboard from the workspace switcher. If you belong to more than one college, open the profile menu and choose **Active college** first. The dashboards and records you can open depend on your approved roles in that college. Save unfinished work before switching. |
| How do I update my profile or password? | Open **Settings → Profile** for personal and institutional details, or **Faculty Profile** where available for expertise and advising details. Use **Security** for the password controls available to your account. |
| Where do I change the theme? | Open **Settings → Appearance** to choose the available theme and display mode. The profile menu also offers a quick display-mode control where supported. |
| How do I change alerts or find a notification? | Open the notification bell or **Notifications** for recent alerts. Select an alert to open its related record if access is still available. Use **Settings → Notifications** for the preferences your role offers. |
| How do I hide the floating Assistant? | In Researcher, Adviser or Panelist, open **Settings → Appearance → Workspace Assistance** and turn off **Show floating AI Assistant**. You can still open Guide from the sidebar. |
| Where are my events, messages or Inbox? | In **Calendar**, select the date and open the event to check its details. **Messages** opens workspace conversations where available. **Inbox** is for direct correspondence. Confirm the recipient and college before sending. |

## Researcher

**Introduction**

1. **Home** — “Check what needs your attention and use the project selector if you work on more than one project.”
2. **Project Overview and Group & Members** — “Check your stage, adviser, members and the next action for this project.”
3. **Tasks & Requirements** — “Open an available requirement to see what to submit and which approvals come first.”
4. **Documents & Group Files** — “Prepare working files here. Open the requirement in Tasks when you’re ready to submit a version.”
5. **Research Timeline and Defense** — “Check upcoming deadlines and whether your defense is ready, scheduled or awaiting results.”

| Search question | Proposed answer |
| --- | --- |
| Where is my project or next action? | Open **Project Overview** and check the selected project, stage, adviser and next action. If you are in an untitled workflow, your work can appear in Tasks before a title is registered. |
| How do I join a class or workflow? | Open **Tasks & Requirements** and use the class invitation or join code your professor provided. Check that you are in the correct college and program. If access is pending or blocked, read the displayed status before trying another code. |
| How do I start an available milestone? | Open the milestone in **Tasks & Requirements** and choose **Start this milestone** if available. Choose your existing workspace or work individually when offered. Complete any earlier requirement or approval listed on a locked milestone. |
| How do I create, join or manage a group? | Open **Group & Members** to see the current roster and adviser. Use the group creation, invitation or join option shown for your situation. Check the group and your role before accepting an invitation or changing membership. |
| How do we request or change an adviser? | Open the adviser-selection milestone or the available adviser directory. Check availability and expertise, then use the request option as group leader. Follow the request status and use **Withdraw** only while it is available. An adviser becomes assigned after acceptance. |
| How do we propose or register a research title? | Open **Title Proposal** when it becomes available. The group leader enters the proposed titles and checks the professor’s decision or revision request there. If the workflow has no proposal step, use the title field in **My Project** when required by the department. |
| How do I upload, link or create a document? | Open **Documents & Group Files**, then add a working file, link an existing Google document, or create one when offered. Open the file to check its preview and access before using it for a requirement. |
| Where do I find shared files and class resources? | Use **Documents & Group Files** for project attachments. Open the assigned workflow or requirement for instructor-provided resources and milestone attachments. Check that you selected the right project or class. |
| How do I submit a requirement? | Open the requirement in **Tasks & Requirements**. Read its instructions, deadline and accepted file types. Select or attach the eligible document, review the submission details and confirm. Check the recorded version and status afterward. |
| How do I revise work or find earlier submissions? | Open the task for its submission status and revision instructions. In **Documents & Group Files**, choose the document and use **Feedback** or its version history to inspect the submitted snapshot. Revise the working draft, then submit a new version from the task when allowed. |
| How do I read the Research Timeline? | Open **Research Timeline** to see milestone order and deadlines. Open the corresponding requirement for the latest status, feedback or eligibility message. |
| How do I request or join a consultation? | Open **Consultations** and use the request option if available for your project. Check the proposed date, status and meeting details. Open the meeting link when one is provided and return to the session for notes or action items if recorded. |
| What is blocking my defense? | Open **Defense** and select the current project or session. Check the eligibility requirements, pending approvals and schedule. Ask your adviser or coordinator about a missing requirement or clearance. |
| Where are my defense results, revisions and badge? | Open the relevant defense record and check whether the official result has been released. Read any revisions or re-defense instructions. Return to the record for clearance or a badge once it is available. |
| Where are my grades and attendance? | Open **My Grades → Class Grades** and select the class and grading period. You can see released scores, attendance and release history. Use **Defense Grades** for available defense reports. |
| How do I contact my group or adviser? | Open **Messages** for your project conversations, **Inbox** for direct correspondence, or **Consultations** when you need a scheduled meeting. Check the active project before posting. |

## Adviser

**Introduction**

1. **Overview** — “Start with Needs your attention for pending requests and other work awaiting you.”
2. **My Advisees** — “Open a group to see its members, milestones and upcoming work.”
3. **Reviews** — “Check the assigned manuscript and exact version before opening the review workspace.”
4. **Consultations** — “Review pending and confirmed meetings, then check the group, time and meeting details.”

| Search question | Proposed answer |
| --- | --- |
| How do I respond to a group’s adviser request? | Open **Overview → Needs your attention → View full request**. Verify the group and request details before accepting or rejecting. If Accept is unavailable, check the adviser capacity or paused-requests notice in **My Advisees**. |
| Where are my advisees and project records? | Open **My Advisees** and select a group assigned to you. Use **Overview** for the roster and next work, **Milestones** for status, and **Activity** for recorded changes. Return to My Advisees if the project is no longer assigned to you. |
| Where are task submissions and adviser feedback? | Open the group’s **Milestones** and the relevant requirement. Check the submission and its version, then use the feedback controls available for that task. For a formal manuscript assignment, use **Reviews** and the assigned version. |
| How do I review or endorse a manuscript? | Open **Reviews → Pending reviews** and choose the assignment. Confirm the submitted version, read the manuscript and enter your feedback. Choose the available recommendation and review the confirmation before submitting the permanent decision. Follow any separate endorsement step shown for that document. |
| What do approve, revise and reject mean? | Approval applies to the assigned version. Use minor or major revision when changes are needed, or rejection when the version should not be accepted. Include actionable feedback where required. Revoked, completed or superseded assignments may be read-only. |
| Where are versions, annotations and review history? | Use the group’s **Documents** and its version history to compare snapshots. Use **Reviews & Feedback** in the group and **Review history** in Reviews to find recorded decisions. If the viewer offers private notes and shared feedback, check which one you are using before sharing. |
| How do I check milestones or defense readiness? | Open the group’s **Milestones** and **Defense** tabs. Check the requirements, adviser assignment, approved manuscript and any required signed clearance. If an approval queue has no actionable control, use the recorded status to identify what the coordinator needs to verify. |
| How do I schedule, join or follow up on a consultation? | Open **Consultations → Schedule consultation**, select an eligible advisee group, and review the topic, time and meeting details. Use the meeting action when a link is present. Check schedule, history or the group’s **Consultations** tab for status, notes and action items. |
| Where can I find official copies or contact a group? | Open **Official Copies** for published records available to your assignment. Use **Messages** for group conversations and **Inbox** for direct correspondence. Use **Calendar** for scheduled events. |

## Panelist

**Introduction**

1. **Overview** — “Check assigned work and upcoming defenses.”
2. **Defense Schedule** — “Open an invitation to check the date, response status and session details.”
3. **Manuscript Reviews and defense packet** — “Use the review queue for manuscript assignments and the session packet for the published defense manuscript.”
4. **Evaluations and Results** — “Find your evaluation for the selected defense and check Results after submission.”

| Search question | Proposed answer |
| --- | --- |
| How do I accept or decline an invitation? | Open **Defense Schedule**, verify the session date and venue or meeting details, and choose **Accept** or **Decline** when available. Enter the requested reason for declining. If the defense was rescheduled, check whether a new response is required. |
| How do I open the session and published packet? | Choose **Open session** on the assigned defense. Check your invitation status and packet publication. An accepted panelist can open a published packet for that session. If the packet is missing, read the readiness message. |
| How do I review the defense manuscript? | Open the packet and confirm the published manuscript version. Use the checklist and annotation tools as available. Check which notes are private, explicitly share feedback when ready, and use the separate review-completion action when offered. |
| How do I review a general manuscript assignment? | Open **Manuscript Reviews** and choose the active assignment. Confirm the version and look at earlier versions where available. Record feedback and a recommendation using the available controls. A completed or superseded assignment may only be viewable. |
| Where do I submit a panel recommendation? | Open the session packet. If it offers a separate recommendation form, review the draft and preview before confirming. In a structured evaluation, enter the recommendation in the evaluation itself. |
| How do I complete a structured evaluation? | Open **Evaluations** for the live defense. Rate each student’s presentation and the group manuscript, add the recommended result, and explain revisions or re-defense when required. Check the saved draft, complete the signature if configured, preview the PDF and explicitly confirm final submission. |
| How do I mark and submit a PDF evaluation? | In the direct PDF workspace, use the available marks, text boxes and page comments. Check the saved draft, complete any required signature, and preview every page before confirming. If you edit after signing, review the new preview and reapply the signature when required. |
| How do I complete a legacy rubric? | Use the rubric shown for the assigned session. Enter the scores and comments it asks for, save the draft if needed, then review and confirm when ready. |
| Why is my evaluation unavailable or locked? | Check the invitation, session readiness and displayed form status. Scoring can wait for the facilitator to start the defense. A missing packet or rubric can also block the form. Once submitted, open the locked copy from **Results** when available. |
| Where is my submission or the official result? | Open **Results** and select the defense. **View my completed evaluation** opens your locked copy when available. The official decision may remain pending after your own evaluation is submitted. |
| Where are official copies, consultations and messages? | Open **Official Copies** for available archival records. Use **Consultations** or **Calendar** for scheduled activity, **Messages** for workspace conversations and **Inbox** for direct correspondence. |

## Professor Coordinator

**Introduction**

1. **Overview** — “Start with current research activity and items that need your attention.”
2. **Workflow and Research Projects** — “Check the workflow your class follows and the groups you supervise.”
3. **Submissions and Progress** — “Review the exact version students submitted, then follow the group’s milestones.”
4. **Class Record** — “Choose your workflow and grading period to review scores and attendance.”
5. **Defense** — “Check eligibility, panel invitations, the review packet and official result release.”

| Search question | Proposed answer |
| --- | --- |
| How do I build and publish a workflow? | Open **Workflow** and choose the workflow you manage. Add or edit milestones and requirements, check their order, deadlines, eligibility conditions, accepted files and grading settings. Review what enrolled researchers will see before publishing. If the editor is unavailable, check your workflow ownership and permissions. |
| How do researchers join and get resources? | Open the workflow’s access and participant controls. Use the supported join or invitation option, review incoming requests where available, and confirm the roster. Add workflow resources or milestone attachments where they belong so researchers can find them in the correct task. |
| Where do I find projects and review title proposals? | Use **Research Projects** to find registered groups. In **Submissions**, open the group’s **Title Proposal** and check its entries. Approving one title registers the research project. Until then, the group’s activity can appear in workflow records. |
| How do I review a submission or return it for revision? | Open **Submissions** and filter by the relevant workflow or requirement. Open the submission and verify its version. Review the evidence, record feedback and use the available decision controls. Check which reviews or approvals still need to happen before the requirement can advance. |
| How do manuscript reviews differ from task submissions? | **Submissions** follows requirement attempts. **Manuscript Reviews** opens version-specific review assignments. Check the reviewer and version before recording feedback or following up. **Official Copies** contains published archival files that you can access. |
| How do I use Progress? | Open **Progress** and choose the workflow or cohort. Compare group milestones and look at the reasons for overdue or incomplete work. Open the relevant project or submission to verify the status before following up. |
| How do I create or use a Class Record? | Open **Class Record**, select a workflow you own and choose Prelim, Midterm or Finals. Add individual activities or link graded requirements. Record scores and attendance, then save drafts. Check the distinction between ungraded, missing, excused and a graded zero. |
| How do I release, correct or export grades? | Check calculation settings, scores and attendance. Use **Release** for one researcher or **Release period** for the roster once the checks pass. For corrections, provide the required note and release again. Use the available history and CSV export for saved grade or attendance records. |
| How do I schedule a defense and manage invitations? | Open **Defense** and verify the project’s eligibility and any clearance required for that session. Choose the session details and panelists using the available controls. Review responses and rescheduling status before starting the defense. |
| How do I request a Dean’s signature or approval? | Open the relevant submission or defense approval workflow. Confirm the project and exact PDF before sending a signing request. Follow the request and signed copy through the related record or signature workspace when available. |
| How do I configure and publish a defense packet? | Open **Defense → Review packet** for the selected session. Choose the approved immutable manuscript for its eligibility milestone and configure the evaluation. Set the structured rubric and rating scale or select the supported PDF method. Existing sessions retain their mode. Check the roster, signature requirements and publication eligibility before publishing. |
| How do I start the defense or check panel submissions? | Open the scheduled defense and review its readiness before using the start control. In the packet, track submitted evaluations. Use consolidated structured results or **Submitted PDF evaluations** according to the session mode. Direct PDF marks do not produce a numerical grade. |
| How do I release the result and handle revisions or badges? | Review the completed required evaluations and explicitly choose the official decision before release. For revisions, review the newer approved manuscript and record clearance when the session allows it. Use a new session for re-defense. Issue the applicable badge once the record shows it is eligible. |
| How do I post an announcement or arrange a meeting? | Use **Announcements** and verify the audience before publishing. Use **Consultations** for eligible project meetings and **Calendar** for scheduled activity. Use **Messages** or **Inbox** for the appropriate conversation. |

## Dean’s Office

**Introduction**

1. **Overview** — “Check your active college and the items in the decision queue.”
2. **Students and Research Groups** — “Filter the roster and projects by program to see the records you oversee.”
3. **Progress & Risk and Advisers** — “Review why a project needs follow-up and check its adviser’s workload.”
4. **Defenses and Reports** — “Check session readiness, outstanding actions and the report scope.”

| Search question | Proposed answer |
| --- | --- |
| How do I find a student or research group? | Open **Students** or **Research Groups** and filter by the available program, year, stage or search options. Check the selected college and filters if you cannot find a record. Use student management controls only when offered for that account. |
| How do I understand risk and follow up? | Open **Progress & Risk** and inspect the reason attached to the status. Compare it with the project’s stage, progress and adviser before deciding which follow-up is needed. Clear filters to check whether a project was simply outside the current view. |
| How do I review adviser workload or availability? | Open **Advisers** and compare assignments and capacity. Capacity controls depend on authority and the faculty member’s home college. Use **Faculty Access** for invitation and role questions. |
| How do I invite faculty or request access? | Open **Faculty Access** in the active college. Use the Adviser invitation or the available Professor Coordinator or Panelist request. Check the pending status and any System Administration review required. The recipient must accept the invitation before the new college role is available. |
| Where do I review or sign an approval? | Start with the **Overview** decision queue or the document signing workspace linked from the request. Open the exact PDF, check the project and requester, then use the signing controls when you have authority. Confirm the signed copy before sending a reply. |
| Where are manuscript reviews and official copies? | Open **Manuscript Reviews** for eligible review assignments and their submitted versions. Use **Official Copies** to find published records available in this college. |
| How do I monitor defenses and outstanding actions? | Open **Defenses** and choose the relevant status, such as upcoming, awaiting panel confirmation, needs rescheduling or awaiting result release. Open **Defense details** to see the session and its outstanding action. |
| How do I open a defense I’m personally assigned to? | Use **My Panel Assignments** in **Defenses** when it appears. Open the assigned session using the action provided. The destination depends on your approved panel role, invitation status and scoring readiness. |
| How do I run or export a college report? | Open **Reports** and select the report, then set its available scope filters. Review the table and use **Export CSV** or **Export PDF** where available. The export includes all matching rows in the selected scope, including rows on other pages. |
| How do I publish a notice or contact someone? | Open **Announcements** and verify the audience before publishing. Use **Consultations** and **Calendar** for meetings and events, **Messages** for workspace conversations and **Inbox** for direct correspondence. |

## System Administration

**Introduction**

1. **Overview** — “Start with the platform summary and open the area you need to inspect.”
2. **Users and Invitations** — “Check the account, its current status and college access before acting.”
3. **College & Programs and Role Permissions** — “Find the academic structure and see which permissions apply to a role.”
4. **Integrations and Audit Logs** — “Check Drive status and trace the recorded outcome of administrative activity.”

| Search question | Proposed answer |
| --- | --- |
| How do I find a user or check their access? | Open **Users** and search the current or archived view. Use **View details** to check identity, registration details, roles, college assignments and sign-in methods. Confirm the account before using any management action. |
| How do I invite faculty or review a Dean’s request? | Use **Users → Invite user** to select the correct college, role and institutional identity. Open **Invitations** to review requests, verify the details and record the approval or rejection note. Approved requests still require the recipient to accept the invitation. Check expiry or delivery status before resending or revoking. |
| How do I update roles or college access? | From the correct account, inspect the current roles and college membership. Use the invitation flow for additional faculty access and the authorized role controls for removing existing grants. Verify the college and whether the account holds the same role elsewhere. |
| How do I send a password reset? | Open **View details** for an active account and use **Reset password** if it has a local password. Verify the saved email before confirming. Google-only users manage their password through Google. Check the delivery result in Advisio. |
| How do I suspend, archive or restore an account? | In **Users**, choose the appropriate action for the verified account and enter the reason. Suspension and archiving block access while preserving records. Find archived accounts in **Archived users**. Use **Verify & restore** and record the verification note before restoring access. |
| How do I manage colleges, programs or majors? | Open **College & Programs**, choose the parent college and program, and review the hierarchy and status. Use the available create, edit or status controls after verifying the parent and any affected records. |
| Where can I see role permissions? | Open **Role Permissions** to inspect the role matrix. For a person’s actual roles and college memberships, open their account in **Users**. |
| How do I check Google Drive or storage usage? | Open **Integrations**. Check the connection, connected account and storage information. Review refresh, connection or disconnection controls when available and confirm the target account before changing it. |
| How do I find an administrative or academic audit event? | Open **Audit Logs** and filter by the available category, outcome and date. Open the matching record and verify the action, actor, target and time. Check the filters if an expected event is missing. |
| Can I change system configuration or restore a backup here? | **System Configuration** displays status information. **Database Backups** describes automated snapshots. In the current interface, backup and restore operations are handled outside this screen. |
| Where are Portal Settings and my account settings? | **Portal Settings** shows the default administrator palette and an email checkbox that does not save. Open account **Settings** for supported profile, security, display mode and notification preferences. |
| How do I publish a system notice or find correspondence? | Open **Announcements** and verify the audience and content before publishing. Use **Calendar** for available events and **Inbox** for direct correspondence. |

## Show me walkthroughs

These sequences use the topic answers above as the detailed reference. A Guide can point to the last control and explain its effect. The user decides whether to perform the action after leaving the walkthrough.

| Workspace and task | What to highlight, in order | Recovery if the expected state is missing |
| --- | --- | --- |
| Researcher · Submit or revise a requirement | **Tasks & Requirements** → the current task’s instructions and status → its file or document version selector → submission review or the existing submitted version. | Explain the blocker shown by the task. If there is no eligible file, point to **Documents & Group Files**. If the task is locked, point to its prerequisite or feedback. |
| Adviser · Review a manuscript | **Reviews → Pending reviews** → active assignment and exact version → manuscript and feedback controls → permanent decision summary. | Point to **Review history** if the assignment is complete. If the version is unavailable, direct the user to the displayed error and the coordinator who can verify the assignment. |
| Panelist · Complete an evaluation | **Defense Schedule** → selected session and readiness → **Evaluations** → controls for the actual mode → draft status → preview or confirmation. Use the rating sections for structured forms, PDF tools for direct PDF and score fields for a legacy rubric. | Explain the visible reason for unavailable scoring. For a locked submission, point to **Results** and the view action when present. |
| Professor Coordinator · Release grades | **Class Record** → workflow and period selectors → activity grades and attendance → draft/release status → **Release** or **Release period**. | Explain ownership, incomplete attendance or grade entries, or the calculation status shown for the selected period. |
| Professor Coordinator · Prepare a defense and release results | **Defense** → session and invitation status → **Review packet** and manuscript version → evaluation configuration or published snapshot → required submissions → **Release official result**. Split packet setup and result release into separate journeys. | Point to the specific readiness or publication requirement. When results are pending, identify the missing required submissions from the visible status. |
| Dean’s Office · Review faculty access | **Faculty Access** → role or invitation options → college-scoped request fields → current request or invitation status. | If the role requires System Administration approval, explain the review and recipient acceptance steps. Show the approved college requirement when access is unavailable. |
| Dean’s Office · Run a report | **Reports** → report type → available filters → result totals → export controls. | Explain the selected scope and offer to clear filters. If the report is denied, explain the permission requirement without offering the route as a workaround. |
| System Administration · Review and manage an account | **Users** → search or **Archived users** → **View details** → status or membership → the applicable management control. Keep invitation review as a separate journey under **Invitations**. | Explain the account status or permission shown. For an archived account, point to **Verify & restore** only when it is available. |
| System Administration · Trace an event | **Audit Logs** → category, outcome and date filters → matching event → available event details. | Clear filters if no events match, distinguish loading from an empty result, and respect access restrictions. |

## Source references and acceptance

- Workspace and routing inventory — [workspace identities](../../packages/auth/src/dashboard-workspaces.ts), [routes and guards](../../apps/web/src/routes.tsx), [tour inventory](../../apps/web/src/lib/workspace-tours.ts), [Researcher sidebar destinations](../../apps/web/src/lib/researcher-navigation.ts).
- Existing help and launcher — [Researcher topics](../../packages/shared/src/researcher-help.ts), [Adviser topics](../../packages/shared/src/adviser-help.ts), [Panelist topics](../../packages/shared/src/panelist-help.ts), [Guide product contract](ADVISIO_GUIDE_PRODUCT_CONTRACT.md), [previous tour coverage](../workspace-guidance.md).
- Academic task detail — [workflow participation](../workflow-participation.md), [Class Record](../class-record.md), [structured defense evaluations](../structured-defense-evaluations.md), [PDF evaluations](../../PDF_EVALUATIONS.md), [defense badges](../../DEFENSE_BADGES.md).
- Institutional administration — [faculty invitations](../account-invitations.md), [account lifecycle](../user-account-lifecycle.md), [audit operations](../audit-trail-operations.md), [System Administration dashboard](../../apps/web/src/app/system-admin/dashboard/page.tsx).

The implementation is complete when every visible workspace destination has relevant current-page help, each task in this catalog is discoverable from the correct dashboard, and every offered walkthrough has a verified target or a useful fallback for its unavailable state.
