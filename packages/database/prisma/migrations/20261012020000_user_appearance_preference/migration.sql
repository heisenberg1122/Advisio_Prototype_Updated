CREATE TYPE "AppearancePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

ALTER TABLE "users"
ADD COLUMN "appearance_preference" "AppearancePreference" NOT NULL DEFAULT 'SYSTEM';
