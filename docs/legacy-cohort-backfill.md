# Phase 9 — conservative legacy cohort backfill

Implementation baseline: `aa9d23c`, `refactor/cohort-driven-research-flow`.

## Before-edit relationship audit

- Project academic IDs are required, but must still be checked against the
  Program/ResearchType/AcademicYear rows. Missing/corrupt evidence is skipped.
- Project.workflowInstanceId and WorkflowInstance.researchId provide two sides
  of case pinning. Both must agree. Workflow.researchTypeId is a scalar UUID,
  so compatibility must be validated explicitly.
- Workspace has college/program and optional cohort, but no academic year or
  research type. All associated cases, including already linked/history cases,
  must resolve consistently before filling its cohort link.
- ResearchMember/WorkspaceMember have leftAt. ResearchMember roles include
  non-researcher academic relationships; only active LEADER/MEMBER participants
  are membership evidence, subject to account role/status and academic scope.
- Enrollment has workflow/user/status/joinedAt, but no year/section. It is access
  authorization, not a cohort. Revocation is never changed. Enrollment-only
  evidence needs a proven single workflow container and independent persisted
  year evidence; profile researchType display strings are never used.
- Cohort identity has five academic/process IDs and no unique identity key.
  Multiple exact matches are ambiguous. Lifecycle is not a tie breaker.
- Cohort membership uniqueness is cohortId/userId. REMOVED is an administrative
  decision and must never be restored by this tool.
- Existing audit helpers attribute actions to authenticated users. There is no
  established migration-actor convention. This utility uses an external report,
  without impersonating the historical coordinator or writing audit rows.

## Implementation policy

Default mode is DRY RUN. One pure planner drives dry-run and apply. No shared,
preview, production or existing local development data is used during validation.
Apply is currently guarded to the explicitly identified isolated integration
database; production target authorization remains a separately reviewed operation.

Creation candidates require a single persisted workflow container, consistent
case/team scope/year, an eligible in-scope coordinator creator, and a reconciled
active enrollment/participant population. Scope/year alone cannot establish a
container. Creation requires `--apply --create-safe-cohorts`, creates DRAFT with
current timestamps, and never invents section/lifecycle history. Existing cohort
statuses are preserved, including CLOSED and ARCHIVED historical attachment.

Browser/mobile verification remains pending pre-merge. Phase 10 is not started.

## Deterministic decision algorithm

1. Read a consistent REPEATABLE READ, READ ONLY snapshot. Projects are the unit
   of academic evidence, including already-linked and historical projects needed
   to validate shared Workspaces. Projectless unlinked Workspaces are reported.
2. Validate the Program→College and ResearchType→Program ID relationships and a
   persisted academic year. Require both sides of the pinned instance link to
   agree, the workflow's scalar researchTypeId to match, a positive pinned version,
   and any current stage to belong to that workflow. Do not substitute a default,
   enrollment, latest version or currently published Process.
3. Preserve valid non-null cohort links. A project/workspace disagreement or an
   incompatible non-null link is a conflict, with no automatic correction.
4. Match all five academic/process identity IDs exactly. A single existing match
   is eligible; two or more are ambiguous, irrespective of lifecycle or owner.
   A valid explicit project link remains authoritative for already-linked cases.
   A workspace pointer does not break a tie between multiple matching cohorts.
5. When there is no existing match, evaluate the stricter legacy-container policy
   below. No candidate or link is produced without sufficient persisted evidence.
6. Resolve each Workspace only if every associated case resolves to the same
   cohort and its existing non-null link is compatible. Otherwise leave it
   unchanged, while allowing independently safe case links where non-contradictory.
7. Derive memberships from eligible active LEADER/MEMBER case participants and
   eligible active team participants of a fully resolved Workspace. Merge/deduplicate
   evidence. Consider enrollment-only evidence separately under the rules below.
8. Existing ACTIVE members are no-ops. Existing REMOVED members and competing
   same-identity cohort participation are reported and preserved.
9. Group actions by cohort and connected multi-case Workspaces. Dry-run displays
   that plan; apply executes only the identical revalidated actions transactionally.

The loader intentionally reads more than cohort-null projects: otherwise a
partially migrated or historical peer case could be overlooked when assigning a
shared Workspace. Reports contain IDs, reason codes and generated cohort metadata,
not researcher names/emails or database credentials. The source snapshot itself is
not serialized into reports.

## Safe missing-cohort reconstruction

Automatic creation **is implemented**, but only when explicitly enabled. All of
the following must hold:

