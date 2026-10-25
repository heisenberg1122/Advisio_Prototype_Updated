# Multi-role notification separation plan

Status: Planned; application implementation has not started.
Updated: 2026-10-26 (Asia/Manila)

Scope: Planning only. This extends `multi-role-dashboard-switcher-plan.md`; it does not change application behavior, role assignments, or deployments.

## 1. Intended experience

One account has a separate notification inbox for each assigned dashboard, with a shared Account notices section for announcements and account changes.

For a Panelist + Professor Coordinator account:

- The Panelist dashboard shows panel invitations, assigned evaluations, and panel review updates.
- The Professor Coordinator dashboard shows workflow administration, enrollment requests, and coordinator tasks.
- University/college announcements and account access changes appear in Account notices, accessible from both dashboards.
- Reading or dismissing a Panelist item leaves Coordinator items unchanged.
- The dashboard switcher shows an unread badge beside each eligible dashboard, so other-role work remains discoverable.

Use the same behavior for Dean + Coordinator and other supported combinations. Single-role users retain a simple inbox with their dashboard updates and Account notices.

### Presentation and counts

The bell popover has two labeled sections: **[Active dashboard] updates** and **Account notices**. Its badge counts unique unread items in those two sections. It must not include unread items from other dashboards.

The full notification page defaults to the active dashboard, with an **Account notices** tab and a **Your dashboards** selector showing only eligible dashboards and their individual unread counts. Existing All / Unread / Read filters apply within the selected section. Label All as **All statuses** if needed to distinguish it from all roles.

Selecting a different inbox on the full page previews that role's notifications without changing the active dashboard. Rows clearly show the target dashboard. Opening an item in that inbox uses the normal dashboard-switch flow, including the unsaved-form guard, and then opens the exact record. Do not change dashboard identity merely when choosing an inbox filter.

Dashboard badges count role items only. Account notices have their own count; do not add that count to every dashboard badge. A notice read in Account notices is read everywhere because it is one shared delivery.

Replace ambiguous bulk controls with **Mark [dashboard] updates as read** and **Mark account notices as read**. The popover's role bulk action affects its active dashboard section only. Do not offer an account-wide bulk action across all roles in the first release. Dismiss operates on one delivery and preserves institutional history through `archivedAt`.

## 2. Verified current state

| Area | Current implementation | Consequence |
| --- | --- | --- |
| Database | `packages/database/prisma/schema.prisma`, `Notification` has recipient, type, entity, action URL, deduplication key, read/archive state; no audience dashboard | A recipient's different responsibilities cannot be reliably separated. |
| Listing and counts | `apps/api/src/routes/notification.routes.ts` lists the newest 50 unarchived items by recipient and counts all unread recipient items | All roles share a feed; counts require a server scope filter. |
| Bulk reading | The same route's `/read-all` updates all unread, unarchived recipient items | Reading one dashboard can clear other dashboards. |
| Web hook | `apps/web/src/hooks/use-notifications.ts` fetches the shared endpoint, infers portal from pathname, and counts unread items from the loaded list | The badge can undercount beyond 50 rows and cannot distinguish shared `/admin` dashboards. |
| Navigation | `apps/web/src/lib/notification-navigation.ts` maps generic links using the current portal and permits recognized portal prefixes without checking the corresponding role in that branch | Links need explicit target context and eligibility validation. Existing record authorization remains essential. |
| Other consumer | `apps/web/src/hooks/use-student.ts` independently fetches notifications for the student dashboard | Updating only the popover would leave another mixed feed. |
| Producers | Direct notification writes exist in workflow, research, document, adviser-request, defense, dean, mail, signing, official-copy, and announcement code | Every producer needs an audience decision. `notification.service.ts` is currently an empty export. |
| Existing dependency | The dashboard switcher plan defines canonical workspace IDs and explicitly distinguishes Dean, Ethics, and Academic Affairs on shared `/admin` routes | Reuse that registry and validated workspace state. Do not create another role-priority resolver. |

