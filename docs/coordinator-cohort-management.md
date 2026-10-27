# Phase 7: coordinator cohort management

## Audit before implementation

The coordinator portal uses `/professor` routes and the Vite/React router compatibility
layer. The web AGENTS guide references a Next documentation directory that is absent
in this checkout; existing Vite routing and components are retained.

| Existing UI | Classification | Impact |
| --- | --- | --- |
| Professor sidebar/topbar: Course Professor, Workflow, Research Projects | MIGRATE TO COHORT | Expose Research Cohorts and separate Process Templates; use coordinator labels |
| `ResearchProjectsOnboarding` | REMOVE FROM NORMAL COORDINATOR FLOW | Teaches create workflow → add participants → register projects; replace with cohort setup guidance |
| Dashboard monitoring `registeredProjects` filter | MIGRATE TO COHORT | Filters out workflowDraft/title-proposal cases; show resulting cases including provisional titles |
| `WorkflowParticipantsCard`, `WorkflowAccessManager`, enrollment counts and invitations | PROCESS ACCESS ONLY | Actual legacy process authorization, never academic membership; retain explicit access management |
| Existing builder, topics, stages, milestones, tasks and publication | KEEP | Reusable process template; no engine/publication changes or complete builder terminology refactor |
| Existing case reviews, documents, defense and progress | KEEP | Preserve case/instance identity and authorization |
| Legacy professor routes, technical workflow IDs and enrollment revoke APIs | LEGACY COMPATIBILITY | Internal identifiers/routes remain; no record/model renaming |

## Existing contracts inspected

- Existing cohort mutation/list/member/assignment routes and validation/service policy
  supply management operations; researcher discovery needed the approved read-only
  addition documented below. Academic identity is immutable after
  creation; metadata edits are name/description only.
- DRAFT → ACTIVE/ARCHIVED; ACTIVE → CLOSED/ARCHIVED; CLOSED → ACTIVE/ARCHIVED;
  ARCHIVED has no outgoing transition. Activation requires a valid published process,
  not a nonempty member count. The UI will not invent a member-count prerequisite.
- Closed/archived cohorts lock membership and assignment. A cohort with any workspaces
  or projects blocks process reassignment, even before a case exists. An unchanged
  assignment is idempotent. No migration behavior is introduced.
- Cohort responses include authoritative active-member, workspace and case counts.
  Detailed team listings are not part of this contract; use the counts and existing
  case monitoring rather than reconstructing teams from enrollment or program.
- Active program/research-type catalogs and academic years supply creation choices.
  Coordinator profile college/program narrows these choices; college is derived.
- The authenticated user directory supports active RESEARCHER filtering and academic
  scope and requires existing `user.manage` permission. Membership UI will not use
  process-access contacts or expose a raw user-ID field as a workaround.

Phase 6 browser smoke paths and mobile verification remain pending pre-merge manual
checks. Phase 7 browser checks will be recorded the same way if control is unavailable.
No schema, Phase 6 researcher flow or Phase 8 changes are authorized here.

## Approved narrow backend exception

The audit found that standard coordinators do not have `user.manage`, so the user
directory cannot power Add Researchers. Process-access contacts depend on workflow
ownership and would incorrectly couple academic membership to process access.
The user explicitly approved a cohort-anchored, read-only eligible-researcher
endpoint as the sole Phase 7 backend contract addition.

`GET /api/cohorts/:id/eligible-researchers?search=...&page=...&limit=...` uses existing
manager authorization, target-cohort academic scope and permission checks. It returns
only active RESEARCHER accounts in the cohort's college/program, excludes ACTIVE
cohort members, and permits eligible previously removed members to be selected again.
Only ID, first/last name, email and student identifier are returned. Strict query
validation disallows academic scope overrides and caps page size at 50. A serializable
snapshot authorizes the cohort and reads/counts candidates. Closed/archived cohort
membership remains locked. No writes, invitations, enrollment changes, workspace/case
creation, schema changes or unrelated directory expansion are introduced.

## Implemented coordinator journey

Navigation now exposes Research Cohorts, Process Templates, Research Cases and the
existing review/defense/progress areas using the existing sidebar design. The
coordinator title replaces Course Professor/Professor Dashboard at the portal level.
Existing `/professor/dashboard?tab=builder` and internal workflow/participant IDs remain.

New protected routes `/professor/cohorts` and `/professor/cohorts/:id` supply:

- Paginated backend cohort loading, searchable cards, Draft/Active/Closed/Archived
  badges, program, track, academic year, assigned published process/version, and
  authoritative active-member counts. No cohorts prompts cohort creation first;
  an unmatched search is distinguished from an empty academic catalog.
