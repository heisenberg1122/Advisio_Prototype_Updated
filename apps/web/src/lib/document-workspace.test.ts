import { describe, expect, it } from "vitest";
import {
  documentPreviewKind,
  documentWorkspaceCapabilities,
  filterAndSortDocuments,
  resolveDocumentSelection,
  taskReturnHref,
  type FileManagerDocument,
} from "./document-workspace";

const googleDocument: FileManagerDocument = {
  id: "google",
  title: "Research Manuscript",
  documentType: "GOOGLE_DOC",
  lifecycleStatus: "DRAFT",
  liveDocumentUrl: "https://docs.google.com/document/d/google-id/edit",
  updatedAt: "2026-10-15T10:00:00.000Z",
  versions: [],
};

const uploadedDocument: FileManagerDocument = {
  id: "uploaded",
  title: "Appendix Dataset",
  documentType: "UPLOADED_WORKING_COPY",
  lifecycleStatus: "DRAFT",
  updatedAt: "2026-10-16T10:00:00.000Z",
  versions: [
    {
      id: "version-1",
      versionNumber: 1,
      fileName: "appendix.pdf",
      mimeType: "application/pdf",
      webViewLink: "/api/documents/files/version-1",
      uploadedAt: "2026-10-16T10:00:00.000Z",
      isImmutable: true,
    },
  ],
};

describe("Documents workspace collection", () => {
  it("searches by title and filters real Google and uploaded records", () => {
    expect(
      filterAndSortDocuments([googleDocument, uploadedDocument], {
        search: "research",
        filter: "ALL",
        sort: "NAME_ASC",
      }).map(({ id }) => id),
    ).toEqual(["google"]);
    expect(
      filterAndSortDocuments([googleDocument, uploadedDocument], {
        search: "",
        filter: "UPLOADED",
        sort: "NAME_ASC",
      }).map(({ id }) => id),
    ).toEqual(["uploaded"]);
  });

  it("sorts by filename and authoritative modified timestamps", () => {
    expect(
      filterAndSortDocuments([googleDocument, uploadedDocument], {
        search: "",
        filter: "ALL",
        sort: "NAME_ASC",
      }).map(({ id }) => id),
    ).toEqual(["uploaded", "google"]);
    expect(
      filterAndSortDocuments([googleDocument, uploadedDocument], {
        search: "",
        filter: "ALL",
        sort: "MODIFIED_DESC",
      }).map(({ id }) => id),
    ).toEqual(["uploaded", "google"]);
  });

  it("preserves valid deep-link selection and safely falls back", () => {
    const documents = [googleDocument, uploadedDocument];
    expect(resolveDocumentSelection(documents, "uploaded", "google")).toBe(
      "uploaded",
    );
    expect(resolveDocumentSelection(documents, "missing", "google")).toBe(
      "google",
    );
  });
});

describe("Documents workspace preview and permissions", () => {
  it("uses supported preview types without pretending Word files render", () => {
    expect(documentPreviewKind(googleDocument)).toBe("GOOGLE_DOC");
    expect(documentPreviewKind(uploadedDocument)).toBe("PDF");
    expect(
      documentPreviewKind({
        ...uploadedDocument,
        versions: [
          {
            ...uploadedDocument.versions[0],
            fileName: "chapter.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        ],
      }),
    ).toBe("UNSUPPORTED");
  });

  it("exposes actions only when project permissions and file kind allow them", () => {
    expect(
      documentWorkspaceCapabilities(googleDocument, {
        canView: true,
        canManageWorkingDocuments: false,
      }),
    ).toMatchObject({
      canOpenGoogle: true,
      canEditDetails: false,
      canUpdateMilestone: false,
    });
    expect(
      documentWorkspaceCapabilities(uploadedDocument, {
        canView: false,
        canManageWorkingDocuments: true,
      }).canOpenStoredVersion,
    ).toBe(false);
  });

  it("builds the original Tasks context return link", () => {
    expect(taskReturnHref("project one", "task/two")).toBe(
      "/student/tasks?projectId=project+one&taskId=task%2Ftwo",
    );
  });
});
