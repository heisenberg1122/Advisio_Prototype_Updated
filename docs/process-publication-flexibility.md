# Phase 8: optional Phases and Process Builder terminology

## Before-edit audit

Baseline: `77b0591`, clean `refactor/cohort-driven-research-flow`.
The web AGENTS guide references an absent Next documentation directory; this repo
uses Vite/React and the existing routing compatibility layer. No framework change.

| Restriction/dependency                                                     | Classification               | Handling                                                                    |
| -------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| Publication requires topics and each active stage's topicId                | PUBLICATION VALIDATION       | Remove organizational requirements only                                     |
| At least one non-Archived stage; required document submission task         | PUBLICATION VALIDATION       | Retain; usable formats follow the existing submission parser                |
| Stage create/update rejects null/missing topicId                           | BUILDER-ONLY UI ASSUMPTION   | Allow unphased; still reject a supplied foreign/invalid Phase               |
| Publication resequences stages by topics                                   | BUILDER-ONLY UI ASSUMPTION   | Preserve saved sequence when publishing; no stage/current-instance mutation |
| Creation/Phase reassignment automatically regroups global stage sequence   | BUILDER-ONLY UI ASSUMPTION   | Append new Requirements; grouping alone must not change execution order     |
| Phase drag/drop writes phase and stage order                               | BUILDER-ONLY UI ASSUMPTION   | Organize groups only; retain explicit Requirement ordering controls         |
| Sequence normalizers, stage positioning/move, conditions and advancement   | EXECUTION REQUIREMENT        | Preserve sequential mechanics; do not implement Phase execution             |
| Composer required Phase, first-Phase default, create-before-topic redirect | BUILDER-ONLY UI ASSUMPTION   | No Phase / Unassigned without auto-created/default Phase                    |
| Readiness/progress and preview omit/penalize unphased stages               | BUILDER-ONLY UI ASSUMPTION   | Follow publication rules; include all active Requirements in saved order    |
| ADVISER_SELECTION / DEFENSE_ELIGIBILITY / TITLE_PROPOSAL rules             | INTENTIONAL SPECIAL BEHAVIOR | Preserve enums, gates, modes and runtime side effects                       |
| Nullable WorkflowStage.topicId and existing phased definitions             | LEGACY COMPATIBILITY         | No schema migration, backfill or reassignment                               |
| Instance/currentStage, provisioning, submission access, progress/deadlines | EXECUTION REQUIREMENT        | Runtime services do not require topicId; unchanged                          |

Active means the existing `category !== 'Archived'` rule. WorkflowStage has no
isActive/disabled field. WorkflowTask has no active/disabled field: persisted tasks
are current items, `isRequired=false` means optional, and deletion removes an item.
No new status/model is invented. Usable document formats come from the existing
`parseAllowedFileTypes` submission contract.

Phase 6/7 browser/mobile checks remain pending pre-merge; Phase 8 checks will also
remain pending. No commit/push, Phase 9, schema or engine redesign is authorized.

## Implemented publication contract

- A future publication may have zero Phases, all phased Requirements, or a mix of
  phased and unassigned Requirements. No default Phase is created.
- At least one active Requirement is still required. Empty drafts and drafts
  containing only Archived Requirements cannot publish, but remain editable.
- Every active document Requirement needs at least one required persisted
  Submission Item with a supported format. Missing items, optional-only items,
  and unsupported-only/whitespace-only format lists fail publication. Existing
  default formats, extension notation, MIME aliases and supported formats remain
  usable under `parseAllowedFileTypes`; non-document Requirements need no child
  item where the existing contract permits that.
- Creation accepts omitted/null `topicId`; editing accepts null to clear a Phase.
  A supplied Phase ID must still be a valid UUID in the same Process. Invalid,
  empty-string, and foreign Phase IDs are rejected rather than silently unassigned.
- Existing stage creation still supplies its default required PDF/DOCX item when
  document submission is enabled. No draft creation restriction was added.
- The error envelope retains `error` and `issues`, and also includes
  `details.issues` for the existing API client's error handling. The builder
  displays the concrete publication issue using Process/Requirement terminology.

## Ordering and compatibility boundaries

The organizational resequencer was invoked during publication, Phase reorder,
Requirement creation and Phase reassignment. It put all unassigned Requirements
first and regrouped other Requirements by Phase. That would turn the requested
`1 unassigned → 2 phased → 3 unassigned` sequence into a different execution order.
Those implicit grouping operations were removed. New Requirements append to the
saved global sequence, while changing or visually reordering Phases does not
move Requirements. Publication validates existing prerequisite conditions without
rewriting stage sequences, `isFinal`, assignments or current instances.

