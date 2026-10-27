# Phase 6: researcher cohort/team lifecycle

## Frontend audit before implementation

- The normal researcher has one exact `POST /api/research` writer:
  `handleCreateResearch()` in `apps/web/src/app/student/dashboard/page.tsx`.
  It creates a workspace, optionally accepts a manual title/abstract, then posts
  registration with the first returned enrollment's workflow ID. Dashboard CTAs,
  an onboarding stepper, a legacy overview and a modal all lead to that handler.
- The dashboard independently chooses `workspaces[0]`; its registration workflow
  uses `enrollments[0]`. `resolveStudentWorkflow()` also falls back to the first
  enrollment and can choose a different process than the selected project.
- `JoinedWorkflows` sends researchers into process browsing before a case exists.
  Tasks and adviser navigation use the same helper, and `WorkflowStartPanel`
  calls the legacy participation endpoint. `TitleProposalPanel` can also create
  participation before submitting proposals. These are normal frontend creation
  paths that must stop creating cases independently of cohort/team start.
- Tasks already preserve stage order, milestone conditions, instance progress
  and enrollment-gated submissions. Existing-case behavior must stay; only its
  process/context selection and pre-case entry points need migration.
- ActiveProjectProvider shares `student-research`, validates selected IDs and
  preserves projectId across navigation. Its selection guard currently captures
  query data; success adoption must use the refreshed cache rather than a stale
  closure after a start response.
- Workspace joins already distinguish workspace invitation codes from legacy
  project invitation codes. The former creates membership only; the latter is
  existing-case compatibility. Its cache refresh and success wording need updating.
- Project overview/title helpers treat workflowDraft as unregistered. New cases
  need an explicit provisional indicator without a manual title-registration form.
- Researcher sidebar/deep pages currently expose research modules even before
  a case. Existing empty states and active case selection must be preserved while
  setup is prioritized for a researcher who has no authorized case.
- Professor `ResearchProjectsOnboarding` contains registration wording, but is a
  coordinator-only component. Coordinator/adviser/panelist/admin behavior and all
  backend compatibility creation paths remain outside this phase.

The web AGENTS file references Next's bundled guide. That path/package is absent
in this checkout. The package manifest and README identify Vite + React, and
`lib/router-compat.tsx` provides the existing Next-style routing imports. This
phase follows that existing stack without adding or migrating frameworks.

## Implementation boundary

Introduce one shared researcher lifecycle resolver and data hook. Cohort and team
choices come only from authorized backend responses; multiple choices require
explicit selection. Existing authorized cases take precedence over setup, including
legacy cohort-null cases and cases retained in closed/archived cohorts.

Team formation writes only the existing cohort-linked workspace endpoint. Start
uses only the Phase 5 workspace start endpoint, with no registration metadata.
Keep backend routes/services/schema, enrollment authorization, execution/stage
semantics, and other roles unchanged. Preserve current theme and component styles.

## Implemented researcher lifecycle

`lib/researcher-lifecycle.ts` is the shared pure resolver. The dashboard and
pre-case Tasks entry use `useResearcherLifecycle()` and the same lifecycle panel.
The hook loads every page of authorized cohort memberships, active workspace
memberships, and authorized cases. It supports the six requested lifecycle states,
plus explicit cohort/team/case selection and an inactive-cohort blocked state.

- Exactly one active cohort is preselected. Multiple cohorts show name, program,
  research track and academic year and require selection. No arbitrary URL ID
  becomes an authorized choice. Multiple teams/cases require selection as well.
- An explicit authorized case wins over remembered setup parameters. An explicit
  cohort/team setup choice clears a remembered unrelated case. Existing cases
  take precedence over new-process validation, including legacy cohort-null
  records, restricted-process records and closed/archived cohort history.
- Team creation posts only cohortId, team name, supported SOLO/GROUP mode and
  supported joining mode to `/api/workspaces`. It creates no case. Existing
  individual workspaces use the same explicit leader start; none are automatic.
- Joining a workspace uses the existing code endpoint and remains membership
  only. Its backend restrictions, including blocked workspace joining after
  research starts, remain unchanged. Existing-case invitation joining remains
  available separately through `/api/research/join/:code`.
- Only an active team LEADER gets the Start Research action. Members see the
  waiting message. Confirmation uses the existing accessible Modal component.
  The action is disabled while pending, and the existing single-flight action
  runner prevents duplicate submissions before a rerender can disable the button.
- Start posts only `/api/workspaces/:id/start-research`, with **no request body**.
  HTTP 201 and idempotent HTTP 200 both adopt the server-returned case. Friendly
  failures cover inactive cohorts, unassigned processes, membership problems,
  out-of-cohort participants, restricted access and a non-leader actor. The UI
  does not repair memberships, change assignments or restore revoked access.
