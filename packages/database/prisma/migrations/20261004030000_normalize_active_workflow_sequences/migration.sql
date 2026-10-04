-- Keep archived milestones for audit history while compacting visible milestone
-- numbers to 1..n within each workflow.
UPDATE "workflow_stages"
SET "sequence" = "sequence" + 1000000;

WITH ranked AS (
  SELECT
    "id",
    CASE
      WHEN "category" = 'Archived' THEN
        -ROW_NUMBER() OVER (
          PARTITION BY "workflow_id", ("category" = 'Archived')
          ORDER BY "sequence", "id"
        )
      ELSE
        ROW_NUMBER() OVER (
          PARTITION BY "workflow_id", ("category" = 'Archived')
          ORDER BY "sequence", "id"
        )
    END AS "new_sequence"
  FROM "workflow_stages"
)
UPDATE "workflow_stages" AS stage
SET "sequence" = ranked."new_sequence"
FROM ranked
WHERE stage."id" = ranked."id";
