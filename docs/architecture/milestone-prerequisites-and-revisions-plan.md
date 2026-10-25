# Milestone prerequisites and group revision cycles

Planned October 25, 2026. Implementation added October 26, 2026.

## Intended behavior

Students follow the professor's workflow without manually registering a research project before beginning work. A professor can configure specific prerequisite milestones across topics in the same workflow and manually reopen a group's passed milestone when new work is required.

Example configuration:

| Topic | Milestone | Availability type | Prerequisites |
| --- | --- | --- | --- |
| Requirements | Title Research | Independent | None |
| Capstone 1 | Title Defense | Requires Prerequisites | Requirements -> Title Research |

Topics organize content. Milestone prerequisites govern eligibility. Titles and names are examples, not special cases in application logic.

## Milestone terminology

- **Independent Milestone:** has no prerequisite milestones and can be started without completing other milestones first. In the professor's editor, label this option Independent with the explanation No prerequisites; students can start anytime.
- **Requires Prerequisites:** students must pass all selected prerequisite milestones before starting the dependent milestone's submission flow.
- Student-facing availability labels for an independent milestone are No prerequisites and Available to start when other eligibility rules are satisfied.
- Anytime refers to prerequisite eligibility, not unrestricted submissions. Active enrollment, group membership, deadlines, submission lifecycle, and approval requirements still apply. Independent does not mean optional or automatically passed.
- In explicit prerequisite mode, derive Independent from an empty prerequisite list rather than persisting a separate flag that could conflict with the saved relationships. Keep legacy sequence behavior separate; do not label a legacy sequence-locked milestone Available to start merely because it has no explicit links.

## Product rules

1. A milestone may have zero or more prerequisites from the same workflow, including other topics. All selected prerequisites must currently be valid and passed for that group.
2. In explicit prerequisite mode, a milestone with no prerequisites is an Independent Milestone, available once the student has active enrollment and a valid solo/group workspace, subject to existing deadlines and submission rules. Display order does not silently create additional prerequisites, even if the milestone appears in a later topic.
3. The professor configures dependencies at workflow level. Approval, revision, and eligibility are evaluated separately for each group/project instance.
4. A passed milestone may be reopened by an authorized professor using Request Revision. Require a reason and identify which required tasks or deliverables need revision. For milestones without uploads, reopen their explicit milestone decision instead.
5. Requesting revision revokes the current milestone's validity immediately. Its original approval and submitted files remain in history. A new submission creates a new attempt.
6. Defense rejection does not automatically reopen another milestone. The professor makes that decision explicitly; the defense result remains recorded separately.
7. Students can view blocked milestones, instructions, feedback, and previous attempts. Blocking prevents new submission, approval, advancement, and completion that would require an unmet prerequisite. Draft preparation may continue.
8. Block direct and indirect dependents while a prerequisite is invalid. Preserve unrelated progress. Do not automatically reject or erase downstream submissions.
9. If a dependent milestone had already passed against an older prerequisite approval, show Needs Revalidation. Reapproving the prerequisite alone must not silently restore that dependent approval; the professor must reconfirm it or request a new submission.
10. On reapproval, a dependent milestone that has never passed becomes available for its next permitted attempt. An existing defense failure or revision requirement must still be resolved.
11. Show the group's reopened prerequisite as its next action. Recalculate workflow/project completion if previously completed requirements are no longer valid. Finalized official copies and issued records require their existing controlled handling and are never rewritten by this feature.
12. Existing workflows keep their current availability behavior until explicitly switched to prerequisite mode. Do not infer dependencies merely from topic or milestone order.

## Current implementation findings

- `WorkflowTopic` and `WorkflowStage` exist, but there is no persisted prerequisite relationship.
- `MilestoneComposer.tsx` supports create/edit settings, including approval and upload requirements, but no dependency selector.
- Student task locking and API submission authorization currently compare stage sequence with `currentStage`. `requiresApproval` is also used as a lock flag. Prerequisite eligibility needs its own meaning and must not reuse that flag.
- `getMilestoneProgress` derives completion from task approvals and approved document versions. Its approved-version lookup needs explicit project ownership filtering before it can support group-specific prerequisite checks.
- Milestones with no required tasks and no document requirement cannot become complete through the current requirement count alone. They need an explicit per-group completion/approval record.
- `advanceMilestoneIfSatisfied` advances only the current stage, and manual transitions can mark completion based on the target stage. Both need shared prerequisite and completion checks.
- The task review endpoint can change status, but it does not reconcile previously advanced progress when approval is withdrawn. It also updates attempt review fields, so preserving an append-only decision history is necessary.
- Formal manuscript reviews use exact-version reviewer assignments and reject direct task-review shortcuts. Reopening must integrate with that lifecycle rather than bypass it.
- Students without a project currently receive preview-only tasks. Submission ownership still requires a project record.

