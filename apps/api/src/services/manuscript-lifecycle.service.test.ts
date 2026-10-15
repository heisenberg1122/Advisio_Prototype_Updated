import { ManuscriptLifecycleStatus } from "../lib/prisma.js";
import { describe, expect, it } from "vitest";
import {
  canSubmitFromStatus,
  canTransitionManuscript,
} from "./manuscript-lifecycle.service.js";

describe("manuscript lifecycle state machine", () => {
  it("permits submissions only from draft and revision-required states", () => {
    expect(canSubmitFromStatus(ManuscriptLifecycleStatus.DRAFT)).toBe(true);
    expect(
      canSubmitFromStatus(ManuscriptLifecycleStatus.REVISION_REQUIRED),
    ).toBe(true);
    expect(canSubmitFromStatus(ManuscriptLifecycleStatus.SUBMITTED)).toBe(false);
    expect(canSubmitFromStatus(ManuscriptLifecycleStatus.IN_REVIEW)).toBe(false);
    expect(canSubmitFromStatus(ManuscriptLifecycleStatus.APPROVED)).toBe(false);
    expect(canSubmitFromStatus(ManuscriptLifecycleStatus.FINALIZED)).toBe(false);
  });

  it("allows only Phase 3 review-start and revision-request transitions", () => {
    expect(
      canTransitionManuscript(
        ManuscriptLifecycleStatus.SUBMITTED,
        ManuscriptLifecycleStatus.IN_REVIEW,
      ),
    ).toBe(true);
    expect(
      canTransitionManuscript(
        ManuscriptLifecycleStatus.IN_REVIEW,
        ManuscriptLifecycleStatus.REVISION_REQUIRED,
      ),
    ).toBe(true);
    expect(
      canTransitionManuscript(
        ManuscriptLifecycleStatus.IN_REVIEW,
        ManuscriptLifecycleStatus.APPROVED,
      ),
    ).toBe(false);
    expect(
      canTransitionManuscript(
        ManuscriptLifecycleStatus.APPROVED,
        ManuscriptLifecycleStatus.FINALIZED,
      ),
    ).toBe(false);
  });
});
