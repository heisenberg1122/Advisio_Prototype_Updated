ALTER TABLE "users" ADD COLUMN "google_onboarding_stage" VARCHAR(20);
ALTER TABLE "users" ADD CONSTRAINT "users_google_onboarding_stage_check"
CHECK ("google_onboarding_stage" IS NULL OR "google_onboarding_stage" IN ('IDENTITY', 'RESEARCHER', 'FACULTY', 'COMPLETE'));
