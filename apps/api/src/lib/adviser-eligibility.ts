import type { Prisma } from "./prisma.js";

export const adviserIdentitySelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} satisfies Prisma.UserSelect;

export function adviserIdentity({
  id,
  firstName,
  lastName,
  email,
}: Prisma.UserGetPayload<{ select: typeof adviserIdentitySelect }>) {
  return { id, firstName, lastName, email };
}

export const adviserEligibilitySelect = {
  collegeId: true,
  programId: true,
  status: true,
  collegeMemberships: {
    where: { roleNames: { has: "ADVISER" }, college: { isActive: true } },
    select: { collegeId: true },
  },
} satisfies Prisma.UserSelect;

export function hasEligibleAdviserAccount(
  adviser: Prisma.UserGetPayload<{ select: typeof adviserEligibilitySelect }>,
  project: { collegeId: string; programId: string },
) {
  return (
    adviser.status === "ACTIVE" &&
    adviser.collegeMemberships.some((membership) => membership.collegeId === project.collegeId) &&
    (adviser.collegeId !== project.collegeId ||
      !adviser.programId ||
      adviser.programId === project.programId)
  );
}
