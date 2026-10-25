# Multi-role dashboard switcher implementation plan

Status: Planned; application implementation has not started.
Updated: 2026-10-26 (Asia/Manila)

Scope: Implementation plan only. The attached profile-menu screenshot is the placement reference; no application changes, role assignments, or deployment are part of this planning task.

## 1. Intended outcome

A person signs in once and switches between dashboards for roles already assigned to their account.

Primary examples:

- An account with `RPO` and `RESEARCH_COORDINATOR` switches between Dean's Office and Professor Coordinator.
- An account with `PANELIST` and `RESEARCH_COORDINATOR` switches between Panelist and Professor Coordinator.
- An account with one role sees its dashboard name without a switching menu.
- After login, accounts with two or more eligible dashboards receive a short onboarding screen explaining their roles and asking which dashboard to enter.

In the interface, call the control **Switch dashboard**. Place it in the dropdown opened by clicking the user's name/avatar in the topbar, directly below the identity header and above Dark Mode, matching the supplied screenshot. Only users with two or more eligible dashboards see this control. Use **Your dashboards** as the options heading. Research teams, research workspaces, projects, and workflow enrollment remain separate concepts.

The user signs into one account, chooses a starting role dashboard, and can change dashboards from that same profile menu without signing in again. The selected dashboard controls visible navigation and role labels; it does not change the user's assigned roles.

The first release opens the selected role's dashboard home. Restoring an arbitrary last document, defense, or form is a later enhancement.

## 2. Verified foundation and gaps

| Area | Current code | Planned change |
| --- | --- | --- |
| Multiple role assignments | Prisma `UserRole`; `UserManagement.tsx`; `PUT /api/users/:id/roles` | Reuse verified assignments and existing eligibility checks. |
| User session | `auth-provider.tsx` exposes `user.roles` | Keep one authenticated identity; expose fresh dashboard eligibility from that identity. |
| Login destination | Email and Google login use `roles[0]`; the login page has separate routing conditions | Route multi-role accounts through dashboard onboarding; resolve single-role destinations directly. |
| Portal protection | `ProtectedRoute.tsx` checks role arrays, but has an incomplete first-role fallback map | Use one shared dashboard registry for eligibility and fallback destinations. |
| Profile selection menu | `AppTopbar.tsx` contains the screenshot's identity header, Dark Mode, My Profile, Account Settings, and Sign Out | Insert Switch dashboard below the identity header; derive its choices and active-role badge from validated dashboard state. |
| Portal navigation | `AppSidebar.tsx` and `AppTopbar.tsx` are shared by portals | Keep sidebar navigation and topbar search/profile/settings links aligned with the selected dashboard. |
| Dean identity | Dean demo accounts use `RPO`; `/admin` is shared with `REB` and `VPAA`, with branding/navigation selected by role-priority conditions | Preserve existing role values and make shared-portal dashboard identity follow the explicitly selected workspace. |
| Authorization | API authentication currently unions permissions from all assigned roles | Preserve the authorization model for this navigation feature; verify target-role and record-scope checks. Do not claim that selecting a dashboard alone isolates API permissions. |
| Routing runtime | Vite + React Router, with compatibility aliases for `next/link` and `next/navigation` | Implement against the actual React Router runtime. |

## 3. Shared dashboard registry

Add a serializable registry in `packages/auth/src/dashboard-workspaces.ts`, exported through a browser-safe auth package entry point. Add the auth package as an explicit web dependency when consuming it. Keep Lucide components and visual styling in the web app; do not import server authentication code into the frontend bundle.

Each entry defines a stable workspace ID, canonical institutional role, display label, short description, route prefix, home URL, and display order. Frontend and API tests should use the same role values.

