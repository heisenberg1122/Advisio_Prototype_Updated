ALTER TABLE "workflow_stages" ADD COLUMN "required_milestone_id" UUID;
CREATE INDEX "workflow_stages_required_milestone_id_idx" ON "workflow_stages"("required_milestone_id");
ALTER TABLE "workflow_stages" ADD CONSTRAINT "workflow_stages_required_milestone_id_fkey"
FOREIGN KEY ("required_milestone_id") REFERENCES "workflow_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_stages" ADD CONSTRAINT "workflow_stages_no_self_condition"
CHECK ("required_milestone_id" IS NULL OR "required_milestone_id" <> "id");
