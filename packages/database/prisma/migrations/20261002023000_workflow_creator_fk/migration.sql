UPDATE "workflows" AS workflow
SET "created_by" = professor."id"
FROM (
  SELECT "id"
  FROM "users"
  WHERE "email" = 'professor01@university.edu.ph'
  LIMIT 1
) AS professor
WHERE NOT EXISTS (
  SELECT 1 FROM "users" WHERE "users"."id" = workflow."created_by"
);

ALTER TABLE "workflows"
ADD CONSTRAINT "workflows_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
