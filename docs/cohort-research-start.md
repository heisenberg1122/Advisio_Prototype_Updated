# Phase 5: activate cohort-driven research start

## Start/participation audit before implementation

- `POST /api/workspaces`: RESEARCHER-only; name and SOLO/GROUP mode come from the
  caller, academic IDs from the authenticated account/profile. It creates a
  workspace and LEADER membership only, with no research project, workflow
  instance or enrollment. It currently has no way to select a cohort.
- Workspace invitation emails are leader-only and contain the existing join
  code. Acceptance is `POST /api/workspaces/join/:code`, not a separate persistent
  invitation-acceptance model. Joining requires a researcher in the same program
  and college, enabled GROUP invitation, and no active workspace project. It
  restores/adds workspace membership and sends existing membership notifications;
  it does not create research records or workflow access.
- Legacy pre-case workspace membership has no separate leadership-transfer or
  removal endpoint. Research-case leadership transfer/removal in
  `group-membership.service.ts` synchronizes workspace membership after a case
  exists. This phase does not redesign team management.
- `ResearchWorkspace.participationMode` and `ResearchProject.participationMode`
  record selected SOLO/GROUP behavior. Workspace access is currently PUBLIC_OPEN
  or INVITE_ONLY. `ResearcherProfile.researchType` is optional onboarding input,
  not coordinator-controlled eligibility. Workflow-stage `submissionMode` controls
  an activity's submission granularity, not cohort permission to work alone.
  Neither ResearchCohort nor ResearchType has a solo/group eligibility policy.
- Consequently, automatic solo-workspace creation is deferred. Existing explicitly
  created valid SOLO workspaces can use the general start endpoint. No new
  permission flag, schema field, status or one-workspace-per-cohort rule is added.
- `POST /api/research` still validates manual title registration and calls
  `resolveRegistrationWorkflow()`. The student dashboard creates a workspace and
  optionally calls this route when a title is supplied. Read-only research-list
  hooks/pages also depend on the route family; they are not registration writers.
- `startWorkflowParticipation()` has a different legacy contract: active
  enrollment is required, a normal member may begin a group, cohort-null legacy
  workspaces/solo contexts are supported, and existing pinned participation can
  resume. Its callers are `POST /api/workflows/:id/participation`,
  `POST /api/workflows/stages/:stageId/start` without a research ID, and
  `POST /api/adviser-requests` with a workflow but no research ID.

## Implementation boundary

Team formation remains separate from research start. Optional cohort selection
during new workspace creation will be validated against active academic cohort
membership and profile scope. Cohort-linked joins will validate the same cohort
membership without provisioning anything. Legacy cohort-null creation/join
behavior remains available.

The explicit start operation will derive cohortId from the workspace, require
active workspace leadership and call the Phase 4 provisioning service. No
provisioning logic or enrollment mutations are copied into the route.
The two old creation paths remain LEGACY COMPATIBILITY. No new code will call
`resolveRegistrationWorkflow()`, and no student UI or downstream module changes
are part of this phase.

The optional readiness projection is deferred to avoid maintaining a second set
of validation rules. There is no persisted READY state. Start always validates
fresh transactional state in the canonical service.

## Start endpoint and contract

`POST /api/workspaces/:id/start-research` accepts a UUID path parameter and no
body, or `{}`. Any registration metadata in the body, and any query metadata,
is rejected with 400. In particular title, workflow, research type, college,
program, academic year, cohort and actor cannot be overridden by request input.

The route authenticates an ACTIVE researcher, loads the workspace's stored
cohort link and only the caller's current membership, and requires LEADER.
Absent/departed membership and ordinary MEMBER are forbidden, as is unrelated
staff access. It calls `provisionResearchCase({ cohortId: workspace.cohortId,
workspaceId: id, actorId: req.user.id })`. The service rechecks all membership,
academic, lifecycle and enrollment state inside its existing transaction, so a
concurrent change cannot rely solely on the route's initial authorization read.

