# Adviser Phase 2: Guide and Floating AI Assistant

**PROVISIONAL — original detailed Adviser handoff unavailable.** Prepared November 7, 2026 against `b78a1196381d60b88e687c0b5db1cba3c80c2b9f` and [product contract v1.0](ADVISIO_GUIDE_PRODUCT_CONTRACT.md).

This file preserves the workflow categories requested in the documentation task and expands them using inspected repository functionality. It cannot recover unspecified details of the missing original handoff. **Supply the original specification before implementation, retain its substantive requirements, and reconcile it into this file with explicit source attribution and a reviewed difference list.** Do not replace that detailed source with this provisional specification or a generic summary.

The [Adviser video production plan](../walkthroughs/adviser-production-plan.md) and [recording script](../../walkthrough/adviser/adviser-script.json) describe recorded academic workflows. They are supporting references, not the missing Guide/AI specification and not authorization to run their data-preparation commands.

## Scope, gates, and ownership

Implement Adviser-specific help content, route mappings, state-aware suggestions, and walkthrough definitions using the shared infrastructure. Explain existing Adviser workflows; do not redesign or implement the underlying academic features. Follow all shared UX, AI, preference, privacy, token, and accessibility requirements in the product contract. Do not rebuild the Researcher Guide.

Before implementation, resolve:

1. The original detailed Adviser handoff and any requirement differences.
2. A verified shared base containing the intended Researcher Guide/assistant. This checkout has no shared assistant API/UI, role help registry, action validator, Guide drawer, or assistance preference; its tour component is partial and unintegrated. The shared owner supplies these or completes separate authorized work. The Adviser owner must not implement duplicates.
3. Named owners, shared interface exports, endpoint, action schema, preference semantics, tour readiness API, numerical request/history limits, and approved visual references or an explicit record that screenshots are unavailable.
4. Authorized synthetic fixtures and actual current routes/selectors. Source inspection below is not a runtime pass.

Adviser owner: topics, role context, mappings, walkthrough steps/target hooks, tests. Shared owner: drawer, floating UI, API/routing, validator, tour engine, settings, and registry interfaces. Any necessary shared change requires documented coordination; changing backend workflows or access rules is outside this task.

## Source-verified route references

**Verify every reference on the approved implementation base and in its rendered UI.** These are route references found in source, not an AI action allowlist. Entity placeholders must come from authorized current data and be encoded/validated. Never assume a wildcard route or a query string makes a screen or control available.

