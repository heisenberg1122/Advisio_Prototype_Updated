-- CreateEnum
CREATE TYPE "ResearchParticipationMode" AS ENUM ('SOLO', 'GROUP');

-- CreateEnum
CREATE TYPE "ResearchAccessMode" AS ENUM ('INVITE_ONLY', 'PUBLIC_APPROVAL', 'PUBLIC_OPEN');

-- CreateEnum
CREATE TYPE "ResearchJoinRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResearchTitleRevisionStatus" AS ENUM ('APPLIED', 'PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "research_projects"
ADD COLUMN "participation_mode" "ResearchParticipationMode" NOT NULL DEFAULT 'SOLO',
ADD COLUMN "access_mode" "ResearchAccessMode" NOT NULL DEFAULT 'INVITE_ONLY',
ADD COLUMN "invite_code_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "invite_code_expires_at" TIMESTAMP(3);

-- Existing projects with multiple active researchers are groups. Existing
-- invitation codes remain active and private so existing links keep working.
UPDATE "research_projects" AS project
SET "participation_mode" = 'GROUP'
WHERE (
  SELECT COUNT(*)
  FROM "research_members" AS member
  WHERE member."research_id" = project."id"
    AND member."left_at" IS NULL
    AND member."projectRole" IN ('LEADER', 'MEMBER')
) > 1;

UPDATE "research_projects"
SET "invite_code_enabled" = true,
    "participation_mode" = 'GROUP'
WHERE "invite_code" IS NOT NULL;

-- CreateTable
CREATE TABLE "research_join_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "research_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "status" "ResearchJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "response_note" TEXT,
    "responded_by" UUID,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_title_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "research_id" UUID NOT NULL,
    "previous_title" TEXT NOT NULL,
    "proposed_title" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ResearchTitleRevisionStatus" NOT NULL DEFAULT 'APPLIED',
    "requested_by" UUID NOT NULL,
    "reviewed_by" UUID,
    "review_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_title_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "research_join_requests_research_id_requester_id_key" ON "research_join_requests"("research_id", "requester_id");
CREATE INDEX "research_join_requests_research_id_status_idx" ON "research_join_requests"("research_id", "status");
CREATE INDEX "research_join_requests_requester_id_status_idx" ON "research_join_requests"("requester_id", "status");
CREATE INDEX "research_title_revisions_research_id_created_at_idx" ON "research_title_revisions"("research_id", "created_at");
CREATE INDEX "research_title_revisions_status_idx" ON "research_title_revisions"("status");

-- AddForeignKey
ALTER TABLE "research_join_requests" ADD CONSTRAINT "research_join_requests_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "research_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_title_revisions" ADD CONSTRAINT "research_title_revisions_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "research_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
