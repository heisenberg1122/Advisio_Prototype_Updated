import { z } from "zod";
export declare const researchTypeSchema: z.ZodObject<{
    programId: z.ZodString;
    name: z.ZodString;
    code: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    workflowId: z.ZodOptional<z.ZodString>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    code: string;
    isActive: boolean;
    programId: string;
    description?: string | undefined;
    workflowId?: string | undefined;
}, {
    name: string;
    code: string;
    programId: string;
    description?: string | undefined;
    isActive?: boolean | undefined;
    workflowId?: string | undefined;
}>;
export declare const createResearchSchema: z.ZodObject<{
    researchTypeId: z.ZodString;
    programId: z.ZodString;
    collegeId: z.ZodString;
    academicYearId: z.ZodString;
    title: z.ZodString;
    abstract: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    collegeId: string;
    programId: string;
    researchTypeId: string;
    academicYearId: string;
    title: string;
    abstract?: string | undefined;
}, {
    collegeId: string;
    programId: string;
    researchTypeId: string;
    academicYearId: string;
    title: string;
    abstract?: string | undefined;
}>;
export declare const updateResearchSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    abstract: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["DRAFT", "SUBMITTED", "UNDER_REVIEW", "REVISION", "APPROVED", "DEFENSE", "COMPLETED", "ARCHIVED", "REJECTED"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "REVISION" | "APPROVED" | "DEFENSE" | "COMPLETED" | "ARCHIVED" | "REJECTED" | undefined;
    title?: string | undefined;
    abstract?: string | undefined;
}, {
    status?: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "REVISION" | "APPROVED" | "DEFENSE" | "COMPLETED" | "ARCHIVED" | "REJECTED" | undefined;
    title?: string | undefined;
    abstract?: string | undefined;
}>;
export declare const assignMemberSchema: z.ZodObject<{
    researchId: z.ZodString;
    userId: z.ZodString;
    projectRole: z.ZodEnum<["LEADER", "MEMBER", "ADVISER", "PANELIST", "COORDINATOR"]>;
}, "strip", z.ZodTypeAny, {
    researchId: string;
    userId: string;
    projectRole: "LEADER" | "MEMBER" | "ADVISER" | "PANELIST" | "COORDINATOR";
}, {
    researchId: string;
    userId: string;
    projectRole: "LEADER" | "MEMBER" | "ADVISER" | "PANELIST" | "COORDINATOR";
}>;
export type ResearchTypeInput = z.infer<typeof researchTypeSchema>;
export type CreateResearchInput = z.infer<typeof createResearchSchema>;
export type UpdateResearchInput = z.infer<typeof updateResearchSchema>;
export type AssignMemberInput = z.infer<typeof assignMemberSchema>;
//# sourceMappingURL=research.d.ts.map