- Create/join/start invalidate cohort, workspace, case, enrollment, student module,
  milestone, dashboard-document, resource, submission-option and process-access
  query prefixes. Start also seeds the returned case/instance and team creation
  seeds the returned workspace, allowing immediate context adoption. Existing
  nested case metadata survives a scalar idempotent response. The active provider
  validates selection against the latest cache rather than a captured query result.
  No hard refresh is required by these actions.
- Case-dependent sidebar items and dashboard shortcuts appear once an authorized
  case is available. Existing Tasks, Documents, Adviser, Consultations, Defense,
  results and files keep their existing case selection and authorization.
- Generated titles carry a pending indicator in the lifecycle panel, overview,
  dashboard cards/selectors, Tasks, Documents, Defense and file selectors. Adviser
  request details show title pending. Existing recorded title history and legacy
  title editing remain; no cohort title-editing or approval mechanism was added.

## Writers and process ownership

| Relationship | Before | After | Disposition |
| --- | ---: | ---: | --- |
| Exact frontend `apiClient.post('/api/research', ...)` case creation | 1 | 0 | REMOVE: dashboard handler/form retired |
| Frontend legacy `/api/workflows/:id/participation` creation | 2 | 0 | REMOVE: start panel retired; proposal fallback removed |
| Cohort start endpoint caller | 0 | 1 | MIGRATE: canonical frontend start action |
| Production `resolveStudentWorkflow` callers | 3 | 3 | MIGRATE: dashboard, Tasks and adviser hook remain pinned-case based |
| First-enrollment selection in normal researcher process context | Present | 0 | REMOVE: enrollment cannot choose the process |
| Backend registration/participation/provisioning routes/services | Existing | Unchanged | INTENTIONAL compatibility |

The selected case's stored WorkflowInstance determines process identity for both
new and legacy cases. A requested workflow ID cannot switch to another enrolled
process or borrow another case's progress. Matching enrollment remains a separate
authorization requirement; `workflowAccessRemoved` is still honored. Tasks keep
their pinned current stage, milestone conditions, submission checks and existing
researchId-based stage start. An access invitation is not a case-creation action.

## Final search classification

Search scope: all `apps/web/src`, with production researcher paths distinguished
from tests and other roles. Searches included every phrase and symbol requested
in the Phase 6 prompt, and AST inspection checked frontend POST destinations.

| Remaining usage / removed dependency | Classification | Reason |
| --- | --- | --- |
| Register Research Project / Register Project CTAs, registration form, handler, enrollment-first selector, registration-unlock instructions | REMOVE (completed) | No normal researcher creation path remains |
| Shared lifecycle/context, team setup/join, leader start, pending-title presentation, access invitation wording | MIGRATE (completed) | Cohort/team/case flow replaces registration ownership |
| `resolveStudentWorkflow()` declaration and three production callers | INTENTIONAL | Compatibility name retained; implementation now uses the pinned case and independent enrollment authorization |
| `workflowAccessRemoved` in lifecycle, process helper, Tasks and overview | INTENTIONAL | Restriction signal preserved; no creation, navigation fallback or access restoration grants process authorization |
| GET `/api/research`, existing-case document/file/team mutations, provider IDs and project interfaces | INTENTIONAL | Technical ResearchProject remains the case model; these calls do not create a case |
| `/api/research/join/:code` preview/join | INTENTIONAL | Existing-case membership, including legacy invitations; not registration |
| `registeredAt`, `workflowDraft`, `Registered Research Project` title label and existing legacy edit behavior | LEGACY READ COMPATIBILITY | Preserves recorded registration/title history; provisional cases take the pending-title branch and cannot open the legacy edit modal |
| `ResearchProjectsOnboarding.tsx` lines 30/54 registration copy | INTENTIONAL scope boundary; MIGRATE in a later coordinator phase | Coordinator-only onboarding, not rendered in the researcher journey; changing coordinator behavior is excluded |
| Adviser dashboard's two `Research title not registered` fallbacks | INTENTIONAL scope boundary; MIGRATE in a later adviser phase | Adviser-role presentation is explicitly outside this phase |
| Regression-test strings for old registration terms | INTENTIONAL | Negative assertions prevent the obsolete entry points returning |
| `ResearchType.workflowId`, `enrollments[0]`, `handleCreateResearch`, registration-unlock and title-required startup dependencies in production researcher paths | REMOVE (completed / zero occurrences) | No runtime frontend dependency remains |

The legacy case-code preview response does not expose `isTitleProvisional`.
That unchanged backend preview supplies a stored title as record identity; the
authorized case view displays the explicit pending indicator after joining.
No frontend rule guesses title approval from a generated title string.

