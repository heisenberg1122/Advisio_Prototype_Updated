CREATE TABLE "dean_inbox_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "attachment_version_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dean_inbox_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dean_inbox_messages_document_id_created_at_idx" ON "dean_inbox_messages"("document_id", "created_at");
CREATE INDEX "dean_inbox_messages_author_id_idx" ON "dean_inbox_messages"("author_id");

ALTER TABLE "dean_inbox_messages" ADD CONSTRAINT "dean_inbox_messages_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dean_inbox_messages" ADD CONSTRAINT "dean_inbox_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dean_inbox_messages" ADD CONSTRAINT "dean_inbox_messages_attachment_version_id_fkey" FOREIGN KEY ("attachment_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
