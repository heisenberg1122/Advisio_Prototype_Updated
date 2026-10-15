-- The local database was baselined from a structurally equivalent schema.
-- Prisma schema diffing does not inspect PostgreSQL triggers, so restore the
-- immutable workflow protections idempotently.

CREATE OR REPLACE FUNCTION "protect_submitted_review_decision"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'SUBMITTED' AND (
    NEW."assignment_id" IS DISTINCT FROM OLD."assignment_id" OR
    NEW."document_version_id" IS DISTINCT FROM OLD."document_version_id" OR
    NEW."document_id" IS DISTINCT FROM OLD."document_id" OR
    NEW."reviewer_id" IS DISTINCT FROM OLD."reviewer_id" OR
    NEW."reviewType" IS DISTINCT FROM OLD."reviewType" OR
    NEW."overall_comment" IS DISTINCT FROM OLD."overall_comment" OR
    NEW."recommendation" IS DISTINCT FROM OLD."recommendation" OR
    NEW."status" IS DISTINCT FROM OLD."status" OR
    NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
  ) THEN
    RAISE EXCEPTION 'Submitted manuscript review decisions cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "reviews_protect_submitted_decision_update" ON "reviews";
CREATE TRIGGER "reviews_protect_submitted_decision_update"
BEFORE UPDATE ON "reviews"
FOR EACH ROW EXECUTE FUNCTION "protect_submitted_review_decision"();

CREATE OR REPLACE FUNCTION "protect_immutable_manuscript_version"()
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

DROP TRIGGER IF EXISTS "document_versions_protect_immutable_update" ON "document_versions";
CREATE TRIGGER "document_versions_protect_immutable_update"
BEFORE UPDATE ON "document_versions"
FOR EACH ROW EXECUTE FUNCTION "protect_immutable_manuscript_version"();

CREATE OR REPLACE FUNCTION "protect_task_submission_attempt_provenance"()
RETURNS TRIGGER AS $$
BEGIN
  IF
    NEW."task_submission_id" IS DISTINCT FROM OLD."task_submission_id" OR
    NEW."research_id" IS DISTINCT FROM OLD."research_id" OR
    NEW."task_id" IS DISTINCT FROM OLD."task_id" OR
    NEW."milestone_id" IS DISTINCT FROM OLD."milestone_id" OR
    NEW."document_id" IS DISTINCT FROM OLD."document_id" OR
    NEW."document_version_id" IS DISTINCT FROM OLD."document_version_id" OR
    NEW."attempt_number" IS DISTINCT FROM OLD."attempt_number" OR
    NEW."submitted_by" IS DISTINCT FROM OLD."submitted_by" OR
    NEW."note" IS DISTINCT FROM OLD."note" OR
    NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
  THEN
    RAISE EXCEPTION 'Task submission attempt provenance cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "task_submission_attempts_protect_provenance_update" ON "task_submission_attempts";
CREATE TRIGGER "task_submission_attempts_protect_provenance_update"
BEFORE UPDATE ON "task_submission_attempts"
FOR EACH ROW EXECUTE FUNCTION "protect_task_submission_attempt_provenance"();