| Topic                   | Reference route/query                                              | Source and caveat                                                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview                | `/adviser/dashboard`                                               | [dashboard](../../apps/web/src/app/adviser/dashboard/page.tsx), [AdviserSidebar](../../apps/web/src/components/dashboards/adviser/AdviserSidebar.tsx). Dashboard wildcard dispatches tabs; not every invented path/tab is a feature.                                                                           |
| My Advisees             | `/adviser/dashboard?tab=advisees`                                  | Sidebar and dashboard. Cards open individual group workspaces.                                                                                                                                                                                                                                                 |
| Group workspace         | `/adviser/advisees/:researchId`                                    | [routes](../../apps/web/src/routes.tsx), [group page](../../apps/web/src/app/adviser/advisees/[researchId]/page.tsx). `section` accepts `overview`, `documents`, `milestones`, `consultations`, `reviews`, `defense`, `activity`.                                                                              |
| Adviser request details | `/adviser/dashboard?requestId=:requestId`                          | Dashboard opens a request-details dialog from fetched requests. Pending requests appear in Overview's Needs your attention; no dedicated `/adviser/requests` route was verified.                                                                                                                               |
| Manuscript Reviews      | `/adviser/reviews`                                                 | [review page](../../apps/web/src/app/adviser/reviews/page.tsx) reuses [ManuscriptReviewWorkspace](../../apps/web/src/components/documents/ManuscriptReviewWorkspace.tsx). Sidebar label is **Reviews**.                                                                                                        |
| Exact review            | `/adviser/reviews?assignmentId=:assignmentId&versionId=:versionId` | Review workspace consumes these two context keys. Group-page links also include `projectId` and `documentId`, but the review workspace does not use those keys to select an assignment at this snapshot. Validate a consistent assignment/version pair; do not assume project/document query filtering exists. |
| Milestone Progress      | `/adviser/advisees/:researchId?section=milestones`                 | Group page shows current/completed stages and requirement progress. Dashboard also contains `tab=approvals` and `tab=progress` views; verify any action/selector before mapping.                                                                                                                               |
| Consultations           | `/adviser/dashboard?tab=consultations`                             | Sidebar/dashboard; group workspace links can add `researchId=:researchId`. Group-local readout is `?section=consultations`. No dedicated Adviser `/consultations` route was verified; shared faculty consultation routes in `routes.tsx` target other portals.                                                 |
| Official Copies         | `/adviser/documents?tab=official`                                  | Sidebar, routes, and [shared documents page](../../apps/web/src/app/student/documents/page.tsx). Distinct from active manuscript reviews.                                                                                                                                                                      |
| Messages                | `/adviser/dashboard?tab=group-chats`                               | Sidebar/dashboard and [AdviserGroupChats](../../apps/web/src/components/dashboards/adviser/AdviserGroupChats.tsx).                                                                                                                                                                                             |
| Inbox                   | `/adviser/inbox`                                                   | Routes and [mail page](../../apps/web/src/app/mail/page.tsx). Separate from Messages.                                                                                                                                                                                                                          |
| Calendar                | `/adviser/calendar`                                                | Routes and [calendar page](../../apps/web/src/app/calendar/page.tsx).                                                                                                                                                                                                                                          |
| Settings                | `/adviser/settings`                                                | Routes reuse [AccountSettingsPage](../../apps/web/src/components/settings/AccountSettingsPage.tsx) through the student settings export. No Workspace Assistance control exists yet.                                                                                                                            |

Route-level roles differ: reviews/documents/settings explicitly require `ADVISER`; some other Adviser routes also list `SYSTEM_ADMIN`. Do not copy the broadest role list into every help action. Resolve the active workspace and actual object access using shared validation and existing server checks.

## Required Adviser help content and behavior

All items below are **requirements**, not claims that Guide/AI behavior is implemented. Each topic needs a plain-language answer, applicable states, a verified navigation destination, and a walkthrough only where a stable visible target exists. Use [ADVISER_ACCEPTANCE_MATRIX.md](ADVISER_ACCEPTANCE_MATRIX.md) for evidence.

### Adviser Overview

- Explain advising workload, group progress, capacity, pending requests, reviews, and actions needing attention using current authorized data.
- Answer “What should I do next?” with one relevant permitted next step. Separate a request awaiting a decision, an assigned manuscript review, and a milestone approval; these are different processes.
- If no groups or attention items exist, explain the empty state without inventing a request or claiming everything is approved. Loading and failed requests must not be described as empty results.
- Offer Take me there to My Advisees or the relevant verified item, and Show me for actual Overview controls.

### My Advisees

- Explain how an accepted group appears, how to identify/open its card, and which project/workflow/progress information is available.
- Guide users to a selected group's workspace; ask which group when multiple authorized groups are plausible. Do not default to the first group for “this group” without context.
- Handle no groups, missing workflow, missing adviser assignment, stale selection, and failed loading. Help must never expose unrelated groups or imply that viewing a request grants full project membership.

### Individual research-group workspaces

- Cover Overview, Documents, Milestones, Consultations, Reviews & Feedback, Defense, and Activity using the real section navigation.
- Explain the difference between this group's records and global review/consultation lists. Preserve project context through actions and clearly label a move to a global workspace.
- Documents guidance distinguishes working/live files, stored versions, submitted versions, history, and permitted preview/download. Do not claim an uploaded file is automatically a submitted requirement.
- Defense readiness and panel information reflect authorized visible records; Adviser approval alone does not release results or replace coordinator/dean/panel gates.
- For an inaccessible/deleted group, stop the action and return to permitted My Advisees help without disclosing private metadata.

