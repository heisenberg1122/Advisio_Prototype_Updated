# Class record

The Professor/Coordinator portal has **Class Record** at `/professor/class-record`. Each workflow has one record with **Prelim**, **Midterm**, and **Finals** periods. The owning professor creates the record; active researcher enrollments form its roster. College authorization, workflow ownership, and the researcher-panel restriction apply on every request. Neither adviser assignments nor general administrator access grant editing access to another professor's class record.

## Activities and calculations

Professors can add individual activities with 1–10,000 maximum points, or link a graded standard milestone requirement. A requirement can belong to only one period. Linked group scores use the **released grade of the current submitted version**, and only for researchers who are currently members of that project. A missing released score or ambiguous multiple-project submission keeps the activity ungraded. Private milestone drafts never become a class-record score.

Individual entries distinguish **Graded** (including zero), **Ungraded**, **Missing** (zero), and **Excused** (excluded). Total-points calculation is the default: eligible earned points divided by eligible possible points. Attendance is recorded separately by default. A professor can configure milestone, individual, and attendance category weights totaling 100%, and the credit awarded to late attendance. An empty category with positive weight prevents release; the system does not silently change the weights. Scores are percentages; no institutional GPA/transmutation scale is assumed.

Period weights in the overall grade are optional. The researcher's overall grade appears only after all three periods have releases whose saved weights total 100%. Each release retains its own grading policy and result.

## Attendance and release

Each period supports one attendance session per date, with **Present**, **Absent**, **Late**, or **Excused** for each researcher. Excused dates are excluded from attendance calculations. Unmarked dates remain distinct from absences.

**Save drafts** persists professor-only edits. **Release** publishes one researcher; **Release period** publishes the entire active roster atomically. Every activity must be graded, missing, or excused, and every attendance date must be marked before a researcher's record can be released. A release requires an eligible calculated score.

Releases are immutable snapshots containing that researcher's activities, source milestone/version references, attendance, grading policy, and percentage. A database trigger rejects editing or deleting a release. Corrections create a new release. Researchers continue seeing the previous release while drafts or source milestone grades change. A period revision prevents stale saves; release also verifies a source fingerprint so a changed roster or linked milestone cannot silently replace the professor's reviewed values.

Changing a saved score/attendance mark, changing settings after release, or releasing again requires a correction note. Academic audit entries record actor, time, old/new values, and reason in the same transaction. The professor can view the latest 50 audit entries and export saved grade/attendance sheets as CSV; spreadsheet formula characters are escaped.

## Researcher access

**My Grades → Class Grades** at `/student/grades` shows only the authenticated researcher's releases and attendance, plus their release history. The API never reads draft score or attendance tables to build this response. It ignores arbitrary student identifiers and requires active enrollment in the current authorized college. Revoking enrollment removes access. Existing defense reports remain under **Defense Grades**.

## Team setup and deployment

This change adds six tables: `class_record_periods`, `class_record_items`, `class_record_scores`, `class_record_sessions`, `class_record_attendance`, and `class_record_releases`. The migration is additive; it does not backfill grades, create classes, or add sample accounts to shared databases. Existing submission comments, milestone grade releases, and defense grade reports continue to use their existing records.

After pulling, install the locked dependencies, back up the intended database, and apply committed migrations before starting the updated API:

```sh
npm ci
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
npm run build --workspace=@research-management/database
```

Start the app with the normal development process. The professor opens **Class Record**, selects an owned workflow, and chooses **Create class record** to initialize its three periods. No extra environment variables are required for grading. `VITE_QUERY_DEVTOOLS=true` is an optional local debugging setting; the normal app hides the widget.

The API is mounted at `/api/class-records`. Professor list/read/initialize and period settings/activity/score/attendance/release operations enforce ownership and the active college. `/api/class-records/mine` lists a researcher's enrolled classes; `/:workflowId/mine` returns only that authenticated researcher's published snapshots. The frontend adds `/professor/class-record`, Class Record/My Grades navigation, a Class Grades tab alongside existing Defense Grades, and submission deep links from linked milestone cells.

For a deployment using the restricted audit runtime role, reapply the existing `packages/database/scripts/audit-runtime-role.sql` grants as the migration owner after the migration. The script preserves the audit table's SELECT/INSERT-only access; do not grant the runtime role ownership or weaken the append-only protections.

## Verification results

Local validation after safely pulling the latest audit UI change passed 427 frontend tests and 94 focused API calculation, access, grading, and review tests (521 total). API type checking, lint, frontend/API builds, real local API permission checks, immutable-release checks, and separate browser checks passed. Browser verification covered score and attendance editing, researcher isolation, private Finals drafts, preserved released grades after draft corrections, linked PDF review, and 390-pixel phone layouts. GitHub CI and hosting status must be checked separately for the pushed commit.

## Local sample

Apply `20261102040000_class_record` through Prisma migrate deploy, after backing up the intended local database. Regenerate the client and restart the API. No class records or grades are assigned to existing workflows automatically.

The ignored `.local/class-record-demo.json` contains local sample links and accounts; do not commit it. The dedicated highlight-review sample has two researchers, shared milestone scores, different individual scores and attendance, released Prelim/Midterm records, and private Finals drafts. The existing review and researcher accounts still work.

Validation covers points/weighted calculations, missing/excused/ungraded behavior, college/owner/enrollment boundaries, own-student release filtering, real API stale-write and correction checks, private draft isolation, immutable release storage, and browser grade/attendance editing. Desktop and phone checks cover both portals and preserve the sample's original scores after testing.

The floating query debugging widget is opt-in during development (`VITE_QUERY_DEVTOOLS=true`). Its saved desktop position could extend beyond a phone viewport; it is hidden in the normal local app and production.
