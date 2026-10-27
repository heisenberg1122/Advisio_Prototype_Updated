# Phase 10 — final regression, architecture audit and merge gate

## A. Executive result

**READY WITH MANUAL CHECKS PENDING.**

The reconciled local implementation passes the full automated regression suite.
The production backfill guard is intact. No feature expansion or runtime-engine
change was introduced in Phase 10. Required deployed browser/role/mobile journeys
must not be treated as passed until they have actually been exercised.

Local regression and remote PR CI passed; the exact audited commit deployed to
Vercel. Public preview navigation and a limited mobile check were performed.
The user explicitly selected authenticated journeys as manual checks because no
approved preview-only role accounts were supplied. Those checks remain NOT RUN.

This report distinguishes local results, remote checks and manual verification.
Nothing here authorizes merging into main or executing a real-data backfill.

## B. Git reconciliation

| Item                           | Evidence                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Working branch                 | `refactor/cohort-driven-research-flow`                                                                      |
| Refactor HEAD before merge     | `f9dd6ffa09735e80c8ce5948d39ddacdb3b67987`                                                                  |
| Main HEAD fetched and merged   | `f6276e467fde35abb4760c1ddceb3f9ba0188084`                                                                  |
| Merge commit                   | `3d5386c270cbe1343b6ef8257e9063938779bc64`                                                                  |
| Method                         | `git merge --no-ff origin/main`; published refactor history preserved                                       |
| Conflicts                      | 39: 28 architecture/shared/test/package paths and 11 landing paths                                          |
| Main-only history              | 48 commits: 43 patch-equivalent non-merge commits, one historical merge, four genuinely new landing commits |
| Net new main work              | 23 public-home/landing paths                                                                                |
| Final audit HEAD / latest main | Recorded in final verification section below                                                                |

Fetch reported a forced upstream history update from previously remembered
`eba0928` to current main. This was an upstream fact, not a local force push.
`git cherry` and a tree comparison proved that all net changes from the accepted
pre-migration baseline to current main were landing-page work. Every incoming
architecture/shared conflicted blob was identical to that pre-migration baseline.

Conflict hunks were reviewed for global ResearchType publication, implicit Phase
resequencing, removed cohort constraints, legacy frontend creation fallback, pinned
case precedence, current query-cache selection, retained tests and commands. Those
were stale incoming assumptions, not new fixes to discard. The accepted Phase 1–9
versions were retained after per-path baseline equivalence checks. Shared context
and navigation were specifically reconciled; no auth/RBAC change was auto-selected.
Latest main's landing blobs were retained exactly. No migration conflicted.

The rewritten ancestor also reintroduced three components deliberately removed by
Phase 6 (`fc22f8e`): JoinedWorkflows.tsx, its obsolete component test, and
WorkflowStartPanel.tsx. Their incoming versions matched the old baseline exactly;
the existing accepted deletions were preserved, preventing revival of legacy
frontend creation. No accepted Phase 1–9 test was weakened or removed.

Before the merge commit, an exact staged-tree assertion verified that the only
differences from Phase 9 were the 23 landing paths and that each matched main's
blob. Architecture, shared application code, auth, schema and migration history
were unchanged by reconciliation. No rebase, reset, force push, feature-branch
deletion or merge into main was performed.

### Full main-only commit inventory

The 48 incoming commit IDs and subjects are listed in Appendix 1. The four new
non-equivalent commits are `fa37882`, `063ed63`, `903c361`, and `f6276e4`.

### Per-file conflict dispositions

Appendix 2 lists all 39 conflicted paths and their resolution. The remaining
automatically merged files were checked by the exact-tree assertion above.

### Full branch diff classification

Against reconciled main, the accepted Phase 0–9 diff covers 115 paths before this
report (plus the Phase 10 test extension/report). Major areas reviewed:

