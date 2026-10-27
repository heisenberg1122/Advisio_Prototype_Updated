# Research cohort database foundation

Implemented on `refactor/cohort-driven-research-flow`. This stage adds database
structure only. No routes, frontend behavior, registration flow, enrollment
rules, or existing workflow/project fields are changed.

## Exact additions

The authoritative definitions are in
`packages/database/prisma/schema.prisma`; the additive SQL is in
`packages/database/prisma/migrations/20261027000300_research_cohorts/migration.sql`.

Enums:

- `ResearchCohortStatus`: `DRAFT`, `ACTIVE`, `CLOSED`, `ARCHIVED`.
- `ResearchCohortMemberStatus`: `ACTIVE`, `REMOVED`.

`ResearchCohort` maps to `research_cohorts`:

| Field | Definition |
| --- | --- |
| `id` | UUID primary key; `gen_random_uuid()` |
| `name` | Required `VarChar(150)` |
| `description` | Nullable `Text` |
| `collegeId` | Required UUID; `college_id` |
| `programId` | Required UUID; `program_id` |
| `researchTypeId` | Required UUID; `research_type_id` |
| `academicYearId` | Required UUID; `academic_year_id` |
| `workflowId` | Nullable UUID; `workflow_id` |
| `status` | `ResearchCohortStatus`; defaults to `DRAFT` |
| `createdBy` | Required UUID; `created_by` |
| `createdAt` | `DateTime`; defaults to `now()`; `created_at` |
| `updatedAt` | `DateTime`; Prisma `@updatedAt`; `updated_at` |

Relations: `college`, `program`, `researchType`, `academicYear`, `workflow`,
`creator`, `members`, `workspaces`, and `researchProjects`.

`ResearchCohortMember` maps to `research_cohort_members`:

| Field | Definition |
| --- | --- |
| `id` | UUID primary key; `gen_random_uuid()` |
| `cohortId` | Required UUID; `cohort_id` |
| `userId` | Required UUID; `user_id` |
| `status` | `ResearchCohortMemberStatus`; defaults to `ACTIVE` |
| `joinedAt` | `DateTime`; defaults to `now()`; `joined_at` |
| `removedAt` | Nullable `DateTime`; `removed_at` |

Relations: `cohort` and `user`. The `(cohortId, userId)` pair is unique.

Both `ResearchProject` and `ResearchWorkspace` gain:

```prisma
cohortId String? @map("cohort_id") @db.Uuid
cohort   ResearchCohort? @relation(fields: [cohortId], references: [id], onDelete: SetNull)

@@index([cohortId])
```

Reverse relations:

- `College.researchCohorts`
- `Program.researchCohorts`
- `AcademicYear.researchCohorts`
- `ResearchType.researchCohorts`
- `Workflow.researchCohorts`
- `User.createdResearchCohorts`, using relation name `ResearchCohortCreator`
- `User.researchCohortMemberships`

Indexes:

- Cohorts: `(collegeId, programId)`, `academicYearId`, `researchTypeId`,
  `workflowId`, `createdBy`, and `status`.
- Members: unique `(cohortId, userId)`, plus `(userId, status)` and
  `(cohortId, status)`.
- Projects and workspaces: `cohortId` on each table.

## Referential actions

- Cohort references to college, program, research type, academic year, workflow,
  and creator use `onDelete: Restrict`.
- Membership references to users use `onDelete: Restrict`.
- Deleting a cohort cascades only to its cohort-membership rows. It sets the
  cohort links on projects/workspaces to null; those academic records survive.
- All new foreign keys use `ON UPDATE CASCADE`.

## Migration and backfill concerns

- The migration creates two enums, two tables, two nullable columns, eleven
  indexes (including the membership unique index), and ten foreign keys.
  It contains no drops, renames, row updates, or data deletion.
- Existing projects/workspaces keep `cohortId = null`. No cohort or membership
  rows are inferred or backfilled. A workflow/type alone cannot identify a
  class, section, batch, or academic cohort reliably.
- `ResearchType.workflowId`, `Workflow.researchTypeId`, `WorkflowEnrollment`,
  and all existing fields/models remain unchanged. No membership synchronization
  with workflow enrollments is introduced.
- Individual foreign keys enforce existence. They do not enforce matching
  college/program/type across a cohort, matching cohort IDs between a project
  and its workspace, researcher eligibility, or a published workflow status.
  These policies require explicit validation in later cohort services.
- `removedAt` and membership status are stored independently. Future membership
  operations must set/clear them together and reactivate the same unique row.
- Cohort workflow assignment does not add immutable process versions or migrate
  running workflow instances. Those behaviors remain outside this stage.
- Creator/user deletion and the metadata-driven user-deletion planner require
  cohort-aware review before real cohorts are provisioned. Ordinary deletion is
  protected by foreign keys, while explicit deletion services can plan dependent
  records from Prisma relations.
- Deploy the migration before running code generated from the new schema. Normal
  Prisma model reads can select the new nullable columns even without cohort UI.
- Nullable column additions avoid a data backfill, but PostgreSQL still takes
  DDL locks and builds the two new indexes on existing tables. Schedule production
  deployment according to table size and concurrent activity.
- A whole-database schema comparison also reports pre-existing foreign-key
  differences in `packet_document_reviews`, `packet_review_publications`, and
  `pdf_evaluations`, plus two index-name differences in `task_submission_attempts`.
  Comparing the same database against the saved pre-cohort schema produced
  identical non-cohort differences. The new cohort structures have no drift.
  No corrective or destructive SQL for those older differences was applied.

## Verification

The required Prisma generation and project-wide type-check passed, as did the
database package build and Prisma schema validation. Project-wide unit tests
passed with 667 test executions (49 database tests are opt-in and run separately).

A transactional migration smoke test created legacy projects/workspaces before
the SQL ran and verified they survived with null cohort links. It also verified
enum values, defaults, membership uniqueness, invalid foreign-key rejection,
removal status, assigned-workflow deletion protection, membership deletion
protection, and cohort deletion behavior. The whole smoke test was rolled back.

The migration was then applied through the normal guarded runner only to the
isolated local `advisio_test` PostgreSQL 16 database. Development and production
databases were not migrated. All 49 existing integration tests in 11 suites
passed against the migrated database, including the teardown verification that
known fixture roots were absent. The isolated test database was stopped after
verification. No subsequent architecture stage was started.
