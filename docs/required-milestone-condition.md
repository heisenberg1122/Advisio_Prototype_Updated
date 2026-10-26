# Required Milestone Condition

Both the New milestone and Edit milestone composers replace **Position in topic**
with **Required Milestone Condition**. Select an earlier active milestone in the
same workflow, including an Adviser Milestone, or **No specific milestone required**.
New milestones are added to the end of their selected topic. Existing workflow
ordering and approval rules still apply; this selector adds an explicit prerequisite.

For example, create the Adviser Milestone first, then create “Submit research
proposal” and select that Adviser Milestone as its required condition. The proposal
stays locked until an eligible adviser becomes the group's official adviser. Each
group's condition is evaluated against its own records and approved submissions.

The condition is saved on the milestone and enforced on task starts, submission
options, direct uploads, stored-version submissions, live-manuscript submissions,
adviser requests, and manual workflow transitions. Student task lists, milestone
views, and next-step prompts show which prerequisite is blocking progress.

A milestone cannot require itself, an archived milestone, a later milestone, or a
milestone from a different workflow. Reordering topics or moving milestones must
preserve prerequisite order. A prerequisite cannot be deleted or archived while
another active milestone requires it; clear or change the dependent condition first.

## Deployment

Apply migration `20261026120000_required_milestone_condition`, regenerate the Prisma
client, and deploy the API and web app together. Existing milestones start with no
additional condition.

## Manual walkthrough

1. Open New milestone. Select a topic and confirm that **Required Milestone
   Condition** lists earlier milestones, including Adviser Milestone when present.
2. Create a milestone requiring Adviser Milestone. Reopen it in Edit milestone and
   confirm the selection is retained.
3. Open that group's student tasks before adviser acceptance. The milestone should
   show the required adviser milestone and block starting/submitting work.
4. Accept the adviser request as the selected eligible adviser. Refresh student
   tasks; the prerequisite should be satisfied for that group. Another group's
   incomplete adviser milestone should remain blocked.
5. Clear or change the condition in Edit milestone. Confirm that attempts to select
   the milestone itself, reorder it ahead of its prerequisite, or remove a required
   milestone are refused.

Automated tests and builds were skipped at the user's request.
