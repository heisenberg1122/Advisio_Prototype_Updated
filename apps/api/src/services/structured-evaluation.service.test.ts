import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  defaultStructuredForm,
  structuredFormSchema,
  type StructuredAnswers,
} from "@research-management/validations";
import {
  scoreStructuredEvaluation,
  consolidatedScores,
  renderStructuredEvaluation,
  evaluationPdfHash,
  type FormSnapshot,
} from "./structured-evaluation.service.js";
const snapshot = (count = 3): FormSnapshot => ({
  spec: structuredClone(defaultStructuredForm),
  roster: Array.from({ length: count }, (_, i) => ({
    userId: `s${i}`,
    name: `Researcher ${i + 1}`,
  })),
  panelists: Array.from({ length: 4 }, (_, i) => ({
    userId: `p${i}`,
    name: `Panelist ${i + 1}`,
    required: true,
  })),
  researchTitle: "Team Yuno proposal",
  manuscriptVersionId: "version-1",
  publishedAt: "2026-10-28T00:00:00Z",
});
const answers = (s: FormSnapshot, rating = 5): StructuredAnswers => ({
  researchers: Object.fromEntries(
    s.roster.map((r) => [
      r.userId,
      Object.fromEntries(s.spec.presentation.map((c) => [c.id, rating])),
    ]),
  ),
  manuscript: Object.fromEntries(s.spec.manuscript.map((c) => [c.id, rating])),
  recommendation: "APPROVED",
  feedback: "",
  signature: "",
});
describe("structured defense evaluations", () => {
  it.each([1, 3, 4, 5])("scores each of %i researchers separately", (count) => {
    const s = snapshot(count),
      a = answers(s);
    const r = scoreStructuredEvaluation(s, a, true);
    expect(r.totals.researchers).toHaveLength(count);
    expect(r.totals.researchers.map((t) => t.score)).toEqual(
      Array(count).fill(100),
    );
    expect(r.totals.manuscript).toEqual({ score: 100, maximum: 100 });
  });
  it("uses rating times weight and supports a six-level scale", () => {
    const s = snapshot(1);
    s.spec.scale.push({ value: 6, label: "Excellent" });
    const a = answers(s, 6);
    a.researchers.s0.p0 = 4;
    const r = scoreStructuredEvaluation(s, a, true);
    expect(r.totals.researchers[0]).toMatchObject({ score: 112, maximum: 120 });
    expect(r.totals.manuscript.score).toBe(120);
  });
  it("allows partial drafts but rejects unanswered finals, zeros, unknown criteria and forged researchers", () => {
    const s = snapshot(1),
      a = answers(s);
    delete a.researchers.s0.p0;
    expect(() => scoreStructuredEvaluation(s, a, false)).not.toThrow();
    expect(() => scoreStructuredEvaluation(s, a, true)).toThrow(/Rate every/);
    a.researchers.s0.p0 = 0;
    expect(() => scoreStructuredEvaluation(s, a, false)).toThrow(
      /configured rating/,
    );
    a.researchers.s0.p0 = 5;
    a.researchers.s0.unknown = 5;
    expect(() => scoreStructuredEvaluation(s, a, false)).toThrow(
      /unknown criterion/,
    );
    delete a.researchers.s0.unknown;
    a.researchers.forged = { p0: 5 };
    expect(() => scoreStructuredEvaluation(s, a, false)).toThrow(/outside/);
  });
  it.each([
    "APPROVED_WITH_MINOR_REVISIONS",
    "MAJOR_REVISIONS_REQUIRED",
    "REDEFENSE_REQUIRED",
  ] as const)("requires instructions for %s", (decision) => {
    const s = snapshot(1),
      a = answers(s);
    a.recommendation = decision;
    expect(() => scoreStructuredEvaluation(s, a, true)).toThrow(/instructions/);
    a.feedback = "Clarify the methodology.";
    expect(() => scoreStructuredEvaluation(s, a, true)).not.toThrow();
  });
  it("does not count missing, draft, optional or removed panelists as zero", () => {
    const s = snapshot(1);
    s.panelists.push({ userId: "optional", name: "Observer", required: false });
    const data = [
      { panelistId: "p0", lockedAt: new Date(), answers: answers(s, 4) },
      { panelistId: "p1", lockedAt: null, answers: answers(s, 1) },
      { panelistId: "optional", lockedAt: new Date(), answers: answers(s, 1) },
      { panelistId: "removed", lockedAt: new Date(), answers: answers(s, 1) },
    ];
    const report = consolidatedScores(s, data);
    expect(report.researchers[0].average).toBe(80);
    expect(report.manuscript.average).toBe(80);
    expect(report.final).toBe(false);
    expect(report.submitted).toBe(1);
    expect(consolidatedScores(s, []).researchers[0].average).toBeNull();
  });
  it("finalizes arithmetic averages only after all four required submissions", () => {
    const s = snapshot(1);
    const report = consolidatedScores(
      s,
      [1, 2, 4, 5].map((r, i) => ({
        panelistId: `p${i}`,
        lockedAt: new Date(),
        answers: answers(s, r),
      })),
    );
    expect(report.researchers[0].average).toBe(60);
    expect(report.final).toBe(true);
    expect(report.submitted).toBe(4);
  });
  it("validates template scales, unique criterion IDs and weights", () => {
    const form = structuredClone(defaultStructuredForm);
    form.presentation[0].weight = 0;
    expect(structuredFormSchema.safeParse(form).success).toBe(false);
    form.presentation[0].weight = 4;
    form.scale[1].value = 3;
    expect(structuredFormSchema.safeParse(form).success).toBe(false);
    form.scale[1].value = 2;
    form.manuscript[0].id = form.presentation[0].id;
    expect(structuredFormSchema.safeParse(form).success).toBe(false);
  });
  it("generates multipage PDFs for five students, long feedback and long unbroken text", async () => {
    const s = snapshot(5),
      a = answers(s);
    a.feedback = "Recommendations " + "LongWord".repeat(1200);
    const bytes = await renderStructuredEvaluation(s, a, "Panelist Peña");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(evaluationPdfHash(bytes)).toHaveLength(64);
  });
});
