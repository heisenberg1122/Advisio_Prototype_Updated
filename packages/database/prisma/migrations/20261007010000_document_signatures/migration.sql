ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SIGN';

CREATE TABLE "adviser_signatures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "adviser_id" UUID NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL,
    "image_data" BYTEA NOT NULL,
    "file_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "adviser_signatures_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_signatures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_version_id" UUID NOT NULL,
    "signed_version_id" UUID NOT NULL,
    "signed_by_id" UUID NOT NULL,
    "original_file_hash" VARCHAR(64) NOT NULL,
    "signed_file_hash" VARCHAR(64) NOT NULL,
    "placements" JSONB NOT NULL,
    "authentication_method" VARCHAR(30) NOT NULL DEFAULT 'PASSWORD',
    "verification_code" VARCHAR(32) NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" TEXT,
    CONSTRAINT "document_signatures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "adviser_signatures_adviser_id_key" ON "adviser_signatures"("adviser_id");
CREATE UNIQUE INDEX "document_signatures_source_version_id_key" ON "document_signatures"("source_version_id");
CREATE UNIQUE INDEX "document_signatures_signed_version_id_key" ON "document_signatures"("signed_version_id");
CREATE UNIQUE INDEX "document_signatures_verification_code_key" ON "document_signatures"("verification_code");
CREATE INDEX "document_signatures_signed_by_id_signed_at_idx" ON "document_signatures"("signed_by_id", "signed_at");

ALTER TABLE "adviser_signatures" ADD CONSTRAINT "adviser_signatures_adviser_id_fkey" FOREIGN KEY ("adviser_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_source_version_id_fkey" FOREIGN KEY ("source_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_signed_version_id_fkey" FOREIGN KEY ("signed_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
