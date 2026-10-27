import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("../ui/Tag", () => ({
  Tag: ({ children }: any) => <span>{children}</span>,
}));
import {
  AdviserApprovalBadge,
  AdviserTaskReview,
  needsAdviserApproval,
} from "./AdviserTaskReview";

const version = (
  id: string,
  versionNumber: number,
  recommendation = "APPROVE",
) => ({
  id,
  versionNumber,
  reviews: [
    { id: `review-${id}`, recommendation, overallComment: null, comments: [] },
  ],
});

describe("researcher milestone adviser review", () => {
  it("shows professor queue approval only for the current version and all required advisers", () => {
    const render = (submission: any) =>
      renderToStaticMarkup(
        <AdviserApprovalBadge required submission={submission} />,
      );
    expect(render({ documentVersion: version("v1", 1) })).toContain(
      "Adviser: approved",
    );
    expect(
      render({
        documentVersion: {
          ...version("v1", 1),
          reviews: [
            { id: "r1", assignmentId: "adviser1", recommendation: "APPROVE" },
          ],
          reviewerAssignments: [
            { id: "adviser1", isRequired: true, status: "COMPLETED" },
            { id: "adviser2", isRequired: true, status: "ACTIVE" },
          ],
        },
      }),
    ).toContain("Adviser: not yet approved");
    expect(
      render({
        documentVersion: { id: "v2", versionNumber: 2 },
        attempts: [{ documentVersion: version("v1", 1) }],
      }),
    ).toContain("Adviser: not yet approved");
    expect(
      render({ documentVersion: version("v2", 2, "MAJOR_REVISION") }),
    ).toContain("Adviser: revisions requested");
  });
  it("shows approval even when the adviser left no comment", () => {
    const html = renderToStaticMarkup(
      <AdviserTaskReview
        required
        submission={{
          documentVersionId: "v1",
          documentVersion: version("v1", 1),
        }}
      />,
    );
    expect(html).toContain("Approved by adviser");
    expect(html).toContain("Current submission");
    expect(html).toContain(
      "Other required faculty approvals may still be pending",
    );
    expect(html).not.toContain("Awaiting adviser review");
  });

  it("shows adviser revision feedback and page comments", () => {
    const reviewed = version("v2", 2, "MINOR_REVISION");
    const html = renderToStaticMarkup(
      <AdviserTaskReview
        required
        submission={{
          documentVersionId: "v2",
          documentVersion: {
            ...reviewed,
            reviews: [
              {
                ...reviewed.reviews[0],
                overallComment: "Clarify the method.",
                comments: [
                  {
                    id: "c1",
                    comment: "Explain sampling.",
                    locationData: { page: 3, section: "Methods" },
                  },
                ],
              },
            ],
          },
        }}
      />,
    );
    expect(html).toContain("Adviser requested revisions");
    expect(html).toContain("Clarify the method.");
    expect(html).toContain("Explain sampling.");
    expect(html).toContain("Methods · Page 3");
  });

  it("keeps an old approval separate from a resubmission awaiting review", () => {
    const current = { id: "v2", versionNumber: 2, reviews: [] };
    const html = renderToStaticMarkup(
      <AdviserTaskReview
        required
        submission={{
          documentVersionId: "v2",
          documentVersion: current,
          attempts: [
            {
              id: "a1",
              attemptNumber: 1,
              documentVersionId: "v1",
              documentVersion: version("v1", 1),
            },
            {
              id: "a2",
              attemptNumber: 2,
              documentVersionId: "v2",
              documentVersion: current,
            },
          ],
        }}
      />,
    );
    expect(html).toContain("Awaiting adviser review of the current submission");
    expect(html).toContain("Previous attempt 1");
    expect(html.match(/Approved by adviser/g)).toHaveLength(1);
    expect(html).not.toContain(
      "Other required faculty approvals may still be pending",
    );
  });

  it("does not duplicate the current review from submission history", () => {
    const current = version("v1", 1);
    const html = renderToStaticMarkup(
      <AdviserTaskReview
        required
        submission={{
          documentVersionId: "v1",
          documentVersion: current,
          attempts: [
            {
              id: "a1",
              attemptNumber: 1,
              documentVersionId: "v1",
              documentVersion: current,
            },
          ],
        }}
      />,
    );
    expect(html.match(/Approved by adviser/g)).toHaveLength(1);
  });

  it("shows the requirement before submission and excludes special milestones", () => {
    const task = { stage: { requiresApproval: true }, requiresDocument: true };
    expect(needsAdviserApproval(task)).toBe(true);
    expect(needsAdviserApproval({ ...task, isAdviserMilestone: true })).toBe(
      false,
    );
    expect(needsAdviserApproval({ ...task, isTitleProposal: true })).toBe(
      false,
    );
    expect(needsAdviserApproval({ ...task, requiresDocument: false })).toBe(
      false,
    );
    expect(needsAdviserApproval({ stage: { requiresApproval: false } })).toBe(
      false,
    );
    const html = renderToStaticMarkup(<AdviserTaskReview required />);
    expect(html).toContain("Adviser approval required");
    expect(html).toContain("Submit your work");
  });

  it("recognizes a manually required adviser assignment", () => {
    expect(
      needsAdviserApproval({
        stage: { requiresApproval: false },
        submission: {
          documentVersion: {
            id: "v1",
            versionNumber: 1,
            reviewerAssignments: [{ isRequired: true, status: "ACTIVE" }],
          },
        },
      }),
    ).toBe(true);
    expect(renderToStaticMarkup(<AdviserTaskReview required={false} />)).toBe(
      "",
    );
  });
});