## Proposed data model

Use additive migrations with these conceptual records; final names can follow repository conventions during implementation:

- **Milestone prerequisite:** dependent stage ID and prerequisite stage ID, unique as a pair, with indexes for forward/reverse lookup. Validate same-workflow membership, no self-reference, no duplicates, no archived targets, and no dependency cycles.
- **Per-project milestone state:** unique project/stage pair with current decision, revision generation, and approval validity. Available/Blocked is derived separately from the decision, so a historical Passed result can coexist with a current blocked explanation.
- **Milestone decision event:** append-only project/stage event containing actor, timestamp, reason, previous/new state, affected task/attempt references, and revision generation.
- **Approval basis:** capture the prerequisite approval generations used for a milestone's approval. This detects stale downstream approvals after a prerequisite is reopened and approved again.
- **Workflow availability mode:** retain legacy sequence behavior for existing workflows; offer explicit prerequisites for new or deliberately converted workflows. Converting an active workflow shows affected groups and applies the new checks immediately after a recorded save, without rewriting historical decisions.

Backfill existing milestone state from project-scoped current approvals and reliable decision history. Do not mark a milestone passed solely because its sequence precedes `currentStage`. Leave ambiguous states for professor review rather than fabricating approvals.

## Implementation order

### Phase 1: State and eligibility foundation

- Add prerequisite, milestone state, decision history, approval-basis, and availability-mode persistence and validation.
- Build one server-side evaluator that returns current decision, effective validity, canSubmit/canApprove, unmet prerequisites, and group-specific reasons.
- Treat an empty prerequisite list as Independent in explicit prerequisite mode. Do not apply sequence-based prerequisite locks to independent milestones; continue enforcing other eligibility and submission rules.
- Support explicit decisions for milestones without document uploads.
- Correct project scoping of approved document evidence and ensure historical approved versions cannot override a newer revision request.
- Validate dependency edits against the full graph, including concurrent edits, archived milestones, reordering, and deletion. Require removal/replacement of active references before archiving a prerequisite.

### Phase 2: Submission, approval, and reopening behavior

- Enforce the shared evaluator on file uploads, stored-version submissions, Google document snapshots, milestone-only actions, reviewer approvals, manual workflow transitions, and automatic progression/completion.
- Recheck eligibility inside the committing transaction, serialized with group milestone approval/revision changes. A stale browser or concurrent request must not bypass a new revision request.
- Add a scoped Request Revision operation with required reason and selected deliverables. Record the decision, revoke current validity, reconcile workflow completion, and notify active group members in the same transaction.
- Preserve exact-version review records and immutable submitted artifacts. For formal manuscript submissions, use a lifecycle-aware reopen operation that prepares a working revision and appropriate reviewer assignments while preserving the original approved snapshot.
- Recompute effective eligibility for direct and transitive dependents. Mark prior approvals needing revalidation without automatically changing downstream review results.
- On reapproval, restore eligible work without creating duplicate transitions, repeating passed work unnecessarily, or automatically accepting a failed defense. Notification deduplication must distinguish revision cycles.
- Treat `currentStage` as a navigation/next-action aid in prerequisite mode; it is not evidence that other milestones passed. Finish only when all applicable required milestones are valid.

### Phase 3: Professor and student interfaces

Professor milestone editor:

- Add a Require prerequisite milestones toggle and searchable multi-select grouped by Topic -> Milestone. Show Independent when off and Requires Prerequisites when on.
- Turning the toggle off clears the prerequisite selection on save and explains No prerequisites; students can start anytime. Turning it on requires at least one selection and explains Students must pass all selected milestones first.
- Explain that all selected milestones must currently pass. Keep approval-required and prerequisite settings separate.
- Exclude the current milestone and invalid choices; display server validation errors clearly.

Professor group review:

- Add Request Revision to passed milestones, with reason, selected deliverables, and an impact preview listing blocked dependents.
- Add a reconfirm/review action for downstream approvals needing revalidation. Do not introduce a prerequisite bypass.
- Show decisions, attempts, and reopening reasons in chronological history.

Student views:

- Show prerequisite names/statuses and links to required work in Tasks, milestone details, timeline, and My Projects.
- Label independent milestones No prerequisites, with Available to start only when current eligibility allows starting. If another rule prevents submission, show its actual reason rather than inventing a prerequisite lock.
- Show Needs Revision, Blocked by prerequisite, and Needs Revalidation distinctly from historical review outcomes.
- Put the reopened prerequisite in the next-action card; refresh progress and eligibility after decisions and submissions.
- Keep instructions and submission history accessible while work is blocked.