| Area                   | Review / disposition                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Schema/migrations      | Two cohort models/enums, nullable links, false-default provisional title and non-unique workflow index; existing models/history retained |
| Cohorts                | Scoped route/service/validation, lifecycle authority, eligible researcher lookup and membership separate from access                     |
| Provisioning           | Cohort/team evidence, exact membership, pinned instance, serializable/idempotent primitive and explicit leader start                     |
| Researcher lifecycle   | Cohort→team→Start Research; existing authorized case precedence; no normal manual-registration/participation writers                     |
| Coordinator lifecycle  | Cohort setup/management/monitoring, Process Templates and separate Process Access                                                        |
| Publication/builder    | Optional Phase, active/document integrity checks, saved sequence and independent publication/assignment                                  |
| Legacy backfill        | One pure planner, read-only default, isolated apply guard, exact evidence, rollback/staleness/idempotency                                |
| Shared shell           | Cohort routes/sidebar links, active case context and query refresh needed for new lifecycle; existing role protection retained           |
| Tests                  | Accepted coverage retained; one additional real same-track multi-cohort HTTP journey in Phase 10                                         |
| Documentation/tooling  | Phase reports, guarded integration runner and root commands; no real-data reports/credentials committed                                  |
| Landing reconciliation | Latest main's 23 paths; no custom landing redesign in this phase                                                                         |

## C. Architecture invariants

PASS here means source plus automated verification; it does not assert a browser
journey was performed.

| Invariant                                   | Status | Evidence                                                                                                             |
| ------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| Cohort owns new research lifecycle          | PASS   | cohort-workspace/provisioning services; workspace HTTP tests; researcher lifecycle tests                             |
| Process assignment is cohort-specific       | PASS   | `assignCohortWorkflow`; new same-track A/B/C HTTP regression                                                         |
| Publication independent of assignment       | PASS   | publication/access tests and HTTP snapshots of type/cohort/instance data                                             |
| Existing case pins WorkflowInstance         | PASS   | canonical provisioning repeat/version tests; publication/legacy/backfill history fixtures                            |
| ResearchType.workflowId not authoritative   | PASS   | absent from canonical selection/provisioning reads; deprecated metadata retained; misleading default fixture ignored |
| Membership separate from Process Access     | PASS   | cohort add/remove tests create no access; revoked enrollment unchanged after membership remove/re-add                |
| Leader-only Start Research                  | PASS   | route/service membership/leader checks; ordinary member HTTP 403                                                     |
| Idempotent provisioning                     | PASS   | repeat returns 200/same case; concurrent starts produce one instance/member/audit set                                |
| Legacy cases remain accessible              | PASS   | cohort-null HTTP fixtures and case-precedence/frontend tests                                                         |
| Historical records preserved                | PASS   | all-table Phase 9 before/after comparison with only allowed link/membership changes                                  |
| Sequential engine retained                  | PASS   | `sequence`, `currentStageId`, existing advance/conditions/deadlines; no RequirementInstance/DAG added                |
| No universal institutional sequence         | PASS   | independent reusable templates; no mandatory Phase; sequence is template-configured                                  |
| Special types retained                      | PASS   | ADVISER_SELECTION, DEFENSE_ELIGIBILITY and TITLE_PROPOSAL tests retained                                             |
| No global one-workspace-one-case constraint | PASS   | schema/index audit plus legacy multi-case Workspace fixtures                                                         |
| Real-data apply blocked                     | PASS   | Phase 9 target guard and command tests unchanged                                                                     |

## D. Automated validation and database audit

### Post-reconciliation run

