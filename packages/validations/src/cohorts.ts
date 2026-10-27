import { z } from "zod";

const uuid = z.string().uuid("Invalid ID").toLowerCase();
const cohortStatus = z.enum(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]);

export const cohortParamsSchema = z.object({ id: uuid }).strict();
export const cohortMemberParamsSchema = cohortParamsSchema.extend({
  userId: uuid,
});

export const createCohortSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    description: z.string().trim().max(5000).nullable().optional(),
    collegeId: uuid,
    programId: uuid,
    researchTypeId: uuid,
    academicYearId: uuid,
  })
  .strict();

// Academic identity is immutable here; process assignment has its own endpoint.
export const updateCohortSchema = createCohortSchema
  .pick({
    name: true,
    description: true,
  })
  .partial()
  .extend({ status: cohortStatus.optional() })
  .strict()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    "Provide a cohort name, description, or status to update.",
  );

export const assignCohortWorkflowSchema = z
  .object({ workflowId: uuid })
  .strict();

// Cohort-anchored read only picker: academic scope is never supplied by clients.
export const eligibleCohortResearchersQuerySchema = z
  .object({
    search: z.string().trim().max(100).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export type EligibleCohortResearchersQuery = z.infer<
  typeof eligibleCohortResearchersQuerySchema
>;

export const addCohortMembersSchema = z
  .union([
    z.object({ userId: uuid }).strict(),
    z.object({ userIds: z.array(uuid).min(1).max(100) }).strict(),
  ])
  .transform((value) => ({
    userIds: [...new Set("userId" in value ? [value.userId] : value.userIds)],
  }));

export const cohortListQuerySchema = z
  .object({
    collegeId: uuid.optional(),
    programId: uuid.optional(),
    researchTypeId: uuid.optional(),
    academicYearId: uuid.optional(),
    status: cohortStatus.optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export type CreateCohortInput = z.infer<typeof createCohortSchema>;
export type UpdateCohortInput = z.infer<typeof updateCohortSchema>;
export type CohortListQuery = z.infer<typeof cohortListQuerySchema>;
