import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  universityId: z.string().min(1, "University ID is required"),
  email: z.string().email("Invalid institutional email"),
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  collegeId: z.string().uuid("Invalid college ID").optional(),
  programId: z.string().uuid("Invalid program ID").optional(),
  role: z.string().optional(),
});

export const researcherOnboardingSchema = z.object({
  onboardingToken: z.string().min(32, "Invalid onboarding link"),
  collegeId: z.string().uuid("Select a valid college or graduate school"),
  programId: z.string().uuid("Select a valid program"),
  academicYearId: z.string().uuid("Select a valid academic year"),
  degreeLevel: z.enum(["UNDERGRADUATE", "MASTERS", "DOCTORATE", "OTHER"]),
  otherDegreeLevel: z.string().trim().max(100).optional(),
  yearLevel: z.string().trim().max(50).optional(),
  academicStage: z.string().trim().max(50).optional(),
  academicTerm: z.string().trim().min(1, "Academic term is required").max(50),
  researchStatus: z.string().trim().max(50).optional(),
  groupSetup: z.string().trim().max(50).optional(),
  invitationCode: z.string().trim().max(100).optional(),
  tentativeTitle: z.string().trim().max(300).optional(),
  researchType: z.enum(["INDIVIDUAL", "GROUP"]).optional(),
  interests: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
}).superRefine((data, ctx) => {
  if (data.degreeLevel === "UNDERGRADUATE" && !data.yearLevel) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["yearLevel"], message: "Year level is required for undergraduate researchers" });
  }
  if (["MASTERS", "DOCTORATE"].includes(data.degreeLevel) && !data.academicStage) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["academicStage"], message: "Academic stage is required for graduate researchers" });
  }
  if (data.degreeLevel === "OTHER" && !data.otherDegreeLevel) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherDegreeLevel"], message: "Please specify the degree level" });
  }
  if (data.groupSetup === "JOIN_GROUP" && !data.invitationCode) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["invitationCode"], message: "Enter the group invitation code" });
  }
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const userProfileSchema = z.object({
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  bio: z.string().max(500).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResearcherOnboardingInput = z.infer<typeof researcherOnboardingSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