| Workspace ID | Assigned role | Display label | Home |
| --- | --- | --- | --- |
| `researcher` | `RESEARCHER` | Researcher | `/student/dashboard` |
| `adviser` | `ADVISER` | Adviser | `/adviser/dashboard` |
| `panelist` | `PANELIST` | Panelist | `/panelist/dashboard` |
| `coordinator` | `RESEARCH_COORDINATOR` | Professor Coordinator | `/professor/dashboard` |
| `dean` | `RPO` | Dean's Office | `/admin/dashboard?workspace=dean` |
| `ethics` | `REB` | Ethics Board | `/admin/dashboard?workspace=ethics` |
| `academic-affairs` | `VPAA` | Academic Affairs | `/admin/dashboard?workspace=academic-affairs` |
| `system-admin` | `SYSTEM_ADMIN` | System Administration | `/system-admin/dashboard` |

Dean's Office backed by `RPO` follows existing application behavior. Reference data describes RPO as Research & Publications Office Staff; do not create a new `DEAN` role or migrate assignments as part of this feature. A future separation of Dean and RPO requires its own data and permission design.

Legacy route aliases such as `PROFESSOR`, `ADMIN`, and `STUDENT` must be reviewed for compatibility. An alias in a URL or saved setting never grants a canonical role. System administrators do not automatically receive every faculty dashboard merely because some current routes allow administrative access.

## 4. Selection and navigation rules

Add `DashboardWorkspaceProvider` inside `BrowserRouter` and the existing authentication context, before portal children render. Expose `availableWorkspaces`, `activeWorkspace`, `switchDashboard`, and the validated default destination.

Resolution order:

1. A valid authorized portal URL determines the current dashboard. Browser Back, Forward, refresh, and direct links must agree with the selector.
2. Shared `/admin` routes use the validated `workspace` query value to distinguish roles with the same prefix. Preserve this value in admin sidebar links, profile links, settings, and relevant redirects.
3. A legacy admin URL without that value uses the user's valid remembered admin workspace, then registry order. Canonicalize the URL with replacement, without a redirect loop.
4. After login and any required account setup, accounts with two or more eligible dashboards enter `/choose-dashboard`. A safe, authorized internal return URL preselects its corresponding dashboard and is preserved through onboarding; it does not skip onboarding. Otherwise preselect the user's valid remembered workspace, then the first available entry in registry order. A single-role account continues directly to its authorized return URL or dashboard home.
5. Unknown or unauthorized destinations resolve to a valid dashboard with a clear message. An account with no recognized eligible role receives an access-help screen rather than an arbitrary student dashboard.

Persist the last chosen workspace by user ID as a login preference. For a multi-role account this preselects a card on the next login; it does not automatically skip onboarding. Once onboarding is complete, the current tab's URL remains authoritative: changing the preference in another tab must not navigate this tab. Clear account-specific in-memory state on logout or user changes. Treat storage as untrusted and tolerate storage failures.

Switching opens the target home URL with a new history entry. Do not carry project IDs, workflow filters, defense IDs, document IDs, or unrelated query parameters into the destination. The existing research-project selection remains a separate feature.

### Post-login onboarding

Add an authenticated `/choose-dashboard` page for multi-role accounts. This is part of the login journey, followed by ordinary dashboard switching through the name/profile menu.

Login sequence: authenticate -> hydrate current account -> complete required academic/account setup -> resolve eligible dashboards -> choose dashboard when there are two or more -> enter the selected dashboard. A single eligible dashboard skips the chooser; zero eligible dashboards opens access help.

Flow:

1. Sign in using email/password or Google.
2. Hydrate the account and its complete verified role list. Finish any required existing academic/account setup first; refresh the profile afterward. Pending, suspended, or unauthenticated accounts cannot proceed to dashboard selection.
3. Count eligible dashboard entries, not raw role strings or aliases. Two or more entries open dashboard onboarding. One entry goes directly to its dashboard or authorized return URL. Zero entries open access help.
4. Display the user's name and college, the title **Choose your dashboard**, and the text **Your account has multiple roles. Choose where you want to start. You can switch dashboards anytime from your profile menu.**
5. Show one selectable card per assigned dashboard with icon, role name, short responsibility description, scope when available, and a clear selected state. Dean/Coordinator accounts see Dean's Office and Professor Coordinator; Panelist/Coordinator accounts see Panelist and Professor Coordinator.
6. Provide one primary action, **Continue to [selected dashboard]**, plus Sign out. Use an accessible radio group and native form controls. Stack cards on mobile and retain the app's college branding and light/dark styling.
7. On Continue, refresh/revalidate current role eligibility. If successful, record the selection, mark the login journey complete for this tab/session, and replace the onboarding route with the selected dashboard. If the selected role was removed, update the cards and explain the change. If validation fails due to a network problem, retain the selection and offer retry.

