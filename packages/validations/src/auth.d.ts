import { z } from "zod";
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const registerSchema: z.ZodObject<{
    universityId: z.ZodString;
    email: z.ZodString;
    firstName: z.ZodString;
    middleName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodString;
    password: z.ZodString;
    collegeId: z.ZodOptional<z.ZodString>;
    programId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    universityId: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    collegeId?: string | undefined;
    middleName?: string | undefined;
    programId?: string | undefined;
}, {
    universityId: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    collegeId?: string | undefined;
    middleName?: string | undefined;
    programId?: string | undefined;
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
    newPassword: string;
}, {
    token: string;
    newPassword: string;
}>;
export declare const userProfileSchema: z.ZodObject<{
    firstName: z.ZodString;
    middleName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodString;
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName: string;
    lastName: string;
    middleName?: string | undefined;
    phone?: string | undefined;
    bio?: string | undefined;
}, {
    email: string;
    firstName: string;
    lastName: string;
    middleName?: string | undefined;
    phone?: string | undefined;
    bio?: string | undefined;
}>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
//# sourceMappingURL=auth.d.ts.map