- Draft creation with name, optional description, a scoped active program/track
  and active academic year. College is derived from the selected program. Submission
  rechecks academic IDs against current returned choices; no arbitrary ID fields,
  case metadata, process creation, membership or runtime provisioning occurs here.
- Cohort information, fixed academic identity, name/description editing, current
  process/version/publication status, researchers and authoritative team/case totals.
  Detail/list/member/eligible-picker queries refresh after every mutation, and returned
  cohort/member records are cached immediately. No hard refresh is required.
- Only published matching-track templates from the authorized process API appear in
  Assign Process. The server still enforces scope and publication. Assignment calls
  PUT `/api/cohorts/:id/workflow`; publication remains a separate existing operation.
  Reassignment confirms process ownership but is disabled once any team/case exists,
  matching the actual backend restriction. Existing pinned cases are never modified.
- Add Researchers uses the new read-only cohort lookup with search and pagination.
  It excludes active members, permits eligible removed researchers to be selected,
  and submits selected returned IDs to the unchanged cohort-member POST. The roster
  distinguishes active and removed history. Removal confirms preservation of research
  records and calls the unchanged soft-removal DELETE endpoint. No workflow enrollment
  or team/project membership is created, revoked or restored by these UI operations.
- Lifecycle confirmations follow the exact server transitions. Activation can be
  requested without a fabricated member-count prerequisite; valid published-process
  validation remains on the server. ACTIVE can close/archive. CLOSED supports the
  existing activation/archive transitions while keeping membership/assignment locked.
  ARCHIVED is read-only with no restore/delete/duplicate action.
- Loading, retry, empty and blocked states, disabled/pending operations, single-flight
  mutation protection and useful domain errors use existing components/conventions.
  Database error content is replaced with generic retry guidance.

The normal onboarding guide now teaches the seven cohort setup/start/monitoring
steps. `ResearchProjectsOnboarding` was removed. The former registration/title-based
monitoring filter was removed: provisional cases now appear with Research title
pending. Legacy cases remain in all-case monitoring, and the cohort detail's monitoring
link filters only by the stored, server-returned cohortId, never program or enrollment.
Case reviews, existing removal controls, submissions, defense and builder operations
keep their existing backend behavior.

## Monitoring contract limits

Existing cohort `_count` data supports reliable active membership, research team and
research case totals. Existing authorized case responses contain cohortId, allowing
an exact cohort-linked case view. Detailed per-team rosters/start states are deferred:
the coordinator has no authoritative cohort team-list contract and this phase adds
no cosmetic monitoring API. Counts do not imply a team-to-case one-to-one relationship,
case status breakdown, or inferred pending-start total.

## Final coordinator search classification

| Remaining/retired usage | Classification | Disposition |
| --- | --- | --- |
| Create workflow → add participants → register projects guide and `ResearchProjectsOnboarding` | REMOVE FROM NORMAL COORDINATOR FLOW / REMOVE | Retired component and caller; cohort setup guide replaces it |
| Registration/title-based `registeredProjects` filter and missing-registration instructions | MIGRATE | Removed; monitor provisional and legacy cases without registration prerequisites |
| Workflow Participants/Add Participants as normal academic container | MIGRATE TO COHORT | Academic member management now lives in Research Cohorts |
| `WorkflowParticipantsCard`, `WorkflowAccessManager`, `workflowEnrollmentCount`, enrollment revoke endpoint and legacy invitation controls | PROCESS ACCESS | Technical names retained; visible tab/card/counts explicitly mean process access, with membership distinction and historical preservation |
| `ResearchType.workflowId`, default workflow, active workflow for research type in coordinator runtime selection | REMOVE / zero dependencies | No global assignment write introduced; publication and cohort assignment remain independent |
| Course Professor/Professor Dashboard coordinator shell labels | MIGRATE | Research Coordinator/Coordinator Dashboard |
| `/professor`, `Professor*` component names, legacy `workflowView=participants`, `registeredAt`/`workflowDraft` record metadata | LEGACY COMPATIBILITY | Routes/interfaces and historical fields retained; they do not drive new cohort membership or registration gating |
| Topic, Stage, Milestone, Requirement/task builder terminology and advanced legacy builder sections | PHASE 8 TERMINOLOGY | Existing builder structure and engine semantics intentionally unchanged |
| Existing process publication, resources, reviews, defense participants and case authorization | INTENTIONAL | Preserve existing behavior; defense participants are not academic cohort membership |
| Old wording in regression tests/report audit | INTENTIONAL | Evidence and negative assertions, not normal UI instructions |

