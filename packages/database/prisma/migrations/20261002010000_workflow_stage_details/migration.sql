ALTER TABLE "workflow_stages" ADD COLUMN "category" VARCHAR(50) NOT NULL DEFAULT 'Milestone';

UPDATE "workflow_stages"
SET "category" = "description", "description" = NULL
WHERE "description" IN ('Milestone', 'Compliance', 'Pre-requisite');
