import crypto from "node:crypto";
import { Prisma } from "@research-management/database";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { googleDriveService } from "./google-drive.service.js";
import {
  createVisuallySignedPdf,
  loadVersionFile,
  type SignaturePlacement,
} from "./document-signing.service.js";
import { storageHierarchyService } from "./storage-hierarchy.service.js";

const sha256 = (value: Uint8Array) =>
  crypto.createHash("sha256").update(value).digest("hex");

const officialCopyInclude = {
  sourceVersion: {
    select: {
      id: true,
      versionNumber: true,
      fileName: true,
      submittedAt: true,
      contentChecksum: true,
      milestone: { select: { id: true, name: true, sequence: true } },
      reviewerAssignments: {
        include: {
          reviewer: {
            select: { id: true, firstName: true, lastName: true },
          },
          review: {
            select: {
              id: true,
              recommendation: true,
              overallComment: true,
              submittedAt: true,
            },
          },
        },
        orderBy: { assignedAt: "asc" as const },
      },
    },
  },
  finalizedBy: {
    select: { id: true, firstName: true, middleName: true, lastName: true },
  },
  revokedBy: {
    select: { id: true, firstName: true, middleName: true, lastName: true },
  },
  signatures: {
    include: {
      signedBy: {
        select: { id: true, firstName: true, middleName: true, lastName: true },
      },
      revokedBy: {
        select: { id: true, firstName: true, middleName: true, lastName: true },
      },
    },
    orderBy: { signedAt: "asc" as const },
  },
  supersededBy: { select: { id: true, verificationCode: true, finalizedAt: true } },
  supersedes: { select: { id: true, verificationCode: true, finalizedAt: true } },
} satisfies Prisma.OfficialCopyInclude;

export class OfficialCopyError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public code = "OFFICIAL_COPY_ERROR",
  ) {
    super(message);
  }
}

export type OfficialCopyAccessContext = {
  collegeId: string;
  isProjectCreator: boolean;
  activeProjectRoles: string[];
  isWorkflowOwner: boolean;
  hasAcceptedDefenseAssignment: boolean;
  hasLockedPanelEvaluation: boolean;
};

export function officialCopyAccessPolicy(
  user: AuthenticatedUser,
  context: OfficialCopyAccessContext,
) {
  const roles = new Set(user.roles);
  const projectRoles = new Set(context.activeProjectRoles);
  const isResearcher =
    projectRoles.has("LEADER") || projectRoles.has("MEMBER");
  const isAdviser = roles.has("ADVISER") && projectRoles.has("ADVISER");
  const isProfessor =
    roles.has("RESEARCH_COORDINATOR") && context.isWorkflowOwner;
  const isPanelist =
    roles.has("PANELIST") &&
    (projectRoles.has("PANELIST") || context.hasAcceptedDefenseAssignment);
  const isScopedRpo =
    roles.has("RPO") &&
    Boolean(user.collegeId) &&
    user.collegeId === context.collegeId;
  const isVpaa = roles.has("VPAA");
  const isStudentOwner =
    isResearcher || (roles.has("RESEARCHER") && context.isProjectCreator);

  return {
    canView:
      isStudentOwner ||
      isAdviser ||
      isProfessor ||
      isPanelist ||
      isScopedRpo ||
      isVpaa,
    canFinalize:
      !isStudentOwner && (isAdviser || isProfessor || isScopedRpo || isVpaa),
    canSign:
      !isStudentOwner &&
      (isAdviser ||
        isProfessor ||
        (isPanelist && context.hasLockedPanelEvaluation) ||
        isScopedRpo ||
        isVpaa),
    canRevoke: !isStudentOwner && (isScopedRpo || isVpaa),
    isStudentOwner,
    role: isAdviser
      ? "ADVISER"
      : isProfessor
        ? "COORDINATOR"
        : isPanelist
          ? "PANELIST"
          : isScopedRpo
            ? "DEAN"
            : isVpaa
              ? "VPAA"
              : "NONE",
  };
}

