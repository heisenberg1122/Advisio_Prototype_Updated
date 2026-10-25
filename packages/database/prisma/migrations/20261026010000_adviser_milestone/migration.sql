-- Add the dedicated workflow milestone discriminator without changing existing stages.
CREATE TYPE "WorkflowStageType" AS ENUM ('STANDARD', 'ADVISER_SELECTION');

ALTER TABLE "workflow_stages"
ADD COLUMN "milestone_type" "WorkflowStageType" NOT NULL DEFAULT 'STANDARD';

-- A workflow may contain at most one adviser-selection milestone. Keeping this
-- invariant in PostgreSQL also protects concurrent API requests.
CREATE UNIQUE INDEX "workflow_stages_one_adviser_selection_per_workflow"
ON "workflow_stages" ("workflow_id")
WHERE "milestone_type" = 'ADVISER_SELECTION';

ALTER TABLE "adviser_requests"
ADD COLUMN "workflow_stage_id" UUID;

ALTER TABLE "adviser_requests"
ADD CONSTRAINT "adviser_requests_workflow_stage_id_fkey"
FOREIGN KEY ("workflow_stage_id") REFERENCES "workflow_stages"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "adviser_requests_workflow_stage_id_status_idx"
ON "adviser_requests"("workflow_stage_id", "status");
