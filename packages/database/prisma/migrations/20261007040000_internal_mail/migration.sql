CREATE TABLE "mail_threads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subject" VARCHAR(255) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mail_threads_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "mail_participants" (
    "thread_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_participants_pkey" PRIMARY KEY ("thread_id", "user_id")
);
CREATE TABLE "mail_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "thread_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    CONSTRAINT "mail_messages_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "mail_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mail_threads_updated_at_idx" ON "mail_threads"("updated_at");
CREATE INDEX "mail_participants_user_id_read_at_idx" ON "mail_participants"("user_id", "read_at");
CREATE INDEX "mail_messages_thread_id_created_at_idx" ON "mail_messages"("thread_id", "created_at");
CREATE INDEX "mail_messages_sender_id_is_draft_idx" ON "mail_messages"("sender_id", "is_draft");
CREATE INDEX "mail_attachments_message_id_idx" ON "mail_attachments"("message_id");
ALTER TABLE "mail_threads" ADD CONSTRAINT "mail_threads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mail_participants" ADD CONSTRAINT "mail_participants_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "mail_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mail_participants" ADD CONSTRAINT "mail_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "mail_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mail_attachments" ADD CONSTRAINT "mail_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "mail_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
