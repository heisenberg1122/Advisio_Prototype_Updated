import type { QueryClient } from "@tanstack/react-query";
import type { UserProfile } from "@/providers/auth-provider";
import { apiClient, ApiError } from "./api-client";

export type CohortStatus = "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
type Named = { id: string; name: string; code?: string };
export interface CoordinatorCohort {
  id: string;
  name: string;
  description: string | null;
  collegeId: string;
  programId: string;
  researchTypeId: string;
  academicYearId: string;
  workflowId: string | null;
  status: CohortStatus;
  college: Named;
  program: Named;
  researchType: Named;
  academicYear: Named;
  workflow: ProcessOption | null;
  _count: { members: number; workspaces: number; researchProjects: number };
}
export interface ProcessOption {
  id: string;
  name: string;
  version: number;
  status: string;
  researchTypeId: string;
}
export interface CohortMember {
  id: string;
  userId: string;
  status: "ACTIVE" | "REMOVED";
  joinedAt: string;
  removedAt: string | null;
  user: { id: string; firstName: string; lastName: string };
}
export interface AcademicProgram extends Named {
  collegeId: string;
  isActive?: boolean;
  college?: Named & { isActive?: boolean };
  researchTypes: Array<Named & { programId: string; isActive: boolean }>;
}
export interface AcademicYear extends Named {
  isActive: boolean;
}
export type CoordinatorIdentity = Pick<
  UserProfile,
  "roles" | "permissions" | "college" | "program"
