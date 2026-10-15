-- Phase 3: formal manuscript lifecycle and immutable submitted snapshots.
-- All existing versions remain mutable working/storage records; only newly
-- submitted versions opt into the immutable snapshot constraints.
CREATE TYPE "ManuscriptLifecycleStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'REVISION_REQUIRED',
  'APPROVED',
  'FINALIZED'
);

ALTER TABLE "documents"
  ADD COLUMN "lifecycle_status" "ManuscriptLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "pending_submission_key" VARCHAR(100),
  ADD COLUMN "pending_submission_at" TIMESTAMP(3);

ALTER TABLE "document_versions"
  ADD COLUMN "manuscript_status" "ManuscriptLifecycleStatus",
  ADD COLUMN "is_immutable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "content_checksum" VARCHAR(64),
  ADD COLUMN "submission_key" VARCHAR(100),
  ADD COLUMN "submitted_by" UUID,
  ADD COLUMN "submitted_at" TIMESTAMP(3),
  ADD COLUMN "snapshot_created_at" TIMESTAMP(3),
  ADD COLUMN "source_external_file_id" VARCHAR(255),
  ADD COLUMN "source_modified_at" TIMESTAMP(3),
  ADD COLUMN "milestone_id" UUID;

ALTER TABLE "task_submissions"
  ADD COLUMN "document_version_id" UUID;

CREATE TABLE "manuscript_status_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL,
  "version_id" UUID,
  "from_status" "ManuscriptLifecycleStatus",
  "to_status" "ManuscriptLifecycleStatus" NOT NULL,
  "actor_id" UUID NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "manuscript_status_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_versions_document_id_submission_key_key"
  ON "document_versions"("document_id", "submission_key");
CREATE INDEX "document_versions_submitted_by_submitted_at_idx"
  ON "document_versions"("submitted_by", "submitted_at");
CREATE INDEX "document_versions_milestone_id_idx"
  ON "document_versions"("milestone_id");
CREATE INDEX "task_submissions_document_version_id_idx"
  ON "task_submissions"("document_version_id");
CREATE INDEX "manuscript_status_events_document_id_created_at_idx"
  ON "manuscript_status_events"("document_id", "created_at");
CREATE INDEX "manuscript_status_events_version_id_created_at_idx"
  ON "manuscript_status_events"("version_id", "created_at");
CREATE INDEX "manuscript_status_events_actor_id_idx"
  ON "manuscript_status_events"("actor_id");

ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_submitted_by_fkey"
  FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "document_versions_milestone_id_fkey"
  FOREIGN KEY ("milestone_id") REFERENCES "workflow_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "task_submissions"
  ADD CONSTRAINT "task_submissions_document_version_id_fkey"
  FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "manuscript_status_events"
  ADD CONSTRAINT "manuscript_status_events_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "manuscript_status_events_version_id_fkey"
  FOREIGN KEY ("version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "manuscript_status_events_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_pending_submission_pair_check"
  CHECK (("pending_submission_key" IS NULL) = ("pending_submission_at" IS NULL));

ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_checksum_format_check"
  CHECK ("content_checksum" IS NULL OR length("content_checksum") = 64),
  ADD CONSTRAINT "document_versions_immutable_metadata_check"
  CHECK (
    NOT "is_immutable" OR (
      "content_checksum" IS NOT NULL AND
      "submission_key" IS NOT NULL AND
      "submitted_by" IS NOT NULL AND
      "submitted_at" IS NOT NULL AND
      "snapshot_created_at" IS NOT NULL AND
      "milestone_id" IS NOT NULL AND
      "manuscript_status" IS NOT NULL
    )
  );

-- Lifecycle labels may advance, but the submitted artifact and its provenance
-- cannot be rewritten after the immutable flag has been set.
CREATE FUNCTION "protect_immutable_manuscript_version"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."is_immutable" AND (
    NEW."document_id" IS DISTINCT FROM OLD."document_id" OR
    NEW."version_number" IS DISTINCT FROM OLD."version_number" OR
    NEW."file_name" IS DISTINCT FROM OLD."file_name" OR
    NEW."mime_type" IS DISTINCT FROM OLD."mime_type" OR
    NEW."file_size" IS DISTINCT FROM OLD."file_size" OR
    NEW."storage_path" IS DISTINCT FROM OLD."storage_path" OR
    NEW."google_drive_file_id" IS DISTINCT FROM OLD."google_drive_file_id" OR
    NEW."uploaded_by" IS DISTINCT FROM OLD."uploaded_by" OR
    NEW."uploaded_at" IS DISTINCT FROM OLD."uploaded_at" OR
    NEW."is_immutable" IS DISTINCT FROM OLD."is_immutable" OR
    NEW."content_checksum" IS DISTINCT FROM OLD."content_checksum" OR
    NEW."submission_key" IS DISTINCT FROM OLD."submission_key" OR
    NEW."submitted_by" IS DISTINCT FROM OLD."submitted_by" OR
    NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at" OR
    NEW."snapshot_created_at" IS DISTINCT FROM OLD."snapshot_created_at" OR
    NEW."source_external_file_id" IS DISTINCT FROM OLD."source_external_file_id" OR
    NEW."source_modified_at" IS DISTINCT FROM OLD."source_modified_at" OR
    NEW."milestone_id" IS DISTINCT FROM OLD."milestone_id"
  ) THEN
    RAISE EXCEPTION 'Immutable manuscript snapshot content and provenance cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "document_versions_protect_immutable_update"
BEFORE UPDATE ON "document_versions"
FOR EACH ROW EXECUTE FUNCTION "protect_immutable_manuscript_version"();