| Check                                    | Result                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run type-check`                     | PASS — 9 tasks                                                                              |
| `npm run build`                          | PASS — 6 tasks                                                                              |
| `npm run lint`                           | PASS — repository lint task                                                                 |
| `npm test`                               | PASS — 1,007 executions: API 539, web 354, validations 66, auth 32, email 16                |
| `npm run test:integration:local`         | PASS — 142 tests across 16 files                                                            |
| `git diff --check`                       | PASS                                                                                        |
| Prisma generation/database compilation   | PASS through required dependency build                                                      |
| Isolated migration checksum/schema audit | PASS — 78 migration files, 78 applied, zero checksum mismatches, zero unfinished migrations |

The new Phase 10 HTTP test starts independent cases for same-track cohorts A/B,
publishes/configures a later Process/cohort C, proves the original instance IDs,
versions/current stages/type metadata/cohort assignments remain unchanged, rejects
unsafe reassignment, verifies repeated start does not duplicate cases/instances,
checks unrelated case access, and preserves revoked enrollment after cohort member
removal/re-addition. This extends coverage rather than changing production logic.

No post-merge automated failure or access-control regression was found in this run.
Git initially refused normal removal of a newly staged, resurrected legacy path;
restoring that path's accepted Phase 6 deletion resolved the index issue. This was
merge bookkeeping, not an application failure or reason to remove valid tests.

The build retains Vite's existing >500 kB chunk advisory; it is not a failing build.
No lint warnings/tests were suppressed. Integration-only tests are skipped by the
unit command intentionally and were run through the complete guarded PostgreSQL
runner. The fixture database and cleanup checks are isolated from application data.

### Database/migration conclusions

Only three migration files differ from main, all additive/data-preserving:

- `20261027000300_research_cohorts`: new enums/tables/FKs/indexes and nullable links.
- `20261027000400_workflow_version_index`: replaces the global pair uniqueness
  constraint's index with a non-unique index; no workflow data is deleted.
- `20261027000500_provisional_research_title`: adds non-null false-default flag.

The live isolated schema confirms both cohort_id columns nullable, the title flag
default false, unique cohort/user membership, a non-unique workspace case index and
a non-unique workflow research-type/version index. Existing models, nullable legacy
cases, process pinning and historical multi-case Workspaces remain representable.

There are **five pre-existing reused timestamp prefixes**, each with distinct full
migration names: `20261002010000`, `20261005000000`, `20261009010000`,
`20261026010000`, and `20261026110000`. They already exist on main. Full migration
names are unique; Prisma orders/applies all 78 successfully, and every applied
checksum matches the source (accounting for line endings). No historical migration
was renamed, deleted or rewritten to cosmetically remove this existing debt.
No new timestamp collision or uncommitted schema change was introduced.

### Final repeat

The repeated final fetch still returned main `f6276e4`, already an ancestor of
the reconciled branch. The second complete validation passed: type-check 9 tasks,
build 6 tasks, lint, 1,007 unit executions and 142 real integration tests. Turbo
reused unchanged successful unit/build/lint inputs on the repeat; integration ran
again uncached (142 passed across 16 files). Fixture-cleanliness guards passed,
and the isolated PostgreSQL server was stopped. `git diff --check` passed.

## E. Regression matrix and actual relationship mapping

| Area                  | Automated/source result                                                                                                   | Browser                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Researcher            | PASS — all ten lifecycle states, existing case precedence, leader start, multiple choices and history                     | NOT RUN                          |
| Coordinator           | PASS — scope, lifecycle, eligible lookup, roster, counts, reassignment lock and monitoring contract                       | NOT RUN                          |
| Process Builder       | PASS — no/all/mixed Phases, saved sequence, submission integrity and terminology                                          | NOT RUN                          |
| Documents/Submissions | PASS — canonical project/document policy, revoked enrollment, exact items/versions, upload/review/progression tests       | NOT RUN                          |
| Adviser               | PASS — acceptance/decline/capacity and scoped assignment/access tests; source unchanged from main                         | NOT RUN                          |
| Panelist              | PASS — invitations/exact frozen-version reviewer access; no automatic project membership                                  | NOT RUN                          |
| Defense               | PASS — online/on-site/hybrid, eligibility, packet, evaluation lock/finalization, results/badges and release rules         | NOT RUN                          |
| Dean                  | PASS — existing college-bound endpoints and auth/policy tests; cohort backend scope preserved; dashboard source unchanged | NOT RUN                          |
| System Admin          | PASS — existing protected routes/policies and institution-scoped cohort tests; dashboard source unchanged                 | NOT RUN                          |
| RBAC                  | PASS — researcher management denials, unrelated college/program denial, restricted/multi-role panel boundaries            | NOT RUN                          |
| Legacy Cases          | PASS — direct authorized cohort-null reads, existing instance/version/stage and historical data                           | NOT RUN                          |
| Backfill              | PASS — 35 planner/command + 18 fixture cases; zero-write dry-run, idempotency, rollback, concurrency and staleness        | Not applicable; no real-data run |

The prompt's conceptual AdviserAssignment is persisted through active
ResearchMember(projectRole=ADVISER) plus AdviserRequest and its acceptance state.
PanelAssignment is represented by DefenseInvitation, with review assignments and
frozen packet/version access. Those models remain distinct from cohort membership.
The migration adds only researcher LEADER/MEMBER case roles from validated team
membership; a panel invitation does not turn a panelist into a general case member.

Event relationships were traced from cohort membership→eligible cohort read;
Workspace creation/join→team membership only; leader start→atomic case/instance;
adviser acceptance→recorded adviser relationship and special gate; document
submission→assigned exact-version review; defense scheduling→invitations/packet;
panel response→persisted status; finalized evaluation→existing result/release
logic. Relevant route/service and real integration coverage remains green.
No new relationship model, role, audit, notification or result architecture was added.

## F. Old-assumption and legacy-writer audit

Searches covered user-specified old UI phrases plus workflowId, currentStageId,
ResearchProject, WorkflowEnrollment, ADVISER_SELECTION and DEFENSE_ELIGIBILITY.
Important matches were classified rather than deleted to achieve zero hits.

| Match/area                                                                                              | Classification                                 | Result                                                                 |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| ResearchProject, Workflow/Topic/Stage/Task/Instance, workflowId, currentStageId, enum/API/service names | KEEP — correct internal model/API/engine terms | No mass rename                                                         |
| Cohort workflow selection, provisioning and publication                                                 | KEEP — canonical                               | Exact academic/cohort ownership and immutable case pinning             |
| Deprecated ResearchType.workflowId schema field                                                         | KEEP — compatibility metadata                  | No authoritative runtime selection or publication write                |
| Development/local/panel demo scripts writing the old type pointer                                       | KEEP — intentional fixture compatibility       | Not normal runtime selection; not executed in this phase               |
| WorkflowEnrollment authorization checks                                                                 | KEEP — independent process access              | Not merged with cohort roster; revocation preserved                    |
| Legacy cohort-null case reads and historical Workspaces                                                 | KEEP — legacy/historical access                | No onboarding requirement or global uniqueness added                   |
| Normal coordinator builder old Workflow/Topic/Stage/Milestone wording                                   | MIGRATE — already handled in Phases 7/8        | Preserved Process/Phase/Requirement terminology after merge            |
| Incoming global publication pointer, required-Phase rules and legacy frontend fallback                  | FIX — merge-conflict regression risk           | Accepted Phase 1–9 code retained after baseline proof                  |
| `Course Professor` in use-profile.ts and static System Admin role matrix                                | DEFER — later cross-dashboard semantics        | Unchanged from main; outside the migrated builder/navigation           |
| Adviser handleApproveMilestone local-only state/toast                                                   | DEFER — later dashboard integrity work         | Unchanged from main; no migration-caused backend disconnect introduced |
| Dean older no-project metrics / admin-vs-system-admin conceptual ownership                              | DEFER — later dashboard semantics              | No speculative redesign                                                |
| Old locking/deployment/demo views behind retired legacy markup                                          | DEFER — later cleanup                          | Not a source of normal creation/navigation                             |
| Old registration/navigation strings in negative assertions and fixtures                                 | TEST                                           | Ensure they are absent from normal flow; retained coverage             |
| Prior-phase reports/plans explaining old models                                                         | DOC                                            | Historical documentation, not runtime instructions                     |

### Remaining production creation callers

| Path/caller                                | Why retained / safeguards                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/research` in research.routes.ts | Compatibility contract for legacy/manual registration and existing pinned draft promotion. Validated academic scope, membership/enrollment, cohort selection or authorized existing pin; no normal frontend creation caller                                                                                                              |
| `resolveRegistrationWorkflow()`            | One production caller: the POST /api/research route. Uses eligible explicit cohort assignment or authorized existing pin, never the type default                                                                                                                                                                                         |
| `startWorkflowParticipation()`             | Three production entry points: POST /api/workflows/:id/participation, POST /api/workflows/stages/:stageId/start fallback without researchId, and POST /api/adviser-requests fallback without researchId. All retain their older contracts and use the cohort-aware, enrolled legacy participation service; they do not bypass revocation |
| `POST /api/workspaces/:id/start-research`  | Sole normal frontend creation path; calls canonical provisionResearchCase, with active team/cohort/leader and idempotency checks                                                                                                                                                                                                         |