>;
export const cohortKeys = {
  all: ["coordinator-cohorts"] as const,
  list: ["coordinator-cohorts", "list"] as const,
  detail: (id: string) => ["coordinator-cohorts", "detail", id] as const,
  members: (id: string) => ["coordinator-cohorts", "members", id] as const,
};
export function canManageCohorts(user?: CoordinatorIdentity | null) {
  return Boolean(
    user?.roles.some((role) =>
      ["RESEARCH_COORDINATOR", "PROFESSOR", "SYSTEM_ADMIN"].includes(role),
    ),
  );
}
export function scopedPrograms(
  programs: AcademicProgram[],
  user: CoordinatorIdentity,
) {
  if (!canManageCohorts(user)) return [];
  return programs.filter(
    (program) =>
      program.isActive !== false &&
      program.college?.isActive !== false &&
      (user.roles.includes("SYSTEM_ADMIN") ||
        (program.collegeId === user.college?.id &&
          (!user.program?.id || program.id === user.program.id))),
  );
}
export const statusLabels: Record<CohortStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};
export function cohortActions(cohort: CoordinatorCohort) {
  const open = cohort.status === "DRAFT" || cohort.status === "ACTIVE";
  // This mirrors the existing service's restriction; the server still validates every write.
  return {
    edit: cohort.status !== "ARCHIVED",
    members: open,
    assign:
      open &&
      cohort._count.workspaces === 0 &&
      cohort._count.researchProjects === 0,
    statuses: (
      {
        DRAFT: ["ACTIVE", "ARCHIVED"],
        ACTIVE: ["CLOSED", "ARCHIVED"],
        CLOSED: ["ACTIVE", "ARCHIVED"],
        ARCHIVED: [],
      } satisfies Record<CohortStatus, CohortStatus[]>
    )[cohort.status],
  };
}
export function eligibleProcesses(
  processes: ProcessOption[],
  cohort: CoordinatorCohort,
) {
  return processes.filter(
    (process) =>
      process.status === "PUBLISHED" &&
      process.researchTypeId === cohort.researchTypeId,
  );
}
export async function loadCoordinatorCohorts() {
  const cohorts: CoordinatorCohort[] = [];
  for (let page = 1; ; page++) {
    const result = await apiClient.get<{
      cohorts: CoordinatorCohort[];
      pagination: { totalPages: number };
    }>("/api/cohorts", { params: { page, limit: 100 } });
    cohorts.push(...result.cohorts);
    if (page >= result.pagination.totalPages) return { cohorts };
  }
}
export async function refreshCoordinatorCohorts(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: cohortKeys.all }),
    client.invalidateQueries({ queryKey: ["professor-research"] }),
  ]);
}
async function acceptCohort(
  client: QueryClient,
  result: { cohort: CoordinatorCohort },
) {
  const value = result.cohort;
  client.setQueryData(cohortKeys.detail(value.id), result);
  client.setQueryData<{ cohorts: CoordinatorCohort[] }>(
    cohortKeys.list,
    (old) => ({
      cohorts: [
        value,
        ...(old?.cohorts || []).filter((item) => item.id !== value.id),
      ],
    }),
  );
  await refreshCoordinatorCohorts(client);
  return value;
}
export async function createCoordinatorCohort(
  client: QueryClient,
  user: CoordinatorIdentity,
  programs: AcademicProgram[],
  years: AcademicYear[],
  draft: {
    name: string;
    description: string;
    programId: string;
    researchTypeId: string;
    academicYearId: string;
  },
) {
  const program = scopedPrograms(programs, user).find(
    (item) => item.id === draft.programId,
  );
  const track = program?.researchTypes.find(
    (item) =>
      item.id === draft.researchTypeId &&
      item.isActive &&
      item.programId === program.id,
  );
  const year = years.find(
    (item) => item.id === draft.academicYearId && item.isActive,
  );
  if (!program || !track || !year)
    throw new Error(
      "Select an available program, research track and academic year within your scope.",
    );
  const result = await apiClient.post<{ cohort: CoordinatorCohort }>(
    "/api/cohorts",
    {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      collegeId: program.collegeId,
      programId: program.id,
      researchTypeId: track.id,
      academicYearId: year.id,
    },
  );
  return acceptCohort(client, result);
}
export async function updateCoordinatorCohort(
  client: QueryClient,
  id: string,
  values: { name?: string; description?: string | null; status?: CohortStatus },
) {
  return acceptCohort(
    client,
    await apiClient.patch<{ cohort: CoordinatorCohort }>(
      `/api/cohorts/${encodeURIComponent(id)}`,
      values,
    ),
  );
}
export async function assignCoordinatorProcess(
  client: QueryClient,
  cohort: CoordinatorCohort,
  processes: ProcessOption[],
  processId: string,
) {
  if (
    !cohortActions(cohort).assign ||
    !eligibleProcesses(processes, cohort).some((item) => item.id === processId)
  )
    throw new Error(
      "This process cannot be assigned to the selected research cohort.",
    );
  return acceptCohort(
    client,
    await apiClient.put<{ cohort: CoordinatorCohort }>(
      `/api/cohorts/${encodeURIComponent(cohort.id)}/workflow`,
      { workflowId: processId },
    ),
  );
}
export interface ResearcherOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  universityId?: string;
}
export async function addCoordinatorResearcher(
  client: QueryClient,
  cohortId: string,
  researchers: ResearcherOption[],
  userId: string,
) {
  if (!researchers.some((item) => item.id === userId))
    throw new Error("Choose an eligible researcher from the search results.");
  const result = await apiClient.post<{ members: CohortMember[] }>(
    `/api/cohorts/${encodeURIComponent(cohortId)}/members`,
    { userIds: [userId] },
  );
  client.setQueryData<{ members: CohortMember[] }>(
    cohortKeys.members(cohortId),
    (old) => ({
      members: [
        ...(old?.members || []).filter(
          (item) =>
            !result.members.some((member) => member.userId === item.userId),
        ),
        ...result.members,
      ],
    }),
  );
  await refreshCoordinatorCohorts(client);
}
export async function removeCoordinatorResearcher(
  client: QueryClient,
  cohortId: string,
  userId: string,
) {
  const result = await apiClient.delete<{ member: CohortMember }>(
    `/api/cohorts/${encodeURIComponent(cohortId)}/members/${encodeURIComponent(userId)}`,
  );
  client.setQueryData<{ members: CohortMember[] }>(
    cohortKeys.members(cohortId),
    (old) => ({
      members: (old?.members || []).map((item) =>
        item.userId === userId ? { ...item, ...result.member } : item,
      ),
    }),
  );
  await refreshCoordinatorCohorts(client);
}
export function cohortError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (
    (error instanceof ApiError && error.statusCode >= 500) ||
    /Prisma|P20\d\d|SQL|constraint|database|stack trace/i.test(message)
  )
    return "Unable to complete the cohort operation. Please try again.";
  if (/published workflow|publish.*before activat/i.test(message))
    return "Only published research processes can be assigned to or activated for a cohort.";
  if (
    /workflow.*scope|workflow.*research type|workflow not found/i.test(message)
  )
    return "This process cannot be assigned to the selected research cohort.";
  if (/Every selected account|active researcher/i.test(message))
    return "This researcher cannot be added to the selected cohort.";
  if (/status transition/i.test(message))
    return "This cohort cannot be moved to the requested status.";
  return (
    message.replace(/workflow/gi, "research process") ||
    "Unable to complete the cohort operation. Please try again."
  );
}
