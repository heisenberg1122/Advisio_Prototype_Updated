ALTER TABLE "system_announcements" ADD COLUMN "audience_college_id" UUID;

CREATE INDEX "system_announcements_audience_college_id_published_at_idx"
  ON "system_announcements"("audience_college_id", "published_at");

ALTER TABLE "system_announcements"
  ADD CONSTRAINT "system_announcements_audience_college_id_fkey"
  FOREIGN KEY ("audience_college_id") REFERENCES "colleges"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