New creation returns HTTP 201; an authorized repeat returns HTTP 200. Both use
the domain result unchanged: `{ project, workflowInstance, created }`. The
canonical service owns title generation, identity, member/enrollment creation,
version/stage capture, linkage, audit, rollback and serializable retry. There are
no project, instance, enrollment or notification writes in the new route.

Errors retain Advisio's `{ error: string }` envelope: invalid input is 400;
actor authorization failures are 403; missing cohort/workspace is 404; invalid
lifecycle/configuration/team or revoked access is 409. Revocation messages ask
for coordinator resolution, never repair access. Persistence conflicts are
reported as retryable 409 responses; unexpected errors return a generic 500
without exposing database details. All Phase 4 domain codes are mapped.

Ordinary team members use the existing research-detail and process routes once
started; they do not gain permission to invoke the leader's start action. Existing
enrollment/resource/submission checks still apply independently of case membership.

## Cohort-linked team formation

`POST /api/workspaces` gains optional `cohortId`. When supplied it must be a UUID;
the account must be an ACTIVE researcher in the cohort's exact active program and
college and an ACTIVE member of that ACTIVE cohort. A serializable transaction
shares the cohort-management advisory lock, derives college/program from the
cohort, and creates the workspace plus its LEADER only. No process assignment,
enrollment or academic case is created. The requested SOLO/GROUP mode and existing
access-mode handling remain; cohortId is an identifying choice during formation,
not accepted academic configuration at start.

Code-based joining of a cohort-linked team requires the same active cohort and
researcher membership. It acquires the cohort lock before the existing workspace
lock, checks academic consistency and rechecks that the workspace's cohort link
has not changed. Existing invite validity, project-count restriction and join
notifications remain. A started case blocks further workspace-code joins through
the existing project invitation boundary; this phase does not add roster syncing.

When cohortId is omitted during creation, the previous cohort-null path remains.
Legacy cohort-null joins still use existing program/college checks without new
cohort requirements. No existing workspace is attached or backfilled. Workspace
cardinality remains unchanged; repeated Start Research relies on Phase 4's
cohort/workspace idempotency, not a new uniqueness constraint.

## Solo and readiness decisions

Automatic individual-workspace creation is deferred because no authoritative
cohort/track policy determines whether a cohort permits individual research.
Onboarding `researchType` is user input, not that policy. No
`start-individual-research` endpoint or assumed `allowSolo` default is added.
Explicitly created, correctly linked SOLO workspaces can use the same start
operation under existing SOLO membership rules (one active leader).

No readiness GET endpoint or new READY status is introduced. The leader's explicit
POST is the readiness point and performs authoritative transactional validation.
Phase 6 may add a shared derived projection if needed; missing enrollment must
remain potentially provisionable, while revoked enrollment remains blocking.

## Compatibility and remaining callers

- `POST /api/research` remains operational and unchanged. Its production writer is
  the student dashboard's `handleCreateResearch` flow in
  `apps/web/src/app/student/dashboard/page.tsx`. The dashboard also creates
  workspaces without cohortId today. Other research-list hooks/pages remain reads.
- `resolveRegistrationWorkflow()` still has exactly one production caller:
  `POST /api/research` in `apps/api/src/routes/research.routes.ts`. No new code
  imports it.
- `startWorkflowParticipation()` remains LEGACY COMPATIBILITY, with all three
  existing callers listed in the audit unchanged. It retains member-triggered
  starts and its existing cohort-null/pinned-context behavior.
- The new production caller of `provisionResearchCase()` is only the explicit
  workspace start route. Workspace creation, join, invitation emails/acceptance,
  and membership helpers do not import or invoke it.
- No schema/migration, execution/currentStageId, title approval, document/adviser/
  defense/panelist/consultation/signature/archive logic or workflow-publication
  change is included. The existing Phase 4 service itself is unchanged.

## Exact Phase 5 files

