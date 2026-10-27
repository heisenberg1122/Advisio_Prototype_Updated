# Phase 4: canonical cohort-driven research case provisioning

## Existing creation-path audit (before implementation)

The production API has two `ResearchProject.create()` sites and two
`WorkflowInstance.create()` sites. Searches covered API sources and database
scripts, including create/createMany/upsert and raw INSERT statements. Demo
creation in `packages/database/src/panel-demo.ts` and `local-demo.ts` is offline
fixture tooling, not a production request path.

### Manual registration: `POST /api/research`

Source: `apps/api/src/routes/research.routes.ts`.

1. Trigger: explicit manual registration, with a final title and optional existing
   workspace. `resolveRegistrationWorkflow()` is called only here in production.
2. Authorization: authentication, `RESEARCH_CREATE`, college/program scope;
   an existing workspace requires its active leader. Phase 3 selection intersects
   cohort assignments with existing researcher enrollment; legacy draft promotion
   stays pinned to the server-loaded instance.
3. Project: academic IDs resolved by the route/selection service, trimmed title,
   optional abstract/group name, participation/access/invitation fields, DRAFT,
   actor as creator, optional workspace. No cohort link is written automatically.
   Existing untitled participation is promoted in place instead of recreated.
4. Membership: creator LEADER; other active workspace users copied as MEMBER.
5. Enrollment: missing creator/team enrollments are upserted; `update: {}` does
   not reactivate revoked rows. Group joins and accepted join requests separately
   use the same preserve-existing enrollment policy.
6. Instance: created only when selection provides a workflow and first stage;
   staff registration can still create a project without an instance.
7. First stage: first by sequence excluding category `Archived`.
8. Linkage: instance `researchId` receives the project ID, then project
   `workflowInstanceId` is updated to the created instance ID.
9. Audit: this registration transaction has no provisioning audit write.
10. Notifications: no notification emitted by the creation transaction.
11. Transaction: project/members/enrollments/instance/link are atomic. Workspace
    advisory locking rechecks leadership; draft promotion locks the project.
    Selection and some eligibility reads occur before the transaction. No retry
    loop is present. A full response is loaded after commit.
12. Compatibility: manual final titles, nullable cohort/workspace/instance,
    legacy invitation fields and draft promotion are preserved.

This creation path reads/copies workspace state but does not create, attach or
repair a workspace or alter its membership as part of registration.

### Untitled participation: `startWorkflowParticipation()`

Source: `apps/api/src/services/workflow-participation.service.ts`.

1. Triggers: `POST /api/workflows/:id/participation`,
   `POST /api/workflows/stages/:stageId/start` when no research ID is supplied,
   and `POST /api/adviser-requests` when supplied a workflow without a research ID.
2. Authorization: RESEARCHER, active workflow enrollment, published process,
   active academic scope; active membership in the selected workspace. Existing
   personal participation may resume; a new case/shared membership requires a
   matching active cohort assignment. A workspace member may initiate a group.
3. Project: empty title, `workflowDraft=true`, `registeredAt=null`, DRAFT,
   workflow research type and academic scope, selected current/active year,
   optional workspace, actual workspace leader as creator, group/access fields.
4. Membership: includes only enrolled, active, in-scope workspace members in
   eligible cohorts; requires an eligible leader. An existing shared case can
   gain a MEMBER row instead of a new project. Existing personal cases are reused.
5. Enrollment: requires existing access; creates or reactivates no enrollments.
6. Instance: one instance for newly created participation, with stored version.
7. First stage: first by sequence excluding category `Archived`; empty fails.
8. Linkage: same two-step project/instance linkage as manual registration.
9. Audit: one CREATE `WorkflowParticipation` event on new creation, with workflow
   and workspace IDs. Resume returns without a new creation audit event.
10. Notifications: none from this service. Adviser/milestone callers continue
    their own separate orchestration afterward; those actions are not part of
    the participation transaction.
11. Transaction: all service reads/writes are inside one transaction, with shared
    workflow-access and optional workspace advisory locks; no serialization retry.
12. Compatibility: legacy workspace null/cohort null, solo participation without
    a workspace, blank titles, member-triggered starts and existing pinned runs.

