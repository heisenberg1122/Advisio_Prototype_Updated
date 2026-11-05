# Hosted QR evaluation — current handoff

**Branch implementation:** [Demo accounts implementation](demo-accounts-implementation.md) describes direct dashboard onboarding, eight colleges, and an isolated role switcher. The respondent flow below describes the branch implementation. Check the hosted deployment separately.

Updated 5 November 2026. The evaluation is hosted at [the shared entry page](https://advisio-tam-evaluation-2026.onrender.com/evaluate). The researcher confirmed it opens on a phone. This evaluation uses its own branch, database and fictional records; the official backend remains separate.

The main website is [ADVISIO on Vercel](https://advisio-prototype-updated.vercel.app/). The Render address is for evaluation only. Its `/` and `/index.html` entries redirect to `/evaluate`, preserving any role/program query parameters. The role portals are still needed for the guided activities and use only the temporary evaluation workspace. These redirects take effect when this update is deployed.

## Respondent flow

1. Begin in Google Forms for the study instructions, consent, and respondent group selection. Keep that tab open while you open the ADVISIO invitation.
2. Select your assigned role and college if the invitation has not already selected them. Acknowledge that the demo materials are fictional, then select **Begin Evaluation** to open the temporary workspace.
3. Open **Evaluation activities** on your dashboard and tick activities as you try them. The checklist is saved in your browser for the selected demo role and scenario.
4. Select **Finish walkthrough** to review the role, college, and scenario. You can finish with activities unticked. Select **End demo session** and confirm to clear your practice workspace.
5. Return to your original Google Forms tab. Answer the remaining TAM statements based on your experience and submit your response there. Completing the demo does not automatically submit the form.

The written guide supplements the study team's separate eligibility, study information and informed-consent process. It does not replace them. Respondents may stop at any time.

New workspaces also include a fictional released prelim class record: three graded activities, three attendance dates, and a score breakdown. Students can open **Grades → Class Grades**; professors can inspect the same records in **Class Record**. Midterm/finals remain unreleased, so no final class average is shown. Each project includes a completed consultation with adviser notes and action items, plus its upcoming consultation. Existing sessions keep their current records; end the session and begin a new one after updating to see the additional content.

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
- Support: [advisio.main@gmail.com](mailto:advisio.main@gmail.com).

## Current free hosting

### Branded startup page

Render serves its own loading screen before the evaluation container starts; application CSS cannot replace that response. A static starter page on the main Vercel website avoids showing it to respondents:

- Entry: `https://advisio-prototype-updated.vercel.app/evaluate/start` (supports role/program invitations).
- It displays the ADVISIO logo and “Starting your evaluation environment…”, checks the evaluation service, and opens the Render entry only after health confirms evaluation mode and a connected database.
- The Vercel rewrite `/evaluate/status` forwards only to the evaluation service’s public `/api/health`. It disables caching; the browser sends no account credentials. No production database or session is used. Role/program details carry through to Render, where the original session cookie and permissions still apply.
- Checks stop after two minutes and offer **Try again** and the support email. They also stop when the visitor leaves. This is a visitor startup flow, not an always-running keep-alive service.

Deploy `apps/web/public/evaluation-launcher.{html,css,js}` and `apps/web/vercel.json` on the main Vercel site first. Verify the starter page and uncached health rewrite there. Only then set `EVALUATION_LAUNCH_URL=https://advisio-prototype-updated.vercel.app/evaluate/start` on the existing evaluation service and deploy its updated API. New organizer QR codes and their printed invitation links will use the starter. Leave the variable unset until Vercel is ready; existing Render links continue to work but can still show Render’s startup screen. Existing printed QR codes must be regenerated to use the starter.

Render service `srv-dbkes34ipgvc73apmh6g`: Free web + Free Postgres, Singapore, no persistent disk. `render.evaluation.yaml` targets branch `codex/qr-evaluation-local`; draft [PR #7](https://github.com/heisenberg1122/Advisio_Prototype_Updated/pull/7) remains separate from main. No card or paid resource was added.

The Render configuration targets **50 active sessions** with prepared workspaces across nine programs. Before an organized session, check `/api/evaluation/capacity` and wait for enough ready workspaces in each participating program. The configured cap sets the admission limit. Use measured rehearsal results to decide how many respondents to start together.

The free site sleeps after 15 idle minutes. Open it before a group begins. A restart clears practice files and expires old sessions; respondents then begin again. Google Form submissions remain separate. Sessions expire after 20 idle minutes or 60 total minutes. The free database expires 30 days after creation; check availability before the evaluation date. Shared account allowances also apply. See [Render free-tier documentation](https://render.com/docs/free).

## Deploying updates

1. Run `npm run test:evaluation`, API type checking, the evaluation frontend tests and the website build. Keep ignored `.env`/`.evaluation` files out of Git.
2. Publish the reviewed branch with a lease on its existing head. Check both GitHub workflows (**Advisio CI Pipeline** and **Evaluation image**) and their exact commit separately from local results.
3. Automatic deployments are off. In the existing evaluation Render service, choose **Manual Deploy → Deploy latest commit**. Do not create or overwrite unrelated resources.
4. Confirm Render is live on the intended commit. Verify `/api/health` reports evaluation mode and database connected. Check the entry, invitation, portal checklist, completion instructions, session end, and phone-width layout.
5. Use the hosted QR. A localhost QR remains only a preview for this computer.

The dedicated image workflow builds and starts the Linux container, checks its PDF/Form URLs, origin rejection and restart recovery. Keep the evaluation database separate from production and preserve the schema/session/file isolation guards. No survey answers are submitted by the automated checks.
