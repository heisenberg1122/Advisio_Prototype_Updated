ALTER TABLE "dean_inbox_messages" ADD COLUMN "recipient_id" UUID;

CREATE INDEX "dean_inbox_messages_recipient_id_created_at_idx" ON "dean_inbox_messages"("recipient_id", "created_at");

ALTER TABLE "dean_inbox_messages" ADD CONSTRAINT "dean_inbox_messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
