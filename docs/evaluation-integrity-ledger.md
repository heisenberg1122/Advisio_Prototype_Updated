# Evaluation integrity ledger and defense guide

Implemented scope: newly published structured defense evaluation packets, final panelist submissions, and official result release. Existing sessions with no ledger enrollment remain legacy records. This feature is a centralized, append-only hash chain; it is not a distributed blockchain.

## Explanation for the research defense

> Advisio adapts blockchain's hash-linking principle to preserve a traceable history of defense evaluations. Publishing the evaluation form creates the first record. Each final panelist submission adds a record containing its evaluation snapshot and PDF fingerprint, together with the preceding record's hash. Releasing the official result adds the decision, calculated report, and references to the submitted evaluations. Verification recalculates the hashes, scores, and PDF fingerprints and compares them with the preserved records. A checkpoint retained outside Advisio lets a facilitator compare the current history with a previously observed chain.

### Concrete scenario

Suppose three required panelists submit manuscript section scores of 90, 86, and 88 under the published rubric.

| Record | Action                          | Preserved information                                                                                 |
| ------ | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1      | Facilitator publishes the form  | Rubric, weights, researcher/panel roster, manuscript version and mapping version                      |
| 2      | Panelist A submits              | Ratings, total 90, recommendation, feedback, signature context, exact PDF fingerprint, preceding hash |
| 3      | Panelist B submits              | Ratings, total 86 and the preceding hash                                                              |
| 4      | Panelist C submits              | Ratings, total 88 and the preceding hash                                                              |
| 5      | Facilitator releases the result | Manuscript average 88, separate presentation averages, official decision and source submission hashes |

These example totals assume an appropriate configured rubric. Advisio does not infer a combined grade from presentation and manuscript results, and the facilitator chooses the official decision explicitly.

If someone changes A's stored rating, total, feedback or PDF afterward, verification detects a disagreement with the recorded submission. Result release is rejected when verification detects a mismatch. If an attacker rewrites the data and recomputes the chain, internal hashes can become consistent again. Comparing with the original externally retained checkpoint detects that the committed history differs.

### Questions a panel may ask

