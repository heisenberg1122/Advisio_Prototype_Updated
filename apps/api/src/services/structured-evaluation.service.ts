import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  structuredFormSchema,
  structuredAnswersSchema,
  sectionMaximum,
  sectionScore,
  defenseResultLabels,
  type StructuredForm,
  type EvaluationRoster,
  type StructuredAnswers,
} from "@research-management/validations";

export class StructuredEvaluationError extends Error {
  constructor(
    message: string,
    public statusCode = 409,
  ) {
    super(message);
  }
}
export type FormSnapshot = {
  spec: StructuredForm;
  roster: EvaluationRoster;
  panelists: { userId: string; name: string; required: boolean }[];
  researchTitle: string;
  manuscriptVersionId: string;
  publishedAt: string | null;
};
export function readForm(value: unknown): FormSnapshot {
  const snapshot = value as FormSnapshot;
  if (!snapshot?.roster?.length || !snapshot.panelists?.length)
    throw new StructuredEvaluationError(
      "Publish a structured evaluation form first.",
    );
  return { ...snapshot, spec: structuredFormSchema.parse(snapshot.spec) };
}
export function scoreStructuredEvaluation(
  snapshot: FormSnapshot,
  value: unknown,
  final: boolean,
) {
  const a = structuredAnswersSchema.parse(value),
    { spec, roster } = snapshot;
  const allowed = new Set(spec.scale.map((s) => s.value));
  const check = (
    criteria: StructuredForm["presentation"],
    ratings: Record<string, number>,
  ) => {
    if (Object.keys(ratings).some((id) => !criteria.some((c) => c.id === id)))
      throw new StructuredEvaluationError(
        "The evaluation contains an unknown criterion.",
        400,
      );
    if (Object.values(ratings).some((r) => !allowed.has(r)))
      throw new StructuredEvaluationError(
        "Select a configured rating for every answered criterion.",
        400,
      );
    if (final && criteria.some((c) => ratings[c.id] === undefined))
      throw new StructuredEvaluationError(
        "Rate every criterion for every researcher and the manuscript.",
        400,
      );
  };
  if (
    Object.keys(a.researchers).some(
      (id) => !roster.some((r) => r.userId === id),
    )
  )
    throw new StructuredEvaluationError(
      "The evaluation contains a researcher outside the published roster.",
      400,
    );
  for (const r of roster)
    check(spec.presentation, a.researchers[r.userId] || {});
  check(spec.manuscript, a.manuscript);
  if (final && !a.recommendation)
    throw new StructuredEvaluationError(
      "Select a recommended defense result.",
      400,
    );
  if (
    final &&
    [
      "APPROVED_WITH_MINOR_REVISIONS",
      "MAJOR_REVISIONS_REQUIRED",
      "REDEFENSE_REQUIRED",
    ].includes(a.recommendation) &&
    a.feedback.trim().length < 10
  )
    throw new StructuredEvaluationError(
      "Provide clear revision or re-defense instructions (at least 10 characters).",
      400,
    );
  const totals = {
    researchers: roster.map((r) => ({
      ...r,
      score: sectionScore(spec.presentation, a.researchers[r.userId] || {}),
      maximum: sectionMaximum(spec.presentation, spec.scale),
    })),
    manuscript: {
      score: sectionScore(spec.manuscript, a.manuscript),
      maximum: sectionMaximum(spec.manuscript, spec.scale),
    },
  };
  return { answers: a, totals };
}
export function consolidatedScores(
  snapshot: FormSnapshot,
  evaluations: { panelistId: string; lockedAt: unknown; answers: unknown }[],
) {
  const required = snapshot.panelists.filter((p) => p.required);
  const panels = snapshot.panelists.map((p) => {
    const e = evaluations.find((e) => e.panelistId === p.userId && e.lockedAt);
    return {
      ...p,
      submitted: Boolean(e),
      ...(e ? scoreStructuredEvaluation(snapshot, e.answers, true) : {}),
    };
  });
  const counted = panels.filter((p) => p.required && p.submitted);
  const average = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  return {
    panels,
    submitted: counted.length,
    required: required.length,
    final: required.length > 0 && counted.length === required.length,
    researchers: snapshot.roster.map((r) => ({
      ...r,
      average: average(
        counted.map(
          (p) =>
            p.totals!.researchers.find((s) => s.userId === r.userId)!.score,
        ),
      ),
      maximum: sectionMaximum(snapshot.spec.presentation, snapshot.spec.scale),
    })),
    manuscript: {
      average: average(counted.map((p) => p.totals!.manuscript.score)),
      maximum: sectionMaximum(snapshot.spec.manuscript, snapshot.spec.scale),
    },
  };
}

