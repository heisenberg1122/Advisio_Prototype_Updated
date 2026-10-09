ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'AVAILABILITY';

CREATE TYPE "CalendarAvailabilityStatus" AS ENUM (
  'UNAVAILABLE',
  'ON_LEAVE',
  'OUT_OF_OFFICE',
  'LIMITED_AVAILABILITY'
);

ALTER TABLE "calendar_events"
  ADD COLUMN "availability_status" "CalendarAvailabilityStatus",
  ADD COLUMN "blocks_scheduling" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "private_notes" TEXT;

CREATE INDEX "calendar_events_availability_conflict_idx"
  ON "calendar_events"("type", "blocks_scheduling", "starts_at", "ends_at");

INSERT INTO "permissions" ("id", "key", "module", "description") VALUES
  (gen_random_uuid(), 'calendar.view', 'Calendar', 'View calendar events in scope'),
  (gen_random_uuid(), 'calendar.create', 'Calendar', 'Create calendar events'),
  (gen_random_uuid(), 'calendar.edit_own', 'Calendar', 'Edit personally created calendar events'),
  (gen_random_uuid(), 'calendar.manage', 'Calendar', 'Manage calendar events in scope'),
  (gen_random_uuid(), 'calendar.availability.manage', 'Calendar', 'Manage personal availability blocks')
ON CONFLICT ("key") DO UPDATE SET
  "module" = EXCLUDED."module",
  "description" = EXCLUDED."description";
