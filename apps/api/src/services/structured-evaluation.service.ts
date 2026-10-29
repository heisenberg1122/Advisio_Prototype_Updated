import { createHash } from "node:crypto";
import { renderEvaluationPdf } from "./structured-evaluation-pdf.js";
import {
  structuredFormSchema,
  structuredAnswersSchema,
  sectionMaximum,
  sectionScore,
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

export async function renderStructuredEvaluation(
  snapshot: FormSnapshot,
  answers: StructuredAnswers,
  panelistName: string,
) {
  const { totals } = scoreStructuredEvaluation(snapshot, answers, true);
  return renderEvaluationPdf(snapshot, answers, panelistName, totals);
}
export const evaluationPdfHash = (data: Uint8Array) =>
  createHash("sha256").update(data).digest("hex");
