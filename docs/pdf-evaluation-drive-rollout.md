# Direct PDF evaluation Shared Drive production rollout

## Measure current storage

Run this read-only query against the verified production database with a read-only account. Use the hosting dashboard separately to record the disk allocation and remaining space. The relation sizes include indexes and TOAST, while the byte totals measure logical PDF payload sizes. Run during a low-traffic period because the payload totals scan their tables.

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;

SELECT 'direct evaluations' AS workflow,
       pg_size_pretty(pg_total_relation_size('pdf_evaluations')) AS relation_size,
       count(*) AS records,
       count(source_data) AS source_pdfs,
       count(final_data) AS output_pdfs,
       COALESCE(sum(octet_length(source_data)), 0) AS source_bytes,
       COALESCE(sum(octet_length(final_data)), 0) AS output_bytes
FROM pdf_evaluations
UNION ALL
SELECT 'manuscript review drafts', pg_size_pretty(pg_total_relation_size('packet_document_reviews')),
       count(*), count(source_data), 0, COALESCE(sum(octet_length(source_data)), 0), 0
FROM packet_document_reviews
UNION ALL
SELECT 'published manuscript reviews', pg_size_pretty(pg_total_relation_size('packet_review_publications')),
       count(*), 0, count(pdf_data), 0, COALESCE(sum(octet_length(pdf_data)), 0)
FROM packet_review_publications
UNION ALL
SELECT 'structured evaluations', pg_size_pretty(pg_total_relation_size('structured_evaluations')),
       count(*), 0, count(pdf_data), 0, COALESCE(sum(octet_length(pdf_data)), 0)
FROM structured_evaluations;

SELECT count(*) - count(DISTINCT (source_version_id, source_checksum)) AS repeated_source_copies
FROM pdf_evaluations WHERE source_data IS NOT NULL;
COMMIT;
```

## Release from GitHub main with Drive writes off

1. Prepare the change from the current `origin/main` on a clean branch. Review production free disk space and verify a database snapshot. Run the isolated PostgreSQL tests and rehearse the 30-user workload in an isolated environment sized like production, using test data and a separate Drive folder. Capture API restarts, CPU, memory, database connections, HTTP errors, Drive errors and latency.
2. Release during a low-traffic window. Render runs `20261108100000_pdf_evaluation_drive_artifacts` when the new API starts. Leave `PDF_EVALUATION_DRIVE_FOLDER_ID`, `PDF_EVALUATION_DRIVE_SESSION_IDS`, and `PDF_EVALUATION_DRIVE_ALL_SESSIONS` unset on the production API. Verify GitHub Actions and check that the Render health endpoint reports the exact commit and a connected database. The Namecheap frontend workflow waits for the matching healthy API before publishing. Verify that workflow and confirm that an existing evaluation still opens where one is available.

## Enable a controlled production smoke test

1. Use a restricted folder inside the university's Shared Drive. Verify membership, link sharing, quota, retention, and the production API's ability to see the folder and create files. The API checks that the destination is a writable Shared Drive folder.
2. Use an approved disposable defense session with test data and two authorized panelists. Set `PDF_EVALUATION_DRIVE_FOLDER_ID` to the production folder ID and `PDF_EVALUATION_DRIVE_SESSION_IDS` to that session's UUID. Keep `PDF_EVALUATION_DRIVE_ALL_SESSIONS` unset. The comma-separated allowlist takes precedence if both activation variables are set.
3. Save both drafts, preview and submit each evaluation, then download both final PDFs as the appropriate panelist and facilitator. Check that both drafts share a source file ID, the final file IDs differ, and `source_data` and `final_data` are null for those rows. Test an unassigned panelist and an out-of-college account. Check that an ordinary Workspace account has no direct access to the files. Drive-enabled sessions allow four concurrent direct PDF processing requests per API instance and return a retryable response when busy. Measure the separate document upload routes during the isolated rehearsal.
4. Restore a database backup and the corresponding Drive files in isolation. Reconcile Drive IDs if the restore tool assigns new ones. Open the restored signed PDF through ADVISIO and verify its checksum. Review the rehearsal and restore results before widening production access.
5. At a low-traffic time, clear `PDF_EVALUATION_DRIVE_SESSION_IDS` and set `PDF_EVALUATION_DRIVE_ALL_SESSIONS=true` when ready to enable new writes for all direct PDF evaluations. Keep the production folder ID configured. Observe active defenses, API errors and restarts, database disk usage, and Drive quota.

## Recovery and rollout gates

Unset `PDF_EVALUATION_DRIVE_FOLDER_ID` to return new writes to PostgreSQL if necessary. Keep a release that reads both storage formats deployed for existing Drive-backed evaluations. The runtime verifies Drive bytes against the stored checksum when reading them. A successful retry uses the same file reservation and submission record.

A reservation can remain unreferenced if an upload is abandoned or the evaluation changes before commit. Review such reservations after the smoke test. Treat recent unreferenced rows as potentially in flight, and account for backup and retention requirements before removing any files.

Schedule historical backfill, file lifecycle cleanup, manuscript annotations, and structured evaluation storage as follow-on changes after the production rollout is stable. The initial migration adds references and leaves historical PDF bytes intact. Structured evaluation ledger verification uses its current PDF bytes during this rollout.
