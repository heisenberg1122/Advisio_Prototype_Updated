import type { InstitutionalRole } from "@research-management/auth";
import type { Prisma } from "./prisma.js";

export const FACULTY_COLLEGE_ROLES = [
  "ADVISER",
  "PANELIST",
  "RESEARCH_COORDINATOR",
  "DEAN",
] as const;
export const isCollegeRole = (role: string) =>
  (FACULTY_COLLEGE_ROLES as readonly string[]).includes(role);
type College = { id: string; name: string; code: string; isActive?: boolean };
type Account = {
  collegeId: string | null;
  programId: string | null;
  college?: College | null;
  roles: {
    role: { name: string; permissions?: { permission: { key: string } }[] };
  }[];
  collegeMemberships?: {
    collegeId: string;
    roleNames: string[];
    college: College;
  }[];
};

export function resolveCollegeAuthorization(
  account: Account,
  requestedCollegeId?: string,
) {
  const globalRoles = account.roles.map(({ role }) => role.name);
  const memberships = (account.collegeMemberships || []).filter(
    (membership) => membership.college.isActive !== false,
  );
  const available = new Map<
    string,
    { college: College; roleNames: InstitutionalRole[] }
  >();
  if (
    globalRoles.includes("RESEARCHER") &&
    account.collegeId &&
    account.college?.isActive !== false
  ) {
    available.set(account.collegeId, {
      college: account.college || {
        id: account.collegeId,
        name: "Home college",
        code: "",
      },
      roleNames: ["RESEARCHER" as InstitutionalRole],
    });
  }
  for (const membership of memberships) {
    const current = available.get(membership.collegeId);
    available.set(membership.collegeId, {
      college: membership.college,
      roleNames: [
        ...new Set([
          ...(current?.roleNames || []),
          ...membership.roleNames.filter(isCollegeRole),
        ]),
      ] as InstitutionalRole[],
    });
  }
  const administrator = globalRoles.includes("SYSTEM_ADMIN");
  const defaultCollege =
    account.collegeId && available.has(account.collegeId)
      ? account.collegeId
      : available.keys().next().value || null;
  const collegeId =
    requestedCollegeId ||
    defaultCollege ||
    (administrator ? account.collegeId : null);
  if (requestedCollegeId && !available.has(requestedCollegeId))
    throw Object.assign(
      new Error(
        "You do not have approved access to this college. Sign in again or choose an authorized college.",
      ),
      { statusCode: 403 },
    );
  const roles = (
    administrator
      ? [
          ...new Set([
            "SYSTEM_ADMIN",
            ...(available.get(collegeId || "")?.roleNames || []),
          ]),
        ]
      : available.get(collegeId || "")?.roleNames ||
        (globalRoles.includes("RESEARCHER") && !account.collegeId
          ? ["RESEARCHER"]
          : [])
  ) as InstitutionalRole[];
  return {
    collegeId,
    programId: collegeId === account.collegeId ? account.programId : null,
    roles,
    availableColleges: [...available.values()],
  };
}

/** Faculty directory filters must use the role granted in this college, not the account's union of roles. */
export function collegeUserWhere(
  collegeId: string,
  role?: string,
): Prisma.UserWhereInput {
  if (role && isCollegeRole(role))
    return {
      collegeMemberships: {
        some: {
          collegeId,
          college: { isActive: true },
          roleNames: { has: role as (typeof FACULTY_COLLEGE_ROLES)[number] },
        },
      },
    };
  if (role)
    return {
      collegeId,
      roles: { some: { role: { name: role as InstitutionalRole } } },
    };
  return {
    OR: [
      { collegeId },
      {
        collegeMemberships: {
          some: { collegeId, college: { isActive: true } },
        },
      },
    ],
  };
}
