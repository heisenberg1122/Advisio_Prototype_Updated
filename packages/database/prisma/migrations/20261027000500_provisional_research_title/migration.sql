-- Existing and manually registered projects retain non-provisional titles.
ALTER TABLE "research_projects" ADD COLUMN "is_title_provisional" BOOLEAN NOT NULL DEFAULT false;
