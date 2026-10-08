CREATE TYPE "DefensePacketStatus" AS ENUM ('DRAFT', 'PUBLISHED');
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOWNLOAD';

CREATE TABLE "defense_packets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "defense_session_id" UUID NOT NULL,
    "manuscript_version_id" UUID NOT NULL,
    "similarity_report_version_id" UUID,
    "recommendation_template_version_id" UUID,
    "evaluation_template_version_id" UUID,
    "recommendation_field_mappings" JSONB NOT NULL DEFAULT '[]',
    "evaluation_field_mappings" JSONB NOT NULL DEFAULT '[]',
    "mapping_version" INTEGER NOT NULL DEFAULT 1,
    "engine_version" VARCHAR(20) NOT NULL DEFAULT '2.0',
    "preflight_report" JSONB,
    "status" "DefensePacketStatus" NOT NULL DEFAULT 'DRAFT',
    "review_deadline" TIMESTAMP(3),
    "published_by_id" UUID NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "defense_packets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "panelist_manuscript_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "defense_session_id" UUID NOT NULL,
    "panelist_id" UUID NOT NULL,
    "private_notes" TEXT,
    "annotations" JSONB NOT NULL DEFAULT '[]',
    "revision_checklist" JSONB NOT NULL DEFAULT '[]',
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "panelist_manuscript_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "panelist_recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "defense_session_id" UUID NOT NULL,
    "panelist_id" UUID NOT NULL,
    "responses" JSONB NOT NULL DEFAULT '{}',
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "generated_version_id" UUID,
    "integrity_hash" VARCHAR(64),
    "preview_data" BYTEA,
    "preview_source_hash" VARCHAR(64),
    "preview_layout_report" JSONB,
    "preview_generated_at" TIMESTAMP(3),
    "generation_metadata" JSONB,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "panelist_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "defense_packets_defense_session_id_key" ON "defense_packets"("defense_session_id");
CREATE INDEX "defense_packets_status_published_at_idx" ON "defense_packets"("status", "published_at");
CREATE UNIQUE INDEX "panelist_manuscript_reviews_defense_session_id_panelist_id_key" ON "panelist_manuscript_reviews"("defense_session_id", "panelist_id");
CREATE INDEX "panelist_manuscript_reviews_panelist_id_updated_at_idx" ON "panelist_manuscript_reviews"("panelist_id", "updated_at");
CREATE UNIQUE INDEX "panelist_recommendations_generated_version_id_key" ON "panelist_recommendations"("generated_version_id");
CREATE UNIQUE INDEX "panelist_recommendations_defense_session_id_panelist_id_key" ON "panelist_recommendations"("defense_session_id", "panelist_id");
CREATE INDEX "panelist_recommendations_panelist_id_status_idx" ON "panelist_recommendations"("panelist_id", "status");

ALTER TABLE "defense_packets" ADD CONSTRAINT "defense_packets_defense_session_id_fkey" FOREIGN KEY ("defense_session_id") REFERENCES "defense_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "defense_packets" ADD CONSTRAINT "defense_packets_manuscript_version_id_fkey" FOREIGN KEY ("manuscript_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defense_packets" ADD CONSTRAINT "defense_packets_similarity_report_version_id_fkey" FOREIGN KEY ("similarity_report_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "defense_packets" ADD CONSTRAINT "defense_packets_recommendation_template_version_id_fkey" FOREIGN KEY ("recommendation_template_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "defense_packets" ADD CONSTRAINT "defense_packets_evaluation_template_version_id_fkey" FOREIGN KEY ("evaluation_template_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "defense_packets" ADD CONSTRAINT "defense_packets_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "panelist_manuscript_reviews" ADD CONSTRAINT "panelist_manuscript_reviews_defense_session_id_fkey" FOREIGN KEY ("defense_session_id") REFERENCES "defense_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "panelist_manuscript_reviews" ADD CONSTRAINT "panelist_manuscript_reviews_panelist_id_fkey" FOREIGN KEY ("panelist_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "panelist_recommendations" ADD CONSTRAINT "panelist_recommendations_defense_session_id_fkey" FOREIGN KEY ("defense_session_id") REFERENCES "defense_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "panelist_recommendations" ADD CONSTRAINT "panelist_recommendations_panelist_id_fkey" FOREIGN KEY ("panelist_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "panelist_recommendations" ADD CONSTRAINT "panelist_recommendations_generated_version_id_fkey" FOREIGN KEY ("generated_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
