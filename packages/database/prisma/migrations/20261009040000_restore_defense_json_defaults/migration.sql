-- Keep the database defaults declared by the original defense packet
-- migration represented in the final schema as well.

ALTER TABLE "defense_packets"
  ALTER COLUMN "recommendation_field_mappings" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "evaluation_field_mappings" SET DEFAULT '[]'::jsonb;

ALTER TABLE "panelist_manuscript_reviews"
  ALTER COLUMN "annotations" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "revision_checklist" SET DEFAULT '[]'::jsonb;

ALTER TABLE "panelist_recommendations"
  ALTER COLUMN "responses" SET DEFAULT '{}'::jsonb;
