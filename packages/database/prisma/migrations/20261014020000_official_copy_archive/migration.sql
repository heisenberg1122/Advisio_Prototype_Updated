-- Phase 7: immutable official-copy archive and account-authenticated visual signatures.
-- This migration is additive. Existing manuscript versions and signatures are untouched.

CREATE TYPE "OfficialCopyStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'REVOKED');
CREATE TYPE "OfficialSignatureStatus" AS ENUM ('ACTIVE', 'REVOKED');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OFFICIAL_COPY_AVAILABLE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OFFICIAL_COPY_SIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OFFICIAL_COPY_REVOKED';

CREATE TABLE "official_copies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "research_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "source_version_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    "file_size" BIGINT NOT NULL,
    "storage_provider" VARCHAR(40) NOT NULL DEFAULT 'GOOGLE_DRIVE',
    "storage_path" VARCHAR(500) NOT NULL,
    "google_drive_file_id" VARCHAR(255),
    "checksum" VARCHAR(64) NOT NULL,
    "verification_code" VARCHAR(40) NOT NULL,
    "status" "OfficialCopyStatus" NOT NULL DEFAULT 'ACTIVE',
    "access_policy" JSONB NOT NULL DEFAULT '{"scope":"PROJECT"}',
    "active_slot" UUID,
    "finalized_by_id" UUID NOT NULL,
    "finalized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedes_id" UUID,
    "superseded_at" TIMESTAMP(3),
    "revoked_by_id" UUID,
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_copies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "official_copy_signatures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "official_copy_id" UUID NOT NULL,
    "signed_by_id" UUID NOT NULL,
    "signer_role" VARCHAR(40) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    "file_size" BIGINT NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "google_drive_file_id" VARCHAR(255),
    "source_file_hash" VARCHAR(64) NOT NULL,
    "signed_file_hash" VARCHAR(64) NOT NULL,
    "signature_profile_hash" VARCHAR(64) NOT NULL,
    "placements" JSONB NOT NULL,
    "authentication_method" VARCHAR(40) NOT NULL DEFAULT 'PASSWORD_VISUAL_SIGNATURE',
    "verification_code" VARCHAR(40) NOT NULL,
    "status" "OfficialSignatureStatus" NOT NULL DEFAULT 'ACTIVE',
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_by_id" UUID,
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "official_copy_signatures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "official_copies_source_version_id_key" ON "official_copies"("source_version_id");
CREATE UNIQUE INDEX "official_copies_verification_code_key" ON "official_copies"("verification_code");
CREATE UNIQUE INDEX "official_copies_active_slot_key" ON "official_copies"("active_slot");
CREATE UNIQUE INDEX "official_copies_supersedes_id_key" ON "official_copies"("supersedes_id");
CREATE INDEX "official_copies_research_id_status_idx" ON "official_copies"("research_id", "status");
CREATE INDEX "official_copies_document_id_finalized_at_idx" ON "official_copies"("document_id", "finalized_at");
CREATE INDEX "official_copies_finalized_by_id_finalized_at_idx" ON "official_copies"("finalized_by_id", "finalized_at");

CREATE UNIQUE INDEX "official_copy_signatures_verification_code_key" ON "official_copy_signatures"("verification_code");
CREATE UNIQUE INDEX "official_copy_signatures_official_copy_id_signed_by_id_key" ON "official_copy_signatures"("official_copy_id", "signed_by_id");
CREATE INDEX "official_copy_signatures_official_copy_id_status_signed_at_idx" ON "official_copy_signatures"("official_copy_id", "status", "signed_at");
CREATE INDEX "official_copy_signatures_signed_by_id_signed_at_idx" ON "official_copy_signatures"("signed_by_id", "signed_at");

ALTER TABLE "official_copies" ADD CONSTRAINT "official_copies_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "research_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "official_copies" ADD CONSTRAINT "official_copies_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "official_copies" ADD CONSTRAINT "official_copies_source_version_id_fkey" FOREIGN KEY ("source_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "official_copies" ADD CONSTRAINT "official_copies_finalized_by_id_fkey" FOREIGN KEY ("finalized_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "official_copies" ADD CONSTRAINT "official_copies_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "official_copies" ADD CONSTRAINT "official_copies_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "official_copies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "official_copy_signatures" ADD CONSTRAINT "official_copy_signatures_official_copy_id_fkey" FOREIGN KEY ("official_copy_id") REFERENCES "official_copies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "official_copy_signatures" ADD CONSTRAINT "official_copy_signatures_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "official_copy_signatures" ADD CONSTRAINT "official_copy_signatures_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