Participation copies eligible workspace members into case participation; it does
not create/attach a cohort workspace or synchronize its source roster.

### Other membership/access writers (no project/instance creation)

- `research.routes.ts`: public/code joins and leader-approved join requests add
  or restore research membership, synchronize workspace membership and create
  missing enrollments with empty updates. Join acceptance emits notifications;
  these paths do not provision another case.
- `group-membership.service.ts`: leadership transfer creates/restores LEADER and
  MEMBER rows and synchronizes workspace leadership; removal soft-removes rows.
  These operations audit changes, use serializable transactions and project locks,
  and do not create workflow instances or enrollments.
- `member-assignment.service.ts`: scoped staff assignment restores research
  membership after role/capacity checks, with an audit event in a serializable
  transaction. No project/instance/enrollment creation.
- `adviser-request.routes.ts` and `live-defense.routes.ts`: adviser acceptance,
  reconciliation and defense panel assignments create/restore ADVISER/PANELIST
  research participation as part of their existing transactions. They do not
  provision a project/instance or compatibility researcher enrollment.
- `workflow-access.routes.ts`: explicit approved access/invitation decisions may
  create/restore ACTIVE enrollment under the workflow-access lock, with access
  audit/notification behavior. This is deliberate access management, separate
  from cohort membership and research-case creation.

### Consolidation decision

Both existing creation implementations remain **LEGACY COMPATIBILITY / PHASE 5
MIGRATION**. Neither delegates in Phase 4. Delegation would change accepted
inputs, final versus provisional titles, required cohort linkage, actor/whole-team
eligibility, enrollment creation policy, optional instance behavior and audit
semantics. Shared persistence responsibilities are project/member/instance
creation, first-stage/version capture and dual linkage. Forced reuse would change
externally observable behavior; no legacy path is removed or disabled.

The new service is the canonical implementation for NEW cohort-driven creation.
It will have no production route/caller until a later, separately authorized phase.

## New service contract and authorization

`provisionResearchCase({ cohortId, workspaceId, actorId })` returns
`{ project, workflowInstance, created }`. Its strict input schema accepts only
these three UUIDs; caller-supplied titles, academic IDs, workflows and roles are
rejected. No frontend response or HTTP status is built into the service.

All academic identity comes from `ResearchCohort`. The service checks ACTIVE
cohort status; active college/program/research type/year and a consistent academic
chain; assigned PUBLISHED workflow of the same type; exact workspace/cohort link
and academic scope; and active membership in both structures. The actor must be
the active workspace leader. Every active workspace participant must be an ACTIVE
researcher account in the same program/college and an ACTIVE member of that exact
cohort. A group requires exactly one leader; SOLO requires that leader alone.
Departed workspace members are excluded; invalid active participants reject the
entire operation. Provisioning never attaches a null/foreign workspace cohort.

Errors expose stable domain codes, including `COHORT_NOT_FOUND`,
`COHORT_NOT_ACTIVE`, `COHORT_PROCESS_NOT_ASSIGNED`, `COHORT_PROCESS_NOT_FOUND`,
`COHORT_PROCESS_NOT_PUBLISHED`, `WORKSPACE_NOT_FOUND`,
`WORKSPACE_COHORT_MISMATCH`, `ACTOR_NOT_COHORT_MEMBER`,
`ACTOR_NOT_WORKSPACE_MEMBER`, `ACTOR_NOT_WORKSPACE_LEADER`,
`TEAM_MEMBER_NOT_IN_COHORT`, `TEAM_MEMBER_NOT_ELIGIBLE`,
`INVALID_TEAM_LEADERSHIP`, `INVALID_ACADEMIC_SCOPE`,
`NO_ACTIVE_WORKFLOW_STAGE`, `WORKFLOW_ACCESS_REVOKED`,
`WORKFLOW_ACCESS_MISSING`, `MULTIPLE_RESEARCH_CASES`,
`EXISTING_CASE_INCONSISTENT`, and `INVALID_PROVISIONING_INPUT`.

## Atomic transaction and idempotency

