-- The original group-chat feature added these models to schema.prisma without
-- recording the corresponding database migration. Keep this migration
-- idempotent so databases that previously received the tables through
-- `prisma db push` retain their existing data.

CREATE TABLE IF NOT EXISTS "chat_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "created_by_adviser_id" VARCHAR(255) NOT NULL,
  "adviser_name" VARCHAR(150) NOT NULL,
  "related_research_group_id" VARCHAR(100),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chat_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "chat_group_id" UUID NOT NULL,
  "student_id" VARCHAR(255) NOT NULL,
  "student_name" VARCHAR(150) NOT NULL,
  "invited_by_adviser_id" VARCHAR(255) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responded_at" TIMESTAMP(3),
  CONSTRAINT "chat_invitations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "chat_group_id" UUID NOT NULL,
  "sender_id" VARCHAR(255) NOT NULL,
  "sender_name" VARCHAR(150) NOT NULL,
  "sender_role" VARCHAR(50) NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_invitations_chat_group_id_idx"
  ON "chat_invitations"("chat_group_id");
CREATE INDEX IF NOT EXISTS "chat_invitations_student_id_idx"
  ON "chat_invitations"("student_id");
CREATE INDEX IF NOT EXISTS "chat_messages_chat_group_id_idx"
  ON "chat_messages"("chat_group_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chat_invitations_chat_group_id_fkey'
      AND conrelid = '"chat_invitations"'::regclass
  ) THEN
    ALTER TABLE "chat_invitations"
      ADD CONSTRAINT "chat_invitations_chat_group_id_fkey"
      FOREIGN KEY ("chat_group_id") REFERENCES "chat_groups"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chat_messages_chat_group_id_fkey'
      AND conrelid = '"chat_messages"'::regclass
  ) THEN
    ALTER TABLE "chat_messages"
      ADD CONSTRAINT "chat_messages_chat_group_id_fkey"
      FOREIGN KEY ("chat_group_id") REFERENCES "chat_groups"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
