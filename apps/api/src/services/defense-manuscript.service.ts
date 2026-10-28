import { prisma, type Prisma } from "../lib/prisma.js";
import { hasSignedDefenseApproval } from "./defense-eligibility.service.js";

const PANEL_ROLES = new Set(["PANELIST", "PANEL_CHAIR"]);
const DEFENSE_FACILITATOR_ROLES = new Set(["RESEARCH_COORDINATOR", "DEAN"]);

export function hasDefenseFacilitatorAccess(user: {
  roles: string[];
  collegeId?: string | null;
}) {
  return (
    Boolean(user.collegeId) &&
    user.roles.some((role) => DEFENSE_FACILITATOR_ROLES.has(role))
  );
}

export type DefenseManuscriptEligibilityInput = {
  projectMatches: boolean;
  isImmutable: boolean;
  isPdf: boolean;
  hasChecksum: boolean;
  isSubmittedSnapshot: boolean;
  versionApproved: boolean;
  isCurrentVersion: boolean;
  documentApproved: boolean;
  milestoneMatchesWorkflow: boolean;
  hasRequiredReviewers: boolean;
  requiredReviewsApproved: boolean;
  institutionalApprovalSatisfied: boolean;
  hasAcceptedPanelist: boolean;
  requiredPanelistsAccepted: boolean;
  sessionOpen: boolean;
};

const ELIGIBILITY_MESSAGES: Array<
  [keyof DefenseManuscriptEligibilityInput, string]
> = [
  [
    "projectMatches",
    "The manuscript does not belong to this research project.",
  ],
  ["isImmutable", "The selected version is not an immutable submission."],
  ["isPdf", "The defense manuscript must be a PDF."],
  ["hasChecksum", "The immutable manuscript checksum is missing."],
  [
    "isSubmittedSnapshot",
    "The selected version is not a formal submitted snapshot.",
  ],
  [
    "versionApproved",
    "The exact manuscript version is not approved or finalized.",
  ],
  [
    "isCurrentVersion",
    "A newer manuscript submission exists and must complete review first.",
  ],
  [
    "documentApproved",
    "The manuscript workflow is not currently approved or finalized.",
  ],
  [
    "milestoneMatchesWorkflow",
    "The manuscript milestone does not belong to this project's workflow.",
  ],
  [
    "hasRequiredReviewers",
    "The manuscript has no mandatory faculty approval assignments.",
  ],
  [
    "requiredReviewsApproved",
    "Every mandatory faculty reviewer must approve this exact version.",
  ],
  [
    "institutionalApprovalSatisfied",
    "The required signed institutional defense approval is missing.",
  ],
  [
    "sessionOpen",
    "A completed or cancelled defense packet cannot be published.",
  ],
];

export function evaluateDefenseManuscriptEligibility(
  input: DefenseManuscriptEligibilityInput,
) {
  // Invitation readiness is reported separately; it does not change whether
  // an approved manuscript can be selected or shared with accepted panelists.
  const reasons = ELIGIBILITY_MESSAGES.filter(([key]) => !input[key]).map(
    ([, message]) => message,
  );
  return { eligible: reasons.length === 0, reasons, checks: input };
}

export function panelistPacketAccessPolicy(input: {
  packetPublished: boolean;
  invitationStatus: string | null | undefined;
  invitationRole: string | null | undefined;
}) {
  return (
    input.packetPublished &&
    input.invitationStatus === "ACCEPTED" &&
    PANEL_ROLES.has(String(input.invitationRole || ""))
  );
}

export class DefensePacketPolicyError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 409,
  ) {
    super(message);
    this.name = "DefensePacketPolicyError";
  }
}

export function validateDefensePacketMutation(input: {
  existingStatus?: string | null;
  existingMappingVersion?: number | null;
  publish: boolean;
  replacePublished: boolean;
  expectedMappingVersion?: number | null;
  publicationReason?: string | null;
}) {
  if (input.existingStatus !== "PUBLISHED") return { replacement: false };
  if (!input.publish || !input.replacePublished)
    throw new DefensePacketPolicyError(
      "This packet is already published. Use the explicit approved-update action to replace its documents.",
      "PUBLISHED_PACKET_IMMUTABLE",
    );
  if (String(input.publicationReason || "").trim().length < 10)
    throw new DefensePacketPolicyError(
      "Explain why the published defense document must be replaced (at least 10 characters).",
      "PUBLICATION_REASON_REQUIRED",
      400,
    );
  if (input.expectedMappingVersion !== input.existingMappingVersion)
    throw new DefensePacketPolicyError(
      "The published packet changed after you opened it. Refresh before attempting an approved replacement.",
      "PACKET_VERSION_CONFLICT",
    );
  return { replacement: true };
}

