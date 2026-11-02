# Hosted QR evaluation — current handoff

Updated 3 November 2026. The evaluation is live at [the shared entry page](https://advisio-tam-evaluation-2026.onrender.com/evaluate). The researcher confirmed it opens on a phone. This evaluation uses its own branch, database and fictional records; the official backend remains separate.

## Respondent flow

1. Open the shared QR or an assigned invitation link. The general entry asks for a role and program; valid invitations preselect those details and display them for confirmation.
2. Acknowledge that the materials are fictional, then begin a private temporary workspace. No personal account, registration or participant code is required.
3. Read the written guide at `/evaluate/guide` before opening the native portal. The guide provides navigation help and six activities for the assigned role. The video is a Coming soon placeholder and is optional.
4. Explore the prepared records. Reopen **Evaluation guide** in the portal to tick activities as they are tried. Checklist notes persist only in this browser for this project. They are not proof of task completion or survey answers. Incomplete/failed activities do not prevent honest feedback.
5. Select **Finish exploration**, then **Answer TAM questionnaire**. Confirm the group/program, enter personal ratings and comments, and submit in Google Forms. Opening the form does not submit it.
6. Return and end the practice session before another person uses the device.

The written guide supplements the study team's separate eligibility, study information and informed-consent process. It does not replace them. Respondents may stop at any time.

## Invitations and organizer QR sheet

The entry accepts only known role/program assignments:

- Roles: `student`, `professor`, `adviser`, `panelist`, `dean`.
- Programs: `BSIT`, `BEED`, `BSN`, `BSA`, `BSTM`, `BSCE`, `BSARCH` (use the exact IDs returned by `/api/evaluation/config` if the catalog changes).
- Example: `/evaluate?role=dean&course=BSIT`.
- Guide links preserve valid assignments. Duplicate/unknown assignments are ignored with a warning; an existing different session must be ended before starting another assignment.

Open [the organizer QR sheet](https://advisio-tam-evaluation-2026.onrender.com/evaluate/print) directly to choose a role/program and print or download its QR. It is removed from respondent navigation but is **not access-controlled**. It contains public invitation links, no private administration or respondent data. `/api/evaluation/qr?role=dean&course=BSIT` returns a QR for the corresponding HTTPS entry link. Invalid/extra parameters are rejected. A QR contains no identity, session credential or participant code.

Assignments are conveniences, not permissions or eligibility controls. Every admitted session still receives only the native permissions of the validated chosen role. College assignments must name a specific program scenario; Civil Engineering and Architecture share a college, so an ambiguous college code is never silently converted to a program.

## Google Form and support

[Published TAM questionnaire](https://docs.google.com/forms/d/e/1FAIpQLSfo_25naabVASUIEI61rYzIForhdxLy8cXt5kKfwluIIIXqVA/viewform).

Public fields: role `entry.1428349663`, student program `entry.874351903`. Group values are Researchers/Students, Research professors, Research advisers, Evaluation panelists, College Deans. All ratings/comments remain blank; no session identifier is sent. Google may offer an old saved draft to signed-in users; check the current assignment before answering. Session counts and Form responses must be tracked separately. The shared QR does not prove one response per unique respondent.

- [Official website](https://advisio-prototype-updated.vercel.app).
- Video walkthrough: Coming soon; no external video link yet.
- Support: [nagbolus.student@ua.edu.ph](mailto:nagbolus.student@ua.edu.ph).

## Current free hosting

Render service `srv-dbkes34ipgvc73apmh6g`: Free web + Free Postgres, Singapore, no persistent disk. `render.evaluation.yaml` targets branch `codex/qr-evaluation-local`; draft [PR #7](https://github.com/heisenberg1122/Advisio_Prototype_Updated/pull/7) remains separate from main. No card or paid resource was added.

The deployment admits up to **10 active/provisioning sessions**, not 202 simultaneous workspaces. A hosted automated rehearsal admitted ten, handled 90 activity/PDF reads across three concurrent rounds, and correctly refused an eleventh. Ten actual devices performing the full activities still need a pilot. For 202 respondents, plan twenty groups of ten and a final group of two. Stagger starts in groups of five; simultaneous provisioning took about 109 seconds in that rehearsal.

The free site sleeps after 15 idle minutes. Open it before a group begins. A restart clears practice files and expires old sessions; respondents then begin again. Google Form submissions remain separate. Sessions expire after 20 idle minutes or 60 total minutes. The free database expires 30 days after creation; check availability before the evaluation date. Shared account allowances also apply. See [Render free-tier documentation](https://render.com/docs/free).

## Deploying updates

1. Run `npm run test:evaluation`, API type checking, the evaluation frontend tests and the website build. Keep ignored `.env`/`.evaluation` files out of Git.
2. Publish the reviewed branch with a lease on its existing head. Check both GitHub workflows (**Advisio CI Pipeline** and **Evaluation image**) and their exact commit separately from local results.
3. Automatic deployments are off. In the existing evaluation Render service, choose **Manual Deploy → Deploy latest commit**. Do not create or overwrite unrelated resources.
4. Confirm Render is live on the intended commit. Verify `/api/health` reports evaluation mode and database connected, then check entry, invitation, guide, portal checklist, correct blank questionnaire handoff, session end and a phone-width layout.
5. Use the hosted QR. A localhost QR remains only a preview for this computer.

The dedicated image workflow builds and starts the Linux container, checks its PDF/Form URLs, origin rejection and restart recovery. Keep the evaluation database separate from production and preserve the schema/session/file isolation guards. No survey answers are submitted by the automated checks.