The full operation runs in a PostgreSQL SERIALIZABLE interactive transaction.
Locks are acquired in order: `research-cohort:<id>`,
`workflow-access:<assigned-workflow-id>`, and the workspace ID. These reuse the
cohort-management, workflow-access/participation, and workspace/registration
locking conventions. All validation reads occur inside the transaction.
Prisma `P2034` serialization/deadlock failures retry the entire transaction,
at most five attempts. Domain errors and other persistence failures propagate.
Transaction timeout is 15 seconds with a 5-second connection acquisition limit.

The existing-case query uses `(cohortId, workspaceId)` without excluding archived
records. An existing completed linkage returns unchanged with `created=false`;
it is not assigned the template's newest stored version. Duplicate historical
pairs and missing/inconsistent instance linkages produce explicit errors rather
than selecting, repairing or replacing a case silently. Current actor/team
eligibility and process access are still checked on repeat calls. A repeat is
read-only and does not synchronize roster changes or recreate deleted access.

There is no new database uniqueness constraint: legacy workspaces can contain
multiple projects, and existing non-null/backfilled data has not been declared
globally unique. Serializable predicate reads plus the shared locks protect
concurrent calls through this service. Future cohort-driven callers must use this
boundary; a future writer/backfill that bypasses it must be reviewed separately.

For a new case, one transaction creates the project, exact workspace role mapping,
missing permitted compatibility enrollments, workflow instance, reverse project
link and CREATE audit event. `ResearchProject` stores authoritative cohort IDs,
DRAFT status, `workflowDraft=true`, `registeredAt=null`, a trimmed workspace name
plus ` Research Study` (fallback `Untitled Research Study`), and
`isTitleProvisional=true`. GROUP name/access mode follow the workspace; SOLO uses
INVITE_ONLY. Project invitation fields retain their existing disabled/null
defaults; no new invitation or onboarding flow is introduced.

The instance receives the assigned cohort workflow ID, its stored version, and
the first stage by sequence excluding category `Archived`. No initial transition
or advancement is invented. `WorkflowInstance.researchId` is set to the new
project ID, then `ResearchProject.workflowInstanceId` is set to the new instance
ID. Any failure, including audit persistence, rolls back all writes.

The audit uses the existing CREATE action and ResearchProject entity type, with
`newValues.operation=RESEARCH_CASE_PROVISIONED` and research/cohort/workspace/
workflow/actor IDs. It is emitted only for successful creation. There are no new
notification, email, adviser, defense, or publication side effects.

## Independent enrollment compatibility

For each intended participant, no row means a missing ACTIVE compatibility row
may be created; ACTIVE means preserve the entire existing row and join timestamp;
any other status means `WORKFLOW_ACCESS_REVOKED` and rollback. The service never
updates or upserts enrollment rows. Missing rows are inserted with duplicate
protection, then reread before completion so a conflicting inactive row cannot be
silently accepted. Existing-case retries with missing rows fail
`WORKFLOW_ACCESS_MISSING` instead of repairing access. Cohort add/remove behavior
is unchanged and still does not grant/revoke workflow enrollment.

## Schema and deployment concerns

The only schema change is `ResearchProject.isTitleProvisional Boolean
@default(false) @map("is_title_provisional")`. Migration
`20261027000500_provisional_research_title` adds a NOT NULL boolean with a false
default. It removes no records, fields, relations, indexes or constraints, and
does not make titles nullable. Existing rows and old/manual creation remain
non-provisional; only the new service explicitly opts in. No cohort ID backfill
or provisional-title approval behavior is introduced.

Deploy the migration before code generated from this schema: ordinary Prisma
reads can select the new column even while the new capability has no caller.
PostgreSQL takes an ALTER TABLE lock; plan around concurrent traffic. Production
and development databases are not migrated by the local verification runner.
Existing historical schema drift recorded in Phase 1 is outside this change.
This remains a transitional feature branch, not a production rollout.

## Remaining dependencies and boundary

- `POST /api/research` still owns manual final-title validation, academic defaults,
  workspace leadership, existing-project checks, cohort/enrollment selection,
  draft promotion, project invitation settings, old provisioning and response
  hydration. It is preserved without source edits.
- The only production `resolveRegistrationWorkflow()` caller remains that route;
  the new service neither imports nor calls it.
- Existing participation still serves its three request callers, and membership,
  adviser and defense writers keep their existing transactions and authorization.
