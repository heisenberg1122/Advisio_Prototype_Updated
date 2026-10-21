import { describe, expect, it } from "vitest";
import { VERIFIED_PROGRAMS } from "./program-catalog.js";
import {
  MAX_RESEARCH_INTERESTS,
  RESEARCH_INTEREST_CATALOG,
  researchInterestsForProgram,
} from "./research-interest-catalog.js";

describe("verified-program research interests", () => {
  it("covers the exact 20-program verified catalog", () => {
    expect(Object.keys(RESEARCH_INTEREST_CATALOG).sort()).toEqual(
      VERIFIED_PROGRAMS.map((program) => program.code).sort(),
    );
    expect(VERIFIED_PROGRAMS).toHaveLength(20);
  });

  it("provides a useful, unique catalog for every program", () => {
    for (const interests of Object.values(RESEARCH_INTEREST_CATALOG)) {
      expect(interests.length).toBeGreaterThanOrEqual(MAX_RESEARCH_INTERESTS);
      expect(new Set(interests).size).toBe(interests.length);
      expect(interests.every((interest) => interest.length <= 80)).toBe(true);
    }
  });

  it("keeps BSIT, BSTM, and BSHM program-specific", () => {
    expect(researchInterestsForProgram("BSIT")).toContain("Cybersecurity");
    expect(researchInterestsForProgram("BSTM")).toContain(
      "Sustainable Tourism",
    );
    expect(researchInterestsForProgram("BSHM")).toContain(
      "Hospitality Operations",
    );
    expect(researchInterestsForProgram("BSTM")).not.toContain(
      "Information Systems",
    );
  });

  it("normalizes verified codes and returns no options for unknown programs", () => {
    expect(researchInterestsForProgram(" bstm ")).toEqual(
      RESEARCH_INTEREST_CATALOG.BSTM,
    );
    expect(researchInterestsForProgram("UNKNOWN")).toEqual([]);
  });
});