Show this concise onboarding/chooser on every fresh multi-role login. Do not show it on every page visit, refresh after completion, or profile-menu dashboard switch. Remembering the previous selection reduces effort; automatically skipping onboarding is not part of this release.

Keep the login-journey completion marker scoped to the current authenticated user and tab/session. Reset it after each successful fresh login and clear it on logout or account changes. A restored session with no completion marker goes through the chooser once. The marker is presentation state, never a role grant or server authorization credential; do not store a token in the marker or URL. Use a tab-local fallback when browser storage is unavailable.

Portal guards must route a newly signed-in multi-role account with incomplete onboarding to the chooser, preserving only a validated internal return destination. After completion, ordinary authorized direct links work without reopening onboarding. Visiting `/choose-dashboard` directly with a single role resolves to that role's destination; an unauthenticated visitor goes to login. Avoid login/chooser/portal redirect loops.

For an invitation or other record link, preselect its authorized dashboard. Continuing with that dashboard resumes the original destination, including validated query/hash data. Choosing a different dashboard intentionally opens that dashboard's home instead. Never redirect to an external URL or resume a destination for a removed role.

Existing researcher registration onboarding and Google academic setup keep their distinct purpose. Update their completion navigation only where needed to re-enter the shared post-login resolver. The existing Google setup page currently redirects directly to `/student/dashboard`; do not let that hardcoded destination bypass multi-role selection after setup. Audit `app/(public)/first-login-setup/page.tsx`, which currently chooses a destination from a query parameter: that parameter must never become dashboard eligibility or bypass the authenticated resolver.

## 5. Selector interface

Create `apps/web/src/components/layout/DashboardSwitcher.tsx` and render it inside the existing profile dropdown in `AppTopbar.tsx`.

Profile-menu order:

1. Existing avatar, name, email, and badge showing the active dashboard role.
2. **Switch dashboard** row with a dashboard icon and expand/collapse chevron, visible only for multi-role accounts.
3. When expanded, **Your dashboards** and one option per eligible role, including a checkmark and **Current** label for the active dashboard.
4. Existing Dark Mode, My Profile, and Account Settings controls.
5. Existing university branding and Sign Out.

- Expand the options within the same dropdown; no hover-only nested menu. Each option shows the dashboard label and a short responsibility description. Use the same registry data for these options and the onboarding cards.
- Selecting another dashboard revalidates eligibility, runs the unsaved-changes guard, navigates to its home, updates the topbar badge and portal navigation, and closes the dropdown after success. Disable repeat selection while switching. Selecting the current dashboard closes the menu without navigation or data reset.
- Keep the current dashboard and menu available if refresh fails; show a concise retry message. If a role has been removed, refresh the options and explain why it is unavailable.
- Labels include Professor Coordinator, Panelist, and Dean's Office consistently across the sidebar and profile menu. An account with one eligible dashboard keeps its normal role badge and existing profile actions, with no switch row or role list.
- Keep the avatar trigger available on mobile where the user's name is hidden. Bound dropdown width to the viewport and allow vertical scrolling when needed; use full-width, touch-sized options. Sidebar collapse does not affect access to this topbar control.
- Use existing college theme tokens, light/dark surfaces, spacing, and Lucide icons. With at most eight canonical roles, omit search and favorites from the first release.
- Use native buttons in the profile popover, with `aria-expanded`/`aria-controls` on the switch row and `aria-current` on the active dashboard. Preserve normal Tab navigation; support Enter/Space, Escape, outside-click dismissal, and focus restoration to the avatar trigger. Avoid adding menu roles without their required keyboard behavior.
- Provide a short status announcement after a successful switch. When unsaved-changes confirmation opens, give it focus; Stay returns focus to the switch control with the form intact.

