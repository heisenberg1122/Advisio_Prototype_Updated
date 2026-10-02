ALTER TABLE "adviser_requests"
ADD COLUMN "request_form_document_id" UUID;

CREATE INDEX "adviser_requests_request_form_document_id_idx"
ON "adviser_requests"("request_form_document_id");

ALTER TABLE "adviser_requests"
ADD CONSTRAINT "adviser_requests_request_form_document_id_fkey"
FOREIGN KEY ("request_form_document_id") REFERENCES "documents"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