No production coordinator occurrence of Register Research Project, Register Projects,
project registration, Students without projects, Add Participants, default workflow,
active workflow for research type, ResearchType.workflowId, ResearchProjectsOnboarding,
Course Professor or Professor Dashboard remains. Technical enrollment-count identifiers
and participants component names remain classified as PROCESS ACCESS; the complete
internal builder terminology migration is deferred.

## Focused regression coverage

- Frontend scope/program/track/year choices, forbidden arbitrary IDs, cohort creation
  payload and immediate list/detail cache adoption, exact cohort mutation endpoints,
  member response preservation/soft removal, read-versus-write boundaries and refresh.
- Published matching-track choices, current assignment, failure messages/state
  preservation, future assignment locks, and unchanged cached pinned case identity.
- Empty/search states, statuses, authoritative assignment/counts, creation form fields,
  active/removed roster, coordinator-only render guard, status actions and archived
  read-only display. Navigation retains the existing builder and academic modules.
- Provisional case visibility, exact cohortId filtering and legacy case monitoring.
  AST checks reject unrelated creation/access/publication writers in cohort actions.
- New service tests verify manager/scope authorization, exact eligible account filters,
  minimal returned fields, stable pagination, closed/archived locks and no writes.
- New HTTP integration cases verify unauthenticated/researcher/adviser/restricted-panel
  denial, same/other-program/college manager scope, existing Dean/Admin conventions,
  search/name/email/identifier matching, pagination, forbidden scope overrides, ACTIVE
  member exclusion and REMOVED member eligibility. Snapshot counts verify no membership,
  enrollment, case, workspace or audit mutation from lookup.
- Query validation bounds search, rejects scope overrides and limits pages/page size.
  Existing Phase 6 tests and backend integration suite remain required regression checks.

## Pending pre-merge manual verification

Phase 6's six browser paths and mobile/narrow check remain **PENDING pre-merge** in
`docs/researcher-frontend-lifecycle.md`; they are not failed automated acceptance checks.
Browser control was previously unavailable. These Phase 7 interactive checks also
remain PENDING rather than claimed from server-rendered or contract tests:

1. Coordinator opens Research Cohorts.
2. Creates a Draft cohort in the correct academic scope.
3. Assigns a published matching-track Process Template.
4. Searches for/adds an eligible researcher.
5. Activates the cohort and sees updated status without refresh.
6. Researcher sees the cohort in the unchanged Phase 6 lifecycle.
7. Coordinator removes/adds a member; active/history/search results update.
8. Existing Process Builder opens and continues to work; publishing is separate
   from assignment and process access is separate from cohort membership.
9. Narrow/mobile cohort list/detail/form/confirmation/navigation remain usable.

Verify these on the deployed reviewed commit using appropriate preview test records.
Record commit/URL, browser/viewport and results. Automated rendering is not real-browser
interaction or responsive visual verification. Unavailable browser control does not
block Phase 7 architecture implementation.

## Deferred Phase 8+ work / preserved boundaries

No schema/migration/backfill; no changes to case provisioning, researcher start,
enrollment semantics, publication service, currentStageId/progression, requirement
engine, title approval or automatic solo policy. Adviser, Panelist, Dean and System
Admin dashboards remain untouched. The only added backend contract is the explicitly
approved read-only eligible-researcher endpoint above.

Full Topic → Phase / Stage → Requirement / Task → Checklist terminology, publication
flexibility, RequirementInstance, DAG/parallel execution, detailed cohort team monitoring
and legacy data cleanup remain deferred. Phase 8 has not started. At the implementation
checkpoint Phase 7 was uncommitted/unpushed. Its later commit/push and exact-commit
Actions/deployment results are verified and reported separately.

## Exact files changed

Paths are relative to the repository root. No dependency/lockfile changes were made.

