ALTER TABLE "mail_attachments"
ADD COLUMN "source_attachment_id" UUID,
ADD COLUMN "signed_by_id" UUID,
ADD COLUMN "signed_at" TIMESTAMP(3),
ADD COLUMN "verification_code" VARCHAR(40),
ADD COLUMN "original_file_hash" VARCHAR(64),
ADD COLUMN "signed_file_hash" VARCHAR(64),
ADD COLUMN "signature_placements" JSONB;

CREATE UNIQUE INDEX "mail_attachments_verification_code_key" ON "mail_attachments"("verification_code");
CREATE INDEX "mail_attachments_source_attachment_id_idx" ON "mail_attachments"("source_attachment_id");
CREATE INDEX "mail_attachments_signed_by_id_signed_at_idx" ON "mail_attachments"("signed_by_id", "signed_at");
CREATE UNIQUE INDEX "mail_attachments_source_attachment_id_signed_by_id_key" ON "mail_attachments"("source_attachment_id", "signed_by_id");

ALTER TABLE "mail_attachments" ADD CONSTRAINT "mail_attachments_source_attachment_id_fkey" FOREIGN KEY ("source_attachment_id") REFERENCES "mail_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mail_attachments" ADD CONSTRAINT "mail_attachments_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
