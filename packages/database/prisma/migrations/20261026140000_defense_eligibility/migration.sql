ALTER TYPE "WorkflowStageType" ADD VALUE 'DEFENSE_ELIGIBILITY';

CREATE TABLE "defense_eligibilities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "research_id" UUID NOT NULL,
  "milestone_id" UUID NOT NULL,
  "approved_by" UUID NOT NULL,
  "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumed_at" TIMESTAMP(3),
  "dean_approval_document_id" UUID,
  CONSTRAINT "defense_eligibilities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "defense_eligibilities_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "research_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "defense_eligibilities_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "workflow_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "defense_eligibilities_approval_document_fkey" FOREIGN KEY ("dean_approval_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "defense_eligibilities_research_id_milestone_id_key" ON "defense_eligibilities"("research_id", "milestone_id");
CREATE INDEX "defense_eligibilities_research_id_consumed_at_idx" ON "defense_eligibilities"("research_id", "consumed_at");
ALTER TABLE "defense_sessions" ADD COLUMN "eligibility_id" UUID;
CREATE INDEX "defense_sessions_eligibility_id_idx" ON "defense_sessions"("eligibility_id");
ALTER TABLE "defense_sessions" ADD CONSTRAINT "defense_sessions_eligibility_id_fkey" FOREIGN KEY ("eligibility_id") REFERENCES "defense_eligibilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
