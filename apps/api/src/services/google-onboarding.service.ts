import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { Prisma, prisma } from "../lib/prisma.js";

const sessionSchema = z.object({
  onboardingToken: z
    .string()
    .regex(
      /^[a-f0-9]{64}$/,
      "Sign in with Google again to restart onboarding.",
    ),
});
export const googleOnboardingSessionSchema = sessionSchema;
export const googleOnboardingIdentitySchema = sessionSchema.extend({
  accountType: z.enum(["RESEARCHER", "FACULTY"]),
  universityId: z
    .string()
    .trim()
    .min(1, "Your institutional ID is required")
    .max(50)
    .refine(
      (value) => !/^(?:GOOGLE|TEST)-/i.test(value),
      "Enter your actual institutional ID",
    ),
  firstName: z.string().trim().min(1).max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1).max(100),
  collegeId: z.string().uuid(),
  programId: z.string().uuid(),
  policiesAccepted: z.literal(true),
});
export const googleFacultyOnboardingSchema = sessionSchema.extend({
  academicTitle: z
    .string()
    .trim()
    .min(1, "Academic title is required")
    .max(100),
  facultyDesignation: z
    .string()
    .trim()
    .min(1, "Faculty designation is required")
    .max(150),
  department: z.string().trim().min(1, "Department is required").max(150),
  expertiseKeywords: z
    .array(z.string().trim().min(1).max(80))
    .min(1, "Add at least one area of expertise")
    .max(30),
});
const include = {
  roles: { include: { role: true } },
  facultyProfile: true,
} as const;
type OnboardingAccount = Prisma.UserGetPayload<{ include: typeof include }>;
export class GoogleOnboardingError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}
function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function serializeSession(user: OnboardingAccount, onboardingToken: string) {
  return {
    needsAcademicSetup: true,
    onboardingToken,
    onboardingStage: user.googleOnboardingStage,
    user: {
      id: user.id,
      email: user.email,
      universityId: user.universityId,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      collegeId: user.collegeId,
      programId: user.programId,
      roles: user.roles.map(({ role }) => role.name),
    },
    facultyProfile: user.facultyProfile
      ? {
          academicTitle: user.facultyProfile.academicTitle,
          facultyDesignation: user.facultyProfile.facultyDesignation,
          department: user.facultyProfile.department,
          expertiseKeywords: user.facultyProfile.expertiseKeywords,
        }
      : null,
  };
}
async function pendingAccount(
  tx: Prisma.TransactionClient,
  onboardingToken: string,
  stage?: string,
) {
  const user = await tx.user.findFirst({
    where: {
      onboardingTokenHash: tokenHash(onboardingToken),
      onboardingTokenExpiresAt: { gt: new Date() },
      status: "PENDING",
      googleSubject: { not: null },
      googleOnboardingStage: stage || {
        in: ["IDENTITY", "RESEARCHER", "FACULTY"],
      },
    },
    include,
  });
  if (!user)
    throw new GoogleOnboardingError(
      "Your onboarding session has expired or is no longer available. Sign in with Google again to continue.",
      401,
    );
  return user;
}

// This is a scoped, short-lived onboarding secret, never a dashboard login token.
export async function issueGoogleOnboardingSession(
  userId: string,
  stage: string,
  expectedStage: string | null = stage,
) {
  const onboardingToken = randomBytes(32).toString("hex");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        id: userId,
        status: "PENDING",
        googleOnboardingStage: expectedStage,
      },
      data: {
        googleOnboardingStage: stage,
        onboardingTokenHash: tokenHash(onboardingToken),
        onboardingTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      },
    });
    if (!updated.count)
      throw new GoogleOnboardingError(
        "Your account status changed. Sign in with Google again.",
        409,
      );
    return serializeSession(
      await tx.user.findUniqueOrThrow({ where: { id: userId }, include }),
      onboardingToken,
    );
  });
}

export async function getGoogleOnboardingSession(onboardingToken: string) {
  return prisma.$transaction(async (tx) =>
    serializeSession(
      await pendingAccount(tx, onboardingToken),
      onboardingToken,
    ),
  );
}

