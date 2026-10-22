import type { InstitutionalRole as DbInstitutionalRole, Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const FACULTY_ROLES: DbInstitutionalRole[] = [
  "ADVISER",
  "RESEARCH_COORDINATOR",
  "PANELIST",
  "RPO",
  "REB",
  "VPAA",
  "SYSTEM_ADMIN",
] as const;

const INSTITUTION_ROLE_NAMES: DbInstitutionalRole[] = ["SYSTEM_ADMIN", "VPAA"];
const COLLEGE_OFFICE_ROLE_NAMES: DbInstitutionalRole[] = ["RPO", "REB"];
const RESEARCHER_COLLEGE_CONTACT_ROLES: DbInstitutionalRole[] = [
  "RPO",
  "REB",
  "RESEARCH_COORDINATOR",
];
const INSTITUTION_ROLES = new Set<DbInstitutionalRole>(INSTITUTION_ROLE_NAMES);
const COLLEGE_OFFICE_ROLES = new Set<DbInstitutionalRole>(
  COLLEGE_OFFICE_ROLE_NAMES,
);

function hasAnyRole(
  user: AuthenticatedUser,
  roles: ReadonlySet<DbInstitutionalRole>,
) {
  return user.roles.some((role) => roles.has(role as DbInstitutionalRole));
}

async function relatedResearchIds(userId: string): Promise<string[]> {
  const projects = await prisma.researchProject.findMany({
    where: {
      OR: [
        { createdBy: userId },
        { members: { some: { userId, leftAt: null } } },
      ],
    },
    select: { id: true },
  });
  return projects.map((project) => project.id);
}

/**
 * Formal mail uses the same academic relationships as the existing messaging
 * directory: institution leaders can reach the institution, college offices
 * stay college-scoped, faculty can reach faculty plus assigned projects, and
 * researchers can reach only their project participants and responsible
 * academic offices.
 */
export async function authorizedMailRecipientWhere(
  user: AuthenticatedUser,
): Promise<Prisma.UserWhereInput> {
  const base: Prisma.UserWhereInput = {
    id: { not: user.id },
    status: "ACTIVE",
  };

  if (hasAnyRole(user, INSTITUTION_ROLES)) return base;

  if (hasAnyRole(user, COLLEGE_OFFICE_ROLES)) {
    return {
      ...base,
      OR: [
        ...(user.collegeId ? [{ collegeId: user.collegeId }] : []),
        {
          roles: {
            some: { role: { name: { in: INSTITUTION_ROLE_NAMES } } },
          },
        },
      ],
    };
  }

  const researchIds = await relatedResearchIds(user.id);
  const isResearcher = user.roles.includes("RESEARCHER");

  if (isResearcher) {
    return {
      ...base,
      OR: [
        ...(researchIds.length
          ? [
              {
                memberships: {
                  some: { researchId: { in: researchIds }, leftAt: null },
                },
              },
            ]
          : []),
        {
          roles: {
            some: { role: { name: { in: INSTITUTION_ROLE_NAMES } } },
          },
        },
        ...(user.collegeId
          ? [
              {
                collegeId: user.collegeId,
                roles: {
                  some: {
                    role: {
                      name: {
                        in: RESEARCHER_COLLEGE_CONTACT_ROLES,
                      },
                    },
                  },
                },
              },
            ]
          : []),
      ],
    };
  }

  return {
    ...base,
    OR: [
      {
        roles: {
          some: { role: { name: { in: [...FACULTY_ROLES] } } },
        },
      },
      ...(researchIds.length
        ? [
            {
              memberships: {
                some: { researchId: { in: researchIds }, leftAt: null },
              },
            },
          ]
        : []),
    ],
  };
}

export async function findAuthorizedMailRecipients(
  user: AuthenticatedUser,
  recipientIds: string[],
) {
  const uniqueIds = [...new Set(recipientIds)].filter(
    (recipientId) => recipientId && recipientId !== user.id,
  );
  if (!uniqueIds.length) return [];
  const authorizedWhere = await authorizedMailRecipientWhere(user);
  return prisma.user.findMany({
    where: { AND: [authorizedWhere, { id: { in: uniqueIds } }] },
    select: { id: true },
  });
}
