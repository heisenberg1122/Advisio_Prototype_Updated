-- Preserve the newest pending adviser request for each research project and
-- close any older duplicates before enforcing the one-request rule.
WITH ranked_pending AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "research_id"
      ORDER BY "created_at" DESC, "id" DESC
    ) AS pending_rank
  FROM "adviser_requests"
  WHERE "status" = 'PENDING'
)
UPDATE "adviser_requests" AS request
SET
  "status" = 'CANCELLED',
  "responded_at" = NOW(),
  "response_note" = 'Automatically cancelled when the single pending adviser request rule was introduced.',
  "updated_at" = NOW()
FROM ranked_pending
WHERE request."id" = ranked_pending."id"
  AND ranked_pending.pending_rank > 1;

CREATE UNIQUE INDEX "adviser_requests_one_pending_per_research_idx"
  ON "adviser_requests" ("research_id")
  WHERE "status" = 'PENDING';