| File | Impact |
| --- | --- |
| `apps/web/src/app/professor/cohorts/page.tsx` | New protected cohort list/detail, creation/editing, lifecycle, assignment and member UI; seven-step guide |
| `apps/web/src/app/professor/cohorts/page.test.tsx` | List, search, form, status, role, roster and full detail rendering tests |
| `apps/web/src/lib/coordinator-cohorts.ts` | Typed cohort contracts, academic choice validation, lifecycle policy, mutations, cache adoption/refresh and friendly errors |
| `apps/web/src/lib/coordinator-cohorts.test.ts` | Choice/scope, lifecycle, requests, errors, cache and pinned-case preservation tests |
| `apps/web/src/lib/coordinator-cohort-boundary.test.ts` | AST mutation-boundary and protected-route/builder regression checks |
| `apps/web/src/components/professor/CohortCaseMonitoring.tsx` | Started/provisional and legacy case monitoring, exact cohortId filter |
| `apps/web/src/components/professor/CohortCaseMonitoring.test.tsx` | Provisional, legacy, empty and exact cohort filtering tests |
| `apps/web/src/app/professor/dashboard/page.tsx` | Cohort-first onboarding link/guide; case monitoring replaces registration gate; Process Templates/Access presentation; existing builder/review/defense operations retained |
| `apps/web/src/components/dashboards/professor/ProfessorSidebar.tsx` | Research Management navigation with Cohorts, Process Templates and Cases |
| `apps/web/src/components/dashboards/professor/ProfessorTopbar.tsx` | Coordinator/cohort/template/case titles |
| `apps/web/src/components/dashboards/professor/ProfessorNavigation.test.tsx` | Cohort/template separation and existing module/builder links |
| `apps/web/src/routes.tsx` | Add protected cohort list/detail routes using existing role conventions |
| `apps/web/src/components/workflow/ResearchProjectsOnboarding.tsx` | Retire old enrollment/registration guide |
| `apps/web/src/components/workflow/WorkflowParticipantsCard.tsx` | Explicit process-access presentation; original access actions preserved |
| `apps/web/src/components/workflow/WorkflowAccessManager.tsx` | Explicit separation from cohort membership; original permission/invitation behavior preserved |
| `apps/api/src/routes/cohort.routes.ts` | Approved read-only eligible-researcher route, existing permission/param/query middleware |
| `apps/api/src/services/cohort.service.ts` | Approved scoped, paginated, minimal-field researcher lookup; existing mutation semantics unchanged |
| `apps/api/src/services/cohort.service.test.ts` | Lookup scope/filter/privacy/read-only/locked-state coverage |
| `apps/api/src/routes/cohort.routes.integration.test.ts` | Four new authenticated HTTP cases covering authorization, scope/search/pagination, membership exclusion/history and read-only counts |
| `packages/validations/src/cohorts.ts` | Strict eligible-researcher query schema/type; no academic scope overrides |
| `packages/validations/src/cohorts.test.ts` | Query bounds, normalization and forbidden scope override coverage |
| `docs/coordinator-cohort-management.md` | Before/after audit, policy, approved exception, scope, verification and deferred work |

Remaining generic Professor wording in historical faculty/announcement/builder
content is LEGACY COMPATIBILITY or PHASE 8 TERMINOLOGY. The coordinator portal shell
and normal setup have migrated; other role dashboards and technical names have not.

## Validation results

| Check | Result |
| --- | --- |
| Focused coordinator frontend tests | PASS; 44 focused new tests in five frontend test files after final refinements |
| Cohort service tests | PASS; 29 tests, including four new lookup tests |
| Full `npm run type-check` | PASS, all 9 tasks |
| Full `npm run build` | PASS, all 6 tasks; existing Vite large-chunk warning remains |
| Full `npm run lint` | PASS |
| Full `npm test` | PASS, 930 unit executions: web 329, API 487, validations 66, auth 32, email 16 |
| `npm run test:integration:local` | PASS on unchanged full rerun: 114 tests / 14 files, including four new researcher-lookup HTTP cases |
| Isolated test DB migration/teardown | No pending migrations; final fixture cleanliness verified; test PostgreSQL stopped |
| `git diff --check` | PASS |
| Phase 6 student/provider/provisioning/schema/publication changes | None |
| Remote CI/deployment | Separate push checkpoint; local results do not establish remote CI or deployment success |
| Phase 6/7 browser and narrow-width checks | PENDING pre-merge manual verification; not failed automated acceptance |

The first integration attempt ended without a test summary and left 13 fixture roots
from an existing Phase 4 reviewer-assignment test. The runner's cleanliness guard
detected them. Their exact IDs, test-only names/email marker and isolated database
identity were reviewed; the existing guarded fixture-cleanup helper removed only
those roots, preserving baseline academic reference data. The complete unchanged
rerun passed all 114 tests and final teardown verification. No tests, permissions,
worker settings or assertions were disabled/weakened to obtain the passing result.

Phase 7 implementation and automated validation are complete. Browser interaction
and mobile layout verification remain documented pre-merge work. Stop at Phase 7;
do not infer authorization to start Phase 8 or merge this branch. The user subsequently
authorized committing/pushing Phase 7 as its own checkpoint, with browser/mobile checks
still pending pre-merge and no authorization to begin Phase 8.
