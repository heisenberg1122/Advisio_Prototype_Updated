-- Phase 9 P0 adds only nullable columns and uniqueness constraints. Existing
-- consultation, document, and group-file records remain untouched.
ALTER TYPE "ConsultationStatus" ADD VALUE IF NOT EXISTS 'REQUESTED' BEFORE 'SCHEDULED';

ALTER TABLE "documents"
ADD COLUMN "creation_key" VARCHAR(100);

CREATE UNIQUE INDEX "documents_creation_key_key"
ON "documents"("creation_key");

ALTER TABLE "group_files"
ADD CONSTRAINT "group_files_promoted_document_id_fkey"
FOREIGN KEY ("promoted_document_id") REFERENCES "documents"("id")
ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

CREATE UNIQUE INDEX "group_files_promoted_document_id_key"
ON "group_files"("promoted_document_id");

ALTER TABLE "consultations"
ADD COLUMN "legacy_import_key" VARCHAR(100),
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "consultations_legacy_import_key_key"
ON "consultations"("legacy_import_key");

ALTER TABLE "consultation_notes"
ADD COLUMN "action_items" JSONB,
ADD COLUMN "transcript" JSONB,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
