INSERT INTO "colleges" ("id", "code", "name", "description", "is_active", "created_at", "updated_at") VALUES
  (gen_random_uuid(), 'COA',  'College of Accountancy', 'Accountancy academic unit', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CEA',  'College of Engineering and Architecture', 'Engineering and architecture academic unit', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CHTM', 'College of Hospitality and Tourism Management', 'Hospitality and tourism academic unit', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CIT',  'College of Information Technology', 'Information technology academic unit', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CNP',  'College of Nursing and Pharmacy', 'Nursing and pharmacy academic unit', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SAS',  'School of Arts and Sciences', 'Arts and sciences academic unit', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SBPA', 'School of Business and Public Administration', 'Business and public administration academic unit', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SOE',  'School of Education', 'Education academic unit', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SHS',  'Senior High School', 'Senior high school academic unit', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "is_active" = true,
  "updated_at" = CURRENT_TIMESTAMP;
