import { z } from "zod";

export const collegeSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(3).max(150),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const programSchema = z.object({
  collegeId: z.string().uuid("Invalid college ID"),
  code: z.string().min(2).max(20),
  name: z.string().min(3).max(150),
  description: z.string().optional(),
  hasMajors: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const passwordSchema = z
  .string()
  .min(1, "Enter your password to confirm this change");

export const programMajorSchema = z.object({
  code: z.string().trim().min(2).max(20).optional().or(z.literal("")),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(1000).optional(),
});

export const collegeMutationSchema = collegeSchema.extend({
  password: passwordSchema,
});
export const collegeUpdateSchema = collegeSchema
  .omit({ isActive: true })
  .partial()
  .extend({ password: passwordSchema, isActive: z.boolean().optional() });

export const programMutationSchema = programSchema.extend({
  password: passwordSchema,
  majors: z.array(programMajorSchema).max(20).optional(),
});
export const programUpdateSchema = programSchema
  .omit({ isActive: true })
  .partial()
  .extend({ password: passwordSchema, isActive: z.boolean().optional() });

export const programMajorMutationSchema = programMajorSchema.extend({
  password: passwordSchema,
});
export const programMajorUpdateSchema = programMajorSchema
  .partial()
  .extend({ password: passwordSchema, isActive: z.boolean().optional() });

export const academicYearSchema = z.object({
  name: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "Academic year format must be YYYY-YYYY"),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  isCurrent: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type CollegeInput = z.infer<typeof collegeSchema>;
export type ProgramInput = z.infer<typeof programSchema>;
export type AcademicYearInput = z.infer<typeof academicYearSchema>;
