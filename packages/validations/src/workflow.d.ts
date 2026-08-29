import { z } from "zod";
export declare const workflowStageSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    sequence: z.ZodNumber;
    responsibleRoleId: z.ZodString;
    requiresApproval: z.ZodDefault<z.ZodBoolean>;
    deadlineDays: z.ZodOptional<z.ZodNumber>;
    isFinal: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    sequence: number;
    responsibleRoleId: string;
    requiresApproval: boolean;
    isFinal: boolean;
    description?: string | undefined;
    deadlineDays?: number | undefined;
}, {
    name: string;
    sequence: number;
    responsibleRoleId: string;
    description?: string | undefined;
    requiresApproval?: boolean | undefined;
    deadlineDays?: number | undefined;
    isFinal?: boolean | undefined;
}>;
export declare const createWorkflowSchema: z.ZodObject<{
    researchTypeId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    stages: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        sequence: z.ZodNumber;
        responsibleRoleId: z.ZodString;
        requiresApproval: z.ZodDefault<z.ZodBoolean>;
        deadlineDays: z.ZodOptional<z.ZodNumber>;
        isFinal: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        sequence: number;
        responsibleRoleId: string;
        requiresApproval: boolean;
        isFinal: boolean;
        description?: string | undefined;
        deadlineDays?: number | undefined;
    }, {
        name: string;
        sequence: number;
        responsibleRoleId: string;
        description?: string | undefined;
        requiresApproval?: boolean | undefined;
        deadlineDays?: number | undefined;
        isFinal?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    researchTypeId: string;
    stages: {
        name: string;
        sequence: number;
        responsibleRoleId: string;
        requiresApproval: boolean;
        isFinal: boolean;
        description?: string | undefined;
        deadlineDays?: number | undefined;
    }[];
    description?: string | undefined;
}, {
    name: string;
    researchTypeId: string;
    stages: {
        name: string;
        sequence: number;
        responsibleRoleId: string;
        description?: string | undefined;
        requiresApproval?: boolean | undefined;
        deadlineDays?: number | undefined;
        isFinal?: boolean | undefined;
    }[];
    description?: string | undefined;
}>;
export declare const workflowTransitionSchema: z.ZodObject<{
    workflowInstanceId: z.ZodString;
    toStageId: z.ZodString;
    remarks: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    workflowInstanceId: string;
    toStageId: string;
    remarks?: string | undefined;
}, {
    workflowInstanceId: string;
    toStageId: string;
    remarks?: string | undefined;
}>;
export type WorkflowStageInput = z.infer<typeof workflowStageSchema>;
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type WorkflowTransitionInput = z.infer<typeof workflowTransitionSchema>;
//# sourceMappingURL=workflow.d.ts.map