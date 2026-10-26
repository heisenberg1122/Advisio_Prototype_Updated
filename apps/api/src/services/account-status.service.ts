import { prisma, Prisma, UserStatus } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { emailNotification } from "./notification-email.service.js";

export class AccountStatusError extends Error {
  constructor(
    message: string,
    public statusCode = 409,
  ) {
    super(message);
  }
}

export async function changeAccountStatus(options: {
  actor: AuthenticatedUser;
  userId: string;
  status: UserStatus;
  verificationConfirmed?: unknown;
  verificationNote?: unknown;
  ipAddress?: string;
  userAgent?: string;
}) {
  return prisma.$transaction(
    async (tx) => {
      // Serialize changes to the active administrator set, including role edits/deletions.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(72401801)`;
      const user = await tx.user.findUnique({
        where: { id: options.userId },
        include: { roles: { include: { role: true } } },
      });
      if (!user) throw new AccountStatusError("User not found", 404);
      if (options.actor.id === user.id && options.status !== "ACTIVE") {
        throw new AccountStatusError(
          "You cannot suspend or deactivate your own signed-in account.",
        );
      }
      const verificationNote =
        typeof options.verificationNote === "string"
          ? options.verificationNote.trim()
          : "";
      if (
        options.status === "ACTIVE" &&
        user.googleOnboardingStage &&
        user.googleOnboardingStage !== "COMPLETE"
      ) {
        throw new AccountStatusError(
          "The user must complete Google registration and onboarding before the account can be approved.",
        );
      }
      if (
        options.status === "ACTIVE" &&
        user.status !== "ACTIVE" &&
        (options.verificationConfirmed !== true ||
          verificationNote.length < 10 ||
          verificationNote.length > 2000)
      ) {
        throw new AccountStatusError(
          "Verify identity and provide a verification note of 10–2000 characters before activation.",
          400,
        );
      }
      if (
        user.status === "ACTIVE" &&
        options.status !== "ACTIVE" &&
        user.roles.some(({ role }) => role.name === "SYSTEM_ADMIN")
      ) {
        const count = await tx.user.count({
          where: {
            status: "ACTIVE",
            roles: { some: { role: { name: "SYSTEM_ADMIN" } } },
          },
        });
        if (count <= 1)
          throw new AccountStatusError(
            "The last active System Administrator cannot be deactivated or suspended.",
          );
      }
      if (
        options.status === "SUSPENDED" &&
        (verificationNote.length < 10 || verificationNote.length > 2000)
      ) {
        throw new AccountStatusError(
          "Provide a suspension reason of 10–2000 characters.",
          400,
        );
      }
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          status: options.status,
          ...(options.status !== user.status
            ? { sessionVersion: { increment: 1 } }
            : {}),
        },
        select: {
          id: true,
          universityId: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: options.actor.id,
          action: options.status === "ACTIVE" ? "APPROVE" : "UPDATE",
          entityType: "USER_ACCOUNT",
          entityId: user.id,
          oldValues: { status: user.status },
          newValues: { status: options.status, verificationNote },
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
      });
      if (user.status !== "ACTIVE" && options.status === "ACTIVE" && user.googleSubject) {
        await tx.notification.create({ data: {
          recipientId: user.id, audience: "account", type: "WORKFLOW_CHANGED",
          title: "Your Advisio account has been approved",
          message: "You can now sign in with Google and access your assigned workspace.",
          actionUrl: "/login", entityType: "USER_ACCOUNT", entityId: user.id,
          ...emailNotification("account_approved"),
        } });
      }
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
