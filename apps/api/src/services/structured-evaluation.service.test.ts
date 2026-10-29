import { describe, it, expect } from "vitest";
import {
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFArray,
  decodePDFRawStream,
} from "pdf-lib";
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
import { validateEvaluationLogos } from "./structured-evaluation-pdf.js";
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
  it("renders the saved college branding, aligned seals, and a single final panelist name", async () => {
    const s = snapshot(3);
    s.spec.branding = {
      ...s.spec.branding!,
      collegeName: "College of Architecture",
      templateName: "ARCHITECTURE FORM 4",
      collegeLogo: s.spec.branding!.schoolLogo,
    };
    s.spec.name = "Architectural Design Proposal Evaluation";
    const bytes = await renderStructuredEvaluation(
      s,
      answers(s),
      "Panelist Unique Name",
    );
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    const streams = pdf.getPages().map((page) => {
      const contents = page.node.Contents();
      const refs =
        contents instanceof PDFArray ? contents.asArray() : [contents!];
      return refs
        .map((ref) =>
          Buffer.from(
            decodePDFRawStream(
              pdf.context.lookup(ref) as PDFRawStream,
            ).decode(),
          ).toString(),
        )
        .join("\n");
    });
    const encoded = (s: string) =>
      Buffer.from(s, "latin1").toString("hex").toUpperCase();
    const all = streams.join("\n");
    expect(all).toContain(encoded("College of Architecture"));
    expect(all).toContain(encoded("ARCHITECTURE FORM 4"));
    expect(all).toContain(encoded(s.spec.name.toUpperCase()));
    expect(all.split(encoded("Panelist Unique Name"))).toHaveLength(2);
    expect(all).not.toContain(encoded("Panelist: "));
    for (const page of pdf.getPages()) {
      const images = page.node.Resources()!.lookup(PDFName.of("XObject"));
      expect(images).toBeDefined();
    }
    // The left and right image transforms have equal dimensions and y positions.
    const transforms = [
      ...streams[0].matchAll(/([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/g),
    ].filter((m) => Number(m[1]) === 62);
    expect(transforms).toHaveLength(2);
    expect(transforms[0][2]).toBe(transforms[1][2]);
    expect(transforms[0][4]).toBe(transforms[1][4]);
  });
  it("accepts legacy forms, rejects remote logos, and validates image contents before saving", async () => {
    const form = structuredClone(defaultStructuredForm);
    delete form.branding;
    expect(structuredFormSchema.safeParse(form).success).toBe(true);
    form.branding = structuredClone(defaultStructuredForm.branding!);
    form.branding.collegeLogo = "https://example.test/logo.png";
    expect(structuredFormSchema.safeParse(form).success).toBe(false);
    form.branding.collegeLogo = "data:image/png;base64,AAAA";
    await expect(validateEvaluationLogos(form)).rejects.toThrow(/valid PNG/);
  });
  it.each([2, 6, 10])(
    "paginates aligned tables for %i rating levels and many long criteria",
    async (levels) => {
      const s = snapshot(5);
      s.spec.scale = Array.from({ length: levels }, (_, i) => ({
        value: i + 1,
        label: `Rating level ${i + 1}`,
      }));
      s.spec.presentation = Array.from({ length: 30 }, (_, i) => ({
        id: `p${i}`,
        title: `Criterion ${i + 1}: ${"Detailed criterion ".repeat(8)}`,
        weight: 1,
        description: "",
      }));
      const a = answers(s, levels);
      const bytes = await renderStructuredEvaluation(s, a, "Panelist");
      expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(5);
    },
  );
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
