CREATE TYPE "AdviserRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ADVISER_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ADVISER_REQUEST_DECIDED';

CREATE TABLE "adviser_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "research_id" UUID NOT NULL,
  "adviser_id" UUID NOT NULL,
  "requested_by_id" UUID NOT NULL,
  "status" "AdviserRequestStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "response_note" TEXT,
  "responded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "adviser_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "adviser_requests_research_id_adviser_id_key" ON "adviser_requests"("research_id", "adviser_id");
CREATE INDEX "adviser_requests_adviser_id_status_idx" ON "adviser_requests"("adviser_id", "status");
CREATE INDEX "adviser_requests_research_id_status_idx" ON "adviser_requests"("research_id", "status");

ALTER TABLE "adviser_requests" ADD CONSTRAINT "adviser_requests_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "research_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "adviser_requests" ADD CONSTRAINT "adviser_requests_adviser_id_fkey" FOREIGN KEY ("adviser_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "adviser_requests" ADD CONSTRAINT "adviser_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