- A specific pinned legacy workflow/container, not just academic scope, exists.
- Every case using it has validated, identical college/program/type/year evidence.
  Contradictory, missing-pin, already-conflicted or multiple-year evidence prevents
  reconstruction. A shared Workspace cannot introduce cases outside this container.
- There is no existing cohort associated with that workflow which would make
  reconstructing its boundary uncertain. Academic scope alone is never enough.
- Its active persisted case/team participant population is nonempty, eligible,
  and exactly reconciled with the workflow's nonempty ACTIVE enrollment population.
  Incomplete, extra, ineligible or unmatched enrollment/participant populations
  prevent creation; revoked enrollment is never used to complete that proof.
- The workflow is PUBLISHED or ARCHIVED, and has one persisted ACTIVE creator with
  RESEARCH_COORDINATOR role in the exact college/program. A random administrator
  or unrelated actor is never substituted.

The grouping key is workflow ID + college + program + research type + academic year.
Generated names use the persisted process name/year plus `Migrated`; the process
name is truncated within the 150-character limit while preserving that suffix.
No section is inferred. `createdBy` is the proven original coordinator owner,
while the report identifies this as a current migration, not a historical action
by that coordinator. New cohorts are DRAFT with current automatic timestamps.
DRAFT blocks new research start but does not invalidate already-existing cases;
their authorized read/continue behavior remains intact. No cohort is activated.

The normal `--apply` leaves creation-dependent groups report-only with
`CREATION_NOT_AUTHORIZED`. `--create-safe-cohorts` alone is still a dry-run.
Only `--apply --create-safe-cohorts` can create these proven containers.

## Membership and access policy

- The account must be ACTIVE, have RESEARCHER role, and have the exact cohort
  college/program. Project faculty roles are excluded from researcher inference.
- Active ResearchMember and fully resolved WorkspaceMember evidence can justify
  cohort membership even when legacy process enrollment is revoked. The report
  lists the independent evidence and never changes that revocation.
- Enrollment alone requires ACTIVE status, the exact pinned workflow/type scope,
  a single consistent workflow container/year, exactly its one represented cohort,
  and an independent matching ResearcherProfile.academicYearId. Profile research
  type display strings are not authoritative and are never used. A departed case
  or team relationship contradicts enrollment-only inference and causes a skip.
- Enrollment-only users with missing/ambiguous year/container evidence, non-active
  enrollment, or contradictory participation do not become cohort members.
- Removed cohort membership is never restored. Existing ACTIVE membership is never
  updated or backdated. Conflicting ACTIVE same-identity membership in another
  cohort or competing planned participation is reported rather than guessed.
- A skipped membership does not prevent separately safe cohort links. Cohort
  membership does not grant or repair WorkflowEnrollment process access.

## Apply, concurrency, stale plans and audit

Each cohort/case cluster runs in a SERIALIZABLE transaction with a dedicated
transaction advisory lock. Before any write, the executor verifies the live target,
compares the evidence fingerprint and recomputes the group with the **same planner**.
The group must match exactly. Link updates additionally require `cohortId = null`;
existing non-null values are never overwritten. Memberships use the database's
cohort/user uniqueness constraint with insert-only behavior.

The fingerprint covers the full relevant snapshot, including persisted timestamps,
case links, assignments, membership states and enrollment data. This deliberately
conservative first implementation may skip remaining groups after even an unrelated
source change. After a transaction's own successful writes, its expected fingerprint
is advanced to include those known writes. An external change produces STALE_PLAN,
never a silent remapping. Run a fresh dry-run for review rather than forcing it.

Serialization conflicts are STALE_PLAN. Other group failures are APPLY_FAILED;
that group's writes roll back. Unrelated safe groups can still proceed. Ambiguity
or an unapproved creation group does not abort other safe groups. There is no
automatic retry with a changed mapping, destructive cleanup, or repair operation.

The external apply report records `LEGACY_COHORT_BACKFILL`, completion time, source
fingerprint, plan/evidence, actual writes per action kind, per-group status and
created-cohort ID mappings. No audit rows or notifications are generated. No
existing authenticated-user audit helper is repurposed to impersonate a historical
researcher/coordinator. Fixture cleanup uses the existing isolated-test helpers;
it is not part of the migration utility or its write surface.

On identical fixture state, second apply performs zero material writes and reports
ALREADY_MIGRATED / MEMBERSHIP_ALREADY_EXISTS. Concurrent apply, including automatic
creation, cannot duplicate cohort or membership rows. Failed clusters roll back
new cohorts and memberships as well as links.

## Commands and operational boundary

Build once before using the tool:

```powershell
npm --workspace=@research-management/database run build
```

