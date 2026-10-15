-- Partial indexes are not represented by Prisma's schema diff. Recreate the
-- exact-version reviewer guard after baselining an existing local database.
-- Preserve every historical row while superseding only redundant ACTIVE rows.
WITH ranked_active AS (
  SELECT
    assignment."id",
    ROW_NUMBER() OVER (
      PARTITION BY assignment."document_version_id", assignment."reviewer_id", assignment."review_type"
      ORDER BY
        EXISTS (
          SELECT 1 FROM "reviews" review
          WHERE review."assignment_id" = assignment."id" AND review."status" = 'SUBMITTED'
        ) DESC,
        assignment."assigned_at" ASC,
        assignment."id" ASC
    ) AS duplicate_rank
  FROM "reviewer_assignments" assignment
  WHERE assignment."status" = 'ACTIVE'
)
UPDATE "reviewer_assignments" assignment
SET
  "status" = 'SUPERSEDED',
  "revoked_at" = COALESCE(assignment."revoked_at", CURRENT_TIMESTAMP),
  "status_reason" = COALESCE(
    NULLIF(trim(assignment."status_reason"), ''),
    'Superseded while restoring exact-version reviewer uniqueness.'
  ),
  "updated_at" = CURRENT_TIMESTAMP
FROM ranked_active
WHERE assignment."id" = ranked_active."id"
  AND ranked_active.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "reviewer_assignments_active_reviewer_key"
  ON "reviewer_assignments"("document_version_id", "reviewer_id", "review_type")
  WHERE "status" = 'ACTIVE';
