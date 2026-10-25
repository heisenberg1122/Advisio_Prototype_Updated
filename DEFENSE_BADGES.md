# Coordinator-issued defense badges

In **Professor → Defense → Defense achievement badges**, a Research Coordinator
can issue a group badge for a completed session with a released `APPROVED` result:

- `TITLE_DEFENSE`: **Title Defense Passed**
- `FINAL_DEFENSE` or `FINAL_ORAL_DEFENSE`: **Final Defense Passed**

The event creation form now includes **Title defense**. Proposal and pre-oral
events do not automatically count as title defense. Results with minor or major
revisions remain ineligible; releasing a result does not automatically issue a
badge. This feature does not change the existing result or revision workflow.

Students see all issued badges for the active project on their **Defense** page,
including earlier sessions. Each award displays its unique ID, issuer, issuance
date, and the student roster saved at issuance. The badge recognizes the group’s
defense milestone; it does not complete the research workflow or issue a diploma.

`POST /api/defense-sessions/:id/badge` requires authentication and the
`RESEARCH_COORDINATOR` role with the session's college assigned to the issuer.
The server determines the badge type and recipients. One badge is allowed per
session; retries and concurrent requests return the original award without
duplicate notifications or audit entries. Existing defense read permissions
govern visibility, including active project membership for students.

## Database rollout

Apply `20261026020000_defense_badges` and all preceding migrations before running
the updated API. Use the deployment's normal `prisma migrate deploy` step. Local
development can run:

```powershell
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
```

The migration adds only the `defense_badges` table, constraints and indexes. It
does not modify existing defense results. Roll back the application with the
table retained to preserve issued awards.

## Validation

Route tests cover coordinator/college authorization, result eligibility,
server-selected award metadata, and duplicate issuance. The guarded PostgreSQL
defense integration suite covers title/final issuance, simultaneous requests,
student visibility, and denial of other groups' reads. Test fixtures are removed
after the suite.
