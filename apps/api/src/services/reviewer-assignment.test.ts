import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../middleware/auth.js";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("../lib/prisma.js", async () => ({
  ...(await vi.importActual("@prisma/client")),
  prisma: { document: { findUnique: mocks.findUnique } },
}));
vi.mock("./notification-email.service.js", () => ({
  emailNotification: vi.fn(),
}));
vi.mock("./research-workflow-integration.service.js", () => ({
  advanceMilestoneIfSatisfied: vi.fn(),
  createNotificationsOnce: vi.fn(),
  synchronizeTaskAttemptLifecycle: vi.fn(),
}));

import { reviewerAssignmentService } from "./reviewer-assignment.service.js";

const user = {
  id: "coordinator",
  collegeId: "college",
  roles: ["RESEARCH_COORDINATOR"],
} as AuthenticatedUser;
beforeEach(() => {
  mocks.findUnique.mockResolvedValue({
    id: "document",
    research: {
      collegeId: "college",
      members: [{ projectRole: "COORDINATOR" }],
      workflowInstance: { workflow: { createdBy: user.id } },
    },
    versions: [
      {
        id: "version",
        fileSize: 2048n,
        reviews: [
          { overallComment: "Sample feedback", reviewer: { id: "reviewer" } },
        ],
        reviewerAssignments: [
          { reviewerId: user.id, reviewer: { id: user.id } },
        ],
      },
    ],
  });
});

describe("manuscript review workflow response", () => {
  it("serializes stored file sizes so version history can be returned as JSON", async () => {
    const document = await reviewerAssignmentService.reviewWorkflow(
      user,
      "document",
    );
    const response = JSON.parse(JSON.stringify({ document }));
    expect(response.document.versions[0].fileSize).toBe(2048);
    expect(response.document.versions[0].reviews[0].overallComment).toBe(
      "Sample feedback",
    );
  });

  it("continues rejecting access from another college", async () => {
    await expect(
      reviewerAssignmentService.reviewWorkflow(
        { ...user, collegeId: "other" },
        "document",
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: "DOCUMENT_NOT_FOUND" });
  });

  it("continues hiding reviewer identities from student members", async () => {
    const fixture = await mocks.findUnique();
    fixture.research.members = [{ projectRole: "LEADER" }];
    const document = await reviewerAssignmentService.reviewWorkflow(
      { ...user, roles: ["RESEARCHER"] },
      "document",
    );
    expect(document.versions[0].reviews[0].reviewer).toBeNull();
    expect(document.versions[0].reviewerAssignments[0].reviewer).toBeNull();
  });
});
