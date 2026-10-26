import { Prisma, prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import {
  buildUserDeletionPlan,
  executeUserDeletionPlan,
  UserDeletionError,
} from "./user-deletion-plan.js";

function requireDeletionAdministrator(
  actor: AuthenticatedUser,
  userId: string,
) {
  if (!actor.roles.includes("SYSTEM_ADMIN"))
    throw new UserDeletionError(
      "System Administrator access is required to permanently delete an account and its records.",
      403,
    );
  if (actor.id === userId)
    throw new UserDeletionError(
      "You cannot delete your own signed-in account.",
    );
}

async function deletionTarget(tx: Prisma.TransactionClient, id: string) {
  const user = await tx.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } } },
  });
  if (!user) throw new UserDeletionError("User not found", 404);
  if (
    user.status === "ACTIVE" &&
    user.roles.some(({ role }) => role.name === "SYSTEM_ADMIN") &&
    (await tx.user.count({
      where: {
        status: "ACTIVE",
        roles: { some: { role: { name: "SYSTEM_ADMIN" } } },
      },
    })) <= 1
  ) {
    throw new UserDeletionError(
      "The last active System Administrator cannot be deleted.",
    );
  }
  return user;
}

export async function previewUserDeletion(
  actor: AuthenticatedUser,
  userId: string,
) {
  requireDeletionAdministrator(actor, userId);
  return prisma.$transaction(
    async (tx) => {
      const user = await deletionTarget(tx, userId);
      return (await buildUserDeletionPlan(tx, user)).preview;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 10_000,
      timeout: 60_000,
    },
  );
}

export async function permanentlyDeleteUser(options: {
  actor: AuthenticatedUser;
  userId: string;
  confirmation: unknown;
  previewToken: unknown;
  deleteAllData: unknown;
  ipAddress?: string;
  userAgent?: string;
}) {
  requireDeletionAdministrator(options.actor, options.userId);
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(72401801)`;
      const user = await deletionTarget(tx, options.userId);
      if (
        options.confirmation !== `delete ${user.universityId} sudo` ||
        options.deleteAllData !== true
      ) {
        throw new UserDeletionError(
          "Confirm permanent deletion of the account and all listed records.",
          400,
        );
      }
      const plan = await buildUserDeletionPlan(tx, user);
      if (options.previewToken !== plan.preview.token) {
        throw new UserDeletionError(
          "The user's records changed. Close and reopen this dialog to review the latest deletion preview.",
        );
      }
      await executeUserDeletionPlan(tx, plan);
      // Version numbers are immutable history. Point each surviving document at
      // its newest remaining version after removing this person's submissions.
      const removedDocuments = new Set(
        plan.nodes
          .filter((node) => node.model === "Document")
          .map((node) => node.row.id),
      );
      const affectedDocuments = new Set(
        plan.nodes
          .filter((node) => node.model === "DocumentVersion")
          .map((node) => String(node.row.documentId))
          .filter((id) => !removedDocuments.has(id)),
      );
      for (const documentId of affectedDocuments) {
        const latest = await tx.documentVersion.findFirst({
          where: { documentId },
          orderBy: { versionNumber: "desc" },
          select: { versionNumber: true },
        });
        if (latest)
          await tx.document.updateMany({
            where: { id: documentId },
            data: { currentVersion: latest.versionNumber },
          });
      }
      // Historical grant/connection metadata is not ownership of another user's account.
      await tx.userRole.updateMany({
        where: { grantedBy: user.id },
        data: { grantedBy: null },
      });
      await tx.storageIntegration.updateMany({
        where: { connectedBy: user.id },
        data: { connectedBy: null },
      });
      if (plan.files.length)
        await tx.fileDeletionJob.createMany({
          data: plan.files,
          skipDuplicates: true,
        });
      // Keep one administrative audit trail without copying the deleted person's name/email.
      await tx.auditLog.create({
        data: {
          userId: options.actor.id,
          action: "DELETE",
          entityType: "USER",
          entityId: user.id,
          newValues: {
            deletedRecords: plan.preview.totalRecords,
            fileCleanupQueued: plan.files.length,
          },
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
      });
      return {
        message: "Account and associated records permanently deleted.",
        deletedRecords: plan.preview.totalRecords,
        fileCleanupQueued: plan.files.length,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 60_000,
    },
  );
}