Do not show Create workspace or Join with code: this menu selects institutionally assigned dashboards. Role changes continue through the verified System Administration flow.

## 6. Integration and access behavior

### Authentication and profile

Replace duplicated first-role routing with the registry and one post-login resolver. Both password and Google login must resolve from the hydrated account's full role list and enter multi-role onboarding when applicable, including handling temporary profile-load failures without assuming Researcher access. Required academic/account setup takes precedence; its completion returns to the same resolver rather than selecting a dashboard independently.

Add a reusable profile-refresh operation to `AuthProvider`. Refresh on window focus and after relevant role updates; on an authorization failure, refresh eligibility once and handle a genuinely removed role without repeatedly retrying. Avoid redirecting an account merely because a request failed due to a network outage.

Use the existing authenticated `GET /api/auth/me` for role hydration/revalidation. Dashboard selection requires no new login, role-assignment request, or token replacement. Keep role management in the existing verified `PUT /api/users/:id/roles` flow. Return the hydrated account or resolved next step from authentication rather than a single `role` string; do not navigate while hydration is incomplete. Preserve Google `needsAcademicSetup` and the validated pending return across that transition.

Keep the user's name, email, and identity shared. Active role labels come from the resolved dashboard rather than `user.roles[0]` or independently editable profile overrides.

### Portal guards and shared administration

Use registry helpers in `ProtectedRoute.tsx`, login routing, and portal navigation. Preserve resource-specific route guards and server checks.

Build on the role-aware branding/navigation already present in `admin/layout.tsx`. Replace its role-priority conditions (`isEthicsOnly` and `isVpaa`) with the explicitly selected authorized workspace, so an account holding RPO and REB or VPAA can enter each distinct view. Preserve current single-role behavior and official-copy restrictions. Review each admin navigation item against existing endpoint permissions and role scope. An unsupported role/view combination must produce an access message, not a misleading dean screen.

Existing System Administrator support access in individual routes should remain an explicit, tested policy. It must not be interpreted as automatic assignment to Coordinator or Panelist.

### Data, requests, and notifications

Review shared query keys and component state. Include user, dashboard identity, and applicable record IDs in keys for results whose content depends on the dashboard. Keep account-wide caches separate. Cancel obsolete reads on switch and prevent late responses from populating the destination view. An in-flight mutation stays associated with its original record and action.

Notifications retain their authorized destination workspace. Opening a Panelist assignment while in Coordinator mode resolves the Panelist dashboard when the account has that role. Do not blindly rewrite a notification to the current portal. Account-wide versus role-specific inbox/calendar behavior must follow existing service scope.

### Unsaved forms

Add a lightweight dirty-form registration mechanism and connect the switch action to it. For unsaved evaluations, rubric entries, workflow forms, or manuscript edits, offer Stay and Discard changes. Offer Save draft only where a real draft-save operation exists. If saving fails, keep the current dashboard and form. Use the current routing architecture; do not introduce a router migration just for the selector.

### Server authorization boundary

The selector never writes role assignments, generates an elevated token, or makes a client-provided role authoritative. The API continues to load current assigned roles and verify permissions plus college/project/assignment scope.

Test the primary multi-role combinations against critical approval, coordinator, and evaluation endpoints. Where an operation records an acting role, validate that role against current assignments and that operation; never infer it from whichever assigned role appears first. Preserve existing signature-role attribution and academic conflict-of-interest rules across dashboard switches.

Strict isolation to only the selected role's permission set would require explicit validated request context across JSON requests, uploads, downloads, realtime connections, and legacy clients. That is a separate authorization change, not a property to promise from this dashboard selector.

