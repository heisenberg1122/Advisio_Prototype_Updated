import { prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";

export type DocumentProjectAccessContext = {
  collegeId: string;
  isProjectCreator: boolean;
  activeProjectRoles: string[];
  isWorkflowOwner: boolean;
  hasAssignedReview: boolean;
};

export type DocumentProjectAccess = {
  exists: boolean;
  canView: boolean;
  canManageWorkingDocuments: boolean;
  canSubmitManuscript: boolean;
  canReview: boolean;
  canApproveOfficialDocuments: boolean;
  reasons: string[];
};

/**
 * Pure policy function kept separate from Prisma so every role boundary can be
 * regression-tested without relying on seed data. Project membership and
 * reviewer assignment always take precedence over broad role names.
 */
export function documentProjectAccessPolicy(
  user: AuthenticatedUser,
  context: DocumentProjectAccessContext,
): DocumentProjectAccess {
  const roles = new Set(user.roles);
  const projectRoles = new Set(context.activeProjectRoles);
  const isResearcher = projectRoles.has("LEADER") || projectRoles.has("MEMBER");
  const isAdviser = roles.has("ADVISER") && projectRoles.has("ADVISER");
  const isProfessor =
    roles.has("RESEARCH_COORDINATOR") && context.isWorkflowOwner;
  const isVpaa = roles.has("VPAA");
  const isScopedRpo =
    roles.has("RPO") &&
    Boolean(user.collegeId) &&
    user.collegeId === context.collegeId;
  const isAssignedReviewer = context.hasAssignedReview;

  const reasons = [
    isResearcher && "research-group-member",
    isAdviser && "assigned-adviser",
    isProfessor && "assigned-workflow-professor",
    isAssignedReviewer && "assigned-reviewer",
  ].filter(Boolean) as string[];

  return {
    exists: true,
    canView: isResearcher || isAdviser || isProfessor,
    canManageWorkingDocuments: isResearcher || isAdviser,
    canSubmitManuscript: roles.has("RESEARCHER") && isResearcher,
    canReview: isAdviser || isProfessor || isAssignedReviewer,
    canApproveOfficialDocuments: isScopedRpo || isVpaa,
    reasons,
  };
}

class DocumentAccessService {
  public async forResearch(
    user: AuthenticatedUser,
    researchId: string,
  ): Promise<DocumentProjectAccess> {
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
        documents: {
          where: {
            OR: [
              { reviews: { some: { reviewerId: user.id } } },
              {
                reviewerAssignments: {
                  some: {
                    reviewerId: user.id,
                    status: { in: ["ACTIVE", "COMPLETED"] },
                  },
                },
              },
            ],
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!research) {
      return {
        exists: false,
        canView: false,
        canManageWorkingDocuments: false,
        canSubmitManuscript: false,
        canReview: false,
        canApproveOfficialDocuments: false,
        reasons: [],
      };
    }

    return documentProjectAccessPolicy(user, {
      collegeId: research.collegeId,
      isProjectCreator: research.createdBy === user.id,
      activeProjectRoles: research.members.map((member) => member.projectRole),
      isWorkflowOwner:
        research.workflowInstance?.workflow.createdBy === user.id,
      hasAssignedReview: research.documents.length > 0,
    });
  }

  public async canViewVersion(user: AuthenticatedUser, versionId: string) {
    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
      select: {
        uploadedBy: true,
        document: { select: { researchId: true } },
        reviews: {
          where: { reviewerId: user.id },
          select: { id: true },
          take: 1,
        },
        reviewerAssignments: {
          where: {
            reviewerId: user.id,
            status: { in: ["ACTIVE", "COMPLETED"] },
          },
          select: { id: true },
          take: 1,
        },
        packetManuscripts: {
          where: {
            status: "PUBLISHED",
            defenseSession: {
              invitations: {
                some: {
                  inviteeId: user.id,
                  status: "ACCEPTED",
                  role: { in: ["PANELIST", "PANEL_CHAIR"] },
                },
              },
            },
          },
          select: { id: true },
          take: 1,
        },
        packetSimilarityReports: {
          where: {
            status: "PUBLISHED",
            defenseSession: {
              invitations: {
                some: {
                  inviteeId: user.id,
                  status: "ACCEPTED",
                  role: { in: ["PANELIST", "PANEL_CHAIR"] },
                },
              },
            },
          },
          select: { id: true },
          take: 1,
        },
        packetRecommendationTemplates: {
          where: {
            status: "PUBLISHED",
            defenseSession: {
              invitations: {
                some: {
                  inviteeId: user.id,
                  status: "ACCEPTED",
                  role: { in: ["PANELIST", "PANEL_CHAIR"] },
                },
              },
            },
          },
          select: { id: true },
          take: 1,
        },
        packetEvaluationTemplates: {
          where: {
            status: "PUBLISHED",
            defenseSession: {
              invitations: {
                some: {
                  inviteeId: user.id,
                  status: "ACCEPTED",
                  role: { in: ["PANELIST", "PANEL_CHAIR"] },
                },
              },
            },
          },
          select: { id: true },
          take: 1,
        },
        generatedRecommendations: {
          where: { panelistId: user.id },
          select: { id: true },
          take: 1,
        },
        deanInboxAttachments: {
          where: { recipientId: user.id },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!version) return false;
    const projectAccess = await this.forResearch(
      user,
      version.document.researchId,
    );
    const packetAccess = [
      version.packetManuscripts,
      version.packetSimilarityReports,
      version.packetRecommendationTemplates,
      version.packetEvaluationTemplates,
    ].some((packets) => packets.length > 0);
    return (
      projectAccess.canView ||
      version.uploadedBy === user.id ||
      version.reviews.length > 0 ||
      version.reviewerAssignments.length > 0 ||
      version.generatedRecommendations.length > 0 ||
      version.deanInboxAttachments.length > 0 ||
      packetAccess
    );
  }

  public async canSubmitReview(
    user: AuthenticatedUser,
    versionId: string,
    reviewType: "ADVISER" | "PANEL" | "REB" | "COORDINATOR" | "DEAN",
  ) {
    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
      select: {
        document: { select: { researchId: true } },
        reviewerAssignments: {
          where: {
            reviewerId: user.id,
            reviewType,
            status: "ACTIVE",
          },
          select: { id: true },
          take: 1,
        },
        reviews: {
          where: { reviewerId: user.id, reviewType },
          select: { id: true },
          take: 1,
        },
        packetManuscripts: {
          where: {
            status: "PUBLISHED",
            defenseSession: {
              invitations: {
                some: {
                  inviteeId: user.id,
                  status: "ACCEPTED",
                  role: { in: ["PANELIST", "PANEL_CHAIR"] },
                },
              },
            },
          },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!version) return false;
    if (version.reviewerAssignments.length > 0) return true;
    const access = await this.forResearch(user, version.document.researchId);
    if (version.reviews.length > 0) return true;
    if (reviewType === "ADVISER")
      return access.reasons.includes("assigned-adviser");
    if (reviewType === "COORDINATOR")
      return access.reasons.includes("assigned-workflow-professor");
    if (reviewType === "PANEL") return version.packetManuscripts.length > 0;
    // REB assignment is explicit through an existing Review until the formal
    // reviewer-assignment table is introduced in Phase 4.
    return false;
  }
}

export const documentAccessService = new DocumentAccessService();
