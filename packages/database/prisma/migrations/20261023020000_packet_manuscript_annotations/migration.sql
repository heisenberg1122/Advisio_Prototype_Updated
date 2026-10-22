CREATE TABLE "packet_document_reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "defense_session_id" UUID NOT NULL REFERENCES "defense_sessions"("id") ON DELETE CASCADE,
  "panelist_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "source_version_id" UUID NOT NULL REFERENCES "document_versions"("id") ON DELETE RESTRICT,
  "source_data" BYTEA NOT NULL,
  "source_checksum" VARCHAR(64) NOT NULL,
  "annotations" JSONB NOT NULL DEFAULT '[]',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "preview_hash" VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "packet_reviews_session_panelist_version_key"
ON "packet_document_reviews"("defense_session_id", "panelist_id", "source_version_id");
CREATE TABLE "packet_review_publications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "review_id" UUID NOT NULL REFERENCES "packet_document_reviews"("id") ON DELETE CASCADE,
  "revision" INTEGER NOT NULL,
  "pdf_data" BYTEA NOT NULL,
  "integrity_hash" VARCHAR(64) NOT NULL,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "packet_review_publications_review_id_revision_key" ON "packet_review_publications"("review_id", "revision");
CREATE FUNCTION "protect_packet_review_publication"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Shared manuscript feedback is immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "packet_review_publication_guard" BEFORE UPDATE ON "packet_review_publications"
FOR EACH ROW EXECUTE FUNCTION "protect_packet_review_publication"();