Existing uncommitted application edits were observed during planning. This plan does not modify those files.

## 3. Notification audience and storage

Keep the existing `Notification` row as a per-recipient delivery, including its current read/archive state. Add:

- `audienceScope`: enum `WORKSPACE`, `ACCOUNT`, or `LEGACY`.
- `targetWorkspaceId`: nullable stable ID from the shared dashboard registry.

Enforce the invariant in server validation and a database check constraint: WORKSPACE requires a recognized target workspace; ACCOUNT and LEGACY require no target workspace. LEGACY is exclusively for unresolved migrated data and must never be accepted for new deliveries after rollout.

Use the registry's IDs: `researcher`, `adviser`, `panelist`, `coordinator`, `dean`, `ethics`, `academic-affairs`, and `system-admin`. Their current canonical roles are RESEARCHER, ADVISER, PANELIST, RESEARCH_COORDINATOR, RPO, REB, VPAA, and SYSTEM_ADMIN. An `/admin` URL alone cannot distinguish its three workspaces.

A role-specific event creates a delivery only for the responsibility that caused the recipient to receive it. Holding multiple roles does not broadcast an event into every inbox. When a person independently receives the same event in two responsibilities, create two deliveries with separate read/archive states and role-appropriate text/destinations. An account notice creates one delivery per person.

Extend the existing deduplication-key convention to include stable event identity, recipient ID, scope, and workspace (or an account sentinel). Keep keys within the existing 191-character limit, using a stable hash where necessary. Repeated delivery of the same event must not create duplicates, and delivery to a second legitimate role must not be suppressed by recipient-only deduplication.

Add query indexes based on recipient, scope, workspace, archive/read state, and chronological ordering. Verify the actual listing/count query plans before finalizing the index set; retain existing indexes until their consumers are audited.

## 4. Producer classification rules

Audience describes the recipient's responsibility, not the sender's role, currently selected dashboard, notification severity, or type alone.

| Event/context | Destination audience |
| --- | --- |
| Request asking someone to become an adviser; adviser capacity changes | Adviser |
| Adviser decision delivered to a research team | Researcher |
| Panel invitation, panel response request, assigned panel evaluation | Panelist |
| Defense schedule/result delivered to research team members | Researcher |
| Defense administration update delivered to the responsible coordinator | Professor Coordinator |
| Manuscript review assignment or revision task | Assigned recipient responsibility: Adviser, Panelist, Coordinator, etc., from the actual assignment |
| Workflow enrollment/administration request | Owning/approving dashboard from the workflow's verified responsibility |
| Workflow progress delivered to a research team | Researcher |
| Ethics decision requiring board action | Ethics Board; delivery of that outcome to researchers is a separate Researcher item |
| Signature or official-copy action | Required signer's verified responsibility; use the event/assignment, not the first user role |
| University and college announcements | Account, preserving current college audience restrictions |
| Role added/removed or account access changed | Account, so a role-removal message remains reachable after removal |
| Mail/thread activity | Resolve the participant's verified workflow responsibility; truly personal account mail may be Account |

Create a producer inventory covering every `notification.create`, `notification.createMany`, and helper call. Record event source, recipient selection, verified responsibility, destination, and deduplication rule. Types such as WORKFLOW_CHANGED and DEFENSE_CONFIRMED are insufficient on their own because multiple recipient responsibilities can receive them.

Implement typed delivery helpers in `apps/api/src/services/notification.service.ts`. Require explicit audience; accept the caller's Prisma transaction client so business changes and deliveries commit together. Integrate `createNotificationsOnce` in `research-workflow-integration.service.ts` with this contract rather than retaining an unscoped alternative. Validate the system-configure notification creation endpoint as well; a supplied workspace must match a current recipient assignment and the intended event.

## 5. API and authorization contract

Proposed scoped contract:

- `GET /api/notifications?scope=workspace&workspaceId=panelist&cursor=...&status=unread` returns one authorized inbox, its total unread count, and a stable cursor. Account uses `scope=account` without a workspace. Support All statuses and Read as well.
- `GET /api/notifications/summary` returns unread counts for eligible dashboards plus a separate account count. Count all matching unarchived rows, independently of pagination.
- `PATCH /api/notifications/read-all` requires an explicit scope and workspace when applicable. It applies only to that authorized inbox. Omitted scope must not silently read all roles.
- `PATCH /api/notifications/:id/read` and `/:id/archive` validate ownership and audience eligibility using the stored delivery. A caller's supplied workspace cannot reclassify a row.

Use strict input validation: unknown scopes, invalid workspace values, invalid cursors, unsupported statuses, and contradictory parameters receive a validation error. A recognized but unassigned workspace receives an access denial. Reuse one server audience predicate across lists, counts, and mutations so their visibility rules agree. Place summary/static routes before any conflicting dynamic routes.

Every request uses the authenticated user ID and current database role assignments. A query parameter, local preference, dashboard selection, or cached token claim never grants a role. Workspace membership does not grant access to the underlying project, college, defense, review, or thread: existing resource-specific authorization remains mandatory when opening or acting on a record.

When a role is removed, its inbox immediately disappears from active reads, counts, and mutations after role refresh; the server denies stale requests regardless of UI state. Preserve stored delivery history. On legitimate reassignment of the same role, historical deliveries can reappear, but record access is rechecked and unavailable records show a clear access message. Do not automatically mark or archive those items on role removal.

For frontend/backend compatibility, introduce scoped reads additively and migrate all callers before requiring scope. Make scoped bulk-read available before switching its UI; retire the old broad behavior through a controlled release. Enable the separated UI only after producer conversion and backfill validation. Document any transitional unscoped reads as legacy behavior, not separation enforcement.

## 6. Navigation and frontend state

Extend `AppNotification` with its scope and target workspace, and expose server counts rather than counting the loaded page. Update the hook, popover, list, all portal notification pages, and the independent student-dashboard consumer.

Resolve role-specific links from the stored target workspace and entity/assignment context. Generic `/research/manuscript` and `/defense/session` links must resolve for that target responsibility, even when the user is currently viewing another dashboard. Preserve validated record identifiers and shared-admin workspace query identity. Never rewrite an assigned Panelist review to Coordinator merely because Coordinator is open.

Validate internal destinations with a shared safe-link helper: reject external origins, protocol-relative destinations, unsupported schemes, malformed URLs, unauthorized portal targets, and workspace/route mismatches. Use a neutral, authorized account destination for account notices; rendering them must not require the revoked role. Notices without a meaningful action remain readable without fabricating a link.

Opening an item follows target eligibility revalidation, any dirty-form guard, navigation, and a successful item-read update with visible retry on mutation failure. Canceling a dashboard switch leaves both the current form and notification unread. A missing or inaccessible record gets a clear message; the notification must never imply that access was granted. Avoid unhandled read-update promises or falsely optimistic success.

Key fetched state by authenticated user ID, inbox scope, selected workspace, status, and cursor. Clear account state on logout/user change. Cancel or ignore obsolete responses on dashboard/filter switches; a slow response must not refill another inbox. Reset pagination and close the popover on active workspace changes. Do not fetch workspace data while account/dashboard eligibility is unresolved.

Keep the existing polling approach initially, with shared fetching/cache where practical so the bell, full list, student dashboard, and switcher do not each issue redundant requests. Invalidate affected scoped lists and summary after read/archive actions; synchronize other tabs through existing polling or a broadcast invalidation. Tabs may remain on different dashboards. Show an error/retry state on fetch failure instead of claiming the inbox is empty or caught up.

Use labeled tabs/selectors and keyboard-operable row actions, visible focus, readable counts, mobile bounds, and light/dark styling. Announce successful role changes and meaningful mutation failures accessibly.

## 7. Migration and rollout