- No runtime path delegates to the new service yet. Its callers in this phase are
  tests only. Three implementations now contain project/instance creation sites:
  the new internal canonical capability and the two documented legacy paths.
  Phase 5 migration of callers is explicitly outstanding, not hidden duplication.
- No frontend, student action trigger, existing-title approval, DAG execution,
  workflow publication, model rename or compatibility-field removal is included.

## Exact Phase 4 files

| File | Change |
| --- | --- |
| `packages/database/prisma/schema.prisma` | Add default-false provisional-title field only |
| `packages/database/prisma/migrations/20261027000500_provisional_research_title/migration.sql` | Additive column migration |
| `apps/api/src/services/research-case-provisioning.service.ts` | New internal canonical service and domain errors |
| `apps/api/src/services/research-case-provisioning.service.test.ts` | Focused unit coverage |
| `apps/api/src/services/research-case-provisioning.integration.test.ts` | Real PostgreSQL and legacy HTTP regression coverage |
| `apps/api/scripts/run-database-integration-tests.mjs` | Include the new suite in the guarded integration runner |
| `docs/research-case-provisioning.md` | Creation-path audit, design, boundaries and verification report |

## Tests added

The 51 focused unit cases cover authoritative identity and input rejection, roles,
academic-chain checks, all inactive cohort states, missing/unpublished process,
workspace/cohort mismatch, actor and whole-team validation, title fallback,
enrollment denial, preservation of pinned records, ambiguous/incomplete historical
cases, serialization retry and the five-attempt limit. Test doubles never claim
to establish database atomicity or concurrency safety.

The 32 new database integration cases establish actual persistence behavior:
exact roles and dual linkage; nonempty provisional title; first non-archived stage;
version pinning and repeat-call identity; simultaneous calls yielding one case,
one instance and one audit; compatibility enrollment creation/preservation and
non-reactivation; cohort/team/scope denials; and departed-member/solo behavior.

Failure injection at member creation, instance creation and audit persistence
verifies real PostgreSQL rollback after progressively later writes. A separate
forced serialization failure rolls back the fully written attempt before a
successful retry. The actual migration SQL is exercised against an isolated
temporary table containing a pre-existing title, proving false defaults for
existing/manual rows and explicit true for a new provisional case.

HTTP regression tests exercise the complete existing `POST /api/research`
transaction, subsequent project GET and the existing milestone advancement
service/transition history with a null cohort and a pinned workflow version.
They also exercise member-triggered participation, a cohort-null legacy workspace,
and resumption of an existing pinned instance after cohort membership removal.
The service test confirms provisioning introduces no user notifications.

Test fixtures use exact tracked IDs, guarded live database identity verification,
and full teardown. No production/development data is used or backfilled.

Two initial integration setup attempts exposed fixture identifiers longer than
the existing college/program code and academic-year name limits; the fixtures
were corrected without schema or assertion changes. A later complete run ended
with Windows native exit `0xC0000005` before a test summary; cleanup passed. The
unchanged runner then passed all 90 tests in 13 suites and clean teardown. No
assertion, timeout, isolation guard or access control was weakened to obtain a
passing run. The isolated database was stopped after verification.

## Final local validation (2026-10-27, Asia/Manila)

| Check | Result |
| --- | --- |
| Prisma schema validation | Passed |
| Database `db:generate` | Passed |
| Database package `build` (`prisma generate && tsc`) | Passed separately and within the workspace build |
| `npm run type-check` | Passed |
| `npm run build` | Passed; existing frontend bundle-size warning remains |
| `npm run lint` | Passed |
| `npm test` | Passed: 783 test executions (442 API, 229 web, 64 validations, 32 auth, 16 email); 90 opt-in database tests skipped here |
| `npm run test:integration:local` | Passed separately: all 90 tests in 13 suites, including all 32 new provisioning cases; clean teardown |
| New TypeScript file formatting and `git diff --check` | Passed |

The unit count includes existing emitted test copies in auth/validations, as in
the Phase 0 baseline. The only database migration executed was against the guarded
local `advisio_test` instance, which was stopped afterward. No production rollout,
frontend migration, Phase 5 trigger, or later phase was started.
