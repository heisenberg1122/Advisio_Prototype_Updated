import { z } from "zod";
export const workflowStageSchema = z.object({
    name: z.string().min(2).max(100),
    description: z.string().optional(),
    sequence: z.number().int().positive(),
    responsibleRoleId: z.string().uuid("Invalid role ID"),
    requiresApproval: z.boolean().default(false),
    deadlineDays: z.number().int().positive().optional(),
    isFinal: z.boolean().default(false),
});
export const createWorkflowSchema = z.object({
    researchTypeId: z.string().uuid("Invalid research type ID"),
    name: z.string().min(3).max(150),
    description: z.string().optional(),
    stages: z.array(workflowStageSchema).min(1, "Workflow must contain at least one stage"),
});
export const workflowTransitionSchema = z.object({
    workflowInstanceId: z.string().uuid("Invalid workflow instance ID"),
    toStageId: z.string().uuid("Invalid stage ID"),
    remarks: z.string().optional(),
});
//# sourceMappingURL=workflow.js.map