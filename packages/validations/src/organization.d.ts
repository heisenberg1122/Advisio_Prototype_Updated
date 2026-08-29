import { z } from "zod";
export declare const collegeSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    code: string;
    isActive: boolean;
    description?: string | undefined;
}, {
    name: string;
    code: string;
    description?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const programSchema: z.ZodObject<{
    collegeId: z.ZodString;
    code: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    code: string;
    isActive: boolean;
    collegeId: string;
    description?: string | undefined;
}, {
    name: string;
    code: string;
    collegeId: string;
    description?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const academicYearSchema: z.ZodObject<{
    name: z.ZodString;
    startDate: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    endDate: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    isCurrent: z.ZodDefault<z.ZodBoolean>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isActive: boolean;
    startDate: string | Date;
    endDate: string | Date;
    isCurrent: boolean;
}, {
    name: string;
    startDate: string | Date;
    endDate: string | Date;
    isActive?: boolean | undefined;
    isCurrent?: boolean | undefined;
}>;
export type CollegeInput = z.infer<typeof collegeSchema>;
export type ProgramInput = z.infer<typeof programSchema>;
export type AcademicYearInput = z.infer<typeof academicYearSchema>;
//# sourceMappingURL=organization.d.ts.map