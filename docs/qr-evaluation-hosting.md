# QR evaluation: hosting and Google Forms handoff

Status on **3 November 2026**: the TAM Google Form is published and connected to the local evaluation app. The hosted deployment files are prepared. Render sign-in and resource creation were deferred at the researcher's request. There is **no public evaluation website address yet**; the existing localhost QR remains a computer-only preview.

## Accounts

A different Render account can own this evaluation. It needs read access to the source repository and permission to create the proposed resources. For a private repository, connect a GitHub identity that already has repository access, or arrange access with the repository owner. Public repositories can be selected using the provider's public-repository flow when available.

The questionnaire can remain owned by the existing University of the Assumption Google account. Render receives only its public respondent link and the public role/program field identifiers. No Google password, OAuth credential, email list, respondent identifier, or response data is needed in Render.

## Published questionnaire

[Open the published TAM questionnaire](https://docs.google.com/forms/d/e/1FAIpQLSfo_25naabVASUIEI61rYzIForhdxLy8cXt5kKfwluIIIXqVA/viewform?usp=publish-editor).

The live form was published with **Anyone with the link** responder access and no publication notifications. Email collection, one-response Google sign-in, and respondent results-summary access remain off. No participant-code field was added.

The app's questionnaire button prefills the assigned respondent group and, for students, the selected program. All ratings and comments stay blank. Respondents can change the prefilled values and must confirm the group/program before answering. Opening the link does not prove submission. Google may offer a previously saved draft to an already signed-in user; choose the current link's draft when testing a different role, and always check the selected respondent group.

The five live routes were inspected without submitting answers. A student Nursing link selected Students and Nursing, with no rating or comment answers. The four faculty links reached their corresponding questionnaire sections. Unit checks cover all 35 role/program URL combinations and remove unrelated prefilled answers or identifiers from supplied URLs.

## Prepared topology

`render.evaluation.yaml` describes a new evaluation-only stack:

| Resource                  | Draft configuration                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| Web service               | `advisio-tam-evaluation-2026`, Docker, Singapore, one `0.5c-512mb` instance                              |
| Database                  | `advisio-tam-evaluation-db-2026`, database name `advisio_evaluation`, Singapore, `0.5c-1g`, 1 GB storage |
| Persistent workspace disk | 1 GB mounted at `/var/lib/advisio-evaluation`                                                            |
| Session capacity          | 20 active/provisioning sessions; evaluate respondents in waves                                           |
| Deployment updates        | Automatic redeploys off; use a reviewed build for the event                                              |

These are **paid-resource candidates, not purchased resources**. Review Render's current quoted recurring charges and the account owner's budget before creating them. Performance still needs a rehearsal on the selected host. The configured plans are an initial pilot configuration, not a guarantee that 202 people can use the site simultaneously.

The website and API share one HTTPS origin. This keeps the evaluation cookie first-party on phone browsers. The normal application deployment and its database are not referenced by this Blueprint. Do not apply it over any resource with an existing matching name; choose fresh names and update all references if necessary.

The hosted startup derives its origin from Render's `RENDER_EXTERNAL_URL`; a custom HTTPS origin can be set with `EVALUATION_WEB_URL`. It requires the dedicated evaluation database name and normalizes only that URL. External integration credentials are rejected. The database's external IP allowlist is empty, so the service uses Render's internal connection. The container initializes only its literal storage mount, then runs the application as the unprivileged `node` user.

## Resume deployment after sign-in

1. Sign into the Render account that should own the evaluation. No account change is required in Google Forms.
2. Review the implementation branch, `codex/qr-evaluation-local`, including `apps/api/Dockerfile.evaluation`, `render.evaluation.yaml`, and the evaluation source. Keep all `.env` files and `.evaluation` contents out of Git.
3. Commit and push the reviewed branch. Open a review PR so the existing checks and the new **Evaluation image** job can run. Verify GitHub Actions and deployment results separately. Do not interpret a push as a successful deployment.
4. Create a new Blueprint from the repository, choose this branch, and specify `render.evaluation.yaml`. Confirm new resource names and the displayed charges before resource creation. The local branch has not been pushed as part of this preparation.
5. Let the dedicated database and web service finish deploying. Record the actual HTTPS address assigned by Render; do not predict it from the service name. The container start command does not run the normal production migration command or a production seed.
6. Verify `/api/health` returns evaluation mode with the database connected. Verify `/evaluate`, direct links to each role's portal, manuscript viewing/upload, reviews, consultations, panel PDF preview, session resume, and ending a session. Check that the questionnaire button points to the published Google Form with the expected role/program and blank ratings/comments.
7. Perform the pilot with the intended 20 simultaneous devices. Inspect errors and response times, and adjust the selected resources before inviting respondents. Confirm that two people choosing the same course cannot affect each other's records.
8. Test an actual phone using mobile data, then another phone/browser if available. Confirm QR scan, temporary access, PDF actions, questionnaire handoff, and session closure. These phone and hosted-service checks have not been performed during local preparation.
9. Once those checks pass, open the hosted `/evaluate/print` page or download its `/api/evaluation/qr` image. The QR will automatically contain the actual hosted HTTPS `/evaluate` address. Replace the old localhost handout before printing or distributing it.

The shared QR should open the evaluation activities first. Sending respondents directly to the Google Form bypasses those activities. Keep the existing eligibility and informed-consent procedure before the hands-on session.

## Validation and remaining limits

`npm run test:evaluation:hosting` tests hosted environment guards and origin/database normalization. `npm run test:evaluation` includes the survey-link privacy checks and single-origin SPA routing/CSP tests. Website and API builds verify the application changes. The CI job builds the dedicated Linux container after the branch is reviewed/pushed.

The Blueprint passed Render's published JSON-schema validation. Docker is not installed in the current local environment, so the Linux image build, selected-account resource validation, and actual deployment remain pending. No Render resources, public URL, remote deployment, or hosting charges were created during preparation. Local files, the Google Form, and its ownership remain available while hosting sign-in is postponed.

Provider references checked on 3 November 2026: [Render Blueprint specification](https://render.com/docs/blueprint-spec), [compute plan IDs](https://render.com/docs/compute-plans), [persistent disks](https://render.com/docs/disks), and [Google Forms publishing and prefilled links](https://support.google.com/docs/answer/2839588).

Local checks completed during this handoff: 3 hosted-configuration tests, 10 evaluation/SPA/survey tests, API type checking, and both website/API builds passed. Eleven actual session handoff links were checked (seven student programs plus the four faculty roles), and anonymous access to the published questionnaire returned the questionnaire. Google Forms showed 0 responses after the browser route checks. No survey answers were submitted.