export async function saveGoogleOnboardingIdentity(
  input: z.infer<typeof googleOnboardingIdentitySchema>,
) {
  return prisma.$transaction(
    async (tx) => {
      const account = await pendingAccount(
        tx,
        input.onboardingToken,
        "IDENTITY",
      );
      if (account.roles.some(({ role }) => role.name !== "RESEARCHER")) {
        throw new GoogleOnboardingError(
          "An administrator has assigned this account's roles. Contact the administrator before continuing.",
          409,
        );
      }
      const [program, duplicate, role] = await Promise.all([
        tx.program.findFirst({
          where: {
            id: input.programId,
            collegeId: input.collegeId,
            isActive: true,
            college: { isActive: true },
          },
        }),
        tx.user.findFirst({
          where: { universityId: input.universityId, id: { not: account.id } },
          select: { id: true },
        }),
        tx.role.findUnique({
          where: {
            name: input.accountType === "FACULTY" ? "ADVISER" : "RESEARCHER",
          },
        }),
      ]);
      if (!program)
        throw new GoogleOnboardingError(
          "Choose an active course/program within your college or school.",
        );
      if (duplicate)
        throw new GoogleOnboardingError(
          "That institutional ID is already registered. Contact the administrator to recover or link your existing account.",
          409,
        );
      if (!role)
        throw new GoogleOnboardingError(
          "Account registration is temporarily unavailable.",
          503,
        );
      const updated = await tx.user.updateMany({
        where: {
          id: account.id,
          status: "PENDING",
          googleOnboardingStage: "IDENTITY",
          onboardingTokenHash: tokenHash(input.onboardingToken),
          onboardingTokenExpiresAt: { gt: new Date() },
        },
        data: {
          universityId: input.universityId,
          firstName: input.firstName,
          middleName: input.middleName || null,
          lastName: input.lastName,
          collegeId: program.collegeId,
          programId: program.id,
          googleOnboardingStage: input.accountType,
        },
      });
      if (!updated.count)
        throw new GoogleOnboardingError(
          "Your onboarding session changed. Sign in with Google again to continue.",
          409,
        );
      await tx.userRole.deleteMany({ where: { userId: account.id } });
      await tx.userRole.create({
        data: { userId: account.id, roleId: role.id },
      });
      await tx.auditLog.create({
        data: {
          userId: account.id,
          action: "UPDATE",
          entityType: "GOOGLE_REGISTRATION",
          entityId: account.id,
          newValues: {
            accountType: input.accountType,
            policiesAccepted: true,
            status: "PENDING",
          },
        },
      });
      return serializeSession(
        await tx.user.findUniqueOrThrow({ where: { id: account.id }, include }),
        input.onboardingToken,
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function submitGoogleFacultyOnboarding(
  input: z.infer<typeof googleFacultyOnboardingSchema>,
) {
  return prisma.$transaction(
    async (tx) => {
      const user = await pendingAccount(tx, input.onboardingToken, "FACULTY");
      if (!user.roles.some(({ role }) => role.name === "ADVISER"))
        throw new GoogleOnboardingError(
          "This account has no faculty registration request.",
          403,
        );
      const updated = await tx.user.updateMany({
        where: {
          id: user.id,
          status: "PENDING",
          googleOnboardingStage: "FACULTY",
          onboardingTokenHash: tokenHash(input.onboardingToken),
          onboardingTokenExpiresAt: { gt: new Date() },
        },
        data: {
          googleOnboardingStage: "COMPLETE",
          onboardingTokenHash: null,
          onboardingTokenExpiresAt: null,
        },
      });
      if (!updated.count)
        throw new GoogleOnboardingError(
          "Your onboarding session changed. Sign in with Google again to continue.",
          409,
        );
      const { onboardingToken: _token, ...profile } = input;
      const values = {
        ...profile,
        expertiseKeywords: [...new Set(profile.expertiseKeywords)],
      };
      await tx.facultyProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...values },
        update: values,
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE",
          entityType: "FACULTY_ONBOARDING",
          entityId: user.id,
          newValues: { status: "PENDING", profileSubmitted: true },
        },
      });
      return {
        message: "Faculty profile submitted for administrator verification.",
        status: "PENDING",
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
