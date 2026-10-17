CREATE TYPE "ColorThemePreference" AS ENUM ('DEFAULT_ADVISIO', 'COLLEGE_PROGRAM');

ALTER TABLE "users"
ADD COLUMN "color_theme_preference" "ColorThemePreference" NOT NULL DEFAULT 'COLLEGE_PROGRAM';
