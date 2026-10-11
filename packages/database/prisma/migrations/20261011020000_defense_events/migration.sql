-- CreateEnum
CREATE TYPE "DefenseEventStatus" AS ENUM ('DRAFT', 'READY', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DefenseQueueStatus" AS ENUM ('WAITING', 'PREPARE_NEXT', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'SKIPPED');

-- CreateTable
CREATE TABLE "defense_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(30) NOT NULL,
    "college_id" UUID NOT NULL,
    "defense_type" VARCHAR(80) NOT NULL DEFAULT 'RESEARCH_DEFENSE',
    "status" "DefenseEventStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "scheduled_end" TIMESTAMP(3) NOT NULL,
    "venue" VARCHAR(200),
    "meeting_url" VARCHAR(500),
    "notes" TEXT,
    "created_by" UUID,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defense_events_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "defense_sessions"
ADD COLUMN "defense_event_id" UUID,
ADD COLUMN "queue_position" INTEGER,
ADD COLUMN "queue_status" "DefenseQueueStatus" NOT NULL DEFAULT 'WAITING',
ADD COLUMN "prepared_at" TIMESTAMP(3),
ADD COLUMN "called_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "defense_events_code_key" ON "defense_events"("code");
CREATE INDEX "defense_events_college_id_scheduled_start_idx" ON "defense_events"("college_id", "scheduled_start");
CREATE INDEX "defense_events_status_scheduled_start_idx" ON "defense_events"("status", "scheduled_start");
CREATE INDEX "defense_sessions_defense_event_id_queue_position_idx" ON "defense_sessions"("defense_event_id", "queue_position");

-- AddForeignKey
ALTER TABLE "defense_events" ADD CONSTRAINT "defense_events_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "defense_events" ADD CONSTRAINT "defense_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "defense_sessions" ADD CONSTRAINT "defense_sessions_defense_event_id_fkey" FOREIGN KEY ("defense_event_id") REFERENCES "defense_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
