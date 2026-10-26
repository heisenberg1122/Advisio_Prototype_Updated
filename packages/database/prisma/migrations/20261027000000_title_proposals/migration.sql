ALTER TYPE "WorkflowStageType" ADD VALUE IF NOT EXISTS 'TITLE_PROPOSAL';
ALTER TABLE "workflow_stages" ADD COLUMN "title_proposal_count" INTEGER NOT NULL DEFAULT 3 CHECK ("title_proposal_count" BETWEEN 1 AND 10);
ALTER TABLE "research_projects" ADD COLUMN "registered_at" TIMESTAMP(3);
CREATE TABLE "title_proposal_submissions" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 "research_id" UUID NOT NULL REFERENCES "research_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "stage_id" UUID NOT NULL REFERENCES "workflow_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "titles" TEXT[] NOT NULL,
 "status" VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED' CHECK ("status" IN ('SUBMITTED','REVISION_REQUIRED','APPROVED')),
 "version" INTEGER NOT NULL DEFAULT 1,
 "selected_index" INTEGER,
 "submitted_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "reviewed_by" UUID REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "review_note" TEXT,
 "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "reviewed_at" TIMESTAMP(3),
 UNIQUE ("research_id", "stage_id"),
 CHECK ("selected_index" IS NULL OR ("selected_index" >= 0 AND "selected_index" < cardinality("titles")))
);
