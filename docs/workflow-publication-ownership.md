# Phase 3: cohort-owned workflow selection

## Publication

`POST /api/workflows/:id/publish` keeps the existing publish permission, scoped
management check, readiness validation, transaction, stage ordering, publication
timestamp, audit entry, and deduplicated notifications. It no longer writes
`ResearchType.workflowId`. Publication does not update any cohort assignment or
workflow instance. Notification text describes availability for assignment and
does not imply that a cohort was switched.

New named workflow drafts start at version 1 independently. Existing name
validation, management authorization, and stored version numbers are preserved.
This does not introduce process family/version models or a new versioning API.

## Runtime selection

`resolveRegistrationWorkflow()` no longer loads the research type's legacy
workflow relation or falls back to its pointer. A new researcher selection must
intersect active legacy enrollment with an explicitly assigned, published process
on an ACTIVE cohort where the researcher is an ACTIVE member. Selection checks
college/program scope, consistent research-type/program/college relations, active
academic configuration, the existing workspace's cohort when present, and the
requested academic year when provided. Multiple
eligible processes require an explicit workflow ID. A researcher's additional
management role does not bypass their own membership requirement.

Staff registration has no implicit process default. An explicitly requested
process must have an active cohort assignment within the staff member's permitted
academic scope. Existing registration validation still applies.

New untitled workflow participation uses the same cohort eligibility rule,
including when a new member joins an existing workspace's workflow record. A
workspace with `cohortId` must use that cohort's assignment. Automatic participant
inclusion also requires active membership in the eligible cohort and the existing
enrollment/account/scope checks.

Existing project instances stay pinned to their stored workflow ID and version.
Existing participation can resume without retroactive cohort assignment. Title
registration can promote an existing current-year workflow draft using its
server-loaded workflow ID; request data cannot supply this compatibility bypass.
Legacy enrollment and publication checks still apply to that promotion.

The selection helper only reads cohort records. Adding/removing cohort members
still does not create, revoke, or restore `WorkflowEnrollment`. Existing document,
submission, and resource authorization remain separate. This stage does not
automatically provision cohorts, memberships, workspaces, or projects, backfill
runtime `cohortId` fields, or change frontend pages.
Existing registration provisioning remains; this stage changes its process
selection and preserves promotion of already-running drafts.

## Schema and deployment

`ResearchType.workflowId` remains nullable with an explicit deprecated/legacy
Prisma comment. Its existing values and relation are preserved as compatibility
metadata. Demo seeds and integration fixtures may still populate that metadata;
production workflow selection does not use it.

`Workflow` replaces `@@unique([researchTypeId, version])` with
`@@index([researchTypeId, version])`. Migration
`20261027000400_workflow_version_index` drops only the former unique index and
creates a non-unique index on the same columns. It deletes no records and changes
no foreign keys or nullable cohort references. The development seed now finds
its named demo process explicitly before updating/creating it, because Prisma
no longer generates the removed composite unique selector.

Apply this migration before allowing duplicate research-type/version writes.
Index creation uses normal PostgreSQL locking; schedule deployment according to
the size and traffic of the workflow table. Once duplicate pairs exist, restoring
the old unique index requires resolving those duplicates first. No data backfill
is part of this migration. Before new researchers start a process, a coordinator
must explicitly configure an active cohort, its process, and its members; legacy
workflow enrollment remains an independent requirement.

## Verification

Focused unit coverage checks publication isolation, preserved publish access
controls/readiness/audit behavior, cohort selection, mixed-role membership,
ambiguous choices, academic consistency, and existing pinned participation.

The cohort HTTP integration suite creates two version-1 processes for the same
research type through the API, publishes them, and verifies the legacy pointer
and all active cohort fields remain unchanged by publication. It then assigns
different published processes to two cohorts and tests selection, membership
removal, and preservation of legacy enrollment. Existing participation and
registration integration fixtures now provide explicit cohort assignments.

Only the guarded local `advisio_test` database is used for database verification.
No application/deployment database is migrated by these checks.

Verified locally on 2026-10-27 (Asia/Manila):

| Check | Result |
| --- | --- |
| Database `db:generate` | Passed |
| Database package build (`prisma generate && tsc`) | Passed within the workspace build |
| `npm run type-check` | Passed |
| `npm run build` | Passed; existing frontend bundle-size warning remains |
| `npm run lint` | Passed |
| `npm test` | Passed: 732 test executions; 58 opt-in database tests skipped here |
| `npm run test:integration:local` | Passed separately: all 58 tests in 12 suites, with clean fixture teardown |

The test count includes the validation/auth packages' existing emitted test
copies, consistent with the Phase 0 baseline. The migration was applied only to
the isolated local test database; a final full integration rerun confirmed no
pending migrations and clean teardown. That database was stopped afterward.
No subsequent architecture phase was started.
