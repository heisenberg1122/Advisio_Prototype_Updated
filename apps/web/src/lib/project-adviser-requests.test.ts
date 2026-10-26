import { describe, expect, it } from "vitest";
import { projectAdviserRequests } from "./project-adviser-requests";

describe("project adviser request isolation", () => {
  const other = { id: "other-pending", researchId: "x", status: "PENDING" };
  const own = { id: "own-pending", researchId: "y", status: "PENDING" };
  it("does not block a project because another project has a pending request", () => {
    expect(projectAdviserRequests([other], "y")).toEqual({
      requests: [],
      pendingRequest: null,
    });
  });
  it("selects the current project's pending request regardless of response order", () => {
    expect(projectAdviserRequests([other, own], "y")).toEqual({
      requests: [own],
      pendingRequest: own,
    });
  });
  it("does not treat decided requests as pending or select requests without a project", () => {
    expect(
      projectAdviserRequests([{ ...own, status: "ACCEPTED" }], "y")
        .pendingRequest,
    ).toBeNull();
    expect(projectAdviserRequests([other, own], null)).toEqual({
      requests: [],
      pendingRequest: null,
    });
  });
});
