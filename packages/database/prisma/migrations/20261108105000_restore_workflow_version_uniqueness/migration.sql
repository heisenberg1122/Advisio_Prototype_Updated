BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

-- Rebuild the Prisma unique index removed by the historical workflow migration.
-- An existing duplicate aborts the transaction and leaves every row intact.
CREATE UNIQUE INDEX "workflows_research_type_id_version_key"
  ON "workflows"("research_type_id", "version");

DROP INDEX "workflows_research_type_id_version_idx";

COMMIT;