### Phase 4: Remove manual research registration from the starting flow

- Retain internal project IDs for document/submission ownership. Create or reuse a draft record automatically when an enrolled solo student or established group first starts eligible work.
- Show joined workflows in My Projects before a draft project exists. Use a neutral Research title pending label; collect title/abstract only when the configured milestone requires them.
- Require group identity/membership to be established before a group submission. Enrollment alone must not generate separate solo projects for every future group member.
- Provision atomically and idempotently so simultaneous starts by group members produce one shared record. Reuse eligible existing records and respect current academic scope and duplicate-project rules.
- Resolve the existing one-project-per-academic-year constraint explicitly when a student has multiple workflow enrollments; do not silently choose the most recently joined workflow or create conflicting records.
- Link approved title data to the group's current accepted submission through an explicit title field/binding, not milestone-name matching. Retain prior accepted titles in history.

### Phase 5: Verification and rollout

- Back up and exercise additive migrations/backfill against a representative test database.
- Deliver persistence/evaluator and enforcing endpoints together before enabling the UI feature. Keep existing workflows in legacy mode until configured.
- Run focused unit and database integration tests, then relevant workspace type checks and production builds.
- If implementation is pushed, inspect GitHub Actions and deployment results for that exact commit. Report local results separately from remote CI/deployment, including checks still running.

## Acceptance scenarios

1. Group A's Title Research passes and unlocks Title Defense across topics. Group B stays blocked until its own prerequisite passes.
2. The professor requests revision on Group A's Title Research after defense rejection. Only Group A loses prerequisite validity; the earlier approval and defense result remain visible.
3. Group A submits a new attempt, receives approval, and can retry defense through its normal review lifecycle. An old approved file never satisfies the reopened requirement by itself.
4. A dependent milestone that previously passed remains Needs Revalidation after the prerequisite is reapproved, until the professor explicitly reviews/reconfirms it.
5. Multiple prerequisites require all to pass; transitive invalidation works; unrelated milestones remain available.
6. Self-reference, circular chains, cross-workflow links, archived prerequisite selection, and unsafe deletion are rejected.
7. Direct API calls and concurrent approvals/submissions cannot bypass a prerequisite invalidated during the request.
8. Unauthorized professors, students, removed participants, and out-of-scope users cannot reopen or approve milestones. Existing exact-version review controls remain enforced.
9. Upload-free milestones can pass, be reopened, and serve as prerequisites. Current group approval never leaks across projects.
10. Reopening a requirement updates progress and removes stale workflow completion. Repeated clicks and revision cycles do not duplicate project records, decisions, or notifications.
11. A student/group can start from a joined workflow without manually registering a project. The resulting submissions belong to the correct shared internal record.
12. Existing legacy workflows and historical artifacts retain their supported behavior after migration.
13. An Independent Milestone in a later topic can be started without passing earlier milestones. Existing deadlines, membership, approval, and resubmission rules still apply; independent work is not automatically complete or optional.
14. Saving the editor with prerequisites disabled removes the relationships and shows Independent. Enabling prerequisites requires at least one valid selection and changes eligibility accordingly.

## Recommended delivery slices

Implement Phases 1-3 as the first complete feature: cross-topic prerequisites and professor-controlled revision cycles. Implement Phase 4 next using that same eligibility service, then complete rollout verification. This preserves the original workflow-first goal while keeping the two behavior changes independently reviewable.


## Implementation notes (October 26, 2026)

- New workflows use explicit prerequisites. Existing workflows retain legacy sequence behavior until the professor reviews the affected groups and enables prerequisites in Milestone availability.
- The editor labels milestones without prerequisites Independent and supports cross-topic prerequisite selection and optional research-title collection.
- Group milestone decisions are available in the professor's project details. Request Revision records feedback and selected deliverables, preserves prior approvals, blocks dependent work, and resets stale workflow completion. Passed dependents require explicit reconfirmation.
- Students can start a joined workflow by explicitly choosing Solo research or their group workspace. The API creates/reuses the shared internal project record; a title is collected only through a configured title milestone.
- The additive migration is `20261025010000_milestone_prerequisites`. API startup uses the repository's existing migration deployment process. Health responses expose `features.milestonePrerequisites` for deployment verification.
- Further local tests and image delivery were stopped at the user's request. The user will perform manual testing; remote CI and deployment status are checked after pushing.