**Why is it blockchain-inspired?** Each event contains the hash of its predecessor. This adapts the hash-chain mechanism described by [NIST](https://csrc.nist.gov/glossary/term/hash_chain).

**Is it a private blockchain?** No. PostgreSQL stores one centrally administered ledger. There is no distributed consensus, mining, token, smart contract or network of independent validating nodes.

**Why use both PDF hashing and a hash chain?** A PDF hash checks the exact retained file. The chain also links the form, submitted ratings and totals, actors, sequence and released result into one history.

**Does a valid hash prove fair grading?** No. It supports integrity and traceability of recorded evaluations. Academic judgment, identity assurance and correct original input remain separate concerns.

**Can the administrator change it?** Ordinary application routes expose no ledger editing/deletion operation, and database triggers reject UPDATE, DELETE and TRUNCATE. A sufficiently privileged database owner can bypass database protections. Independent checkpoint custody is necessary to detect coordinated history rewriting; a fresh receipt generated after a rewrite is not evidence of the original history.

**Is it immutable?** Describe it as tamper-evident with append-only controls, rather than absolutely immutable. A checkpoint match means agreement with the supplied file through its recorded sequence; it does not establish who retained that file or the integrity of later events.

**Can a scoring error be corrected?** This release retains the existing final-submission lock. It does not introduce a grade-correction/re-release workflow. Never manually edit a locked grade to simulate a correction. A future authorized correction feature must preserve the original submission, append a correction record and create an explicitly released report version.

## Dashboard workflow

Facilitator: **Defense → Review packet → Consolidated evaluations → Evaluation integrity**.

1. Publish a new structured evaluation packet to enroll the session.
2. Panelists preview and confirm their final evaluations. Each receives its own ledger record number and hash in the evaluation workspace.
3. After all required panelists submit, select **Verify records**.
4. Select **Download checkpoint** and retain the JSON file outside Advisio, for example with an institution-controlled custodian. The file contains a session ID, sequence and hash, without scores or feedback.
5. Confirm that the downloaded file has been retained, or select **Compare retained checkpoint** to upload an existing file. A valid checkpoint covering the current chain is required for release.
6. Select the official decision and release it. Release appends another event, so download and independently retain a new checkpoint covering the released result.
7. Later, upload the previously retained checkpoint to compare history. A pre-release checkpoint verifies only its earlier prefix; the interface states when later records fall outside its coverage.

Researchers see a summary only after result release. Individual panelists cannot access consolidated integrity reports or another panelist's evaluation through these endpoints. Integrity history responses never contain raw ledger payloads.

## Implemented mechanisms

- One sequential chain per defense session. SHA-256 hashes cover a domain/version identifier, session, sequence, event type, payload version, actor ID and role snapshot, server time, operation ID, payload and previous hash.
- Canonical JSON version 1 sorts object keys, preserves array order and rejects undefined/nonfinite values. JSON numbers use the existing server scoring rules; client-supplied totals are not authoritative.
- Session row locks serialize appends. Unique session/sequence and operation constraints prevent forks and duplicate operations. Submission retries return the existing locked evaluation after integrity verification.
- Business changes and event writes share a transaction. Ledger failure rolls back the associated publication/submission/release. Verification reads use a consistent database snapshot. Release rechecks submissions and current required assignments under the session lock.
- Verification checks chain structure, supported event formats, form/manuscript references, locked evaluation snapshots, recalculated totals, exact PDF bytes, final report/decision, and any supplied checkpoint.
- Historical actor/session identifiers have no cascading foreign keys. Account/project deletion does not rewrite ledger events. There is no user-facing lookup of orphaned sessions.
- No silent enrollment/backfill of earlier evaluations. Republishing an eligible unstarted packet enrolls that session prospectively. Legacy PDF and rubric modes retain their existing workflow.

## Checkpoint and deployment limits

Checkpoint custody is manual in this release. No automated independent storage service, checkpoint delivery worker, external timestamp authority or cryptographic signature has been configured. The application can compare a supplied file, but cannot prove it was retained independently. Users must export again after release to cover the new release event.

Deploy the API, frontend and additive migration together. Regenerate Prisma before type checking/building. The migration adds `evaluation_ledger_started_at` and `evaluation_ledger_events` plus rejection triggers. Do not apply migrations to a live database as part of testing.

Use separate migration and non-owner runtime database identities in production. The runtime role needs SELECT/INSERT on ledger events and must not own the table/function/schema, inherit the migration role, or have UPDATE/DELETE/TRUNCATE or trigger-disabling privileges. `REVOKE ... FROM PUBLIC` in the migration does not revoke pre-existing direct/default grants to a named runtime role. Review those grants explicitly. Existing API startup currently runs migrations: deployments must separate that privileged migration step from the restricted application connection before claiming role separation.

Ledger payloads retain academic records, actor identifiers and feedback even when source accounts/projects are deleted. Establish institution-approved retention and restricted archival procedures before production use; the feature does not supply an automated retention/deletion policy. Do not claim that account deletion erases ledger snapshots.

## Validation and demonstration

Automated service tests cover canonicalization, altered ratings/feedback/totals/PDFs/forms, missing locks/records, broken ordering, unsupported events, coordinated rewriting against a retained checkpoint, release verification and idempotency. HTTP tests cover privacy, final submission receipts, retries and checkpoint input validation. The database defense workflow exercises concurrent panelist submissions, append-only triggers, checkpoint-required release, altered totals blocking release, and comparison across the release event.

For a defense demonstration, use disposable test records: show a valid history, retain a checkpoint, modify a fixture's score, and show the mismatch. Do not tamper with production student records. Record the actual test environment and results in the manuscript rather than presenting the illustrative 90/86/88 scenario as an experiment.
