ALTER TABLE "defense_sessions"
ADD COLUMN "decision_and_feedback_only" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "released_feedback" TEXT;