class OfficialCopyService {
  async accessForResearch(user: AuthenticatedUser, researchId: string) {
    const research = await prisma.researchProject.findUnique({
      where: { id: researchId },
      select: {
        collegeId: true,
        createdBy: true,
        members: {
          where: { userId: user.id, leftAt: null },
          select: { projectRole: true },
        },
        workflowInstance: {
          select: { workflow: { select: { createdBy: true } } },
        },
        defenseSessions: {
          where: {
            invitations: {
              some: {
                inviteeId: user.id,
                status: "ACCEPTED",
                role: { in: ["PANELIST", "PANEL_CHAIR"] },
              },
            },
          },
          select: { id: true },
          take: 1,
        },
        evaluations: {
          where: { evaluatorId: user.id, status: "LOCKED" },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!research) return null;
    return officialCopyAccessPolicy(user, {
      collegeId: research.collegeId,
      isProjectCreator: research.createdBy === user.id,
      activeProjectRoles: research.members.map(({ projectRole }) => projectRole),
      isWorkflowOwner:
        research.workflowInstance?.workflow.createdBy === user.id,
      hasAcceptedDefenseAssignment: research.defenseSessions.length > 0,
      hasLockedPanelEvaluation: research.evaluations.length > 0,
    });
  }

  async list(user: AuthenticatedUser, researchId: string) {
    const access = await this.accessForResearch(user, researchId);
    if (!access)
      throw new OfficialCopyError(
        "Research project not found.",
        404,
        "PROJECT_NOT_FOUND",
      );
    if (!access.canView)
      throw new OfficialCopyError(
        "You cannot access this project's official archive.",
        403,
        "OFFICIAL_ARCHIVE_FORBIDDEN",
      );
    const [copies, eligibleVersions] = await Promise.all([
      prisma.officialCopy.findMany({
        where: { researchId },
        include: officialCopyInclude,
        orderBy: { finalizedAt: "desc" },
      }),
      access.canFinalize
        ? prisma.documentVersion.findMany({
            where: {
              document: { researchId, lifecycleStatus: "APPROVED" },
              manuscriptStatus: "APPROVED",
              isImmutable: true,
              officialCopies: { none: {} },
            },
            select: {
              id: true,
              versionNumber: true,
              fileName: true,
              submittedAt: true,
              contentChecksum: true,
              document: {
                select: { id: true, title: true, documentType: true },
              },
              milestone: { select: { id: true, name: true, sequence: true } },
            },
            orderBy: { submittedAt: "desc" },
          })
        : Promise.resolve([]),
    ]);
    const redactReviewers = access.isStudentOwner;
    return {
      permissions: {
        canView: access.canView,
        canFinalize: access.canFinalize,
        canSign: access.canSign,
        canRevoke: access.canRevoke,
      },
      eligibleVersions,
      copies: copies.map((copy) => ({
        ...copy,
        canSign:
          access.canSign &&
          copy.status === "ACTIVE" &&
          !copy.signatures.some(
            (signature) =>
              signature.signedById === user.id && signature.status === "ACTIVE",
          ),
        fileSize: Number(copy.fileSize),
        fileUrl: copy.googleDriveFileId
          ? `/api/official-copies/files/${copy.googleDriveFileId}`
          : null,
        sourceVersion: {
          ...copy.sourceVersion,
          reviewerAssignments: copy.sourceVersion.reviewerAssignments.map(
            (assignment) => ({
              ...assignment,
              reviewer: redactReviewers ? null : assignment.reviewer,
            }),
          ),
        },
        signatures: copy.signatures.map((signature) => ({
          ...signature,
          fileSize: Number(signature.fileSize),
          fileUrl: signature.googleDriveFileId
            ? `/api/official-copies/files/${signature.googleDriveFileId}`
            : null,
          mechanism: "ACCOUNT_AUTHENTICATED_VISUAL_SIGNATURE",
        })),
      })),
    };
  }

  async finalize(options: {
    sourceVersionId: string;
    user: AuthenticatedUser;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const source = await prisma.documentVersion.findUnique({
      where: { id: options.sourceVersionId },
      include: {
        document: { include: { research: true } },
        reviewerAssignments: {
          where: {
            isRequired: true,
            status: { in: ["ACTIVE", "COMPLETED"] },
          },
          include: { review: { select: { recommendation: true } } },
        },
        officialCopies: { take: 1 },
      },
    });
    if (!source)
      throw new OfficialCopyError("Document version not found.", 404);
    const access = await this.accessForResearch(
      options.user,
      source.document.researchId,
    );
    if (!access?.canFinalize)
      throw new OfficialCopyError(
        "Only authorized project faculty or the scoped Dean's Office may finalize this manuscript.",
        403,
        "FINALIZATION_FORBIDDEN",
      );
    if (source.officialCopies[0])
      return { copy: source.officialCopies[0], duplicate: true };
    if (
      source.mimeType !== "application/pdf" ||
      !source.isImmutable ||
      source.manuscriptStatus !== "APPROVED" ||
      source.document.lifecycleStatus !== "APPROVED"
    )
      throw new OfficialCopyError(
        "Only the exact immutable PDF version with completed academic approval may be finalized.",
        409,
        "VERSION_NOT_ELIGIBLE",
      );
    if (!source.contentChecksum)
      throw new OfficialCopyError(
        "The approved version has no stored integrity checksum.",
        409,
        "SOURCE_CHECKSUM_MISSING",
      );
    const required = source.reviewerAssignments;
    if (
      required.length === 0 ||
      required.some(
        (assignment) =>
          assignment.status !== "COMPLETED" ||
          assignment.review?.recommendation !== "APPROVE",
      )
    )
      throw new OfficialCopyError(
        "All configured mandatory reviewers must approve this exact version before finalization.",
        409,
        "MANDATORY_APPROVALS_INCOMPLETE",
      );

    const original = await loadVersionFile(source);
    const checksum = sha256(original);
    if (checksum !== source.contentChecksum)
      throw new OfficialCopyError(
        "The stored PDF no longer matches its approved checksum. Finalization was stopped.",
        409,
        "SOURCE_INTEGRITY_MISMATCH",
      );

    const folderId = await storageHierarchyService.resolveFolder({
      researchId: source.document.researchId,
      bucket: "OFFICIAL",
      stageId: source.milestoneId,
    });
    const baseName = source.fileName
      .replace(/\.pdf$/i, "")
      .replace(/[^a-zA-Z0-9._ -]/g, "-")
      .slice(0, 205);
    const fileName = `${baseName || "manuscript"}-official-v${source.versionNumber}.pdf`;
    const stored = await googleDriveService.uploadFile({
      fileName,
      mimeType: "application/pdf",
      buffer: original,
      folderId,
      description: `Advisio immutable official copy: ${source.document.title}`,
      appProperties: {
        advisioManaged: "true",
        advisioResearchId: source.document.researchId,
        advisioDocumentId: source.documentId,
        advisioSourceVersionId: source.id,
        advisioLifecycle: "OFFICIAL_ARCHIVE",
        advisioChecksum: checksum,
      },
    });
    const finalizedAt = new Date();
    const verificationCode = `OFF-${crypto.randomBytes(10).toString("hex").toUpperCase()}`;
    try {
      const copy = await prisma.$transaction(
        async (tx) => {
          const duplicate = await tx.officialCopy.findUnique({
            where: { sourceVersionId: source.id },
            include: officialCopyInclude,
          });
          if (duplicate) return duplicate;
          const current = await tx.officialCopy.findUnique({
            where: { activeSlot: source.documentId },
            select: { id: true },
          });
          if (current) {
            await tx.officialCopy.update({
              where: { id: current.id },
              data: {
                status: "SUPERSEDED",
                activeSlot: null,
                supersededAt: finalizedAt,
              },
            });
          }
          const lifecycle = await tx.document.updateMany({
            where: { id: source.documentId, lifecycleStatus: "APPROVED" },
            data: { lifecycleStatus: "FINALIZED" },
          });
          if (!lifecycle.count)
            throw new OfficialCopyError(
              "The manuscript lifecycle changed while finalization was running.",
              409,
              "CONCURRENT_FINALIZATION_CONFLICT",
            );
          await tx.documentVersion.update({
            where: { id: source.id },
            data: { manuscriptStatus: "FINALIZED" },
          });
          const created = await tx.officialCopy.create({
            data: {
              researchId: source.document.researchId,
              documentId: source.documentId,
              sourceVersionId: source.id,
              title: source.document.title,
              documentType: source.document.documentType,
              fileName: stored.fileName,
              mimeType: "application/pdf",
              fileSize: BigInt(stored.sizeBytes),
              storagePath: stored.storagePath,
              googleDriveFileId: stored.fileId,
              checksum,
              verificationCode,
              activeSlot: source.documentId,
              finalizedById: options.user.id,
              finalizedAt,
              supersedesId: current?.id,
            },
            include: officialCopyInclude,
          });
          await tx.manuscriptStatusEvent.create({
            data: {
              documentId: source.documentId,
              versionId: source.id,
              fromStatus: "APPROVED",
              toStatus: "FINALIZED",
              actorId: options.user.id,
              reason: "An authorized faculty member archived the approved version as an official copy.",
              metadata: {
                officialCopyId: created.id,
                checksum,
                verificationCode,
                supersedesId: current?.id || null,
              },
            },
          });
          await tx.auditLog.create({
            data: {
              userId: options.user.id,
              action: "APPROVE",
              entityType: "OfficialCopy",
              entityId: created.id,
              newValues: {
                researchId: created.researchId,
                documentId: created.documentId,
                sourceVersionId: created.sourceVersionId,
                checksum,
                verificationCode,
                status: created.status,
              },
              ipAddress: options.ipAddress,
              userAgent: options.userAgent,
            },
          });
          const recipients = await tx.researchMember.findMany({
            where: {
              researchId: created.researchId,
              leftAt: null,
              userId: { not: options.user.id },
              projectRole: { in: ["LEADER", "MEMBER", "ADVISER"] },
            },
            select: { userId: true },
          });
          if (recipients.length) {
            await tx.notification.createMany({
              data: recipients.map(({ userId: recipientId }) => ({
                recipientId,
                type: "OFFICIAL_COPY_AVAILABLE" as const,
                title: "Official manuscript copy available",
                message: `${source.document.title} version ${source.versionNumber} was finalized and archived.`,
                entityType: "OfficialCopy",
                entityId: created.id,
                actionUrl: `/student/documents?projectId=${created.researchId}&documentId=${created.documentId}&versionId=${created.sourceVersionId}&tab=official`,
                deduplicationKey: `official-copy:${created.id}:available:${recipientId}`,
              })),
              skipDuplicates: true,
            });
          }
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (copy.googleDriveFileId !== stored.fileId)
        await googleDriveService.deleteStoredFile(stored.fileId).catch(() => false);
      return { copy, duplicate: copy.googleDriveFileId !== stored.fileId };
    } catch (error) {
      await googleDriveService.deleteStoredFile(stored.fileId).catch(() => false);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const duplicate = await prisma.officialCopy.findUnique({
          where: { sourceVersionId: source.id },
          include: officialCopyInclude,
        });
        if (duplicate) return { copy: duplicate, duplicate: true };
      }
      throw error;
    }
  }

  async sign(options: {
    officialCopyId: string;
    user: AuthenticatedUser;
    placements: SignaturePlacement[];
    ipAddress?: string;
    userAgent?: string;
  }) {
    if (!options.placements.length || options.placements.length > 10)
      throw new OfficialCopyError("Add between one and ten signature placements.");
    const copy = await prisma.officialCopy.findUnique({
      where: { id: options.officialCopyId },
      include: {
        signatures: { where: { signedById: options.user.id }, take: 1 },
      },
    });
    if (!copy) throw new OfficialCopyError("Official copy not found.", 404);
    const access = await this.accessForResearch(options.user, copy.researchId);
    if (!access?.canSign)
      throw new OfficialCopyError(
        "You are not an authorized signer for this official copy.",
        403,
        "OFFICIAL_SIGNING_FORBIDDEN",
      );
    if (copy.status !== "ACTIVE")
      throw new OfficialCopyError(
        "Only the active official copy may receive signatures.",
        409,
        "OFFICIAL_COPY_NOT_ACTIVE",
      );
    if (copy.signatures[0])
      return { signature: copy.signatures[0], duplicate: true };
    const [signatureProfile, signer] = await Promise.all([
      prisma.userSignature.findUnique({ where: { userId: options.user.id } }),
      prisma.user.findUnique({
        where: { id: options.user.id },
        select: { firstName: true, middleName: true, lastName: true },
      }),
    ]);
    if (!signatureProfile)
      throw new OfficialCopyError(
        "Create or upload your signature before signing this official copy.",
        409,
        "SIGNATURE_PROFILE_REQUIRED",
      );
    if (!signer) throw new OfficialCopyError("Signer account not found.", 404);
    const original = await loadVersionFile(copy);
    if (sha256(original) !== copy.checksum)
      throw new OfficialCopyError(
        "The archived PDF failed integrity validation. Signing was stopped.",
        409,
        "OFFICIAL_COPY_INTEGRITY_MISMATCH",
      );
    const signedAt = new Date();
    const signerName = [signer.firstName, signer.middleName, signer.lastName]
      .filter(Boolean)
      .join(" ");
    const signedBuffer = await createVisuallySignedPdf({
      original,
      signatureImage: signatureProfile.imageData,
      signerName,
      placements: options.placements,
      signedAt,
    });
    const folderId = await storageHierarchyService.resolveFolder({
      researchId: copy.researchId,
      bucket: "OFFICIAL",
    });
    const fileName = `${copy.fileName.replace(/\.pdf$/i, "")}-signed-${options.user.id.slice(0, 8)}.pdf`;
    const signedFileHash = sha256(signedBuffer);
    const stored = await googleDriveService.uploadFile({
      fileName,
      mimeType: "application/pdf",
      buffer: signedBuffer,
      folderId,
      description: `Account-authenticated visual signature copy: ${copy.title}`,
      appProperties: {
        advisioManaged: "true",
        advisioResearchId: copy.researchId,
        advisioOfficialCopyId: copy.id,
        advisioSignerId: options.user.id,
        advisioLifecycle: "OFFICIAL_VISUAL_SIGNATURE",
        advisioChecksum: signedFileHash,
      },
    });
    const verificationCode = `SIG-${crypto.randomBytes(10).toString("hex").toUpperCase()}`;
    try {
      const signature = await prisma.$transaction(async (tx) => {
        const latest = await tx.officialCopy.findUnique({
          where: { id: copy.id },
          select: { status: true },
        });
        if (latest?.status !== "ACTIVE")
          throw new OfficialCopyError(
            "The official copy changed while signing was in progress.",
            409,
            "CONCURRENT_SIGNING_CONFLICT",
          );
        const created = await tx.officialCopySignature.create({
          data: {
            officialCopyId: copy.id,
            signedById: options.user.id,
            signerRole: access.role,
            fileName: stored.fileName,
            fileSize: BigInt(stored.sizeBytes),
            storagePath: stored.storagePath,
            googleDriveFileId: stored.fileId,
            sourceFileHash: copy.checksum,
            signedFileHash,
            signatureProfileHash: signatureProfile.fileHash,
            placements: options.placements,
            verificationCode,
            signedAt,
          },
          include: {
            signedBy: {
              select: { id: true, firstName: true, middleName: true, lastName: true },
            },
          },
        });
        await tx.auditLog.create({
          data: {
            userId: options.user.id,
            action: "SIGN",
            entityType: "OfficialCopySignature",
            entityId: created.id,
            newValues: {
              officialCopyId: copy.id,
              sourceVersionId: copy.sourceVersionId,
              sourceFileHash: copy.checksum,
              signedFileHash,
              verificationCode,
              authenticationMethod: "PASSWORD_VISUAL_SIGNATURE",
            },
            ipAddress: options.ipAddress,
            userAgent: options.userAgent,
          },
        });
        const recipients = await tx.researchMember.findMany({
          where: {
            researchId: copy.researchId,
            leftAt: null,
            userId: { not: options.user.id },
            projectRole: { in: ["LEADER", "MEMBER", "ADVISER"] },
          },
          select: { userId: true },
        });
        if (recipients.length) {
          await tx.notification.createMany({
            data: recipients.map(({ userId: recipientId }) => ({
              recipientId,
              type: "OFFICIAL_COPY_SIGNED" as const,
              title: "Official copy signed",
              message: `${signerName} added an account-authenticated visual signature to ${copy.title}.`,
              entityType: "OfficialCopySignature",
              entityId: created.id,
              actionUrl: `/student/documents?projectId=${copy.researchId}&documentId=${copy.documentId}&tab=official`,
              deduplicationKey: `official-signature:${created.id}:${recipientId}`,
            })),
            skipDuplicates: true,
          });
        }
        return created;
      });
      return {
        signature,
        duplicate: false,
        version: {
          id: signature.id,
          fileName: signature.fileName,
          googleDriveFileId: signature.googleDriveFileId,
        },
      };
    } catch (error) {
      await googleDriveService.deleteStoredFile(stored.fileId).catch(() => false);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const duplicate = await prisma.officialCopySignature.findUnique({
          where: {
            officialCopyId_signedById: {
              officialCopyId: copy.id,
              signedById: options.user.id,
            },
          },
        });
        if (duplicate)
          return {
            signature: duplicate,
            duplicate: true,
            version: {
              id: duplicate.id,
              fileName: duplicate.fileName,
              googleDriveFileId: duplicate.googleDriveFileId,
            },
          };
      }
      throw error;
    }
  }

  async resolveArtifact(user: AuthenticatedUser, fileId: string) {
    const copy = await prisma.officialCopy.findFirst({
      where: { googleDriveFileId: fileId },
    });
    const signature = copy
      ? null
      : await prisma.officialCopySignature.findFirst({
          where: { googleDriveFileId: fileId },
          include: { officialCopy: true },
        });
    const researchId = copy?.researchId || signature?.officialCopy.researchId;
    if (!researchId)
      throw new OfficialCopyError("Official document not found.", 404);
    const access = await this.accessForResearch(user, researchId);
    if (!access?.canView)
      throw new OfficialCopyError(
        "You cannot access this official document.",
        403,
      );
    return {
      entityId: copy?.id || signature!.id,
      entityType: copy ? "OfficialCopy" : "OfficialCopySignature",
      fileName: copy?.fileName || signature!.fileName,
      mimeType: copy?.mimeType || signature!.mimeType,
      googleDriveFileId: copy?.googleDriveFileId || signature!.googleDriveFileId,
      storagePath: copy?.storagePath || signature!.storagePath,
    };
  }

  async verify(user: AuthenticatedUser, officialCopyId: string, signatureId?: string) {
    const copy = await prisma.officialCopy.findUnique({
      where: { id: officialCopyId },
      include: { signatures: true },
    });
    if (!copy) throw new OfficialCopyError("Official copy not found.", 404);
    const access = await this.accessForResearch(user, copy.researchId);
    if (!access?.canView)
      throw new OfficialCopyError("You cannot verify this official copy.", 403);
    const signature = signatureId
      ? copy.signatures.find((item) => item.id === signatureId)
      : null;
    if (signatureId && !signature)
      throw new OfficialCopyError("Signed artifact not found.", 404);
    const artifact = signature || copy;
    const buffer = await loadVersionFile(artifact);
    const actualChecksum = sha256(buffer);
    const expectedChecksum = signature?.signedFileHash || copy.checksum;
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE",
        entityType: signature ? "OfficialCopySignatureIntegrity" : "OfficialCopyIntegrity",
        entityId: artifact.id,
        newValues: { matches: actualChecksum === expectedChecksum },
      },
    });
    return {
      matches: actualChecksum === expectedChecksum,
      checksum: expectedChecksum,
      checkedAt: new Date(),
      statement:
        "Checksum verification confirms file integrity only; it does not establish legal validity or cryptographic digital-signature authenticity.",
    };
  }

  async revoke(options: {
    officialCopyId: string;
    reason: string;
    user: AuthenticatedUser;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const copy = await prisma.officialCopy.findUnique({
      where: { id: options.officialCopyId },
    });
    if (!copy) throw new OfficialCopyError("Official copy not found.", 404);
    const access = await this.accessForResearch(options.user, copy.researchId);
    if (!access?.canRevoke)
      throw new OfficialCopyError(
        "Only the scoped Dean's Office may revoke an official archive record.",
        403,
      );
    if (copy.status === "REVOKED") return { copy, duplicate: true };
    if (!options.reason.trim())
      throw new OfficialCopyError("A revocation reason is required.");
    const revokedAt = new Date();
    const revoked = await prisma.$transaction(async (tx) => {
      const updated = await tx.officialCopy.update({
        where: { id: copy.id },
        data: {
          status: "REVOKED",
          activeSlot: null,
          revokedAt,
          revokedById: options.user.id,
          revocationReason: options.reason.trim(),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: options.user.id,
          action: "UPDATE",
          entityType: "OfficialCopy",
          entityId: copy.id,
          oldValues: { status: copy.status },
          newValues: { status: "REVOKED", reason: options.reason.trim() },
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
      });
      const recipients = await tx.researchMember.findMany({
        where: {
          researchId: copy.researchId,
          leftAt: null,
          projectRole: { in: ["LEADER", "MEMBER", "ADVISER"] },
        },
        select: { userId: true },
      });
      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map(({ userId: recipientId }) => ({
            recipientId,
            type: "OFFICIAL_COPY_REVOKED" as const,
            title: "Official copy revoked",
            message: `${copy.title} was revoked. The archival record remains available for audit history.`,
            entityType: "OfficialCopy",
            entityId: copy.id,
            actionUrl: `/student/documents?projectId=${copy.researchId}&documentId=${copy.documentId}&tab=official`,
            deduplicationKey: `official-copy:${copy.id}:revoked:${recipientId}`,
          })),
          skipDuplicates: true,
        });
      }
      return updated;
    });
    return { copy: revoked, duplicate: false };
  }
}

export const officialCopyService = new OfficialCopyService();
