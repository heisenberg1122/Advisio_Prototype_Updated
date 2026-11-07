import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { EVALUATION_COURSES } from "./catalog.js";
import { demoEvaluationForm, evaluationAsset } from "./branding.js";
import { ROLE_SCENARIOS, scenarioTasks } from "./scenarios.js";
import { manuscript } from "./manuscript.js";

describe("readable fictional research documents", () => {
  it("renders every discipline and all three revisions without overflowing", async () => {
    for (const course of EVALUATION_COURSES)
      for (const version of [1, 2, 3]) {
        const buffer = await manuscript(course, version);
        const pdf = await PDFDocument.load(buffer);
        expect(pdf.getPageCount()).toBe(5);
        expect(pdf.getTitle()).toContain("Fictional evaluation sample");
        expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
      }
  }, 15000);
});

describe("role scenarios and discipline branding", () => {
  it("preserves the four student stages and adds Fresh account to every role", () => {
    expect(ROLE_SCENARIOS.student.map((s) => s.id)).toEqual([
      "in-progress",
      "live-defense",
      "completed-title",
      "completed-final",
      "fresh-account",
    ]);
    expect(Object.keys(ROLE_SCENARIOS).sort()).toEqual([
      "adviser",
      "dean",
      "panelist",
      "professor",
      "student",
    ]);
    for (const [role, scenarios] of Object.entries(ROLE_SCENARIOS)) {
      expect(scenarios[0].id).not.toBe("fresh-account");
      expect(
        scenarios.filter((scenario) => scenario.id === "fresh-account"),
      ).toEqual([
        { id: "fresh-account", label: "Fresh account", project: null },
      ]);
      expect(new Set(scenarios.map((s) => s.id)).size).toBe(scenarios.length);
      for (const scenario of scenarios)
        expect(
          scenarioTasks(
            role as keyof typeof ROLE_SCENARIOS,
            scenario.id,
            Array(6).fill("task"),
          ),
        ).toHaveLength(6);
    }
    expect(ROLE_SCENARIOS.dean.some((s) => s.id === "pending-signature")).toBe(
      true,
    );
    expect(ROLE_SCENARIOS.panelist.some((s) => s.id === "review-history")).toBe(
      true,
    );
  });
  it("uses the provided college logos and program-specific title and final forms", async () => {
    const logos = new Map<string, string>();
    for (const course of EVALUATION_COURSES) {
      const title = await demoEvaluationForm(course),
        final = await demoEvaluationForm(course, true);
      expect(title.name).toContain("Title Defense Evaluation");
      expect(final.name).toContain("Final Defense Evaluation");
      expect(/Capstone/.test(title.name)).toBe(course.id === "BSIT");
      const logo = title.branding!.collegeLogo;
      expect(logo).toBe(await evaluationAsset(`${course.collegeCode}.png`));
      expect(logo.length).toBeLessThan(350000);
      const bytes = Buffer.from(logo.split(",")[1], "base64");
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      expect(bytes.readUInt32BE(16)).toBeLessThanOrEqual(1024);
      expect(bytes.readUInt32BE(20)).toBeLessThanOrEqual(1024);
      logos.set(course.collegeCode, logo);
    }
    expect(new Set(logos.values()).size).toBe(8);
    await expect(evaluationAsset("../outside.png")).rejects.toThrow();
  });
  it("includes the final manuscript results and conclusions", async () => {
    const pdf = await PDFDocument.load(
      await manuscript(EVALUATION_COURSES[0], 2, true),
    );
    expect(pdf.getPageCount()).toBe(7);
  });
});
