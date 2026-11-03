import { z } from "zod";

const id = z.string().uuid();
const optionalId = z.preprocess(
  (v) => (v === "all" || v === "" ? undefined : v),
  id.optional(),
);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Choose a valid date")
  .optional();
export const reportTypeSchema = z.enum([
  "research-progress",
  "defense-outcomes",
  "adviser-workload",
]);
export const monitoringQuerySchema = z
  .object({
    collegeId: optionalId,
    programId: optionalId,
    academicYearId: optionalId,
    stageId: optionalId,
    researchTypeId: optionalId,
    from: date,
    to: date,
    search: z.string().trim().max(160).default(""),
    defenseType: z.string().trim().min(1).max(80).optional(),
    view: z
      .enum(["upcoming", "attention", "completed", "cancelled"])
      .default("upcoming"),
    status: z
      .enum([
        "all",
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "REVISION",
        "APPROVED",
        "DEFENSE",
        "COMPLETED",
        "ARCHIVED",
        "REJECTED",
      ])
      .default("all"),
    availability: z.enum(["all", "accepting", "closed"]).default("all"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    format: z.enum(["pdf", "csv"]).optional(),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "End date must follow start date",
    path: ["to"],
  })
  .refine((v) => !v.stageId || !v.defenseType, {
    message: "Select one defense stage",
    path: ["stageId"],
  });
export type MonitoringQuery = z.infer<typeof monitoringQuerySchema>;
export { id as monitoringIdSchema };
