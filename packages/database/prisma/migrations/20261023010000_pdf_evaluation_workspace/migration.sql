ALTER TABLE "defense_packets"
  ADD COLUMN "evaluation_mode" VARCHAR(20) NOT NULL DEFAULT 'RUBRIC',
  ADD COLUMN "evaluation_signature_required" BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT "defense_packet_evaluation_mode_check" CHECK ("evaluation_mode" IN ('RUBRIC', 'PDF'));

CREATE TABLE "pdf_evaluations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "defense_session_id" UUID NOT NULL,
  "panelist_id" UUID NOT NULL,
  "source_version_id" UUID NOT NULL,
  "source_data" BYTEA NOT NULL,
  "source_checksum" VARCHAR(64) NOT NULL,
  "annotations" JSONB NOT NULL DEFAULT '[]',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
  "signature_data" BYTEA,
  "signature_placement" JSONB,
  "signed_at" TIMESTAMP(3),
  "preview_hash" VARCHAR(64),
  "final_data" BYTEA,
  "integrity_hash" VARCHAR(64),
  "locked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pdf_evaluations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pdf_evaluations_session_fk" FOREIGN KEY ("defense_session_id") REFERENCES "defense_sessions"("id") ON DELETE CASCADE,
  CONSTRAINT "pdf_evaluations_panelist_fk" FOREIGN KEY ("panelist_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "pdf_evaluations_source_fk" FOREIGN KEY ("source_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT,
  CONSTRAINT "pdf_evaluations_final_check" CHECK ("status" <> 'LOCKED' OR ("final_data" IS NOT NULL AND "integrity_hash" IS NOT NULL AND "locked_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "pdf_evaluations_defense_session_id_panelist_id_key" ON "pdf_evaluations"("defense_session_id", "panelist_id");

CREATE FUNCTION "protect_locked_pdf_evaluation"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'LOCKED' THEN
    RAISE EXCEPTION 'Final PDF evaluations are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "locked_pdf_evaluation_guard" BEFORE UPDATE ON "pdf_evaluations"
FOR EACH ROW EXECUTE FUNCTION "protect_locked_pdf_evaluation"();
