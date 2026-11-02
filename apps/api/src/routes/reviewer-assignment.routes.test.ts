import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reviewWorkflow: vi.fn() }));
vi.mock("../services/reviewer-assignment.service.js", () => ({
  reviewerAssignmentService: { reviewWorkflow: mocks.reviewWorkflow },
  ReviewerAssignmentError: class extends Error {},
}));
import router from "./reviewer-assignment.routes.js";

describe("review workflow response", () => {
  it("serializes stored file sizes when loading a submitted version's history", async () => {
    mocks.reviewWorkflow.mockResolvedValue({
      id: "sample-document",
      versions: [{ id: "submitted-version", fileSize: 3219n }],
    });
    const layer = (router as any).stack.find(
      (entry: any) =>
        entry.route?.path === "/documents/:documentId/review-workflow",
    );
    const request = {
      user: { id: "reviewer" },
      params: { documentId: "sample-document" },
    };
    let payload = "";
    const response: any = {
      req: request,
      json: vi.fn((value) => {
        payload = JSON.stringify(value);
      }),
      status: vi.fn().mockReturnThis(),
    };
    await layer.route.stack.at(-1).handle(request, response);
    expect(response.status).not.toHaveBeenCalled();
    expect(JSON.parse(payload).document.versions[0]).toEqual({
      id: "submitted-version",
      fileSize: 3219,
    });
    expect(mocks.reviewWorkflow).toHaveBeenCalledWith(
      request.user,
      "sample-document",
    );
  });
});