Set `BACKFILL_DATABASE_URL` explicitly to the reviewed target through the execution
environment. The tool does not load `.env` or fall back to DATABASE_URL. It validates
live database/user/schema/application identity against the explicit URL without
printing credentials. No database is contacted by `--help` or invalid flags.

```powershell
npm run backfill:cohorts -- --dry-run
npm run backfill:cohorts -- --dry-run --json
npm run backfill:cohorts -- --apply
npm run backfill:cohorts -- --apply --create-safe-cohorts
```

The root command delegates to the database package; the direct executable is
`node packages/database/dist/legacy-cohort-backfill-cli.js`. For pure JSON stdout
without npm banners, use that direct executable with `--json`, or use
`--output backfill-reports/plan.json` after creating the ignored report directory.
With --json, the prominent pre-write summary goes to stderr. Report files use
exclusive creation and are never overwritten; an existing/unwritable destination
is rejected before any apply writes. Actual migration/student reports must not be
committed. `/backfill-reports/` is ignored; there are no real-data reports in this
change.

**Phase 9 apply is locked to isolated validation:** local `advisio_test`, public
schema, application_name=advisio-integration-tests, NODE_ENV=test,
RUN_DATABASE_INTEGRATION_TESTS=1 and an explicit INTEGRATION_TEST_RUN_ID are required.
No unsafe bypass/force flag was added. The fixture tests set BACKFILL_DATABASE_URL
to the already verified INTEGRATION_DATABASE_URL. Production/shared/preview apply
is refused. A later production operation needs separate reviewed target-policy
authorization and a real-data dry-run; implementation completion is not permission
to run it. This phase used only the isolated database.

Unknown/conflicting/duplicate flags are rejected. Apply failures or stale groups
produce exit code 2; invalid options/targets or report setup failures produce 1.
Dry-run and report-only creation candidates return 0. Review report skip reasons
even when the command exits successfully. Persisted dry-run files are review
artifacts, not promises that the same actions remain safe later; apply replans and
revalidates in-process before executing its plan.

## Report fields and fixture example

Counts distinguish project decisions, cohort candidates, planned row actions and
finding events. SKIPPED counts findings, not a migration percentage: a case can
have a safely planned link while a membership/Workspace has its own skip reason.
Planned counts can include creation-dependent actions; actual applied counts are
separate under `written` / `writesPerformed` and per-group results.

Controlled one-case fixture, with one existing matching cohort:

```text
Legacy Backfill Plan
MODE: DRY RUN
Projects inspected: 1
ALREADY_MIGRATED: 0
SAFE_EXISTING_COHORT_MATCH: 1
SAFE_COHORT_CREATION_CANDIDATE: 0
PROJECT_LINK_UPDATE: 1
WORKSPACE_LINK_UPDATE: 1
MEMBERSHIP_CREATE: 1
MEMBERSHIP_ALREADY_EXISTS: 0
AMBIGUOUS: 0
CONFLICT: 0
INSUFFICIENT_EVIDENCE: 0
SKIPPED: 0
New cohort creation authorized: NO (candidates are report-only)
Writes performed: 0
```

Machine-readable JSON includes `mode`, `writesPerformed`, safe target identity and
`plan` (`format`, `sourceHash`, `projectsInspected`, counts, action groups, findings).
Each finding identifies the entity/user IDs and reason. Each action lists its
evidence and target. An apply report additionally contains actual counts and group
outcomes. This is synthetic fixture output, not a production inventory.

Reason codes:

