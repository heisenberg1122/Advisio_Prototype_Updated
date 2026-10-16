-- Populate the verified academic programs used by Google account onboarding.
-- The upsert keeps this safe to apply when some programs already exist.
INSERT INTO "programs" (
  "id", "college_id", "code", "name", "description", "has_majors",
  "is_active", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  college."id",
  catalog."code",
  catalog."name",
  catalog."name" || ' degree program',
  false,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (VALUES
  ('COA', 'BSA', 'Bachelor of Science in Accountancy'),
  ('COA', 'BSAIS', 'Bachelor of Science in Accounting Information System'),
  ('CEA', 'BSARCH', 'Bachelor of Science in Architecture'),
  ('CEA', 'BSCE', 'Bachelor of Science in Civil Engineering'),
  ('CEA', 'BSCPE', 'Bachelor of Science in Computer Engineering'),
  ('CEA', 'BSIE', 'Bachelor of Science in Industrial Engineering'),
  ('CHTM', 'BSHM', 'Bachelor of Science in Hospitality Management'),
  ('CHTM', 'BSTM', 'Bachelor of Science in Tourism Management'),
  ('CIT', 'BSIT', 'Bachelor of Science in Information Technology'),
  ('CIT', 'BLIS', 'Bachelor of Library and Information Science'),
  ('CNP', 'BSN', 'Bachelor of Science in Nursing'),
  ('CNP', 'BSPH', 'Bachelor of Science in Pharmacy'),
  ('SAS', 'ABCOMM', 'Bachelor of Arts in Communication'),
  ('SAS', 'BSCRIM', 'Bachelor of Science in Criminology'),
  ('SAS', 'BHS', 'Bachelor in Human Services'),
  ('SAS', 'BSPSYCH', 'Bachelor of Science in Psychology'),
  ('SBPA', 'BSBA-MM', 'Bachelor of Science in Business Administration, Major in Marketing Management'),
  ('SBPA', 'BSBA-OM', 'Bachelor of Science in Business Administration, Major in Operations Management'),
  ('SOE', 'BEED', 'Bachelor of Elementary Education'),
  ('SOE', 'BSED-VE-RE', 'Bachelor of Secondary Education, Major in Values Education with Religious Education')
) AS catalog("college_code", "code", "name")
JOIN "colleges" AS college ON college."code" = catalog."college_code"
ON CONFLICT ("college_id", "code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "is_active" = true,
  "updated_at" = CURRENT_TIMESTAMP;
