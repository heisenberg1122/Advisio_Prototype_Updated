import type { Prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import type { MonitoringQuery } from "../schemas/dean-monitoring.schema.js";
import type { MonitoringScope } from "@research-management/shared/src/dean-monitoring";
import { prisma } from "../lib/prisma.js";

export const monitoringError = (message: string, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
export function deanCollege(user: AuthenticatedUser, requested?: string) {
  if (!user.roles.some((r) => r === "DEAN" || r === "SYSTEM_ADMIN"))
    throw monitoringError("Dean access is required.", 403);
  if (!user.collegeId)
    throw monitoringError(
      "Choose an authorized college before opening this section.",
      403,
    );
  if (requested && requested !== user.collegeId)
    throw monitoringError(
      "The selected college does not match your active college.",
      403,
    );
  return user.collegeId;
}
export async function monitoringScope(
  collegeId: string,
  q: MonitoringQuery,
  includeDefenseStages = false,
): Promise<MonitoringScope> {
  const [college, programs, academicYears, stages, researchTypes, eventTypes] =
    await Promise.all([
      prisma.college.findUnique({
        where: { id: collegeId },
        select: { id: true, name: true, code: true },
      }),
      prisma.program.findMany({
        where: { collegeId },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      prisma.academicYear.findMany({
        select: { id: true, name: true, isCurrent: true },
        orderBy: { startDate: "desc" },
      }),
      prisma.workflowStage.findMany({
        where: {
          workflow: {
            OR: [
              { researchTypes: { some: { program: { collegeId } } } },
              { instances: { some: { research: { collegeId } } } },
            ],
          },
        },
        select: { id: true, name: true, milestoneType: true },
        orderBy: [{ sequence: "asc" }, { id: "asc" }],
      }),
      prisma.researchType.findMany({
        where: { program: { collegeId } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      includeDefenseStages
        ? prisma.defenseEvent.findMany({
            where: {
              collegeId,
              sessions: {
                some: { research: { collegeId }, eligibilityId: null },
              },
            },
            distinct: ["defenseType"],
            select: { defenseType: true },
            orderBy: { defenseType: "asc" },
          })
        : Promise.resolve([]),
    ]);
  if (!college) throw monitoringError("College not found.", 404);
  const legacyStages = eventTypes.map((e) => ({
    id: `event:${e.defenseType}`,
    name: defenseStageName(e.defenseType),
  }));
  const defenseStages = [
    ...stages
      .filter((s) => s.milestoneType === "DEFENSE_ELIGIBILITY")
      .map(({ id, name }) => ({ id, name })),
    ...legacyStages,
  ];
  for (const [value, options, label] of [
    [q.programId, programs, "program"],
    [q.academicYearId, academicYears, "academic year"],
    [q.stageId, includeDefenseStages ? defenseStages : stages, "stage"],
    [q.researchTypeId, researchTypes, "research type"],
    [q.defenseType && `event:${q.defenseType}`, legacyStages, "defense stage"],
  ] as const) {
    if (value && !options.some((o) => o.id === value))
      throw monitoringError(`Invalid ${label} for this scope.`);
  }
  return {
    college,
    programs,
    academicYears,
    stages: stages.map(({ id, name }) => ({ id, name })),
    defenseStages,
    researchTypes,
  };
}
export function projectWhere(
  collegeId: string,
  q: MonitoringQuery,
): Prisma.ResearchProjectWhereInput {
  return {
    collegeId,
    ...(q.programId && { programId: q.programId }),
    ...(q.academicYearId && { academicYearId: q.academicYearId }),
    ...(q.researchTypeId && { researchTypeId: q.researchTypeId }),
  };
}
export const TIMEZONE = "Asia/Manila";
export function defenseStageName(value: string | undefined) {
  return value
    ? value
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Not recorded";
}
export function defenseStageWhere(
  q: MonitoringQuery,
): Prisma.DefenseSessionWhereInput {
  return q.stageId
    ? { eligibility: { milestoneId: q.stageId } }
    : q.defenseType
      ? { eligibilityId: null, defenseEvent: { defenseType: q.defenseType } }
      : {};
}
// Institution currently operates in Manila (UTC+08:00, no DST). Date inputs are local calendar dates.
export function dateBounds(q: Pick<MonitoringQuery, "from" | "to">) {
  return {
    ...(q.from && { gte: new Date(`${q.from}T00:00:00+08:00`) }),
    ...(q.to && {
      lt: new Date(new Date(`${q.to}T00:00:00+08:00`).getTime() + 86400000),
    }),
  };
}
