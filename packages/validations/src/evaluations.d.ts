import { z } from "zod";
export declare const evaluationCriteriaSchema: z.ZodObject<{
    criterion: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    maxScore: z.ZodNumber;
    weight: z.ZodDefault<z.ZodNumber>;
    sequence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sequence: number;
    criterion: string;
    maxScore: number;
    weight: number;
    description?: string | undefined;
}, {
    sequence: number;
    criterion: string;
    maxScore: number;
    description?: string | undefined;
    weight?: number | undefined;
}>;
export declare const evaluationTemplateSchema: z.ZodObject<{
    name: z.ZodString;
    researchTypeId: z.ZodString;
    totalScore: z.ZodNumber;
    criteria: z.ZodArray<z.ZodObject<{
        criterion: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        maxScore: z.ZodNumber;
        weight: z.ZodDefault<z.ZodNumber>;
        sequence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sequence: number;
        criterion: string;
        maxScore: number;
        weight: number;
        description?: string | undefined;
    }, {
        sequence: number;
        criterion: string;
        maxScore: number;
        description?: string | undefined;
        weight?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    researchTypeId: string;
    totalScore: number;
    criteria: {
        sequence: number;
        criterion: string;
        maxScore: number;
        weight: number;
        description?: string | undefined;
    }[];
}, {
    name: string;
    researchTypeId: string;
    totalScore: number;
    criteria: {
        sequence: number;
        criterion: string;
        maxScore: number;
        description?: string | undefined;
        weight?: number | undefined;
    }[];
}>;
export declare const submitEvaluationSchema: z.ZodObject<{
    templateId: z.ZodString;
    researchId: z.ZodString;
    totalScore: z.ZodNumber;
    recommendation: z.ZodString;
    criteriaScores: z.ZodOptional<z.ZodArray<z.ZodObject<{
        criterionId: z.ZodString;
        score: z.ZodNumber;
        comment: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        criterionId: string;
        score: number;
        comment?: string | undefined;
    }, {
        criterionId: string;
        score: number;
        comment?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    researchId: string;
    recommendation: string;
    totalScore: number;
    templateId: string;
    criteriaScores?: {
        criterionId: string;
        score: number;
        comment?: string | undefined;
    }[] | undefined;
}, {
    researchId: string;
    recommendation: string;
    totalScore: number;
    templateId: string;
    criteriaScores?: {
        criterionId: string;
        score: number;
        comment?: string | undefined;
    }[] | undefined;
}>;
export type EvaluationCriteriaInput = z.infer<typeof evaluationCriteriaSchema>;
export type EvaluationTemplateInput = z.infer<typeof evaluationTemplateSchema>;
export type SubmitEvaluationInput = z.infer<typeof submitEvaluationSchema>;
//# sourceMappingURL=evaluations.d.ts.map