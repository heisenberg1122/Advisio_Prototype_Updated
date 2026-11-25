import { z } from "zod";

export const invitationalRoleSchema = z.enum([
  "ADVISER",
  "RESEARCH_COORDINATOR",
  "PANELIST",
  "DEAN",
]);
export const invitationProfileSchema = z.object({
  universityId: z
    .string()
    .trim()
    .min(1, "Institutional ID is required")
    .max(50),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
});
export const facultyVerificationNoteRequired =
  "Add a verification note of at least 10 characters for this faculty access request.";

export const inviteAccountSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    ...invitationProfileSchema.partial().shape,
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
      .max(1000)
      .optional(),
  })
  .refine(
    ({ firstName, lastName, universityId }) =>
      (!firstName && !lastName && !universityId) ||
      Boolean(firstName && lastName && universityId),
    { message: "Provide all profile details for legacy invitations." },
  );
export const invitationTokenSchema = z.object({
  token: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "This invitation link is invalid or has expired."),
});
export const acceptAccountInvitationSchema = invitationTokenSchema.extend({
  profile: invitationProfileSchema.optional(),
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
export type InvitationProfile = z.infer<typeof invitationProfileSchema>;
export type InviteAccountInput = z.infer<typeof inviteAccountSchema>;
