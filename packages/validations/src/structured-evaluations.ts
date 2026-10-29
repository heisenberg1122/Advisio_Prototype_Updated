import { z } from "zod";
import {
  schoolLogo,
  informationTechnologyLogo,
} from "./evaluation-branding-assets.js";

// Embedded, bounded PNGs keep a published form independent of mutable URLs.
const logo = z
  .string()
  .max(350000)
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/)
  .or(z.literal(""));
export const evaluationBrandingSchema = z.object({
  schoolName: z.string().trim().min(1).max(150),
  schoolAddress: z.string().trim().min(1).max(250),
  collegeName: z.string().trim().min(1).max(150),
  templateName: z.string().trim().min(1).max(150),
  schoolLogo: logo,
  collegeLogo: logo,
});
export type EvaluationBranding = z.infer<typeof evaluationBrandingSchema>;
export const defaultEvaluationBranding: EvaluationBranding = {
  schoolName: "UNIVERSITY of the ASSUMPTION",
  schoolAddress:
    "Unisite Subdivision, Del Pilar, City of San Fernando, 2000 Pampanga, Philippines",
  collegeName: "College of Information Technology",
  templateName: "CAPSTONE PROJECT FORM 4",
  schoolLogo,
  collegeLogo: informationTechnologyLogo,
};

export const defenseResults = [
  "APPROVED",
  "APPROVED_WITH_MINOR_REVISIONS",
  "MAJOR_REVISIONS_REQUIRED",
  "REDEFENSE_REQUIRED",
  "REJECTED",
] as const;
export const defenseResultLabels: Record<
  (typeof defenseResults)[number],
  string
> = {
  APPROVED: "Approved",
  APPROVED_WITH_MINOR_REVISIONS: "Approved with Minor Revisions",
  MAJOR_REVISIONS_REQUIRED: "Approved with Major Revisions",
  REDEFENSE_REQUIRED: "Re-Defense Required",
  REJECTED: "Disapproved",
};
const criterion = z.object({
  id: z.string().min(1).max(80),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(1000).default(""),
  weight: z.number().finite().positive().max(100),
});
export const structuredFormSchema = z
  .object({
    name: z.string().trim().min(3).max(150),
    branding: evaluationBrandingSchema.optional(),
    scale: z
      .array(
        z.object({
          value: z.number().int().min(1).max(10),
          label: z.string().trim().min(1).max(50),
        }),
      )
      .min(2)
      .max(10),
    presentation: z.array(criterion).min(1).max(30),
    manuscript: z.array(criterion).min(1).max(30),
    feedbackLabel: z
      .string()
      .trim()
      .min(1)
      .max(150)
      .default("Panel recommendation / required revisions"),
    feedbackPrompt: z
      .string()
      .max(1000)
      .default("Record feedback and required revisions."),
    signatureRequired: z.boolean().default(false),
  })
  .superRefine((form, ctx) => {
    if (form.scale.some((s, i) => s.value !== i + 1))
      ctx.addIssue({
        code: "custom",
        message: "Rating values must run consecutively from 1.",
        path: ["scale"],
      });
    const ids = [...form.presentation, ...form.manuscript].map((c) => c.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Criterion identifiers must be unique.",
      });
  });
export type StructuredForm = z.infer<typeof structuredFormSchema>;
export type DefenseResult = (typeof defenseResults)[number];
export type EvaluationRoster = { userId: string; name: string }[];
export type StructuredAnswers = {
  researchers: Record<string, Record<string, number>>;
  manuscript: Record<string, number>;
  recommendation: DefenseResult | "";
  feedback: string;
  signature: string;
};
export const structuredAnswersSchema = z.object({
  researchers: z.record(z.record(z.number().int())),
  manuscript: z.record(z.number().int()),
  recommendation: z.union([z.enum(defenseResults), z.literal("")]),
  feedback: z.string().max(20000),
  signature: z.string().max(150).default(""),
});
export const defaultStructuredForm: StructuredForm = {
  name: "Capstone Proposal Defense Evaluation",
  branding: defaultEvaluationBranding,
  scale: ["Very Poor", "Poor", "Fair", "Good", "Very Good"].map((label, i) => ({
    value: i + 1,
    label,
  })),
  presentation: [
    ["Confidence, grooming and poise", 4],
    ["Mastery of the proposal", 6],
    ["Ability to answer questions", 9],
    ["Utilization of visual aids", 1],
  ].map(([title, weight], i) => ({
    id: `p${i}`,
    title: String(title),
    weight: Number(weight),
    description: "",
  })),
  manuscript: [
    ["Format / presentation", 2],
    ["Appropriateness of the proposal", 2],
    ["Social impact and relevance", 2],
    ["Presentation of arguments", 2],
    ["Suitability of sampling design", 2],
    ["Technical viability", 4],
    ["Market potential", 2],
    ["Overall content", 4],
  ].map(([title, weight], i) => ({
    id: `m${i}`,
    title: String(title),
    weight: Number(weight),
    description: "",
  })),
  feedbackLabel: "Panel recommendation / required revisions",
  feedbackPrompt:
    "Record feedback, suggested improvements, and required revisions.",
  signatureRequired: false,
};
export function sectionMaximum(
  criteria: StructuredForm["presentation"],
  scale: StructuredForm["scale"],
) {
  return criteria.reduce(
    (sum, c) => sum + c.weight * Math.max(...scale.map((s) => s.value)),
    0,
  );
}
export function sectionScore(
  criteria: StructuredForm["presentation"],
  ratings: Record<string, number>,
) {
  return criteria.reduce((sum, c) => sum + (ratings[c.id] || 0) * c.weight, 0);
}
