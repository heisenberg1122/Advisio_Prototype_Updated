ALTER TYPE "DefenseDecision" ADD VALUE IF NOT EXISTS 'REDEFENSE_REQUIRED';
ALTER TABLE "defense_packets" ADD COLUMN "structured_form" JSONB;
ALTER TABLE "defense_sessions" ADD COLUMN "revision_clearance" JSONB;
CREATE TABLE "structured_evaluation_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "college_id" UUID NOT NULL,
  "created_by" UUID NOT NULL, "spec" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "structured_evaluation_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "structured_evaluation_templates_college_id_created_at_idx" ON "structured_evaluation_templates"("college_id", "created_at");
CREATE TABLE "structured_evaluations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "defense_session_id" UUID NOT NULL,
  "panelist_id" UUID NOT NULL, "revision" INTEGER NOT NULL DEFAULT 1,
  "answers" JSONB NOT NULL, "totals" JSONB NOT NULL, "locked_at" TIMESTAMP(3),
  "preview_hash" VARCHAR(64), "pdf_data" BYTEA, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "structured_evaluations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "structured_evaluations_defense_session_id_fkey" FOREIGN KEY ("defense_session_id") REFERENCES "defense_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "structured_evaluations_defense_session_id_panelist_id_key" ON "structured_evaluations"("defense_session_id", "panelist_id");
