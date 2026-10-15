-- Phase 2: persist live collaborative document ownership on the existing
-- documents table. Every new column is nullable so existing records remain
-- valid and no data is rewritten or deleted.
ALTER TABLE "documents"
  ADD COLUMN "milestone_id" UUID,
  ADD COLUMN "live_document_url" TEXT,
  ADD COLUMN "live_external_file_id" VARCHAR(255);

CREATE UNIQUE INDEX "documents_research_id_live_external_file_id_key"
  ON "documents"("research_id", "live_external_file_id");

CREATE INDEX "documents_milestone_id_idx"
  ON "documents"("milestone_id");

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_milestone_id_fkey"
  FOREIGN KEY ("milestone_id") REFERENCES "workflow_stages"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
