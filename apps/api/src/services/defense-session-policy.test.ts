import { describe, expect, it } from "vitest";
import {
  currentPanelInvitation,
  hasAcceptedPanelAssignment,
  liveDefenseConflictScope,
  normalizeEvaluationScores,
} from "./defense-session-policy.js";

const invitations = [
  { inviteeId: "panel-a", role: "PANELIST", status: "ACCEPTED" },
  { inviteeId: "panel-b", role: "PANEL_CHAIR", status: "PENDING" },
  { inviteeId: "observer", role: "OBSERVER", status: "ACCEPTED" },
];

describe("panelist defense-session assignment policy", () => {
  it("recognizes current panel invitations independently of project college", () => {
    expect(currentPanelInvitation(invitations, "panel-b")?.status).toBe(
      "PENDING",
    );
    expect(hasAcceptedPanelAssignment(invitations, "panel-a")).toBe(true);
    expect(hasAcceptedPanelAssignment(invitations, "panel-b")).toBe(false);
    expect(currentPanelInvitation(invitations, "observer")).toBeUndefined();
  });

  it("scopes live-session collisions to an event or standalone project", () => {
    expect(
      liveDefenseConflictScope({
        defenseEventId: "event-a",
        researchId: "project-a",
      }),
    ).toEqual({
      OR: [{ researchId: "project-a" }, { defenseEventId: "event-a" }],
    });
    expect(
      liveDefenseConflictScope({
        defenseEventId: null,
        researchId: "project-a",
      }),
    ).toEqual({ OR: [{ researchId: "project-a" }] });
  });
});

describe("live evaluation score normalization", () => {
  const criteria = [
    { id: "quality", criterion: "Quality", maxScore: 10 },
    { id: "delivery", criterion: "Delivery", maxScore: 5 },
  ];

  it("allows an incomplete draft and preserves comments", () => {
    expect(
      normalizeEvaluationScores(
        criteria,
        [
          { criterionId: "quality", score: 7, comment: "Clear method" },
          { criterionId: "delivery", score: "", comment: "Ask a follow-up" },
        ],
        false,
      ),
    ).toMatchObject({
      totalScore: 7,
      criteriaScores: [
        { criterionId: "quality", score: 7, comment: "Clear method" },
        { criterionId: "delivery", comment: "Ask a follow-up" },
      ],
    });
  });

  it("rejects unanswered final criteria but accepts an explicit zero", () => {
    expect(() =>
      normalizeEvaluationScores(
        criteria,
        [
          { criterionId: "quality", score: 7 },
          { criterionId: "delivery", score: "" },
        ],
        true,
      ),
    ).toThrow(/explicit score/i);

    expect(
      normalizeEvaluationScores(
        criteria,
        [
          { criterionId: "quality", score: 7 },
          { criterionId: "delivery", score: 0 },
        ],
        true,
      ).totalScore,
    ).toBe(7);
  });

  it("rejects duplicate, foreign, and out-of-range scores", () => {
    expect(() =>
      normalizeEvaluationScores(
        criteria,
        [
          { criterionId: "quality", score: 7 },
          { criterionId: "quality", score: 8 },
        ],
        false,
      ),
    ).toThrow(/submitted once/i);
    expect(() =>
      normalizeEvaluationScores(
        criteria,
        [{ criterionId: "foreign", score: 1 }],
        false,
      ),
    ).toThrow(/selected rubric/i);
    expect(() =>
      normalizeEvaluationScores(
        criteria,
        [{ criterionId: "quality", score: 11 }],
        false,
      ),
    ).toThrow(/allowed range/i);
  });
});