The existing sequence normalization, explicit stage move/position APIs, archive
handling, `isFinal` handling during explicit stage edits, prerequisite validation,
advancement/completion and deadline services remain in place. An explicit legacy
within-Phase position request remains a deliberate ordering operation. No new
ordering engine or Phase execution state was introduced. Builder prerequisite
choices now use earlier saved global sequence, including unassigned Requirements.

Already-published Processes retain the existing idempotent publish path before
new validation runs. There is no automatic republish, version update, cohort
assignment, ResearchType assignment, data migration, Phase creation, or case
reset. `ResearchType.workflowId` remains deprecated compatibility metadata.

`STANDARD`, `ADVISER_SELECTION`, `DEFENSE_ELIGIBILITY` and `TITLE_PROPOSAL` keep
their existing enums and special rules. Adviser selection remains group-based,
approval-based and non-document; its uniqueness and adviser synchronization remain.
Defense eligibility remains group-based, approval-based and tied to the existing
defense cycle. Title decisions, adviser requests, defense scheduling and runtime
gates were not redesigned. The current manual and automatic completion semantics
for non-document Requirements are unchanged; publication flexibility does not
invent a new completion action.

## Builder presentation

The coordinator builder, composer, publication dialog, removal dialog and related
copy use Process Template/Process, optional Phase and Requirement. Document child
items use Submission Item; aggregate child counts and non-document preview items
use the neutral Requirement Item. Internal model names, routes, prop names, enum
values and request fields remain unchanged.

The composer offers `No Phase / Unassigned` without a required selection or a
default first Phase. The normal Create action opens the Requirement composer even
when there are no Phases. Creating from a specific Phase still explicitly selects
that Phase. Unassigned Requirements have a visible section, with their saved
global sequence numbers. The preview includes every active Requirement in global
sequence with optional Phase badges; it does not invent Phase-level lock state.
Readiness depends on valid active Requirements and usable submissions, not grouping.
Resource copy uses Process wording for coordinator management while preserving
the existing researcher-facing copy and behavior.

The existing visual theme and portal layout are preserved. No researcher, cohort,
adviser, panelist, Dean or administrator behavior was changed.

## Changed files

All paths below are relative to the repository root.

| File                                                            | Impact                                                                                          |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `apps/api/src/services/workflow-publication.service.ts`         | Optional grouping; retained active/document integrity checks using existing format parser       |
| `apps/api/src/routes/workflow.routes.ts`                        | Nullable Phase create/update, no implicit grouping resequence, publication error details        |
| `apps/api/src/services/workflow-publication.service.test.ts`    | Retains original tests; extends publication matrix and immutability coverage                    |
| `apps/api/src/routes/workflow-enrollment-access.routes.test.ts` | Updates obsolete Phase-required expectation; asserts publication performs no stage/Phase writes |
| `apps/api/src/routes/workflow-publication.integration.test.ts`  | Nine real authenticated HTTP/database regression cases                                          |
| `apps/api/scripts/run-database-integration-tests.mjs`           | Includes new suite in guarded sequential integration runner                                     |
| `apps/web/src/app/professor/dashboard/page.tsx`                 | Optional Phase creation/editing, readiness, preview wiring and builder terminology              |
| `apps/web/src/components/workflow/MilestoneComposer.tsx`        | Optional Phase field, save eligibility, coordinator labels; special behavior retained           |
| `apps/web/src/components/workflow/MilestoneAttachmentsCard.tsx` | Requirement terminology only                                                                    |
| `apps/web/src/components/workflow/WorkflowResourcesCard.tsx`    | Coordinator resource wording; researcher default copy retained                                  |
| `apps/web/src/components/workflow/WorkflowAccessManager.tsx`    | Process wording in disable-code confirmation only                                               |
| `apps/web/src/components/workflow/ProcessSequencePreview.tsx`   | Global saved-sequence preview with optional Phase badges                                        |
| `apps/web/src/lib/process-builder.ts`                           | Active Requirements, document readiness and sequence-based prerequisite choices                 |
| `apps/web/src/lib/process-builder.test.ts`                      | Readiness matrix and global prerequisite ordering                                               |
| `apps/web/src/components/workflow/ProcessBuilder.test.tsx`      | Composer, preview and coordinator resource rendering                                            |
| `docs/process-publication-flexibility.md`                       | Audit, implementation, validation and pending verification report                               |

No Prisma schema, migration, cohort service, provisioning service, researcher page,
or runtime engine service changed.

## Terminology search classification

Searched the coordinator dashboard/composer/attachments/resources/access components
and relevant publication/runtime paths for Workflow, Workflow Topic, Topic,
Workflow Stage, Stage, Milestone, Workflow Task, sequential academic process,
must belong to topic, requires topic and at least one topic.

