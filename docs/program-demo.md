# Four-program demonstration dataset

The maintenance tool creates 56 normal password-login accounts, eight separate
four-student groups, and four published program workflows. It does not change the
ordinary login rules, general demo-seed flags, academic catalog, current academic
year, production configuration, or existing accounts.

| Program | College/school | Workflow                                            |
| ------- | -------------- | --------------------------------------------------- |
| BSN     | CNP            | Nursing research                                    |
| BSA     | COA            | Quantitative, qualitative, or mixed-method research |
| BSCPE   | CEA            | Computer Engineering capstone/design                |
| BEED    | SOE            | Qualitative education research                      |

Accountancy and Education are interpretations of the supplied interview sheets.
Nursing and Engineering are proposed demonstration examples. Forms, approvals,
sample findings, and released proposal results are explicitly fictional.

Each program has one professor/coordinator, adviser, Dean, three panelists, and
eight students. Emails use `demo.<program>.<role>@demo.advisio.invalid`, for example
`demo.bsa.professor@demo.advisio.invalid`. Role suffixes are `professor`, `adviser`,
`dean`, `panel1` through `panel3`, and `student1` through `student8`. Each account
has one institutional role. Dean access uses the college scope already enforced
by Advisio; these are ordinary accounts, not isolated respondent workspaces.

## Setup

Run `npm run demo:programs -- plan` without database access to inspect the scope.
For execution outside Render, copy `.env.program-demo.example` to the Git-ignored
`.env.program-demo.local`, supply the exact database host/name and connection,
the four private program passwords, and the deployment's storage configuration.
The tool never chooses a target from the ordinary development `.env`.

Inside the existing Render maintenance shell, set the tool's database URL to the
service's existing `DATABASE_URL`, declare the exact expected host/database, and
set `PROGRAM_DEMO_RENDER_SERVICE_ID` to that service's existing ID. The private
Render connection exception checks the actual `RENDER_SERVICE_ID`, private Render
database hostname, and unchanged connection string. Other external connections
require certificate validation with `sslmode=require&sslaccept=strict`.

```text
npm run demo:programs -- preflight
npm run demo:programs -- seed
npm run demo:programs -- verify
npm run demo:programs -- inspect
```

`seed` refuses existing login collisions and commits the core dataset and its
root-ID manifest together. It then uploads actual newly authored PDFs through
the configured storage service, creates guides and reusable evaluation forms,
prepares the advanced groups, and verifies the result. No Google Drive IDs,
document URLs, or storage paths are fabricated. If file preparation is
interrupted, use `prepare` to resume and `verify` to check the result. Core
accounts remain individually identifiable for cleanup.

Credentials are written to `.demo-local/four-programs/<target-hash>/accounts.csv`.
The target hash prevents local test runs from overwriting the live account list
or storage-cleanup journal. Passwords are not printed or committed.

## Walkthrough

Students 1-4 form Group A and begin at the first milestone. Students 5-8 form
Group B, have a registered title and accepted adviser, and start at final
manuscript revision. Both groups are enrolled and have real workspace membership.
The four workflows contain topics and sequential milestone prerequisites.

BSN, BSA, and BSCPE Group B include a clearly fictional completed proposal defense
with three locked evaluation PDFs, an approved result, and a verified evaluation
integrity ledger. BEED follows the interview's single-defense sequence: proposal
revision, UAREB application, instrument validation, manuscript completion, onsite
defense, revision, and final submission. Final eligibility remains unapproved in
every program. After the revised manuscript is
submitted and approved, exercise the normal coordinator eligibility approval,
Dean approval-letter signature, scheduling, panel invitation, packet publication,
onsite evaluation, official result release, and final revision/submission flow.
The reusable forms keep presentation and manuscript scores separate.

The guide PDF is available through each workflow's Guides & Templates. Ethics and
instrument milestones track supporting demo documents; they are not real UAREB
approvals. Final official archiving is an explicit walkthrough action, not an
automatically issued institutional certificate.

## Preview and remove

```text
npm run demo:programs -- cleanup-preview
```

Inspect its account/group/workflow/file counts, then set
`PROGRAM_DEMO_CLEANUP_CONFIRMATION=DELETE:ADVISIO-PROGRAM-DEMO-V1` and
`PROGRAM_DEMO_CLEANUP_PREVIEW_HASH` to the returned hash. Run:

```text
npm run demo:programs -- cleanup
```

The tool rechecks the immutable creation manifest and relationships in a
serializable transaction. Cleanup refuses changed login identities or roles,
externally linked identities, non-demo group members/enrollments, unrelated
projects/workflows/workspaces, and official archive records. It removes only
the selected dataset's active roots and dependent records. A failed database
deletion rolls back rather than disabling triggers or removing real data.

Audit records and append-only evaluation ledger events remain intact, including
their fictional snapshot data. This is intentionally not a promise to erase
retained institutional history. Empty shared Drive parent folders may remain.
The exact pending storage references are journaled before database deletion;
failed file removals are reported and must be retried. Keep that private journal
until removal is verified. Run `inspect` afterward to confirm zero active roots.

To reset, complete cleanup and then run `seed` again. Never use a whole-database
reset on the live deployment.

## Validation

`npm run test:program-demo` covers account counts and uniqueness, program-specific
milestones, explicit target selection, private passwords, and mixed-data cleanup
rejection. `node --import tsx scripts/program-demo.integration.mjs` is an opt-in
lifecycle test requiring the dedicated loopback `advisio_program_demo_test`
database configured under `.demo-local/four-programs-test/env.json`. It provisions
and reads actual local PDFs, checks all password hashes and workflow progress,
verifies structured proposal evaluations, rejects mixed real/demo membership,
then checks exact cleanup and preservation of an unrelated sentinel account and
real audit/evaluation immutability triggers.

Local tests and live login/storage verification are reported separately from
GitHub Actions and deployment checks. A maintenance-only branch push does not
deploy the application or establish a successful CI run.