## Tests and validation

New focused tests cover lifecycle resolution, published-process prerequisites,
explicit selection and invalid context, active leader/member distinctions,
SOLO support, historical/legacy cases, pinned process ownership, restricted
access, actual HTTP error messages, team creation/join without provisioning,
body-free start, both success statuses, cache refresh/adoption, duplicate start,
cohort pagination, lifecycle rendering, dashboard rendering and navigation.
An AST regression test rejects exact frontend manual registration and legacy
participation creation calls. Existing title/process context tests were updated;
the retired JoinedWorkflows component's obsolete tests were removed.

The database integration suite passed **110 tests in 14 files**, including the
20 explicit workspace-start HTTP tests, 32 provisioning tests, cohort access,
legacy registration/participation, revocation and downstream process behavior.
The guarded runner verified the isolated local `advisio_test` database, found no
pending migrations and verified fixture teardown. The test database was stopped.

Browser interaction/visual verification could not be completed: browser control
is disabled in Work settings, and the native browser tool stopped before input
because it could not reliably verify the browser URL. No browser interaction
occurred. Server-rendered component/dashboard tests are automated rendering
checks, not a claim of an end-to-end browser or responsive visual review. The
temporary isolated UI fixture server was stopped.

## Preserved boundaries and deferred work

No API, service, Prisma schema, migration, workflow publication, enrollment policy,
currentStageId/progression behavior, requirement engine, adviser/panelist/Dean/Admin
behavior or coordinator dashboard was changed. Legacy backend creation remains.
No old rows were backfilled. No frontend visual theme was changed.

Deferred: title lifecycle/approval redesign, requirement instances, parallel/DAG
execution, coordinator SOLO/GROUP policy, automatic solo provisioning, legacy
backend removal/backfill, and other-role onboarding copy. No Phase 7 work started.
At the implementation-validation checkpoint, changes were uncommitted/unpushed;
remote checks and deployment must be verified separately for the checkpoint commit.

## Exact files changed

All paths below are relative to the repository root. Changes are limited to web
frontend source/tests and this report; no package/lockfile changes were needed.

| File | Change |
| --- | --- |
| `apps/web/src/app/student/dashboard/page.tsx` | Replace registration with shared lifecycle; preserve selected context and gate case-only shortcuts |
| `apps/web/src/app/student/dashboard/page.test.tsx` | Add actual dashboard render coverage for cohort/team/member states |
| `apps/web/src/app/student/adviser-pool/page.tsx` | Require started case for normal entry; pending-title wording; preserve adviser requests |
| `apps/web/src/app/student/defense/page.tsx` | Pending-title indicators and cohort/team empty-state wording only |
| `apps/web/src/app/student/documents/page.tsx` | Read provisional flag and mark generated titles |
| `apps/web/src/app/student/group-files/page.tsx` | Pending-title indicators in case selectors only |
| `apps/web/src/app/student/join-group/page.tsx` | Refresh context after membership joining; direct to returned team/case |
| `apps/web/src/app/student/tasks/page.tsx` | Pinned-case process context; shared setup entry; remove enrollment-first/legacy start UI; preserve gating |
| `apps/web/src/app/student/workflows/join/page.tsx` | Access terminology and shared context refresh; existing access endpoint retained |
| `apps/web/src/components/dashboards/student/StudentProjectOverview.tsx` | Pending title/access wording; keep old editing limited to legacy cases |
| `apps/web/src/components/dashboards/student/StudentSidebar.tsx` | Setup priority before an authorized case; existing modules afterward |
| `apps/web/src/components/dashboards/student/StudentSidebar.test.tsx` | Add before/after-case navigation tests |
| `apps/web/src/components/dashboards/student/StudentTopbar.tsx` | Research/team labels |
| `apps/web/src/components/research/ResearcherLifecyclePanel.tsx` | New shared lifecycle cards, selection, team form and start confirmation |
| `apps/web/src/components/research/ResearcherLifecyclePanel.test.tsx` | Add lifecycle/access/history/legacy rendering tests |
| `apps/web/src/components/workflow/JoinedWorkflows.tsx` | Delete obsolete enrollment-first normal entry |
| `apps/web/src/components/workflow/JoinedWorkflows.test.tsx` | Delete two obsolete tests with the retired component |
| `apps/web/src/components/workflow/WorkflowStartPanel.tsx` | Delete obsolete frontend legacy participation creator |
| `apps/web/src/components/workflow/TitleProposalPanel.tsx` | Remove pre-case participation creation; preserve existing case proposal/review behavior |
| `apps/web/src/components/workflow/WorkflowAccessInbox.tsx` | Research process access wording; authorization behavior unchanged |
| `apps/web/src/hooks/use-researcher-lifecycle.ts` | New shared authorized data/state/selection hook and cohort pagination |
| `apps/web/src/hooks/use-researcher-lifecycle.test.ts` | Add pagination coverage |
| `apps/web/src/hooks/use-student.ts` | Adviser context follows selected pinned case; no pre-case pool/creation path |
| `apps/web/src/lib/researcher-lifecycle.ts` | New lifecycle resolver and start-error translations |
| `apps/web/src/lib/researcher-lifecycle.test.ts` | Add lifecycle, selection, legacy, authorization and HTTP-error cases |
| `apps/web/src/lib/researcher-lifecycle-actions.ts` | New team create/join/start and context-refresh actions |
| `apps/web/src/lib/researcher-lifecycle-actions.test.ts` | Add endpoint/payload, creation separation, cache, status, failure and duplicate coverage |
| `apps/web/src/lib/researcher-creation-boundary.test.ts` | Add AST guard against frontend manual registration/legacy participation creation |
| `apps/web/src/lib/student-project-overview.ts` | Provisional-title/read compatibility and case-aware next-step wording |
| `apps/web/src/lib/student-project-overview.test.ts` | Update wording expectations and add explicit provisional flag coverage |
| `apps/web/src/lib/student-workflow-context.ts` | Pinned-case process authority; enrollment remains separate authorization |
| `apps/web/src/lib/student-workflow-context.test.ts` | Replace obsolete enrollment-first expectations with pinned-case/access isolation coverage |
| `apps/web/src/providers/active-project-provider.tsx` | Validate immediate returned-case adoption against current cache |
| `docs/researcher-frontend-lifecycle.md` | Before/after audit, implementation impact, exact scope and verification report |