| Remaining occurrence                                                                                                                                                                | Classification          | Disposition                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| `Workflow`, `WorkflowTopic`, `WorkflowStage`, `WorkflowTask`, `WorkflowInstance`; `topicId`, `milestoneType`, API paths, imports, component/prop names, DOM IDs, query keys         | INTERNAL MODEL          | Intentionally retain schema and API contracts                                     |
| `sequence`, `currentStageId`, stage transitions, advancement, deadline/progress and prerequisite service names/comments; “sequential academic process” in publication documentation | INTENTIONAL ENGINE TERM | Preserve the existing sequential engine                                           |
| Researcher resource default copy, legacy participation/registration, project review/runtime screens outside the builder, shared Title Proposal researcher form                      | LEGACY COMPATIBILITY    | Retain existing compatibility flow and other-role behavior                        |
| Old disabled drawer/blank-canvas markup behind `legacyWorkflowUiEnabled = false`, old locking/deployment/tracking demo views outside the active Process Builder                     | LATER ARCHITECTURE WORK | Do not broaden Phase 8 into portal cleanup or redesign                            |
| Active builder/composer/publication/removal/resource copy using old Workflow/Topic/Stage/Milestone names                                                                            | USER-FACING MIGRATE     | Migrated within the active builder scope; internal select values remain unchanged |

No mandatory-Phase publication message remains. Optional Phase ownership checks
and explicit position handling remain intentionally; these are not publication
requirements.

## Regression coverage and validation

Local validation:

| Check                                     | Result                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Focused publication/access tests          | 55 passed                                                                  |
| Focused builder/readiness/rendering tests | 21 passed                                                                  |
| `npm run type-check`                      | Passed, 9 tasks                                                            |
| `npm run build`                           | Passed, 6 tasks; existing large-chunk advisory remains                     |
| `npm run lint`                            | Passed                                                                     |
| `npm test`                                | 968 passed executions: API 504, web 350, validations 66, auth 32, email 16 |
| `npm run test:integration:local`          | 123 passed across 15 files; 114 existing plus 9 Phase 8 cases              |
| `git diff --check`                        | Passed                                                                     |

The integration suite verifies empty/Archived-only rejection; no-Phase and mixed
publication; retained fully phased publication/readability; explicit Phase clearing;
foreign/invalid Phase rejection; researcher publish rejection; missing, optional-only
and unusable document item rejection; usable required item acceptance; special
adviser/defense settings; immutable existing published definitions and idempotent
publication; unchanged ResearchType/cohort assignment, pinned instance/version,
current stage and revoked enrollment; and cohort research start followed by
existing transitions across phased/unphased Requirements in saved order.

The first integration run passed all existing tests but three new read assertions
called an unsupported detail URL. Those assertions were corrected to exercise the
existing scoped list API. The complete rerun passed without weakening assertions,
access controls, fixture guards or teardown. The dedicated test database identity
and absence of fixture roots were verified after teardown, and PostgreSQL stopped.

Full unit and integration runs also retain the Phase 6 researcher lifecycle,
Phase 7 cohort management, canonical provisioning, legacy registration/participation,
adviser selection, defense and enrollment regression coverage. Integration-only
tests are intentionally skipped by the unit command and were run separately above.

At the implementation-review checkpoint, remote Actions/deployment had not been
triggered for these changes, which were uncommitted on baseline `77b0591`.
The separately authorized commit/push checkpoint and its remote verification are
reported in the accompanying conversation. Browser/mobile checks remain pending.

## Pending pre-merge manual verification

These are pending real-browser checks, not failed automated acceptance criteria:

1. Coordinator opens Process Templates and saves a draft with no Phase.
2. Add an unassigned Requirement and publish successfully.
3. Publish a mix of phased and unassigned Requirements; inspect saved sequence.
4. Document Requirement without a required usable item is blocked; adding one
   permits publication.
5. Existing fully phased Processes open correctly, with unchanged assignments.
6. Existing cohort assignment and pinned Research Case remain unchanged.
7. Resize the Process Builder to narrow/mobile width; verify forms, menus, preview
   and publication dialog interaction.
8. Carry forward all Phase 6/7 browser/mobile checks, including no-team researcher,
   team creation, ordinary-member waiting state, leader Start Research, legacy case
   opening and Tasks/Documents/Adviser pages after start.

No browser interaction or responsive visual verification is claimed by rendering
tests. These checks remain pending against the deployed preview before merge.

## Deferred after this checkpoint

Phase 9 legacy data backfill remains unstarted and requires its own approved scope.
No existing rows were backfilled or reassigned. Database model renames, Phase
runtime state, WorkflowTemplate/WorkflowVersion normalization, RequirementInstance,
DAG/parallel execution and special-type redesign remain deferred. Final regression,
manual browser/mobile verification and merge approval remain later merge gates.
