import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { seedReferenceData } from "@research-management/database";
import {
  EVALUATION_ROLES,
  type EvaluationCourse,
  type EvaluationRole,
} from "./catalog.js";
import { schemaName } from "./config.js";
import type { WorkspaceAccounts, WorkspaceScenario } from "./seed.js";

export const FRESH_ACCOUNT_SCENARIO = "fresh-account";

/** A second private dataset belongs to the same server-generated session. */
export function freshWorkspaceId(sessionId: string) {
  schemaName(sessionId);
  return createHash("sha256")
    .update("advisio-evaluation:fresh:" + sessionId)
    .digest("hex")
    .slice(0, 32);
}

export function workspaceDatasetIds(sessionId: string) {
  schemaName(sessionId);
  return [sessionId, freshWorkspaceId(sessionId)];
}

export function attachFreshAccounts(
  accounts: WorkspaceAccounts,
  fresh: Record<EvaluationRole, WorkspaceScenario>,
) {
  for (const { id } of EVALUATION_ROLES) {
    accounts[id].scenarios = [...(accounts[id].scenarios || []), fresh[id]];
  }
}

/** Only the new, empty evaluation schema is passed here. No sample work is copied. */
export async function seedFreshAccounts(
  db: PrismaClient,
  course: EvaluationCourse,
) {
  await seedReferenceData(db);
  const college = await db.college.findUniqueOrThrow({
    where: { code: course.collegeCode },
  });
  const program = await db.program.findFirstOrThrow({
    where: { code: course.id, collegeId: college.id },
  });
  const year = await db.academicYear.create({
    data: {
      name: "2026-2027",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2027-06-30"),
      isCurrent: true,
    },
  });
  // A research type is reference configuration, not an existing class or project.
  await db.researchType.create({
    data: { programId: program.id, code: "AY26-PROPOSAL", name: course.type },
  });
  const roles = await db.role.findMany();
  const names: Record<EvaluationRole, string> = {
    student: course.researchers[0],
    adviser: course.adviser,
    professor: "Paolo Villanueva",
    panelist: "Marisol Cruz",
    dean: "Aurelia Mendoza",
  };
  const accounts = {} as Record<EvaluationRole, WorkspaceScenario>;
  for (const role of EVALUATION_ROLES) {
    const [firstName, ...rest] = names[role.id].split(" ");
    const user = await db.user.create({
      data: {
        universityId: `AY26-FRESH-${role.id.toUpperCase()}`,
        email: `fresh-${role.id}@evaluation.invalid`,
        firstName,
        lastName: rest.join(" "),
        passwordHash: randomBytes(48).toString("hex"),
        status: "ACTIVE",
        collegeId: college.id,
        programId: program.id,
        roles: {
          create: {
            roleId: roles.find((item) => item.name === role.institutionalRole)!
              .id,
          },
        },
        collegeMemberships: {
          create: {
            collegeId: college.id,
            roleNames: [role.institutionalRole],
          },
        },
      },
    });
    if (role.id === "student") {
      await db.researcherProfile.create({
        data: {
          userId: user.id,
          academicYearId: year.id,
          degreeLevel: "UNDERGRADUATE",
          yearLevel: "YEAR_4",
          academicTerm: "FIRST_SEMESTER",
          researchStatus: "NO_PROJECT",
          status: "NOT_STARTED",
          interests: [],
        },
      });
    } else {
      await db.facultyProfile.create({
        data: {
          userId: user.id,
          academicTitle: "Faculty Member",
          facultyDesignation: role.institutionalRole,
          department: college.name,
          expertiseKeywords: [],
          researchInterests: [],
        },
      });
    }
    accounts[role.id] = {
      id: FRESH_ACCOUNT_SCENARIO,
      label: "Fresh account",
      userId: user.id,
      projectId: null,
      title: "Fresh account",
      defenseId: null,
      home: role.home,
    };
  }
  return accounts;
}
