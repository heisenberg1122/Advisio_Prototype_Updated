# Research cohort backend management

Phase 2 adds authenticated cohort endpoints and a scoped service layer. It does
not change student registration, workflow publishing, frontend behavior, or the
database schema. It does not create projects, workspaces, or workflow instances.

## Endpoints

| Method and path | Request | Response |
| --- | --- | --- |
| `GET /api/cohorts` | Optional academic/status filters and pagination | `{ cohorts, pagination }` |
| `POST /api/cohorts` | Required `name`, `collegeId`, `programId`, `researchTypeId`, `academicYearId`; optional nullable `description` | `201 { cohort }` |
| `GET /api/cohorts/:id` | Cohort UUID | `{ cohort }` |
| `PATCH /api/cohorts/:id` | At least one of `name`, nullable `description`, or `status` | `{ cohort }` |
| `GET /api/cohorts/:id/members` | Cohort UUID | `{ members }` |
| `POST /api/cohorts/:id/members` | `{ userId }` or `{ userIds: [...] }`, at most 100 IDs | `201 { members }` |
| `DELETE /api/cohorts/:id/members/:userId` | Cohort and researcher UUIDs | `{ member }` with removal metadata |
| `PUT /api/cohorts/:id/workflow` | `{ workflowId }` | `{ cohort }` |

List filters are `collegeId`, `programId`, `researchTypeId`, `academicYearId`,
and `status`. Pagination defaults to `page=1&limit=50`; the limit is capped at
100. Pagination returns `page`, `limit`, `total`, and `totalPages`.

Request schemas reject unknown fields, malformed UUIDs, empty updates, and
oversized batches. UUIDs are canonicalized and duplicate member IDs are removed.
Names are trimmed and limited to 2-150 characters; descriptions to 5000.

Academic identity and creator ownership cannot be changed through PATCH.
Workflow assignment must use the dedicated endpoint. There is no generic cohort
delete route and no caller-controlled creation status or creator field.

## Authorization

All endpoints use `requireAuth`, existing permissions, and `getCollegeScope`.
The service also enforces management roles, including when called directly.

| Caller | Scope |
| --- | --- |
| `SYSTEM_ADMIN` | Institution-wide |
| `DEAN` | Assigned college, across its programs |
| `RESEARCH_COORDINATOR` | Assigned college, narrowed to their program when one is assigned |
| `RESEARCHER` | Read-only, active cohort membership and matching assigned academic scope |
| Other roles | No cohort access unless another explicitly authorized role is also held |

The coordinator rule matches the existing workflow convention: a coordinator
with a college but no program assignment has college scope. Non-admin accounts
without an assigned college are denied. Management is academic-scope based, not
restricted to the individual who created the cohort.

Read routes require `RESEARCH_VIEW`; creation uses `WORKFLOW_CREATE`;
configuration/process assignment uses `WORKFLOW_EDIT`; membership changes use
`RESEARCH_ASSIGN`. Researcher management is denied even if an account has an
extra permission grant. Existing researcher-panel restrictions continue to
narrow multi-role accounts to researcher privileges.

User filters intersect scope rather than replacing it. Out-of-scope and missing
cohort IDs return 404. Unauthenticated requests return 401; unauthorized roles
return 403. Researchers cannot view removed memberships; managers can inspect
membership history. Rosters expose only basic user identity, not emails,
credentials, or unrelated profile fields.

Cohort responses include academic labels, basic creator identity, workflow
identity/version/status, and counts. They do not include workflow stages,
resources, project contents, or other enrollment-protected data.

## Academic identity and process assignment

Creation validates an active college/program/research-type chain and an active
academic year. Activation, member addition, and workflow assignment revalidate
this academic context.

A process assignment must reference an existing PUBLISHED workflow whose
`researchTypeId` equals the cohort's research type. The validated research-type
chain establishes its program/college scope; workflow creator identity is not
used as the academic scope source.

The assignment updates only `ResearchCohort.workflowId`. It never updates
`ResearchType.workflowId`, enrolls participants in a workflow, or initializes
runtime records. Reassigning the same valid workflow is idempotent. Replacing a
workflow on a cohort that already has linked workspaces/projects returns 409;
an explicit process migration is required and is outside this phase.

## Lifecycle

Creation starts in DRAFT. Status changes use PATCH:

| Current state | Allowed next states |
| --- | --- |
| DRAFT | ACTIVE, ARCHIVED |
| ACTIVE | CLOSED, ARCHIVED |
| CLOSED | ACTIVE, ARCHIVED |
| ARCHIVED | None |

Activation/reopening requires an assigned workflow that is still published and
valid for the cohort. Membership/process changes are blocked for CLOSED and
ARCHIVED cohorts. Archived configuration is read-only; repeating an archive
request is harmless. Archiving retains the cohort and all academic records.

## Membership and transactions

Only ACTIVE accounts with the RESEARCHER role in the cohort's exact college and
program can be added. An ineligible ID rejects the entire batch before writes.
Adding an active member again preserves their join timestamp. Re-adding a removed
member reactivates the same unique row, clears `removedAt`, and records a new
`joinedAt`. Removal sets `status=REMOVED` and `removedAt`; it does not delete history.

Configuration, assignment, addition, and removal use serializable transactions.
Mutations share a cohort-specific advisory transaction lock, recheck scoped
access inside that transaction, and write audit records atomically. Concurrent
conflicts return 409 for a reload/retry. Member reads authorize and load the
roster within one serializable snapshot.

These operations change cohort membership only. Legacy `WorkflowEnrollment`,
workspace membership, project membership, and student registration remain
independent. No email, notification, or automatic enrollment side effects are
introduced.

## Tests

Validation tests cover server-controlled fields, strict update/assignment
contracts, pagination, member batches, and UUID normalization. Service tests
cover scope intersection, role checks, academic validation, lifecycle rules,
workflow protection, idempotence, and soft removal.

The guarded database integration runner now includes eight HTTP tests with real
authentication and database transactions. They cover coordinator/dean/admin
scope, researcher and restricted-panel access, atomic eligibility checks,
assignment validation, archival, reactivation, concurrent additions, audit
events, and the absence of runtime project/workspace/instance/enrollment creation.
The suite cleans up exact cohort fixture IDs before the existing fixture cleanup.

Verified locally on 2026-10-27 (Asia/Manila):

| Check | Result |
| --- | --- |
| `npm run type-check` | Passed |
| `npm run build` | Passed; existing bundle-size warning remains |
| `npm run lint` | Passed |
| `npm test` | Passed: 716 test executions; 57 opt-in database tests skipped here |
| `npm run test:integration:local` | Passed separately: 57 tests in 12 suites, including all 8 new cohort HTTP tests |

The new focused unit coverage is 25 service tests and 12 validation tests.
The existing validation package also runs its emitted test copies, as recorded
in the Phase 0 baseline. An integration attempt running alongside the build and
unit checks exited without a normal test summary; its cleanup passed. A separate
full rerun then passed all 57 tests and cleanup, without changing assertions,
timeouts, isolation guards, or access controls.

Only the isolated `advisio_test` database was used for cohort HTTP integration.
It was stopped after verification. No new schema migration, production/development
data changes, or subsequent migration phase is part of this work.
