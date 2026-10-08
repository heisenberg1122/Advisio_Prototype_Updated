CREATE TYPE "ChatParticipantStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REMOVED');

ALTER TABLE "chat_groups"
  ADD COLUMN "created_by_user_id" UUID,
  ADD COLUMN "is_faculty_only" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "chat_messages"
  ADD COLUMN "sender_user_id" UUID;

CREATE TABLE "chat_participants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "chat_group_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role_snapshot" VARCHAR(50) NOT NULL,
  "status" "ChatParticipantStatus" NOT NULL DEFAULT 'PENDING',
  "is_admin" BOOLEAN NOT NULL DEFAULT false,
  "invited_by_user_id" UUID,
  "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responded_at" TIMESTAMP(3),
  "last_read_at" TIMESTAMP(3),
  CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_participants_chat_group_id_user_id_key"
  ON "chat_participants"("chat_group_id", "user_id");
CREATE INDEX "chat_participants_user_id_status_idx"
  ON "chat_participants"("user_id", "status");
CREATE INDEX "chat_participants_invited_by_user_id_idx"
  ON "chat_participants"("invited_by_user_id");
CREATE INDEX "chat_groups_created_by_user_id_idx"
  ON "chat_groups"("created_by_user_id");
CREATE INDEX "chat_messages_sender_user_id_idx"
  ON "chat_messages"("sender_user_id");

ALTER TABLE "chat_groups"
  ADD CONSTRAINT "chat_groups_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_sender_user_id_fkey"
  FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_participants"
  ADD CONSTRAINT "chat_participants_chat_group_id_fkey"
  FOREIGN KEY ("chat_group_id") REFERENCES "chat_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_participants"
  ADD CONSTRAINT "chat_participants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_participants"
  ADD CONSTRAINT "chat_participants_invited_by_user_id_fkey"
  FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "chat_groups" AS groups
SET "created_by_user_id" = users."id"
FROM "users" AS users
WHERE lower(users."email"::text) = lower(groups."created_by_adviser_id");

UPDATE "chat_messages" AS messages
SET "sender_user_id" = users."id"
FROM "users" AS users
WHERE lower(users."email"::text) = lower(messages."sender_id");

INSERT INTO "chat_participants" (
  "chat_group_id", "user_id", "role_snapshot", "status", "is_admin", "invited_at", "responded_at", "last_read_at"
)
SELECT groups."id", groups."created_by_user_id", 'ADVISER', 'ACCEPTED', true,
       groups."created_at", groups."created_at", groups."created_at"
FROM "chat_groups" AS groups
WHERE groups."created_by_user_id" IS NOT NULL
ON CONFLICT ("chat_group_id", "user_id") DO NOTHING;

INSERT INTO "chat_participants" (
  "chat_group_id", "user_id", "role_snapshot", "status", "is_admin", "invited_by_user_id", "invited_at", "responded_at"
)
SELECT invitations."chat_group_id", users."id", 'RESEARCHER',
       CASE
         WHEN lower(invitations."status") = 'accepted' THEN 'ACCEPTED'::"ChatParticipantStatus"
         WHEN lower(invitations."status") = 'declined' THEN 'DECLINED'::"ChatParticipantStatus"
         ELSE 'PENDING'::"ChatParticipantStatus"
       END,
       false, groups."created_by_user_id", invitations."invited_at", invitations."responded_at"
FROM "chat_invitations" AS invitations
JOIN "users" AS users ON lower(users."email"::text) = lower(invitations."student_id")
JOIN "chat_groups" AS groups ON groups."id" = invitations."chat_group_id"
ON CONFLICT ("chat_group_id", "user_id") DO NOTHING;
