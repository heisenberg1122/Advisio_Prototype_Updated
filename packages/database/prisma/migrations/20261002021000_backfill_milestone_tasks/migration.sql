INSERT INTO "workflow_tasks" (
  "id", "stage_id", "title", "instructions", "sequence", "due_days",
  "allowed_file_types", "is_required", "created_at", "updated_at"
)
SELECT gen_random_uuid(), stage."id", stage."name",
  'Submit the required deliverable for ' || stage."name" || '.',
  1, stage."deadline_days", 'PDF,DOCX', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "workflow_stages" stage
WHERE NOT EXISTS (
  SELECT 1 FROM "workflow_tasks" task WHERE task."stage_id" = stage."id"
);
