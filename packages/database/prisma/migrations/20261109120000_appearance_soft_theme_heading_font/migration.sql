ALTER TYPE "ColorThemePreference" ADD VALUE IF NOT EXISTS 'COLLEGE_SOFT';

CREATE TYPE "HeadingFontPreference" AS ENUM ('STANDARD', 'SERIF');

ALTER TABLE "users"
ADD COLUMN "heading_font_preference" "HeadingFontPreference" NOT NULL DEFAULT 'STANDARD';
