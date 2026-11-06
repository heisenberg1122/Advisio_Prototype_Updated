import { describe, expect, it } from "vitest";
import { getAcademicIdentity } from "./academic-identity";

describe("signed-in academic identity", () => {
  it.each(["COA", "CEA", "CHTM", "CIT", "CNP", "SAS", "SBPA", "SOE"])(
    "resolves the official %s college logo", code => {
      expect(getAcademicIdentity({ college: { code } })?.logoSrc).toBe(`/college-logos/${code.toLowerCase()}.png`);
    },
  );

  it.each([
    ["BSA", "coa"], ["BSAIS", "coa"],
    ["BSARCH", "cea"], ["BSCE", "cea"], ["BSCPE", "cea"], ["BSIE", "cea"],
    ["BSHM", "chtm"], ["BSTM", "chtm"],
    ["BSIT", "cit"], ["BLIS", "cit"], ["BSN", "cnp"], ["BSPH", "cnp"],
    ["ABCOMM", "sas"], ["BSCRIM", "sas"], ["BHS", "sas"], ["BSPSYCH", "sas"],
    ["BSBA-MM", "sbpa"], ["BSBA-OM", "sbpa"], ["BEED", "soe"], ["BSED", "soe"],
  ])("uses the %s assignment when college details are unavailable", (code, college) => {
    expect(getAcademicIdentity({ program: { code } })?.logoSrc).toBe(`/college-logos/${college}.png`);
  });

  it("preserves the authenticated college and program names", () => {
    expect(getAcademicIdentity({
      college: { code: "CIT", name: "College of Information Technology" },
      program: { code: "BSIT", name: "Bachelor of Science in Information Technology" },
    })).toMatchObject({
      collegeName: "College of Information Technology",
      programName: "Bachelor of Science in Information Technology",
      logoSrc: "/college-logos/cit.png",
    });
  });

  it("uses an explicit college over a conflicting program and handles college aliases", () => {
    expect(getAcademicIdentity({ college: { code: "CONP" }, program: { code: "BSIT" } })?.logoSrc).toBe("/college-logos/cnp.png");
    expect(getAcademicIdentity({ college: { code: "CCS" } })?.logoSrc).toBe("/college-logos/cit.png");
  });

  it("uses the college name when a known code is unavailable", () => {
    expect(getAcademicIdentity({ college: { name: "School of Arts and Sciences" } })?.logoSrc).toBe("/college-logos/sas.png");
  });

  it("does not invent an affiliation for an unassigned account", () => {
    expect(getAcademicIdentity({})).toBeNull();
    expect(getAcademicIdentity({ college: null, program: null })).toBeNull();
    expect(getAcademicIdentity({ college: { code: "", name: "  " } })).toBeNull();
  });

  it("retains unknown assignments with the university logo instead of another college's logo", () => {
    expect(getAcademicIdentity({ college: { name: "New College", code: "NEW" }, program: { code: "BSIT" } })).toMatchObject({
      collegeName: "New College", logoSrc: "/school-logo.png", programName: "BSIT",
    });
  });
});
