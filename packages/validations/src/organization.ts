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
  isActive: z.boolean().default(true),
});

export const academicYearSchema = z.object({
  name: z.string().regex(/^\d{4}-\d{4}$/, "Academic year format must be YYYY-YYYY"),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  isCurrent: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type CollegeInput = z.infer<typeof collegeSchema>;
export type ProgramInput = z.infer<typeof programSchema>;
export type AcademicYearInput = z.infer<typeof academicYearSchema>;
