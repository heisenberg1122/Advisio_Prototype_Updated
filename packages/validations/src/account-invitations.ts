import { z } from "zod";

export const invitationalRoleSchema = z.enum([
  "ADVISER",
  "RESEARCH_COORDINATOR",
  "PANELIST",
  "DEAN",
]);
export const inviteAccountSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  universityId: z
    .string()
    .trim()
    .min(1, "Institutional ID is required")
    .max(50),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  collegeId: z.string().uuid("Select a college or school"),
  roleNames: z
    .array(invitationalRoleSchema)
    .min(1, "Choose at least one role")
    .max(4)
    .transform((roles) => [...new Set(roles)]),
  verificationConfirmed: z.literal(true),
  verificationNote: z
    .string()
    .trim()
    .min(10, "Add a verification note of at least 10 characters")
    .max(1000),
});
export const invitationTokenSchema = z.object({
  token: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "This invitation link is invalid or has expired."),
});
export const acceptAccountInvitationSchema = invitationTokenSchema.extend({
  password: z
    .string()
    .min(12, "Use at least 12 characters")
    .max(72)
    .refine(
      (password) => new TextEncoder().encode(password).length <= 72,
      "Password must be at most 72 UTF-8 bytes",
    ),
});
export const reviewAccountInvitationSchema = z.object({
  verificationConfirmed: z.literal(true),
  verificationNote: z.string().trim().min(10).max(1000),
});
export type InviteAccountInput = z.infer<typeof inviteAccountSchema>;
