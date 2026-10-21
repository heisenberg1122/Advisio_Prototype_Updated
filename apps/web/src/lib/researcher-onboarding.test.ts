import { describe, expect, it } from "vitest";
import {
  MAX_RESEARCH_INTERESTS,
  reconcileResearchInterests,
  restoreResearcherOnboardingDraft,
  restoreResearcherOnboardingSession,
  sanitizeResearchInterests,
  toggleResearchInterest,
} from "./researcher-onboarding";

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const otherUuid = "223e4567-e89b-42d3-a456-426614174001";
const bsit = ["Information Systems", "Software Engineering", "Cybersecurity"];
const bstm = ["Sustainable Tourism", "Destination Management", "Ecotourism"];

describe("researcher onboarding interests", () => {
  it("falls back safely for malformed restored drafts", () => {
    expect(restoreResearcherOnboardingDraft("not json").interests).toEqual([]);
    expect(restoreResearcherOnboardingDraft("[]").collegeId).toBe("");
  });

  it("sanitizes restored fields, removes duplicates, and enforces ten interests", () => {
    const restored = restoreResearcherOnboardingDraft(
      JSON.stringify({
        collegeId: uuid,
        programId: "not-a-uuid",
        degreeLevel: "UNSUPPORTED",
        interests: [
          ...Array.from({ length: 12 }, (_, index) => ` Interest ${index} `),
          "Interest 0",
          42,
        ],
      }),
    );

    expect(restored.collegeId).toBe(uuid);
    expect(restored.programId).toBe("");
    expect(restored.degreeLevel).toBe("");
    expect(restored.interests).toHaveLength(MAX_RESEARCH_INTERESTS);
    expect(restored.interests[0]).toBe("Interest 0");
    expect(new Set(restored.interests).size).toBe(MAX_RESEARCH_INTERESTS);
  });

  it("recovers locked registration values without discarding completed fields", () => {
    const restored = restoreResearcherOnboardingSession(
      JSON.stringify({
        collegeId: "",
        programId: "",
        degreeLevel: "UNDERGRADUATE",
        yearLevel: "3",
        academicTerm: "FIRST_SEMESTER",
      }),
      JSON.stringify({ collegeId: uuid, programId: otherUuid }),
    );

    expect(restored).toMatchObject({
      collegeId: uuid,
      programId: otherUuid,
      degreeLevel: "UNDERGRADUATE",
      yearLevel: "3",
      academicTerm: "FIRST_SEMESTER",
    });
  });

  it("treats the registered college and program as the locked source of truth", () => {
    expect(
      restoreResearcherOnboardingSession(
        JSON.stringify({ collegeId: otherUuid, programId: otherUuid }),
        JSON.stringify({ collegeId: uuid, programId: uuid }),
      ),
    ).toMatchObject({ collegeId: uuid, programId: uuid });
  });

  it("clears incompatible selections when the verified program changes", () => {
    expect(
      reconcileResearchInterests(
        ["Information Systems", "Sustainable Tourism", "Cybersecurity"],
        bstm,
      ),
    ).toEqual(["Sustainable Tourism"]);
  });

  it("preserves valid choices while navigating between steps", () => {
    const selected = ["Sustainable Tourism", "Ecotourism"];
    expect(reconcileResearchInterests(selected, bstm)).toEqual(selected);
    expect(reconcileResearchInterests(selected, bstm)).toEqual(selected);
  });

  it("prevents an eleventh selection while allowing deselection", () => {
    const allowed = Array.from({ length: 11 }, (_, index) => `Area ${index}`);
    const selected = allowed.slice(0, 10);
    expect(toggleResearchInterest(selected, allowed[10], allowed)).toEqual({
      interests: selected,
      limitReached: true,
    });
    expect(toggleResearchInterest(selected, allowed[0], allowed)).toEqual({
      interests: selected.slice(1),
      limitReached: false,
    });
  });

  it("keeps interests optional and rejects invalid restored values", () => {
    expect(sanitizeResearchInterests(undefined)).toEqual([]);
    expect(reconcileResearchInterests([], bsit)).toEqual([]);
  });
});