## 7. Delivery sequence

### Phase 1 — Registry, login routing, and onboarding

- Add registry, eligibility, active-dashboard, canonical URL, default, and safe-return helpers.
- Add provider and user-keyed preference storage.
- Build the authenticated onboarding page with role cards, responsibility descriptions, remembered preselection, role revalidation, and Continue/Sign out actions.
- Integrate password/Google login, required-setup completion, onboarding eligibility/session state, route guards, shared admin identity, and redirects.
- Exit: Dean/Coordinator and Panelist/Coordinator accounts enter the chooser after login; single-role accounts proceed directly; refresh, direct links, and browser history resolve correctly after completion.

### Phase 2 — Dashboard selector and consistent identity

- Build the expandable selector inside the name/profile dropdown in `AppTopbar.tsx`; validate desktop and mobile avatar entry points.
- Align topbar/profile labels and admin navigation with the selected dashboard.
- Reuse existing verified role-management UI and API; add a concise preview of the dashboards enabled by selected roles if useful.
- Exit: multi-role users choose their starting dashboard during login and can switch assigned dashboards afterward without another login; unassigned choices never appear.

### Phase 3 — Workflow continuity and release checks

- Connect dirty forms, request cancellation, context-sensitive query keys, notification destinations, and eligibility refresh.
- Validate server access for the primary multi-role combinations and removed-role behavior.
- Check themes, responsive layout, keyboard interaction, and one-role accounts.
- Verify setup-before-onboarding ordering, per-login completion reset, invitation return preservation, failed eligibility refresh, and role changes while the chooser is open.
- Exit: acceptance matrix passes; sensitive forms and stale data behave correctly during switches.

Complete all three phases before enabling the selector for general use. No database schema migration is expected for the initial feature; reuse `UserRole`, existing verification, and existing audit records.

## 8. Main implementation touchpoints

| Location | Responsibility |
| --- | --- |
| `packages/auth/src/dashboard-workspaces.ts` (new), `src/index.ts` | Shared identifiers and mappings. |
| `apps/web/package.json` | Explicit shared-auth dependency if used by frontend. |
| `apps/web/src/providers/dashboard-workspace-provider.tsx` (new), `App.tsx` | Tab-local resolution, switching, preference, and lifecycle. |
| `apps/web/src/components/layout/DashboardSwitcher.tsx` (new), `AppTopbar.tsx` | Switch dashboard row/options in the profile dropdown and current-role badge. |
| `apps/web/src/components/layout/AppSidebar.tsx`, portal layouts | Navigation, branding, and links follow the active dashboard; preserve shared admin workspace identity. |
| `apps/web/src/lib/dashboard-navigation.ts` (new), `portal-navigation.ts`, `routes.tsx`, `ProtectedRoute.tsx` | Canonical destinations and authorization-aware navigation. |
| `apps/web/src/providers/auth-provider.tsx`, `app/(public)/login/page.tsx` | Complete role hydration, profile refresh, consistent login destination. |
| `apps/web/src/app/(public)/choose-dashboard/page.tsx` (new), `routes.tsx` | Authenticated multi-role onboarding, accessible role cards, session completion, and validated continuation. |
| `apps/web/src/lib/post-login-navigation.ts` (new), `app/(public)/google-onboarding/page.tsx`, `app/(public)/first-login-setup/page.tsx`, relevant registration completion handlers | Shared setup/onboarding/dashboard order and safe pending-return handling. |
| `apps/web/src/app/admin/layout.tsx`, `hooks/use-profile.ts` | Shared-portal identity and role labels. |
| `apps/web/src/hooks/use-notifications.ts`, `lib/notification-navigation.ts` | Correct cross-dashboard destinations. |
| `apps/web/src/components/system-admin/UserManagement.tsx` | Existing verified role assignment and dashboard labels. |
| `apps/web/src/lib/query/query-client.ts`, affected query hooks/forms | State isolation, cancellation, and dirty-form integration. |
| `apps/api/src/middleware/auth.ts`, critical dean/workflow/evaluation/signature routes | Verify existing multi-role authorization and acting-role attribution; make targeted corrections if tests expose gaps. |

