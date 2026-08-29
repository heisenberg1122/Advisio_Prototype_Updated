import { z } from "zod";
export const researchTypeSchema = z.object({
    programId: z.string().uuid("Invalid program ID"),
    name: z.string().min(2).max(100),
    code: z.string().min(2).max(20),
    description: z.string().optional(),
    workflowId: z.string().uuid("Invalid workflow ID").optional(),
    isActive: z.boolean().default(true),
});
export const createResearchSchema = z.object({
    researchTypeId: z.string().uuid("Invalid research type ID"),
    programId: z.string().uuid("Invalid program ID"),
    collegeId: z.string().uuid("Invalid college ID"),
    academicYearId: z.string().uuid("Invalid academic year ID"),
    title: z.string().min(5, "Title must be at least 5 characters"),
    abstract: z.string().optional(),
});
export const updateResearchSchema = z.object({
    title: z.string().min(5).optional(),
    abstract: z.string().optional(),
    status: z.enum([
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "REVISION",
        "APPROVED",
        "DEFENSE",
        "COMPLETED",
        "ARCHIVED",
        "REJECTED",
    ]).optional(),
});
export const assignMemberSchema = z.object({
    researchId: z.string().uuid("Invalid research ID"),
    userId: z.string().uuid("Invalid user ID"),
    projectRole: z.enum(["LEADER", "MEMBER", "ADVISER", "PANELIST", "COORDINATOR"]),
});
//# sourceMappingURL=research.js.map