1. Inventory producers and consumers; finalize mappings against existing role and record authorization. Establish shared registry/resolver dependency with the dashboard-switcher work.
2. Add audience fields and constraints compatibly. Mark existing rows LEGACY; new helpers always require WORKSPACE or ACCOUNT.
3. Convert producers in reviewed batches, retaining transactions and deduplication. Add scoped API reads, summaries, and mutations.
4. Backfill in bounded, restartable batches. Infer only from reliable event/assignment/recipient context. Explicit portal links can help when verified; generic `/admin` links, broad types, message text, and current role order are insufficient. A uniquely assigned current role alone does not prove historical intent.
5. Preserve IDs, read timestamps, archives, titles, messages, and deduplication keys where no split is necessary. If reliable evidence requires splitting an old row across roles, preserve its existing read/archive state in each new delivery and use migration-specific deterministic keys.
6. Keep unresolved rows in a separately labeled **Earlier notifications** section available to their owner, excluding them from role counts and bulk actions. Do not relabel them as Account notices. Recheck record access for any links; render without a link if no safe destination can be established. Existing-owner access to historical content is preserved; assess any stricter institutional retention rule before rollout.
7. Migrate every frontend consumer and enable the separated UI after checking classification coverage. Require explicit API scope, remove broad bulk-read behavior, and prohibit new LEGACY writes. Retain legacy-history reads until classification/retention work is complete.

Release rollback disables the new presentation while preserving audience metadata and read/archive history. A rollback must not restore an account-wide bulk mutation that unexpectedly clears other-role work. Track unclassified new writes, unknown workspace errors, duplicate delivery rates, count mismatches, and failed navigation without logging notification bodies.

## 8. Acceptance and verification

| Scenario | Required result |
| --- | --- |
| Panelist + Coordinator | Each dashboard shows only its own role items plus a separately labeled Account section. |
| Dean + Coordinator; RPO + REB + VPAA | Inbox identity follows the selected workspace, including shared `/admin` routes. |
| Read/dismiss one Panelist delivery | Coordinator deliveries retain their own read/archive state. |
| Mark dashboard updates as read | Changes only that dashboard; Account and other dashboards remain unchanged. |
| Read a shared announcement | Account count updates in every dashboard; role badge counts remain unchanged. |
| More than 50 unread items | Counts remain correct; pagination is stable using creation time plus ID tie-breaking. |
| One event legitimately delivered to two roles | Two scoped deliveries; retry creates no extra copies; neither delivery suppresses the other. |
| Open Panelist item while in Coordinator | Correct authorized dashboard and exact assignment open; unsaved edits are protected. |
| Cancel dirty-form switch | Dashboard, form, and unread state remain unchanged. |
| Tampered workspace, foreign notification ID, forged link | No unauthorized list, count, mutation, dashboard, or record access. |
| Role removed during a session | Its inbox/counts disappear; stale requests fail; account removal notice stays reachable. |
| Account logout/login, two tabs, delayed requests | No previous-account or previous-inbox data appears; tabs keep their dashboard selection. |
| Fetch/read/archive failure | Retryable error; no false empty state or successful read/archive state. |
| Single-role account and student dashboard preview | Both use the same scoped contract and correct counts. |
| Legacy row with uncertain audience | Remains in Earlier notifications without being assigned to a guessed role. |
| Migration/retry/rollback | Historical state is retained, backfill is repeatable, and broad bulk reading is not reintroduced. |

Implementation validation should include focused audience/destination/deduplication unit tests, database-backed API tests for visibility/counts/mutations and role revocation, migration checks, and UI behavior tests for switching and failed requests. Run relevant existing web/API/auth tests, repository type checks, and the web build. Verify navigation, keyboard use, mobile layouts, and independent tabs in the browser.

No runtime tests are required or claimed for this planning-only document. If implementation is later pushed, inspect GitHub Actions and deployment for that exact commit and report remote status separately from local results as required by AGENTS.md.
