ALTER TABLE "notifications" ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "notifications_recipient_id_archived_at_idx"
ON "notifications"("recipient_id", "archived_at");