## 9. Acceptance matrix and validation

| Scenario | Expected result |
| --- | --- |
| Click name/avatar with multiple roles | Profile dropdown shows Switch dashboard below identity and above Dark Mode; expanding it lists only assigned eligible dashboards. |
| Choose another dashboard from profile | Revalidation succeeds, target home opens without another login, badge/navigation update, and dropdown closes. |
| Choose the current dashboard | Dropdown closes without navigation, refetching, or discarding the current form. |
| Dean + Coordinator | Both choices appear; selecting either opens its dashboard and correct sidebar. |
| Panelist + Coordinator | Both dashboards work in the same login session. |
| Single-role account | Goes directly to its authorized destination; static dashboard identity, no multi-role onboarding or switching menu. |
| RPO + REB or VPAA | Shared admin URLs retain explicit workspace identity and appropriate navigation. |
| System Admin alone | System Administration appears; faculty dashboards are not fabricated assignments. |
| Missing role or tampered preference/query | No access grant; validated fallback or access-help message. |
| Password and Google login | Both hydrate all roles and show onboarding for two or more eligible dashboards. |
| Multi-role onboarding | Assigned role cards explain responsibilities; Continue opens the selected dashboard; Sign out ends the session. |
| Remembered selection | Valid previous dashboard is preselected; fresh multi-role login still shows onboarding. |
| Required academic/account setup | Setup completes first; refreshed account enters the shared resolver and onboarding when eligible. |
| Researcher invitation after login | Authorized return is preserved through setup/onboarding; choosing its dashboard resumes the invitation. |
| Different dashboard selected from an invitation | Opens the chosen dashboard home without an unexpected later redirect. |
| Role removed while chooser is open | Continue cannot enter the removed role; choices refresh with an explanation. |
| Network failure on Continue | Retains selection and offers retry; no assumed role or false completion. |
| Chooser refresh, completion, logout, and relogin | Selection remains usable; completed session does not repeatedly onboard; fresh multi-role login starts onboarding again. |
| Direct chooser URL | Authentication is required; one-role accounts resolve directly; no redirect loops. |
| Refresh / Back / Forward | Correct dashboard identity and navigation without loops or label flicker. |
| Two tabs in different dashboards | Switching one does not navigate the other. |
| Logout and a different user's login | No previous user's preference, data, or identity leaks. |
| Unsaved evaluation or failed draft save | User can stay with edits intact; no silent discard. |
| Slow response during switching | Previous dashboard data does not populate the destination. |
| Role revoked during the session | Next protected request is denied by current server roles; refreshed choices remove the role. |
| Cross-dashboard notification | Opens the authorized target role and record. |
| Approval, evaluation, and signature | Existing permission, college/assignment checks, and valid role attribution hold for multi-role accounts. |
| Mobile avatar, collapsed sidebar, dark mode, keyboard | Profile switcher remains reachable; labels, viewport bounds, scrolling, focus, dismissal, and target sizing remain usable. |

Use focused unit tests for registry, role filtering, default resolution, query preservation, safe return URLs, and invalid preferences. Add behavior tests for routing/selection and database-backed API integration cases for relevant role combinations. Run web/API/auth type checks, applicable existing tests, and the web build. Do manual browser verification for the acceptance scenarios that depend on layout, focus, form editing, and multiple tabs.

For implementation, run `npm run type-check`, `npm run test --workspace=web`, `npm run test --workspace=@research-management/auth`, relevant API tests, and `npm run build --workspace=web` after building shared dependencies. If implementation is pushed, inspect GitHub Actions and deployment results for that exact commit as required by `AGENTS.md`; report local verification and remote CI/deployment separately, including pending results.

No runtime tests were executed for this planning document. Implementation validation belongs to the phases above.