## Local validation results

| Check | Result |
| --- | --- |
| Focused lifecycle/actions/rendering/context/title tests | PASS |
| `npm run type-check` | PASS, all 9 tasks |
| `npm run build` | PASS, all 6 tasks; existing Vite chunk-size warning remains |
| `npm run lint` | PASS |
| `npm test` | PASS, 880 unit executions: web 285, API 483, validations 64, auth 32, email 16; integration tests separately enabled below |
| `npm run test:integration:local` | PASS, 110 tests / 14 files; no pending migration; fixture teardown verified |
| `git diff --check` | PASS |
| API/packages/schema/workflow/configuration diff | None |

At local validation, remote checks/deployment had not yet run for Phase 6 and
Phase 5 commit `a0ba718` was HEAD. The Phase 6 checkpoint uses
`refactor/cohort-driven-research-flow`; its push verification is reported separately.

Phase 6 implementation and automated acceptance are complete. Browser smoke and
narrow-width checks remain pending pre-merge manual verification, rather than
failed Phase 6 acceptance criteria. Further architecture work may continue.

## Required preview smoke test before merging into main

These checks remain **PENDING**. Automated tests above do not substitute for
interactive browser and responsive verification. This is a pre-merge checkpoint;
it does not require starting or blocking another architecture phase.

First confirm the preview's deployment commit contains the reviewed Phase 6
changes. These checks were documented before the Phase 6 checkpoint was committed
and pushed; verify the resulting preview before testing. Use disposable preview
accounts/data in a verified non-production database; team creation/join/start
must not be exercised against live academic records as test fixtures.

| Path | Expected browser result | Result |
| --- | --- | --- |
| Active cohort, no team | Correct cohort/process context; Create/Join Research Team; no manual registration or premature Start Research | PENDING |
| Create cohort-linked team | Correct cohortId in team request; team forming state; no case/instance until explicit start; no hard refresh | PENDING |
| Ordinary member joins | Existing code/invitation behavior; correct team; waiting for team leader; no usable leader start action | PENDING |
| Leader starts research | Confirmation, pending/disabled action, body-free start endpoint, successful active case and Continue Research; no stale Start action | PENDING |
| Legacy project | Cohort-null existing case opens normally with its stored title/process; no forced cohort setup or retroactive start | PENDING |
| Tasks/Documents/Adviser after start | Correct case context persists; existing requirements/resources/submissions/access restrictions and adviser behavior work | PENDING |
| Narrow/mobile viewport | Resize once; cohort/team choices, team form, confirmation, navigation and primary actions remain visible/usable without clipping | PENDING |

Record the deployment commit/URL, account role, browser/viewport, result and any
defect for each path. Keep this separate from local validation and from remote
Actions/deployment success. Browser access was rechecked after the user's smoke
test note and is still disabled in Work settings. No checks in this table have
been marked passed without actual browser interaction.