| Code                                      | Meaning / disposition                                                 |
| ----------------------------------------- | --------------------------------------------------------------------- |
| AMBIGUOUS_EXISTING_COHORT                 | Multiple exact cohorts; no choice made                                |
| MISSING_ACADEMIC_YEAR                     | Missing/invalid year; no inference from current year                  |
| NO_PINNED_WORKFLOW                        | Missing forward pinned instance; no fallback                          |
| PINNED_WORKFLOW_CONFLICT                  | Reverse link/type/version/current-stage evidence disagrees            |
| ACADEMIC_SCOPE_CONFLICT                   | Program/college/type relationships disagree                           |
| WORKSPACE_SCOPE_CONFLICT                  | Workspace missing or academic scope differs                           |
| PROJECT_WORKSPACE_COHORT_CONFLICT         | Both links non-null and unequal                                       |
| COHORT_LINK_CONFLICT                      | Existing non-null relationship incompatible                           |
| MULTIPLE_ACADEMIC_YEARS                   | Legacy container spans different years                                |
| INSUFFICIENT_CREATOR_EVIDENCE             | No eligible in-scope coordinator creator                              |
| INSUFFICIENT_LEGACY_CONTAINER_EVIDENCE    | Container boundary cannot be proven                                   |
| UNRECONCILED_LEGACY_POPULATION            | Enrollment and participant populations cannot establish a container   |
| WORKSPACE_WITHOUT_CASE_EVIDENCE           | No cases establish year/type/process                                  |
| UNRESOLVED_WORKSPACE_CASE                 | At least one peer case cannot be resolved                             |
| WORKSPACE_MULTI_COHORT_CONFLICT           | Peer cases resolve to multiple cohorts                                |
| OUT_OF_SCOPE_RESEARCHER                   | Account missing/inactive/non-researcher/out of college/program        |
| NON_ACTIVE_ENROLLMENT_ONLY                | Non-active enrollment alone is insufficient                           |
| INSUFFICIENT_ENROLLMENT_YEAR_OR_CONTAINER | Missing/contradictory year/container or departed participation        |
| REMOVED_MEMBERSHIP_CONFLICT               | Preserve explicit REMOVED decision                                    |
| CONFLICTING_COHORT_MEMBERSHIP             | Another current same-identity membership conflicts                    |
| CONFLICTING_COHORT_PARTICIPATION          | New memberships would compete across same-identity cohorts            |
| CREATION_NOT_AUTHORIZED                   | Plan retained; separate creation option absent                        |
| STALE_PLAN                                | Evidence/group changed or serialization conflict; no writes for group |
| APPLY_FAILED                              | Group failed; its writes rolled back                                  |

## Regression coverage

Planner/command tests cover exact matches across all four cohort states; each
identity dimension; repeatability/immutability; already-correct links/membership;
multiple matching cohorts; missing/reverse-conflicted pin or foreign current stage;
missing year; both partial linkage directions; contradictory links; multi-case
same/different/unresolved Workspaces; proven/missing/unreconciled containers;
multiple years; creator evidence; active/removed/competing memberships; revoked
enrollment with/without independent participation; enrollment-only year evidence;
account eligibility; projectless Workspaces; default/invalid flags; and unsafe targets.

Database fixtures cover:

1. Repeatable dry-run with exact before/after snapshots of **every public table**.
2. Actual CLI default dry-run JSON, with the same complete zero-write assertion.
3. Unique exact match, one-time links/membership and idempotency in an ARCHIVED cohort.
4. Ambiguity skipped while an unrelated safe group migrates.
5. Missing forward pin despite legacy ResearchType default; zero writes.
6. Candidate report-only under normal apply; explicit DRAFT creation once; stable rerun.
7. Partial links and non-null project/Workspace conflict preservation.
8. Same-cohort multi-case Workspace linked once.
9. Different-cohort multi-case Workspace preserved; individual cases safely linked.
10. REMOVED membership and timestamps preserved.
11. Revoked enrollment insufficient alone; independent participation may add membership;
    protected manuscript API still denies revoked access.
12. Enrollment-only independent profile year accepted, departed relationship rejected.
13. Administrative member removal after planning causes STALE_PLAN and zero writes.
14. Injected group failure rolls back newly created cohort/member/link writes.
15. Concurrent existing-cohort apply cannot duplicate links/memberships.
16. Concurrent safe-creation apply cannot duplicate cohorts, with stable rerun IDs.
17. An additional compatible cohort after planning causes STALE_PLAN, without choosing.
18. Legacy-case API read, unchanged protected rows and identical progress projection
    after apply, followed by successful unchanged engine advancement.

The history fixture populates a manuscript, approved submission, adviser membership
and accepted request, consultation, defense session/released decision, panel invitation
and evaluation. It compares every table except the allowed cohort/membership tables
and cohortId/automatic updatedAt on project/Workspace. Existing cohort status and
timestamps are separately compared exactly. This verifies unchanged titles, status,
participation, member history, pinned instance/version/current stage, enrollment,
Process/Phase/Requirement definitions and all represented academic records. The
Phase 6 resolver additionally tests all four cohort states: an existing backfilled
case remains current/history and never offers another Start Research. No frontend
production behavior changed.

The first integration run found a fixture invitation-code length error before the
new tests could execute. Its fixture was corrected to respect the existing 32-character
field. The guarded rerun passed without changing schema, test isolation or access
controls. No real student data or target was used.

## Files changed

