ALTER TABLE "users"
ADD COLUMN "google_subject" VARCHAR(255);

CREATE UNIQUE INDEX "users_google_subject_key"
ON "users"("google_subject");