// Fixed-width character fallback keeps arbitrary names/comments printable with
// the bundled standard font, without allowing unsupported glyphs to fail submission.
const printable = (s: string) =>
  s
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e\xa0-\xff\n]/g, "?");
export async function renderStructuredEvaluation(
  snapshot: FormSnapshot,
  answers: StructuredAnswers,
  panelistName: string,
) {
  const { totals } = scoreStructuredEvaluation(snapshot, answers, true);
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]),
    y = 790;
  const line = (value: string, strong = false, size = 10) => {
    const text = printable(value),
      f = strong ? bold : font;
    for (const paragraph of text.split("\n")) {
      let current = "";
      const flush = () => {
        if (y < 62) {
          page = pdf.addPage([595, 842]);
          y = 790;
        }
        page.drawText(current, {
          x: 44,
          y,
          size,
          font: f,
          color: rgb(0.09, 0.17, 0.24),
        });
        y -= size + 6;
      };
      for (const word of paragraph.split(/\s+/)) {
        // Split overlong words as well as wrapping ordinary prose.
        for (const part of word.match(/.{1,65}/g) || [""]) {
          if (
            f.widthOfTextAtSize((current ? current + " " : "") + part, size) >
              505 &&
            current
          ) {
            flush();
            current = "";
          }
          current += (current ? " " : "") + part;
        }
      }
      flush();
    }
  };
  line(snapshot.spec.name, true, 16);
  line(snapshot.researchTitle, true, 12);
  line(`Panelist: ${panelistName}`);
  line(`Published manuscript: ${snapshot.manuscriptVersionId}`);
  line(snapshot.spec.scale.map((s) => `${s.value}: ${s.label}`).join(" | "));
  for (const r of snapshot.roster) {
    y -= 10;
    line(`Individual presentation - ${r.name}`, true, 12);
    for (const c of snapshot.spec.presentation)
      line(
        `${c.title}: ${answers.researchers[r.userId][c.id]} x ${c.weight} = ${answers.researchers[r.userId][c.id] * c.weight}`,
      );
    const t = totals.researchers.find((t) => t.userId === r.userId)!;
    line(
      `Presentation total: ${t.score.toFixed(2)} / ${t.maximum.toFixed(2)}`,
      true,
    );
  }
  y -= 10;
  line("Group manuscript", true, 12);
  for (const c of snapshot.spec.manuscript)
    line(
      `${c.title}: ${answers.manuscript[c.id]} x ${c.weight} = ${answers.manuscript[c.id] * c.weight}`,
    );
  line(
    `Manuscript total: ${totals.manuscript.score.toFixed(2)} / ${totals.manuscript.maximum.toFixed(2)}`,
    true,
  );
  y -= 10;
  line(snapshot.spec.feedbackLabel, true, 12);
  line(answers.feedback || "No additional feedback.");
  line(
    `Recommended defense result: ${defenseResultLabels[answers.recommendation as keyof typeof defenseResultLabels]}`,
    true,
  );
  if (answers.signature) line(`Electronic signature: ${answers.signature}`);
  line("Official defense result is released separately by the facilitator.");
  for (const [i, p] of pdf.getPages().entries())
    p.drawText(
      `Advisio - Evaluation | Page ${i + 1} of ${pdf.getPageCount()}`,
      { x: 44, y: 30, size: 8, font, color: rgb(0.35, 0.4, 0.45) },
    );
  return Buffer.from(await pdf.save());
}
export const evaluationPdfHash = (data: Uint8Array) =>
  createHash("sha256").update(data).digest("hex");
