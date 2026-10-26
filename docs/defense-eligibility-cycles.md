# Defense eligibility by milestone

Choose **Workflow → Create → Academic event → Advanced settings → Milestone
type → Defense Eligibility**. This is a group approval gate; it can have optional
document requirements and an explicit Required Milestone Condition.

In **Defense → Defense eligibility approvals**, the coordinator approves the
group's next gate after prerequisites and required submissions are approved.
This action also completes the milestone in workflow progress. Academic events
without documents now have an explicit approval action rather than relying on
workflow completion or adviser acceptance.

Each `(research group, milestone)` has one permanent approval record. The system
uses the first unconsumed gate in workflow order. A later gate cannot be approved
until the group's earlier defense eligibility has been consumed.

## Scheduling and results

- Adviser acceptance and full-workflow completion no longer grant eligibility.
- Scheduling requires an approved, unused gate and a signed Dean letter linked
  to that exact eligibility record. Both scheduling endpoints enforce this rule.
- A group can have only one active defense session. Per-group transaction locks
  prevent simultaneous requests from scheduling it twice.
- A session stores its eligibility ID. Releasing the official **Approved** result
  consumes only that record, in the same transaction as the result release.
- Results requiring revisions, rejection, and rescheduling retain the cycle.
  An Approved result is needed before advancing to another defense eligibility.
- Consumed approvals cannot be reset by reapproving or renaming the milestone.

For example: approve Title Defense readiness, sign its Dean letter, schedule and
pass Title Defense, then approve Final Defense readiness and obtain a new letter.
The previous approval and letter cannot unlock Final Defense.

## Multiple groups in a Dean request

The signature modal lists groups with approved, unused eligibility and no active
session. Select multiple groups in the same college and attach a PDF covering all
of them. One letter and signature request is created, linked to each selected
group's current eligibility. The Dean's inbox message lists the covered groups
and milestone names. Signing that letter satisfies the institutional approval
check for those cycles, including manuscript packet readiness. An unsigned or
revoked letter cannot authorize scheduling.

The server checks every selected group's scope and eligibility, validates the
Dean's college, and commits all links together. Failed transactions clean up the
uploaded blob.

## Removing accidental sessions

Each unstarted session has **Delete session** with a confirmation dialog. The
server requires confirmation for that exact session ID and cancels it, removes
active invitations, notifies participants, and records an audit entry. It retains
the packet and other historical records. The group can be scheduled again using
its unconsumed eligibility. Removing the final group cancels the parent event.
Live, deliberating, and completed sessions cannot be deleted this way. Cancelled
sessions cannot be revived by stale invitation responses or reschedule requests.

## Migration and compatibility

Apply `20261026140000_defense_eligibility` and regenerate Prisma before starting
the updated API; deploy the frontend and backend together. The migration adds
the milestone enum value, eligibility table, and nullable session link. It has
been applied to the isolated `advisio_test` database during verification.

Existing sessions keep their history and remain usable. They are not silently
assigned to a newly configured gate. Existing workflows need an explicit Defense
Eligibility milestone and coordinator approval before creating new sessions;
adviser selection is no longer a scheduling shortcut. Existing Dean letters are
not automatically reused for new cycles.
