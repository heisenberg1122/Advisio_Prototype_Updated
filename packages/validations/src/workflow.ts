import { z } from "zod";

export const workflowStageSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  sequence: z.number().int().positive(),
  responsibleRoleId: z.string().uuid("Invalid role ID"),
  requiresApproval: z.boolean().default(false),
  deadlineDays: z.number().int().positive().optional(),
  isFinal: z.boolean().default(false),
  submissionMode: z.enum(["INDIVIDUAL", "GROUP", "EITHER"]).default("EITHER"),
});

export const createWorkflowSchema = z.object({
  researchTypeId: z.string().uuid("Invalid research type ID"),
  name: z.string().trim().min(3).max(150),
  description: z.string().optional(),
  availabilityMode: z
    .enum(["LEGACY_SEQUENCE", "PREREQUISITES"])
    .default("PREREQUISITES"),
  stages: z.array(workflowStageSchema).default([]),
});

export const milestonePrerequisitesSchema = z.object({
  prerequisiteIds: z
    .array(z.string().uuid("Invalid prerequisite milestone ID"))
    .max(100)
    .optional(),
  capturesResearchTitle: z.boolean().optional(),
});

export const milestoneDecisionSchema = z.object({
  action: z.enum(["REQUEST_REVISION", "APPROVE", "RECONFIRM"]),
  reason: z
    .string()
    .trim()
    .min(3, "Explain the reason for this decision.")
    .max(4000),
  taskIds: z.array(z.string().uuid()).max(100).optional(),
});

export const createWorkflowTopicSchema = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const updateWorkflowTopicSchema = createWorkflowTopicSchema
  .partial()
  .refine(
    (value) => value.title !== undefined || value.description !== undefined,
    "Provide a topic title or description to update.",
  );

export const reorderWorkflowTopicsSchema = z.object({
  topicIds: z.array(z.string().uuid("Invalid topic ID")).min(1),
});

export const workflowTransitionSchema = z.object({
  workflowInstanceId: z.string().uuid("Invalid workflow instance ID"),
  toStageId: z.string().uuid("Invalid stage ID"),
  remarks: z.string().optional(),
});

export type WorkflowStageInput = z.infer<typeof workflowStageSchema>;
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type CreateWorkflowTopicInput = z.infer<
  typeof createWorkflowTopicSchema
>;
export type UpdateWorkflowTopicInput = z.infer<
  typeof updateWorkflowTopicSchema
>;
export type WorkflowTransitionInput = z.infer<typeof workflowTransitionSchema>;