class DefenseManuscriptService {
  public async getReadiness(
    sessionId: string,
    onlyVersionId?: string,
    db: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    const session = await db.defenseSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        researchId: true,
        eligibilityId: true,
        eligibility: { select: { deanApprovalDocumentId: true } },
        status: true,
        research: {
          select: {
            id: true,
            title: true,
            workflowInstance: { select: { workflowId: true } },
            documents: {
              where: {
                documentType: "DEAN_DEFENSE_APPROVAL",
                versions: {
                  some: {
                    status: "ACTIVE",
                    signedSignature: {
                      is: {
                        revokedAt: null,
                        signedBy: {
                          roles: {
                            some: {
                              role: { name: { in: ["DEAN"] } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              select: { id: true },
              take: 1,
            },
          },
        },
        invitations: {
          where: { role: { in: ["PANELIST", "PANEL_CHAIR"] } },
          select: { id: true, role: true, status: true, isRequired: true },
        },
      },
    });
    if (!session) return null;

    const versions = await db.documentVersion.findMany({
      where: {
        ...(onlyVersionId ? { id: onlyVersionId } : {}),
        document: { researchId: session.researchId },
        isImmutable: true,
      },
      select: {
        id: true,
        documentId: true,
        versionNumber: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        googleDriveFileId: true,
        storagePath: true,
        status: true,
        manuscriptStatus: true,
        isImmutable: true,
        contentChecksum: true,
        submittedAt: true,
        snapshotCreatedAt: true,
        milestoneId: true,
        document: {
          select: {
            id: true,
            researchId: true,
            title: true,
            documentType: true,
            currentVersion: true,
            lifecycleStatus: true,
          },
        },
        milestone: {
          select: { id: true, name: true, sequence: true, workflowId: true },
        },
        reviewerAssignments: {
          where: { isRequired: true, status: { in: ["ACTIVE", "COMPLETED"] } },
          select: {
            id: true,
            reviewType: true,
            status: true,
            review: { select: { recommendation: true, submittedAt: true } },
          },
        },
      },
      orderBy: [{ submittedAt: "desc" }, { versionNumber: "desc" }],
    });

    const acceptedPanelists = session.invitations.filter(
      (invitation) => invitation.status === "ACCEPTED",
    );
    const requiredPanelists = session.invitations.filter(
      (invitation) => invitation.isRequired && invitation.status !== "REMOVED",
    );
    const sessionChecks = {
      institutionalApprovalSatisfied: session.eligibilityId
        ? await hasSignedDefenseApproval(
            db,
            session.eligibility?.deanApprovalDocumentId || null,
          )
        : session.research.documents.length > 0,
      hasAcceptedPanelist: acceptedPanelists.length > 0,
      requiredPanelistsAccepted:
        requiredPanelists.length > 0 &&
        requiredPanelists.every(
          (invitation) => invitation.status === "ACCEPTED",
        ),
      sessionOpen: !["COMPLETED", "CANCELLED"].includes(session.status),
    };
    const workflowId = session.research.workflowInstance?.workflowId || null;
    const candidates = versions.map((version) => {
      const requiredAssignments = version.reviewerAssignments;
      const result = evaluateDefenseManuscriptEligibility({
        projectMatches: version.document.researchId === session.researchId,
        isImmutable: version.isImmutable,
        isPdf: version.mimeType === "application/pdf",
        hasChecksum: Boolean(version.contentChecksum),
        isSubmittedSnapshot: Boolean(
          version.submittedAt && version.snapshotCreatedAt,
        ),
        versionApproved: ["APPROVED", "FINALIZED"].includes(
          String(version.manuscriptStatus || ""),
        ),
        isCurrentVersion:
          version.document.currentVersion === version.versionNumber,
        documentApproved: ["APPROVED", "FINALIZED"].includes(
          version.document.lifecycleStatus,
        ),
        milestoneMatchesWorkflow: Boolean(
          workflowId && version.milestone?.workflowId === workflowId,
        ),
        hasRequiredReviewers: requiredAssignments.length > 0,
        requiredReviewsApproved:
          requiredAssignments.length > 0 &&
          requiredAssignments.every(
            (assignment) =>
              assignment.status === "COMPLETED" &&
              assignment.review?.recommendation === "APPROVE" &&
              Boolean(assignment.review.submittedAt),
          ),
        ...sessionChecks,
      });
      return {
        ...version,
        fileSize: version.fileSize.toString(),
        ...result,
      };
    });
    return {
      sessionId: session.id,
      researchId: session.researchId,
      researchTitle: session.research.title,
      sessionChecks,
      candidates,
      eligibleVersions: candidates.filter((candidate) => candidate.eligible),
    };
  }

  public async requireEligible(sessionId: string, versionId: string) {
    const readiness = await this.getReadiness(sessionId, versionId);
    if (!readiness) {
      const error = new Error("Defense session was not found.") as Error & {
        statusCode?: number;
        code?: string;
      };
      error.statusCode = 404;
      error.code = "DEFENSE_SESSION_NOT_FOUND";
      throw error;
    }
    const candidate = readiness.candidates[0];
    if (!candidate) {
      const error = new Error(
        "The selected manuscript version does not belong to this research project.",
      ) as Error & { statusCode?: number; code?: string };
      error.statusCode = 400;
      error.code = "MANUSCRIPT_PROJECT_MISMATCH";
      throw error;
    }
    if (!candidate.eligible) {
      const error = new Error(candidate.reasons[0]) as Error & {
        statusCode?: number;
        code?: string;
        details?: string[];
      };
      error.statusCode = 409;
      error.code = "MANUSCRIPT_NOT_DEFENSE_ELIGIBLE";
      error.details = candidate.reasons;
      throw error;
    }
    return { readiness, candidate };
  }
}

export const defenseManuscriptService = new DefenseManuscriptService();
