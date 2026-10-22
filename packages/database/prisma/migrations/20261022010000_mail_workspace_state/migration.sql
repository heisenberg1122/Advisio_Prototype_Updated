CREATE TYPE "MailRecipientType" AS ENUM ('SENDER', 'TO', 'CC', 'BCC');

ALTER TABLE "mail_participants"
ADD COLUMN "recipient_type" "MailRecipientType" NOT NULL DEFAULT 'TO',
ADD COLUMN "archived_at" TIMESTAMP(3),
ADD COLUMN "trashed_at" TIMESTAMP(3);

UPDATE "mail_participants" AS participant
SET "recipient_type" = 'SENDER'
FROM "mail_threads" AS thread
WHERE participant."thread_id" = thread."id"
  AND participant."user_id" = thread."created_by_id";

CREATE INDEX "mail_participants_user_id_trashed_at_archived_at_idx"
ON "mail_participants"("user_id", "trashed_at", "archived_at");
