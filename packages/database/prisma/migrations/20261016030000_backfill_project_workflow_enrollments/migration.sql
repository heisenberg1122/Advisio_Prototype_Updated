-- Project creators and active project members receive the workflow instance
-- attached to their research project. Add missing enrollment rows so the
-- workflow status shown in the UI matches the milestones they can access.
INSERT INTO "workflow_enrollments" (
  "id", "workflow_id", "user_id", "status", "joined_at"
)
SELECT
  gen_random_uuid(),
  workflow_instance."workflow_id",
  member."user_id",
  'ACTIVE',
  member."joined_at"
FROM "research_members" AS member
JOIN "research_projects" AS project
  ON project."id" = member."research_id"
JOIN "workflow_instances" AS workflow_instance
  ON workflow_instance."id" = project."workflow_instance_id"
WHERE member."left_at" IS NULL
  AND member."projectRole" IN ('LEADER', 'MEMBER')
  AND project."status" <> 'ARCHIVED'
ON CONFLICT ("workflow_id", "user_id") DO NOTHING;
