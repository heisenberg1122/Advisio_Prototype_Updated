import { z } from "zod";
export const evaluationCriteriaSchema = z.object({
    criterion: z.string().min(2).max(150),
    description: z.string().optional(),
    maxScore: z.number().positive(),
    weight: z.number().min(0).max(1).default(1),
    sequence: z.number().int(),
});
export const evaluationTemplateSchema = z.object({
    name: z.string().min(3).max(150),
    researchTypeId: z.string().uuid("Invalid research type ID"),
    totalScore: z.number().positive(),
    criteria: z.array(evaluationCriteriaSchema).min(1, "Template must include criteria"),
});
export const submitEvaluationSchema = z.object({
    templateId: z.string().uuid("Invalid template ID"),
    researchId: z.string().uuid("Invalid research ID"),
    totalScore: z.number().min(0),
    recommendation: z.string().min(1, "Recommendation is required"),
    criteriaScores: z.array(z.object({
        criterionId: z.string().uuid(),
        score: z.number().min(0),
        comment: z.string().optional(),
    })).optional(),
});
//# sourceMappingURL=evaluations.js.map