### Adviser Requests

- Explain where pending requests appear, View full request, included group message/members/request PDF where permitted, optional response note, and the existing Accept/Reject confirmation flow.
- Explain capacity reached, new requests paused, stale/nonpending requests, and unavailable request details accurately. Use the live server response; never infer remaining capacity from a cached count alone.
- Clarify that a pending request is not an accepted advisee relationship. The Adviser makes the decision through existing controls; help/AI must not respond to a request automatically.
- Preserve current response semantics (`accept`/`reject` in the existing API) and backend capacity/assignment checks. Do not introduce new business statuses or a new requests backend for the Guide.

### Manuscript Reviews, decisions, and feedback

- Explain active versus completed/revoked/reassigned/superseded assignments, exact document version, reading/preview, comments/highlights where supported, overall feedback, and history.
- Cover the verified recommendation choices: **Approve version**, **Request minor revision**, **Request major revision**, **Reject version**. Explain the effect on that submitted version and remaining workflow gates. Do not conflate manuscript review with task submission approval or PDF endorsement.
- Explain current validation: revision/rejection needs at least 10 characters of actionable overall feedback; an optional page reference must be a positive whole number. Reverify these rules on the implementation base instead of duplicating divergent validation.
- A later researcher revision is a separate preserved version/submission. A previous decision/history must remain readable; the assistant cannot replace, reverse, or fabricate it.
- Guide to the exact authorized assignment/version. Do not offer Continue review for another reviewer or an inactive assignment. An inconsistent/stale deep link must fail safely instead of opening the wrong version.
- Formal PDF signing/endorsement, when applicable in the current UI, uses existing signing rights, confirmation, and preserved signed copies. Never ask for a signing password in chat or imply that text approval is a digital signature.

### Milestone Progress

- Explain current, completed, future, blocked, and missing-workflow states through visible stage/requirement data. Distinguish progress percentages from approval gates.
- Explain which requirements remain, whether a submission/revision/approval is needed, and which role must act next. Never tell the Adviser to bypass another role's gate or author the professor's workflow.
- “Why can't this advance?” must identify only verified blockers or say that the necessary state is unavailable. Link to the selected group's milestone section or a verified existing approval control; do not add new progression behavior.

### Consultations

- Distinguish a requested consultation, a scheduled/upcoming session, an ongoing meeting, a completed record, cancellation, and an empty schedule using states supported by the actual Adviser UI/API.
- Explain the permitted request/scheduling controls, group context, meeting links and connection flow, notes, feedback, action items, and history only where implemented. Inspect the Adviser dashboard rather than assuming another portal's shared consultation page has identical controls.
- Separate joining a real meeting from opening consultation details or saving notes. Show me must never launch a meeting or send invitations. A missing link or unavailable integration receives a clear fallback, not an invented URL.
- Keep personal/private notes and participant information within existing visibility. Respect displayed time zone/date formatting and do not claim an unsaved note or scheduled session is complete.

### Official Copies

- Explain the official publication register, preserved versions/signatures where available, and permitted preview/download/verification.
- Distinguish Official Copies from editable working documents, submitted manuscripts, current review assignments, and Inbox signed attachments. Do not promise a published copy before the required publication steps occur.
- Empty/unpublished/not-authorized states need truthful help; no Guide action may publish, revoke, or sign a copy.

### Communication

- Explain **Messages** for research-group conversations and **Inbox** for formal threads, drafts, replies, and attachments. Use current sidebar labels; a generic helper's “Messages” link to Inbox is not proof that the two are interchangeable.
- Scope a contextual “message this group” suggestion to authorized participants and the existing conversation interface. Do not send messages, create groups, or attach academic records from chat automatically.
- Route to Calendar or notifications only through verified permitted destinations when relevant. Do not claim an Inbox draft was sent or a notification changes an academic decision.

