-- Phase 4: exact-version reviewer assignments and immutable faculty decisions.
ALTER TYPE "ReviewType" ADD VALUE IF NOT EXISTS 'DEAN';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REVIEW_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REVIEWER_REASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MANUSCRIPT_APPROVED';

CREATE TYPE "ReviewerAssignmentStatus" AS ENUM (
  'ACTIVE',
  'COMPLETED',
  'REVOKED',
  'REASSIGNED',
  'SUPERSEDED'
);

CREATE TYPE "ReviewerAssignmentAction" AS ENUM (
  'ASSIGNED',
  'COMPLETED',
  'REVOKED',
  'REASSIGNED',
  'SUPERSEDED'
);

CREATE TABLE "reviewer_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "research_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "document_version_id" UUID NOT NULL,
  "reviewer_id" UUID NOT NULL,
  "review_type" "ReviewType" NOT NULL,
  "is_required" BOOLEAN NOT NULL DEFAULT true,
  "assigned_by_id" UUID NOT NULL,
  "status" "ReviewerAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "status_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reviewer_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reviewer_assignments_status_timestamps_check" CHECK (
    ("status" = 'ACTIVE' AND "completed_at" IS NULL AND "revoked_at" IS NULL) OR
    ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL AND "revoked_at" IS NULL) OR
    ("status" IN ('REVOKED', 'REASSIGNED', 'SUPERSEDED') AND "completed_at" IS NULL AND "revoked_at" IS NOT NULL)
  ),
  CONSTRAINT "reviewer_assignments_status_reason_check" CHECK (
    "status" IN ('ACTIVE', 'COMPLETED') OR length(trim("status_reason")) >= 3
  )
);

CREATE TABLE "reviewer_assignment_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assignment_id" UUID NOT NULL,
  "action" "ReviewerAssignmentAction" NOT NULL,
  "actor_id" UUID NOT NULL,
  "details" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reviewer_assignment_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "reviews" ADD COLUMN "assignment_id" UUID;

CREATE UNIQUE INDEX "reviews_assignment_id_key" ON "reviews"("assignment_id");
CREATE UNIQUE INDEX "reviewer_assignments_active_reviewer_key"
  ON "reviewer_assignments"("document_version_id", "reviewer_id", "review_type")
  WHERE "status" = 'ACTIVE';
CREATE INDEX "reviewer_assignments_research_id_status_idx"
  ON "reviewer_assignments"("research_id", "status");
CREATE INDEX "reviewer_assignments_document_id_status_idx"
  ON "reviewer_assignments"("document_id", "status");
CREATE INDEX "reviewer_assignments_document_version_id_status_idx"
  ON "reviewer_assignments"("document_version_id", "status");
CREATE INDEX "reviewer_assignments_reviewer_id_status_idx"
  ON "reviewer_assignments"("reviewer_id", "status");
CREATE INDEX "reviewer_assignment_events_assignment_id_created_at_idx"
  ON "reviewer_assignment_events"("assignment_id", "created_at");
CREATE INDEX "reviewer_assignment_events_actor_id_idx"
  ON "reviewer_assignment_events"("actor_id");

ALTER TABLE "reviewer_assignments"
  ADD CONSTRAINT "reviewer_assignments_research_id_fkey"
  FOREIGN KEY ("research_id") REFERENCES "research_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "reviewer_assignments_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "reviewer_assignments_document_version_id_fkey"
  FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "reviewer_assignments_reviewer_id_fkey"
  FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "reviewer_assignments_assigned_by_id_fkey"
  FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviewer_assignment_events"
  ADD CONSTRAINT "reviewer_assignment_events_assignment_id_fkey"
  FOREIGN KEY ("assignment_id") REFERENCES "reviewer_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "reviewer_assignment_events_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_assignment_id_fkey"
  FOREIGN KEY ("assignment_id") REFERENCES "reviewer_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Submitted decisions may be annotated through ReviewComment, but their
-- reviewer, version, recommendation, feedback, and submission identity cannot
-- be silently rewritten afterward.
CREATE FUNCTION "protect_submitted_review_decision"()
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

CREATE TRIGGER "reviews_protect_submitted_decision_update"
BEFORE UPDATE ON "reviews"
FOR EACH ROW EXECUTE FUNCTION "protect_submitted_review_decision"();
