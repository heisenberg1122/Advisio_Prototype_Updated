ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SYSTEM_ANNOUNCEMENT';

CREATE TABLE "system_announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "category" VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    "severity" VARCHAR(20) NOT NULL DEFAULT 'INFO',
    "created_by" UUID NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    CONSTRAINT "system_announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "system_announcements_published_at_idx" ON "system_announcements"("published_at");
CREATE INDEX "system_announcements_category_idx" ON "system_announcements"("category");

ALTER TABLE "system_announcements"
ADD CONSTRAINT "system_announcements_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
