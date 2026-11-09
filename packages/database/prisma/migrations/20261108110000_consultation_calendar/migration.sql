BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

ALTER TYPE "ConsultationStatus" ADD VALUE 'PROVISIONING' AFTER 'REQUESTED';
ALTER TYPE "ConsultationStatus" ADD VALUE 'DECLINED';

CREATE TYPE "ConsultationMeetingKind" AS ENUM ('SCHEDULED', 'INSTANT');
CREATE TYPE "ConsultationConferenceState" AS ENUM ('LEGACY', 'AWAITING_APPROVAL', 'PENDING', 'FAILED', 'GOOGLE_VERIFIED', 'MANUAL');

ALTER TABLE "consultations"
  ADD COLUMN "meeting_kind" "ConsultationMeetingKind" NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN "conference_state" "ConsultationConferenceState" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "google_event_id" VARCHAR(255),
  ADD COLUMN "approver_id" UUID,
  ADD COLUMN "request_key" VARCHAR(64),
  ADD COLUMN "request_hash" VARCHAR(64),
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pending_calendar_update" JSONB,
  ADD COLUMN "calendar_cancellation_pending" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX "consultations_google_event_id_key" ON "consultations"("google_event_id");
CREATE UNIQUE INDEX "consultations_request_key_key" ON "consultations"("request_key");
CREATE INDEX "consultations_calendar_cancellation_pending_idx" ON "consultations"("calendar_cancellation_pending");
CREATE INDEX "consultation_participants_user_id_idx" ON "consultation_participants"("user_id");

COMMIT;