### Settings and assistant visibility

- Explain the required **Settings → Appearance → Workspace Assistance** toggle after the shared owner provides it. Until then document the missing control; do not point a tour at a theme control as a substitute.
- First-time/unset preference: launcher enabled, chat closed. Explicit OFF stays OFF; ON shows the launcher with chat initially closed. Closing chat does not disable it. Guide remains available while the assistant is OFF or AI is unavailable.
- Reuse account-isolated shared preference infrastructure; do not fork a role-specific storage key or alter theme/notification behavior.

## Conversational and state-aware registry requirements

Use the shared registry's actual interface once supplied. Each Adviser entry must carry or map to: stable topic ID, verified source/reference revision, user question variants, concise answer, applicable role/route, required authorized context, state predicates, safe action mapping, optional tour ID, and fallback for missing state. This is a logical content contract, not a claim that a TypeScript interface exists today.

Provide deterministic coverage for at least: “Where are my advisees?”, “How do I respond to an adviser request?”, “Why can't I accept this group?”, “How do I review this manuscript?”, “What is the difference between minor and major revision?”, “Where is the previous feedback?”, “Why hasn't this milestone advanced?”, “How do I find this group's consultation notes?”, “Where are official copies?”, “Messages or Inbox?”, and “How do I hide the floating assistant?”

On route/project/role changes, derive fresh context and discard stale suggestions. Differentiate loading, error, empty, forbidden, pending, active, completed, and unavailable integration states. Use conditional general guidance when exact state is unavailable; ask a short disambiguating question when necessary. Do not assert an academic judgment or read private content to answer general navigation questions.

## Walkthrough requirements

Provide role-specific definitions for Overview/next action, My Advisees/group navigation, pending request details/decision controls, assigned manuscript version/feedback/decision controls, milestone blockers, consultations/notes, Official Copies, Messages vs Inbox, and assistance visibility. Reuse the shared engine and visual design.

Each definition must specify its permitted starting state, verified route/query, stable target hook, target readiness condition, tooltip text/placement, and safe missing-target recovery. Existing Adviser source has no verified `data-guide`/`data-tour` target system; hooks and actual rendering must be checked/added narrowly during implementation. Do not copy selectors from the standalone student prototype.

Wait for tabs/dialogs/lazy data to render; use small anchored tooltips with accurate arrows and responsive placement. Back/Next/Skip/Escape and replay must work. Tours may highlight decision controls but never press Accept, submit a review, sign a document, open a real meeting, or send a message. If an academic confirmation dialog is needed as a target, the user opens it through the existing workflow.

## AI efficiency, privacy, and delivery

Use deterministic help first, then relevant verified Adviser knowledge and the single shared assistant API only when necessary. Keep bounded history/context/output using the shared owner's recorded limits. Avoid duplicate classification/retrieval/provider calls. Preserve factual accuracy and distinguish measured usage from estimates. No model call is needed for navigation topics, Guide opening, tour replay, or visibility changes.

Enforce active role, college scope, advisee membership, document rights, reviewer assignment, exact version, and notes/communication visibility through existing controls. Validate every model-proposed action against shared mappings and current access. Do not send private academic content, passwords, signatures, unpublished grades, or other groups' data to the provider or logs. Injected instructions and arbitrary URLs/selectors must never bypass validation.

Deliver Adviser content/mappings/definitions, narrowly scoped target hooks if needed, focused tests, actual matrix evidence, visual screenshots with viewport/theme/source metadata, request/token measurements, changed-file list, and explicit deviations/blockers. Preserve existing Researcher and other-role behavior. No unauthorized commit, push, merge, or deployment. Report local results and any authorized remote checks separately.
