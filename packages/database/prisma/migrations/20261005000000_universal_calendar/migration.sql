CREATE TYPE "CalendarEventType" AS ENUM ('ACADEMIC', 'CONSULTATION', 'DEFENSE', 'DEADLINE', 'MILESTONE', 'ANNOUNCEMENT', 'OTHER');
CREATE TYPE "CalendarVisibility" AS ENUM ('PARTICIPANTS', 'PROGRAM', 'COLLEGE', 'INSTITUTION');

CREATE TABLE "calendar_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "type" "CalendarEventType" NOT NULL,
  "visibility" "CalendarVisibility" NOT NULL DEFAULT 'PARTICIPANTS',
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "all_day" BOOLEAN NOT NULL DEFAULT false,
  "location" VARCHAR(200),
  "meeting_url" VARCHAR(500),
  "college_id" UUID,
  "program_id" UUID,
  "created_by" UUID NOT NULL,
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calendar_event_participants" (
  "event_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  CONSTRAINT "calendar_event_participants_pkey" PRIMARY KEY ("event_id", "user_id")
);

CREATE TABLE "calendar_event_research" (
  "event_id" UUID NOT NULL,
  "research_id" UUID NOT NULL,
  CONSTRAINT "calendar_event_research_pkey" PRIMARY KEY ("event_id", "research_id")
);

CREATE INDEX "calendar_events_starts_at_ends_at_idx" ON "calendar_events"("starts_at", "ends_at");
CREATE INDEX "calendar_events_college_id_program_id_idx" ON "calendar_events"("college_id", "program_id");
CREATE INDEX "calendar_event_participants_user_id_idx" ON "calendar_event_participants"("user_id");
CREATE INDEX "calendar_event_research_research_id_idx" ON "calendar_event_research"("research_id");

ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "colleges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendar_event_participants" ADD CONSTRAINT "calendar_event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_participants" ADD CONSTRAINT "calendar_event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_research" ADD CONSTRAINT "calendar_event_research_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_event_research" ADD CONSTRAINT "calendar_event_research_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "research_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