| Path                                                               | Change                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `packages/database/src/legacy-cohort-planner.ts`                   | Pure evidence planner, decisions, groups, counts and fingerprints                          |
| `packages/database/src/legacy-cohort-backfill.ts`                  | Explicit/live target guard, read-only snapshot, transactional exact-plan executor, summary |
| `packages/database/src/legacy-cohort-backfill-cli.ts`              | Dry-run default CLI, policy flags, JSON/report output and exit codes                       |
| `packages/database/package.json`                                   | Backfill command and side-effect-free subpath export                                       |
| `package.json`                                                     | Root backfill command                                                                      |
| `.gitignore`                                                       | Keep generated real-data reports out of source control                                     |
| `apps/api/src/services/legacy-cohort-backfill.test.ts`             | Planner and command guard tests                                                            |
| `apps/api/src/services/legacy-cohort-backfill.integration.test.ts` | Real fixture dry-run/apply/history/concurrency tests                                       |
| `apps/api/scripts/run-database-integration-tests.mjs`              | Include new suite in guarded sequential runner                                             |
| `apps/web/src/lib/researcher-lifecycle.test.ts`                    | Backfilled existing-case continuation regressions only                                     |
| `docs/legacy-cohort-backfill.md`                                   | Audit, algorithm, operating boundary and implementation report                             |

No schema/migration, backend route, authorization, cohort service, frontend behavior,
case provisioning, process publication or execution-engine implementation changed.

## Validation

| Check                                                 | Result                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Focused planner/command safety tests                  | 35 passed                                                                                             |
| Focused migration database tests                      | 18 passed in the full guarded suite                                                                   |
| Researcher lifecycle regression file                  | 39 passed, including 4 new cohort-state continuation cases                                            |
| Dry-run zero-write verification                       | Complete before/after snapshots of every public table unchanged, including actual CLI default dry-run |
| Apply idempotency                                     | Existing and newly reconstructed cohort reruns: zero material writes; stable IDs/history              |
| Rollback/concurrency/stale evidence                   | Passed against isolated PostgreSQL; no duplicate cohorts/memberships or partial failed-group writes   |
| Database package build / Prisma generate / TypeScript | Passed; no schema or migration diff                                                                   |
| `npm run type-check`                                  | Passed, 9 tasks                                                                                       |
| `npm run build`                                       | Passed, 6 tasks; existing Vite chunk-size advisory unchanged                                          |
| `npm run lint`                                        | Passed, repository lint task                                                                          |
| `npm test`                                            | 1,007 passed executions: API 539, web 354, validations 66, auth 32, email 16                          |
| `npm run test:integration:local`                      | 141 passed across 16 files: 123 existing plus 18 Phase 9 cases                                        |
| `git diff --check`                                    | Passed                                                                                                |

There are 35 new planner/command tests, 18 new database fixtures and 4 new lifecycle
assertions (57 added executions across unit/integration categories). Missing-year
and certain corrupt relationship scenarios are pure-planner fixtures because the
current NOT NULL/foreign-key constraints prevent constructing those invalid rows;
no constraints were weakened to make fixtures possible.

The full integration runner retains its explicit database identity, migration and
fixture-cleanliness guards. Teardown verified that fixture roots were absent, and
the isolated PostgreSQL server was stopped. Integration-only tests are intentionally
skipped by the unit command and were run separately above. The full suite also
retains legacy registration/participation, provisioning, Phase 7 management, Phase 8
publication/ordering, special adviser/defense and enrollment authorization coverage.

No application/shared/preview/production backfill was applied. At implementation
review, these changes were uncommitted on `aa9d23c`. The separately authorized
checkpoint commit/push and its remote verification are reported in the accompanying
conversation; local validation does not imply remote CI/deployment success.

## Deliberately unresolved / Phase 10 boundary

No production, preview or shared development inventory or backfill was executed.
Consequently this report gives fixture counts, not a claim that all real legacy
records can be migrated. Missing years/pins/creator evidence, ambiguous sections,
reused multi-year process containers, conflicting links and explicit removals remain
manual review items. They are never silently repaired. Large inventories need a
reviewed operational window: the conservative full-snapshot planner is read-heavy
and uses a 60-second transaction timeout, with safe failure rather than partial
group writes. Reports must be secured outside version control.

Before any real-data application, review the target policy, backup/restore procedure,
actual dry-run plan and unresolved mappings as a separate deployment operation.
The production apply guard has not been relaxed by this implementation.

Phase 10 remains unstarted: final regression/merge approval, deployed browser smoke
paths, mobile/narrow-width verification, and production backfill authorization are
still pending. Carry forward the Phase 6–8 manual checks. Nothing in fixture success
claims real-browser interaction or visual verification. The production apply guard
must remain intact through Phase 10; a real-data operation is separately authorized.
