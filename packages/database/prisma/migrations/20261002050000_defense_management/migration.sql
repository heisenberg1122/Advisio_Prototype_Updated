ALTER TYPE "DefenseSessionStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "DefenseSessionStatus" ADD VALUE IF NOT EXISTS 'PENDING_ACKNOWLEDGEMENT';
ALTER TYPE "DefenseSessionStatus" ADD VALUE IF NOT EXISTS 'NEEDS_RESCHEDULING';
ALTER TYPE "DefenseSessionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TYPE "DefenseInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'RECONFIRMATION_REQUIRED', 'REMOVED');
CREATE TYPE "DefenseParticipantRole" AS ENUM ('PANEL_CHAIR', 'PANELIST', 'ADVISER', 'OBSERVER');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEFENSE_INVITATION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEFENSE_RESPONSE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEFENSE_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEFENSE_RESCHEDULED';

ALTER TABLE "defense_sessions"
  ADD COLUMN "meeting_url" VARCHAR(500),
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "scheduled_end" TIMESTAMP(3),
  ADD COLUMN "created_by" UUID;

ALTER TABLE "defense_sessions"
  ADD CONSTRAINT "defense_sessions_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "defense_invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "defense_session_id" UUID NOT NULL,
  "invitee_id" UUID NOT NULL,
  "role" "DefenseParticipantRole" NOT NULL DEFAULT 'PANELIST',
  "status" "DefenseInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "is_required" BOOLEAN NOT NULL DEFAULT true,
  "response_note" TEXT,
  "suggested_availability" JSONB,
  "responded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "defense_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "defense_invitations_defense_session_id_invitee_id_key" ON "defense_invitations"("defense_session_id", "invitee_id");
CREATE INDEX "defense_invitations_invitee_id_status_idx" ON "defense_invitations"("invitee_id", "status");
CREATE INDEX "defense_sessions_created_by_idx" ON "defense_sessions"("created_by");

ALTER TABLE "defense_invitations"
  ADD CONSTRAINT "defense_invitations_defense_session_id_fkey"
  FOREIGN KEY ("defense_session_id") REFERENCES "defense_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "defense_invitations"
  ADD CONSTRAINT "defense_invitations_invitee_id_fkey"
  FOREIGN KEY ("invitee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
