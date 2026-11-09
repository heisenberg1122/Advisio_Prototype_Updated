-- DropIndex
DROP INDEX "workflows_research_type_id_version_key";

-- CreateIndex
CREATE INDEX "workflows_research_type_id_version_idx" ON "workflows"("research_type_id", "version");