The AST boundary test scans production frontend sources and confirms **0 direct
POST /api/research creation calls** and **0 legacy participation creation calls**.
Remaining `/api/research` strings in student hooks/pages/providers are GET reads;
case-specific POSTs manage existing folders/files/invites/leadership, not new cases.
Normal adviser/task/title screens supply an existing researchId rather than invoking
the legacy creation fallback. No compatibility endpoint was removed in Phase 10.

### Phase 9 safety

Default dry-run is engine-enforced read-only. Apply requires explicit --apply and
the verified local advisio_test identity/test flags. Creation additionally requires
--create-safe-cohorts. Existing unique matches and proven container creation,
AMBIGUOUS/CONFLICT skips, REMOVED preservation, revoked access, idempotency and
stale/rollback behavior are all retained and retested. No guard was weakened.

## G. Browser and responsive verification

Browser automation was available and used against the Vercel deployment for
`821287405c4075019529e9075b14c1d0fa52649f`:
[audited preview](https://advisio-prototype-updated-79viudwcr-heisenberg1122s-projects.vercel.app).
The user explicitly chose to retain authenticated journeys as manual checks;
no real credentials or invented accounts were used.

| Supplemental public check | Result | Evidence |
| --- | --- | --- |
| Deployed landing page opens | PASS | Rendered page, accessibility tree and desktop screenshot inspected |
| Sign In navigation | PASS | Clicked public Sign In; login route and email/password controls rendered |
| Public login at 390 × 844 | PASS | Screenshot inspected; document/body width 390px, viewport 390px; no captured console errors |
| Public landing at 390 × 844 | PASS | Screenshot inspected; document/body width 385px within 390px viewport |

The temporary viewport override was reset. These limited public checks do not
verify authenticated role pages, their mobile layout, API/schema pairing or any
case-creation journey. All required scenarios below remain
**NOT RUN — MANUAL CHECK REQUIRED**. Rendering/unit tests are not browser passes.

### Researcher checklist

| ID  | Scenario                                        | Status  |
| --- | ----------------------------------------------- | ------- |
| R1  | Log in as an authorized researcher with no team | NOT RUN |
| R2  | Active cohort is visible                        | NOT RUN |
| R3  | Assigned Process is visible appropriately       | NOT RUN |
| R4  | Create a cohort-linked team                     | NOT RUN |
| R5  | Join as another cohort researcher               | NOT RUN |
| R6  | Ordinary member cannot start                    | NOT RUN |
| R7  | Leader sees Start Research                      | NOT RUN |
| R8  | Explicit leader start succeeds                  | NOT RUN |
| R9  | Repeated action produces no duplicates          | NOT RUN |
| R10 | Research Study opens                            | NOT RUN |
| R11 | Provisional title treatment is correct          | NOT RUN |
| R12 | Requirements/Tasks open                         | NOT RUN |
| R13 | Documents open                                  | NOT RUN |
| R14 | Adviser area opens                              | NOT RUN |
| R15 | Authorized legacy case opens directly           | NOT RUN |
| R16 | Closed/archived case is history, not onboarding | NOT RUN |

### Coordinator checklist

| ID  | Scenario                                           | Status  |
| --- | -------------------------------------------------- | ------- |
| C1  | Open Research Cohorts                              | NOT RUN |
| C2  | Create Draft cohort                                | NOT RUN |
| C3  | Assign matching published Process                  | NOT RUN |
| C4  | Search eligible researchers                        | NOT RUN |
| C5  | Add researcher                                     | NOT RUN |
| C6  | Activate cohort                                    | NOT RUN |
| C7  | Researcher sees cohort                             | NOT RUN |
| C8  | Member count is correct                            | NOT RUN |
| C9  | Team count updates after team creation             | NOT RUN |
| C10 | Case count updates after start                     | NOT RUN |
| C11 | Attempt unsafe reassignment after team/case exists | NOT RUN |
| C12 | Server/UI rejects unsafe reassignment              | NOT RUN |
| C13 | Supported removal/re-addition behaves correctly    | NOT RUN |
| C14 | Process Access remains separate                    | NOT RUN |
| C15 | Open Process Builder                               | NOT RUN |
| C16 | Publish Process                                    | NOT RUN |
| C17 | Publication does not automatically assign cohorts  | NOT RUN |

### Builder / cross-role / responsive checklist

| ID  | Scenario                                                                                 | Status  |
| --- | ---------------------------------------------------------------------------------------- | ------- |
| P1  | Process Template / Phase / Requirement / Submission Item labels                          | NOT RUN |
| P2  | Fully phased Process opens and publishes                                                 | NOT RUN |
| P3  | No-Phase Process publishes with an active Requirement                                    | NOT RUN |
| P4  | Mixed/unassigned Requirements render in saved sequence                                   | NOT RUN |
| P5  | Empty Process and missing usable required submission are blocked                         | NOT RUN |
| P6  | Adding the required usable Submission Item permits publication                           | NOT RUN |
| X1  | Assigned adviser request/accept/decline/capacity and consultation/review UI              | NOT RUN |
| X2  | Panel invite/response/schedule/frozen packet/evaluation and release UI                   | NOT RUN |
| X3  | Existing Dean critical route/data load                                                   | NOT RUN |
| X4  | Existing System Admin critical route/data load                                           | NOT RUN |
| N1  | Desktop: sidebar, cohort list/detail, dialogs, builder, lifecycle/start, tables/overflow | NOT RUN |
| N2  | Tablet/narrow desktop: same surfaces                                                     | NOT RUN |
| N3  | Mobile width: same surfaces                                                              | NOT RUN |

Use the updated branch preview and its matching isolated/staging API/schema, with
authorized disposable test accounts. Do not create false academic production
records or point backfill at that environment to make a UI checklist pass.

## H. Remaining risks

### Merge blockers / gates

- Required authenticated cross-role browser and responsive checks must be completed
  and reviewed before merge approval. They are not green merely because API tests pass.
- Verify that the preview's API/schema is the matching isolated/staging revision
  before executing the authenticated checklist. Vercel frontend success alone
  cannot establish this pairing.
- Refresh main and rerun relevant validation if it advances before actual merge.

### Non-blocking existing technical debt

- Five historical timestamp-prefix collisions with unique full migration names;
  all applied checksums and migrations remain valid. Preserve history.
- Existing bundle-size advisory.
- Static old profile/admin role labels, Dean metrics and adviser local-only approval
  UI described above; unchanged by this migration and deferred as requested.
- Legacy registration/participation endpoints remain intentionally supported.

### Post-Phase-10 architecture work

RequirementInstance/DAG/parallel execution, model renames, full template/version
normalization and cross-dashboard integrity redesign remain separate future work.

### Manual deployment concerns

Vercel frontend deployment success does not establish that its configured API and
database are the matching branch/staging revision. Verify that pairing before the
authenticated checklist. Production backfill requires backup, real-data dry-run,
report/ambiguity review, explicit authorization, controlled apply and post-checks.
Code merge alone is not authorization to migrate production data.

## I. Production backfill status

**No real-data backfill was executed.**

Only isolated fixtures were used for apply tests. The Phase 9 production/shared/
preview apply guard is unchanged and must remain intact through the merge gate.

## J. Merge recommendation

**MERGE AFTER MANUAL CHECKS.**

The reconciled architecture and full local/remote automated regression are green.
Required authenticated browser and application responsive scenarios remain NOT RUN
at the user's direction. Complete those checks against the matching staging
API/schema and review their results before authorizing merge.

Do not merge into main automatically, delete the feature branch, or execute a
real-data backfill. The user reviews this report and pending manual gates first.

## Final verification record

| Item | Verified result |
| --- | --- |
| Audited application/test HEAD | `821287405c4075019529e9075b14c1d0fa52649f` |
| Latest fetched main | `f6276e467fde35abb4760c1ddceb3f9ba0188084`; ancestor of branch, unchanged at final fetch |
| Merge checkpoint | `3d5386c270cbe1343b6ef8257e9063938779bc64` |
| Final local repeat | Type-check/build/lint/diff PASS; 1,007 unit executions; 142 integration tests |
| Authenticated GitHub identity / author | NicoleAndreaBolus; commit identity `NicoleAndreaBolus <nagbolus.student@ua.edu.ph>` |
| Draft PR | [PR #4](https://github.com/heisenberg1122/Advisio_Prototype_Updated/pull/4); open, draft, mergeable at audited HEAD |
| Remote Actions | [Run 40509835068](https://github.com/heisenberg1122/Advisio_Prototype_Updated/actions/runs/40509835068) completed SUCCESS; unit/lint/type-check/build and sequential database integration jobs SUCCESS |
| Remote deployment | Vercel Preview SUCCESS for audited HEAD, deployment `7359369163`; public preview exercised above |
| Authenticated/application responsive | NOT RUN / MANUAL CHECK REQUIRED; user explicitly selected manual verification |
| Real-data backfill | NOT EXECUTED; isolated apply guard unchanged |

This final results update is documentation-only, following the audited HEAD above.
Its own commit SHA and final clean/push/check status are recorded in the delivery
message (a commit cannot contain its own SHA). The application/test tree is unchanged
by that follow-up. Remote checks must also be inspected for that final pushed SHA;
the linked completed run above specifically proves the audited application commit.

## Appendix 1 — incoming main commits

| Commit                                   | Subject                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| f6276e467fde35abb4760c1ddceb3f9ba0188084 | Add theme-aware spotlight to footer wordmark                                           |
| 903c361ce7ea3c7e969fa8323793d636a28705ca | Refine landing roles, scroll milestones, and circular theme transitions                |
| 063ed639353536e6822609c3e2637b7a5975a9e2 | Animate landing workspace connections with autoplay and pause controls                 |
| fa37882ad5cd641884d79551b8fa880aa96df307 | Redesign landing page as a concise connected research experience                       |
| b5813082027020a76738385c67981512fbd9904a | Refine public landing page design and motion                                           |
| 996f6055d03c84d998b8e70f017fe7e55472b155 | feat(workflow): support title proposals and work before project registration           |
| 23e031cbc47d04faab035a19775102283ab00e04 | fix(web): show joined workflows independently of research projects                     |
| d87dac92af5715f52a7ac0e88310c6ed30f19204 | fix(auth): allow coordinators to publish scoped workflows                              |
| 86dd702916ae7464a451020ea82601f6d0375f2d | revert: restore repository to 5eb6d534                                                 |
| a0ae2ff43f0cdfd55e986fa23095b3498236adaa | feat(workflow): expose safe workflow deletion                                          |
| 5743ca4f118635879006d2f1f0ce7734c0c400d4 | feat(workflow): add contextual two-column editor                                       |
| 00b1a54e69dc3017718239036f556169d0b64386 | Show milestone delete action in workflow row menu                                      |
| 61ddb504d6413e9d6c7bec320ea32eefb45fae56 | Simplify workflow ordering controls and place moved milestones first                   |
| 780cc6c1e5a7b1efd09e7a1ea8c6f6c9caacac80 | feat(workflow): add persistent drag and drop ordering                                  |
| 084230f6ddee41cb69caf7f166af436979b72b5c | fix(web): keep auth screens on default appearance                                      |
| ab7e9bf665f9d533606d9b8398f7eea76a1c97e2 | feat(workflow): match reference builder layout                                         |
| 8e7ebaf69fa9d707a743c90157b8c07fa2ab6dd3 | fix(email): expose safe Gmail delivery diagnostics                                     |
| 94d05e26e8a99e896e294d9d2d72b44fe0aa86da | feat(email): add configurable Gmail notification templates                             |
| 63dd423b6b67bd0b67884b4ec72217ddc7bc0cc4 | feat(web): apply redesigned Advisio landing page                                       |
| a4f717c31e4ba481c3335e89101f55d6c88cd503 | add defense eligibility and fix request dean signature                                 |
| 310e7304892ca2601c04bbf0483c46189c010d34 | fix(submissions): serialize upload responses and restore CI checks                     |
| 88792ae7fa76166e5ae26c2e402982a8d5eafc28 | feat(workflow): add required milestone conditions                                      |
| 31352089764bd5eae993924b6131f51914c35d2a | feat(workflow): centralize publishing and improve themed UI                            |
| fa527c61730d88561a0c2f9865c30e1382e6929d | feat(auth): register Google users through researcher and faculty onboarding            |
| 688c229814f20ad44000526c9543e1c1940d128f | feat(ui): add global async action feedback                                             |
| 3dc65b1d9f38e102c13c74482dc998705f677ede | add suspend action and fix permanently delete                                          |
| 5ce7fd13eddbd4be45e6cdbc697f914daee05527 | fix adviser request, removal of other roles, and notifications for separated dashboard |
| ec4337a578c9f17d748fd8e8d4a1cb4b7c1cd911 | docs: plan landing page redesign                                                       |
| 1e44011f67be4ff7c143c5c068604d7813a0842a | removed vpaa, rpo, and reb                                                             |
| 13cbc32cf4a66368554d70f5ed479e9a502d35a8 | Add coordinator-issued title and final defense badges                                  |
| 955e1276d2b96e5be1d1797af88efde46ff4618e | add delete button beside + create workflow                                             |
| b31c3c211fb5ed07dd296a5d0475eca26f638a33 | fix separation notifications for multi-roles                                           |
| 25510fe4975d179ed3d661ab5c0f7828655788e4 | Add Google Search Console ownership verification tag                                   |
| f7b2460971466a748fd97e4fa00e97f6ca7071f2 | Add public homepage and OAuth privacy and terms pages                                  |
| 80b610c97dea1dcb7a0bd0c7c0b5a72e5cd83142 | Fix join a workflow card                                                               |
| ac1cd9ed0adecdeeb68fb0892af840a1d9a14c0f | feat(workflow): improve adviser request tracking                                       |
| d05580bf81cbc221db6ca1788105ff5dd41cfee7 | Fix researcher project visibility and access isolation                                 |
| 6dab1c4543f19f10f60a106b0441ebcede4b93a3 | fix(web): include auth package in vercel build command                                 |
| 523c693908f4817db52fac83398993d7da3c9ca3 | fix(web): resolve lint constant condition in login page                                |
| 5ef6b7f63db5d5b0791e59cdb46cec4c2846edf7 | Merge branch 'main' of https://github.com/heisenberg1122/Advisio_Prototype_Updated     |
| 691fabbff57cecc6b8988b8624e12f8d97477eaa | feat(auth): implement multi-role dashboard switcher and onboarding flow                |
| e65cfbb9b071346186545913525087ec9beb1702 | feat(workflow): add adviser milestone integration                                      |
| 953da9a8321264f93c76f1f88a44372cc0d7b38c | feat(workflow): use calendar dates for milestone targets                               |
| 04f02b3d80461be047fd729c5cfd6244f29a0068 | Revert "Add independent milestones, prerequisites, and group revision cycles"          |
| dece11a37adfa4977ec7f76ac30dfb911bdb1038 | Add independent milestones, prerequisites, and group revision cycles                   |
| c8f56e2898d1912d43df117167416d2a729282ba | Require workflow approval and add Advisio inbox invitations                            |
| e0327f8118f4e64b69db42da336a38127f2cfa95 | Run local app and optional PostgreSQL with npm run dev                                 |
| ddc5fb2679e2725940497f5099fda8577f110464 | Redesign Documents workspace with compact version previews                             |

## Appendix 2 — conflict resolutions

| Conflicted path                                                  | Resolution                                                                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| apps/api/scripts/run-database-integration-tests.mjs              | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/api/src/routes/workflow-enrollment-access.routes.test.ts    | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/api/src/routes/workflow.routes.ts                           | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/api/src/routes/workspace.routes.ts                          | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/api/src/services/registration-workflow.service.ts           | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/api/src/services/workflow-participation.integration.test.ts | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/api/src/services/workflow-participation.service.test.ts     | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/api/src/services/workflow-participation.service.ts          | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/api/src/services/workflow-publication.service.test.ts       | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/api/src/services/workflow-publication.service.ts            | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/app/(public)/home/page.tsx                          | Latest main landing blob retained exactly                                         |
| apps/web/src/app/professor/dashboard/page.tsx                    | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/app/student/adviser-pool/page.tsx                   | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/app/student/dashboard/page.tsx                      | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/app/student/documents/page.tsx                      | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/app/student/tasks/page.tsx                          | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/app/student/workflows/join/page.tsx                 | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/components/landing/FinalCtaSection.tsx              | Latest main landing blob retained exactly                                         |
| apps/web/src/components/landing/HeroProductVisual.tsx            | Latest main landing blob retained exactly                                         |
| apps/web/src/components/landing/HeroSection.tsx                  | Latest main landing blob retained exactly                                         |
| apps/web/src/components/landing/LandingFooter.tsx                | Latest main landing blob retained exactly                                         |
| apps/web/src/components/landing/LandingNavbar.tsx                | Latest main landing blob retained exactly                                         |
| apps/web/src/components/landing/ProblemSolution.tsx              | Latest main landing blob retained exactly                                         |
| apps/web/src/components/landing/RoleExperience.tsx               | Latest main landing blob retained exactly                                         |
| apps/web/src/components/landing/SecurityTrustSection.tsx         | Latest main landing blob retained exactly                                         |
| apps/web/src/components/landing/WorkflowSection.tsx              | Latest main landing blob retained exactly                                         |
| apps/web/src/components/landing/landing.css                      | Latest main landing blob retained exactly                                         |
| apps/web/src/components/workflow/MilestoneComposer.tsx           | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/components/workflow/TitleProposalPanel.tsx          | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/components/workflow/WorkflowAccessInbox.tsx         | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/components/workflow/WorkflowAccessManager.tsx       | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/components/workflow/WorkflowParticipantsCard.tsx    | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/hooks/use-student.ts                                | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/lib/student-project-overview.test.ts                | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/lib/student-project-overview.ts                     | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/lib/student-workflow-context.test.ts                | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/lib/student-workflow-context.ts                     | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| apps/web/src/providers/active-project-provider.tsx               | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
| package.json                                                     | Accepted Phase 1–9 blob retained; incoming equals verified pre-migration baseline |
