import { describe, expect, it } from "vitest";
import {
  allowedUploadExtensions,
  buildDocumentSubmissionRequest,
  directUploadFileTypes,
  resolveStableSubmissionKey,
  submissionOptionKey,
  submissionOptionSummary,
  type TaskSubmissionOption,
  uploadFileCompatibility,
  uploadSubmissionSummary,
} from "./task-submission";

const storedOption: TaskSubmissionOption = {
  kind: "STORED_VERSION",
  document: {
    id: "document-a",
    title: "Chapter 1",
    documentType: "MANUSCRIPT",
    lifecycleStatus: "DRAFT",
  },
  version: {
    id: "version-3",
    versionNumber: 3,
    fileName: "chapter-1-v3.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

const googleOption: TaskSubmissionOption = {
  kind: "GOOGLE_DOC_PDF_SNAPSHOT",
  document: {
    id: "document-google",
    title: "Live manuscript",
    documentType: "GOOGLE_DOC",
    lifecycleStatus: "REVISION_REQUIRED",
  },
  snapshot: {
    outputFileType: "PDF",
    outputMimeType: "application/pdf",
    createsImmutableVersion: true,
    requiresExportVerification: true,
  },
};

describe("task document selection", () => {
  it("keeps exact stored versions distinct and describes the confirmation", () => {
    expect(submissionOptionKey(storedOption)).toBe(
      "STORED_VERSION:document-a:version-3",
    );
    expect(submissionOptionSummary(storedOption)).toEqual({
      title: "Chapter 1",
      format: "DOCX",
      version: "Version 3",
      fileName: "chapter-1-v3.docx",
    });
  });

  it("builds the existing exact-version task submission request", () => {
    expect(
      buildDocumentSubmissionRequest(storedOption, {
        taskId: "task-a",
        researchId: "research-a",
        milestoneId: "milestone-a",
        idempotencyKey: "stable-key",
        note: "Ready for review",
      }),
    ).toEqual({
      endpoint: "/api/workflows/tasks/task-a/submissions",
      body: {
        researchId: "research-a",
        documentId: "document-a",
        documentVersionId: "version-3",
        note: "Ready for review",
      },
      idempotencyStrategy: "SERVER_EXACT_VERSION",
    });
  });

  it("builds the Google Docs immutable snapshot request with a stable key", () => {
    expect(submissionOptionSummary(googleOption)).toMatchObject({
      format: "PDF",
      version: "New immutable PDF snapshot",
    });
    expect(
      buildDocumentSubmissionRequest(googleOption, {
        taskId: "task-a",
        researchId: "research-a",
        milestoneId: "milestone-a",
        idempotencyKey: "stable-google-key",
      }),
    ).toEqual({
      endpoint: "/api/documents/document-google/submissions",
      body: {
        milestoneId: "milestone-a",
        taskId: "task-a",
        idempotencyKey: "stable-google-key",
      },
      idempotencyStrategy: "CLIENT_STABLE_KEY",
    });
  });
});

describe("task upload confirmation", () => {
  it("preserves stable retry keys until the selected submission changes", () => {
    const first = resolveStableSubmissionKey(
      null,
      "google:document-a",
      () => "key-a",
    );
    expect(
      resolveStableSubmissionKey(first, "google:document-a", () => "key-b"),
    ).toBe(first);
    expect(
      resolveStableSubmissionKey(first, "google:document-b", () => "key-b"),
    ).toEqual({ scope: "google:document-b", value: "key-b" });
  });

  it("checks professor-configured PDF and DOCX compatibility", () => {
    expect(directUploadFileTypes(["PDF", "DOCX", "TXT"])).toEqual([
      "PDF",
      "DOCX",
    ]);
    expect(allowedUploadExtensions(["PDF", "DOCX"])).toEqual([".pdf", ".docx"]);
    expect(
      uploadFileCompatibility("manuscript.pdf", ["PDF", "DOCX"]),
    ).toMatchObject({ compatible: true, extension: "PDF" });
    expect(
      uploadFileCompatibility("manuscript.doc", ["PDF", "DOCX"]),
    ).toMatchObject({ compatible: false, extension: "DOC" });
  });

  it("builds the exact upload confirmation details", () => {
    expect(uploadSubmissionSummary("final-manuscript.pdf")).toEqual({
      title: "final-manuscript.pdf",
      format: "PDF",
      version: "Uploaded file snapshot",
    });
  });
});
