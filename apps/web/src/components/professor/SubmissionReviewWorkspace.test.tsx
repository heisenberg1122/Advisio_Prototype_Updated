import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/components/documents/SubmissionGradePanel", () => ({ SubmissionGradePanel: () => <div>Grade and history</div> }));
vi.mock("./SubmissionDocumentPreview", () => ({
  SubmissionDocumentPreview: () => <div>Document preview</div>,
}));
vi.mock("@/components/documents/SubmissionComments", () => ({
  SubmissionComments: ({ versionId }: any) => (
    <div data-comment-version={versionId}>Comments</div>
  ),
}));
import {
  SubmissionReviewWorkspace,
  submittedReviewVersions,
} from "./SubmissionReviewWorkspace";

const v1 = {
  id: "version-1",
  versionNumber: 1,
  fileName: "Original.pdf",
  mimeType: "application/pdf",
};
const v2 = {
  ...v1,
  id: "version-2",
  versionNumber: 2,
  fileName: "Revision.pdf",
};
const submission = {
  id: "submission",
  documentVersionId: v1.id,
  documentVersion: v1,
  attempts: [{ documentVersion: v1 }],
  document: { versions: [v2] },
  status: "SUBMITTED",
  projectTitle: "Research group",
  submittedAt: "2026-11-02T08:00:00Z",
  task: { title: "Chapter 1" },
};
const render = (overrides = {}) =>
  renderToStaticMarkup(
    <SubmissionReviewWorkspace
      submission={{ ...submission, ...overrides }}
      queue={[submission]}
      feedback=""
      saving={false}
      onSelect={() => {}}
      onFeedbackChange={() => {}}
      onClose={() => {}}
      onReview={() => {}}
    />,
  );

describe("submission review", () => {
  it("reviews submitted snapshots rather than a newer unsubmitted upload", () => {
    expect(submittedReviewVersions(submission)).toEqual([v1]);
    expect(
      submittedReviewVersions({
        ...submission,
        documentVersion: undefined,
        attempts: [],
      }),
    ).toEqual([]);
  });
  it("includes only versions from actual attempts in revision history", () => {
    expect(
      submittedReviewVersions({
        ...submission,
        documentVersionId: v2.id,
        documentVersion: v2,
      }),
    ).toEqual([v2, v1]);
  });
  it("ties comments to the current submitted snapshot", () => {
    expect(render()).toContain('data-comment-version="version-1"');
    expect(render()).toContain("Decision feedback");
    expect(render()).toMatch(
      /<button[^>]*disabled=""[^>]*>Request revision<\/button>/,
    );
  });
  it.each(["APPROVED", "REVISION_REQUIRED", "REJECTED"])(
    "shows %s as a recorded decision instead of allowing another decision",
    (status) => {
      const html = render({ status, reviewNote: "Saved feedback" });
      expect(html).not.toContain("Approve submission");
      expect(html).toContain("Saved feedback");
      expect(html).toContain("Comments");
    },
  );
});
