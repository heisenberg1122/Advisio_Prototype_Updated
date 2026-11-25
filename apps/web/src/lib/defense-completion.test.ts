import { expect, it } from "vitest";
import { defenseCompletion, latestFinalDefense, type CompletionSession } from "./defense-completion";

const final: CompletionSession = {
  id: "final", researchId: "group", createdAt: "2026-11-01T00:00:00Z",
  status: "COMPLETED", defenseEvent: { defenseType: "FINAL_DEFENSE" },
  releasedAt: "2026-11-02T00:00:00Z", decision: "APPROVED_WITH_MINOR_REVISIONS",
};

it("selects the group's latest valid Final Defense and keeps revisions ahead of certificates", () => {
  const newer = { ...final, createdAt: "2026-11-03T00:00:00Z" };
  const session = latestFinalDefense([
    final,
    { ...newer, status: "CANCELLED" },
    { ...newer, researchId: "another-group" },
    { ...newer, defenseEvent: { defenseType: "TITLE_DEFENSE" } },
  ], "group");
  expect(session).toBe(final);
  expect(defenseCompletion(session).label).toBe("Revisions required");
  const cleared = { ...final, revisionClearance: { clearedAt: "2026-11-04T00:00:00Z" } };
  expect(defenseCompletion(cleared).label).toBe("Revisions cleared · Certificate pending");
  expect(defenseCompletion({ ...cleared, badge: { _count: { certificates: 3 } } }).label).toBe("Certificates issued");
});