| File | Change |
| --- | --- |
| `apps/api/src/routes/workspace-research.routes.ts` | Explicit authenticated leader-only start and domain error mapping |
| `apps/api/src/routes/workspace-research.routes.test.ts` | Route delegation, authorization and error-envelope unit coverage |
| `apps/api/src/routes/workspace-research.routes.integration.test.ts` | Real authenticated coordinator/formation/start and access regression coverage |
| `apps/api/src/services/cohort-workspace.service.ts` | Validated cohort-linked team formation only |
| `apps/api/src/services/cohort-workspace.service.test.ts` | Formation scope/lifecycle/membership unit coverage |
| `apps/api/src/routes/workspace.routes.ts` | Mount start route; optional cohort link on create and cohort-linked join validation |
| `apps/api/src/routes/workspace.routes.test.ts` | Preserve real Prisma exports in the existing deletion test double for new imports |
| `apps/api/scripts/run-database-integration-tests.mjs` | Include the new HTTP suite in the guarded runner |
| `docs/cohort-research-start.md` | Audit, contracts, implementation decisions and verification report |

## Tests added

34 route unit cases cover exact delegation/201/200 response, active leadership,
researcher role, absent cohort, missing workspace, query rejection, every domain
error mapping, revocation wording and safe persistence/unexpected-error handling.
Seven formation unit cases cover cohort-derived identity, transactional workspace
creation, active membership, inactive lifecycle states and account/scope checks.
The existing six workspace deletion cases remain unchanged in behavior.

20 new HTTP integration cases create/activate a cohort and assign its process via
coordinator endpoints, add researchers, create/join cohort-linked teams, and start
through real authenticated requests. They prove formation/invitation/acceptance
creates no case or access, correct provisional case creation, exact roles,
201/200 idempotency, simultaneous starts producing one case, and no new start
notifications. They cover outsiders, unrelated cohort members, ordinary members,
departed leaders, metadata tampering, cohort-null workspaces, removed cohort
members, DRAFT/CLOSED/ARCHIVED lifecycle, process configuration and revoked access.

The suite also checks active enrollment timestamps, post-start member access,
submission/resource denial after enrollment revocation while case membership
remains, the existing post-start join restriction, explicitly created SOLO cases,
and unchanged legacy cohort-null formation. Existing Phase 4 integration retains
full manual-registration/resolver, null-cohort project, pinned-instance progression,
and legacy participation coverage. Existing document/submission suites run too.

## Remaining Phase 6 work

The student frontend still uses manual registration. Phase 6 must deliberately
connect cohort selection and team assembly to the explicit leader Start Research
action, handle the existing case response/role-specific access, and update the
manual-registration experience/navigation. It must not infer readiness merely
from workspace existence. Optional readiness projection, broader team management
before start, and a coordinator-controlled solo eligibility policy remain
separate decisions. No Phase 6 UI change is implemented here.

## Final local validation (2026-10-27, Asia/Manila)

| Check | Result |
| --- | --- |
| Focused start/formation/deletion unit run | Passed: 47 cases (41 new, 6 existing) |
| Focused authenticated HTTP integration | Passed: all 20 new cases, clean teardown |
| `npm run type-check` | Passed |
| `npm run build` | Passed; existing frontend bundle-size warning remains |
| `npm run lint` | Passed |
| `npm test` | Passed: 824 executions (483 API, 229 web, 64 validations, 32 auth, 16 email); 110 opt-in database tests skipped here |
| `npm run test:integration:local` | Passed separately: all 110 tests in 14 suites, clean fixture teardown |
| New TypeScript formatting and `git diff --check` | Passed |

The unit count retains the existing emitted test copies in auth/validations,
consistent with the Phase 0 baseline. Only the guarded local `advisio_test`
database was used for integration fixtures and it was stopped after verification.
The full runner found no pending migrations; Phase 5 adds no schema migration and
does not migrate production/development data. No production rollout or Phase 6
frontend migration is part of this work.
