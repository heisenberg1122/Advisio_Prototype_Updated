import { prisma, type Prisma } from "../lib/prisma.js";
import { ACTIVE_ADVISEE_STATUSES } from "../lib/adviser-capacity.js";
import { collegeUserWhere } from "../lib/college-authorization.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import type { MonitoringQuery } from "../schemas/dean-monitoring.schema.js";
import type {
  DeanReport,
  ReportType,
  ReportCell,
  MonitoringScope,
} from "@research-management/shared/src/dean-monitoring";
import {
  dateBounds,
  deanCollege,
  defenseStageName,
  defenseStageWhere,
  monitoringError,
  monitoringScope,
  projectWhere,
  TIMEZONE,
} from "./dean-monitoring-scope.js";

const outcomes = [
  "APPROVED",
  "APPROVED_WITH_MINOR_REVISIONS",
  "MAJOR_REVISIONS_REQUIRED",
  "REJECTED",
  "REDEFENSE_REQUIRED",
];
export const humanize = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
export const reportTitles: Record<ReportType, string> = {
  "research-progress": "Research Progress",
  "defense-outcomes": "Defense Outcomes",
  "adviser-workload": "Adviser Workload",
};
const col = (key: string, label: string) => ({ key, label });
type Dataset = Pick<
  DeanReport,
  "columns" | "rows" | "summary" | "definitions" | "breakdowns"
>;
export function stageProgress(
  status: string,
  completedAt: Date | null,
  sequence: number,
  count: number,
) {
  return completedAt || status === "COMPLETED"
    ? 100
    : count
      ? Math.max(0, Math.round(((sequence - 1) / count) * 100))
      : 0;
}
export function loadMetrics(groups: number, capacity: number) {
  return {
    slots: Math.max(0, capacity - groups),
    utilization: capacity
      ? `${Math.round((groups / capacity) * 100)}%`
      : "No capacity",
  };
}
function filterLabels(
  q: MonitoringQuery,
  scope: MonitoringScope,
  type: ReportType,
) {
  return {
    "Academic year":
      scope.academicYears.find((v) => v.id === q.academicYearId)?.name ||
      "All academic years",
    Program:
      scope.programs.find((v) => v.id === q.programId)?.name || "All programs",
    ...(type === "research-progress" && {
      Stage: scope.stages.find((v) => v.id === q.stageId)?.name || "All stages",
      "Research type":
        scope.researchTypes.find((v) => v.id === q.researchTypeId)?.name ||
        "All research types",
      Status: q.status === "all" ? "All statuses" : humanize(q.status),
    }),
    ...(type === "defense-outcomes" && {
      "Defense stage":
        scope.defenseStages.find(
          (v) =>
            v.id === (q.defenseType ? `event:${q.defenseType}` : q.stageId),
        )?.name || "All stages",
    }),
    ...(type === "defense-outcomes" && {
      "Release date from": q.from || "Any",
      "Release date to": q.to || "Any",
    }),
    ...(type === "adviser-workload" && {
      Availability: humanize(q.availability),
    }),
  };
}
async function reportDataset(
  db: Prisma.TransactionClient,
  collegeId: string,
  q: MonitoringQuery,
  type: ReportType,
  now: Date,
): Promise<Dataset> {
  const where = projectWhere(collegeId, q);
  if (type === "research-progress") {
    const projects = await db.researchProject.findMany({
      where: {
        ...where,
        ...(q.stageId && { workflowInstance: { currentStageId: q.stageId } }),
        ...(q.status !== "all" && { status: q.status }),
      },
      select: {
        id: true,
        title: true,
        groupName: true,
        status: true,
        completedAt: true,
        updatedAt: true,
        program: { select: { code: true } },
        academicYear: { select: { name: true } },
        researchType: { select: { name: true } },
        members: {
          where: { projectRole: "ADVISER", leftAt: null },
          select: { user: { select: { firstName: true, lastName: true } } },
        },
        workflowInstance: {
          select: {
            currentStage: { select: { name: true, sequence: true } },
            workflow: {
              select: {
                stages: {
                  where: { category: { not: "Archived" } },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ program: { code: "asc" } }, { title: "asc" }, { id: "asc" }],
    });
    const rows = projects.map((p) => ({
      id: p.id,
      title: p.title,
      group: p.groupName || "Not recorded",
      program: p.program.code,
      academicYear: p.academicYear.name,
      researchType: p.researchType.name,
      status: humanize(p.status),
      stage: p.workflowInstance?.currentStage?.name || "No workflow stage",
      progress: stageProgress(
        p.status,
        p.completedAt,
        p.workflowInstance?.currentStage?.sequence || 0,
        p.workflowInstance?.workflow.stages.length || 0,
      ),
      adviser:
        p.members
          .map((m) => `${m.user.firstName} ${m.user.lastName}`)
          .join(", ") || "Unassigned",
      inactiveDays: Math.max(
        0,
        Math.floor((now.getTime() - p.updatedAt.getTime()) / 86400000),
      ),
    }));
    return {
      columns: [
        col("title", "Project"),
        col("group", "Group"),
        col("program", "Program"),
        col("academicYear", "Academic year"),
        col("researchType", "Research type"),
        col("status", "Status"),
        col("stage", "Stage"),
        col("progress", "Stage progress (%)"),
        col("adviser", "Adviser"),
        col("inactiveDays", "Days since project update"),
      ],
      rows,
      summary: [
        { label: "Projects", value: rows.length },
        {
          label: "Completed",
          value: projects.filter((p) => p.status === "COMPLETED").length,
        },
        {
          label: "Without adviser",
          value: projects.filter((p) => !p.members.length).length,
        },
        {
          label: "Updated within 14 days",
          value: rows.filter((r) => r.inactiveDays < 14).length,
        },
        {
          label: "14–29 days since update",
          value: rows.filter((r) => r.inactiveDays >= 14 && r.inactiveDays < 30)
            .length,
        },
        {
          label: "30+ days since update",
          value: rows.filter((r) => r.inactiveDays >= 30).length,
        },
        ...[...new Set(rows.map((r) => r.stage))].map((stage) => ({
          label: `Stage: ${stage}`,
          value: rows.filter((r) => r.stage === stage).length,
        })),
        ...[...new Set(rows.map((r) => r.status))].map((status) => ({
          label: `Status: ${status}`,
          value: rows.filter((r) => r.status === status).length,
        })),
      ],
      definitions: [
        "Current-state project report; academic year selects the project cohort, not a historical snapshot.",
        "Stage-based progress reflects workflow position, not a grade or prediction.",
        "Days since project update uses the recorded project update time. Other research activity may not update this field; inactivity alone is not a missed deadline.",
      ],
    };
  }
  if (type === "defense-outcomes") {
    const sessions = await db.defenseSession.findMany({
      where: {
        research: where,
        releasedAt: { not: null, ...dateBounds(q) },
        ...defenseStageWhere(q),
      },
      select: {
        id: true,
        researchId: true,
        decision: true,
        releasedAt: true,
        eligibility: { select: { milestone: { select: { name: true } } } },
        defenseEvent: { select: { defenseType: true } },
        research: {
          select: {
            title: true,
            groupName: true,
            program: { select: { code: true } },
            academicYear: { select: { name: true } },
          },
        },
      },
      orderBy: [{ releasedAt: "desc" }, { id: "asc" }],
    });
    const valid = sessions.filter(
      (s) => s.decision && outcomes.includes(s.decision),
    );
    const rows = valid.map((s) => ({
      id: s.id,
      projectId: s.researchId,
      title: s.research.title,
      group: s.research.groupName || "Not recorded",
      program: s.research.program.code,
      academicYear: s.research.academicYear.name,
      stage:
        s.eligibility?.milestone.name ||
        defenseStageName(s.defenseEvent?.defenseType),
      decision: humanize(s.decision!),
      releasedAt: s.releasedAt!.toISOString(),
    }));
    const groups = new Map<
      string,
      {
        program: string;
        stage: string;
        attempts: number;
        projects: Set<string>;
        decisions: Map<string, number>;
      }
    >();
    for (const row of rows) {
      const key = JSON.stringify([row.program, row.stage]);
      const group = groups.get(key) || {
        program: row.program,
        stage: row.stage,
        attempts: 0,
        projects: new Set<string>(),
        decisions: new Map<string, number>(),
      };
      group.attempts++;
      group.projects.add(row.projectId);
      group.decisions.set(
        row.decision,
        (group.decisions.get(row.decision) || 0) + 1,
      );
      groups.set(key, group);
    }
    return {
      columns: [
        col("id", "Attempt ID"),
        col("title", "Project"),
        col("group", "Group"),
        col("program", "Program"),
        col("academicYear", "Academic year"),
        col("stage", "Defense stage"),
        col("decision", "Released decision"),
        col("releasedAt", "Released at (UTC)"),
      ],
      rows,
      summary: [
        { label: "Released attempts", value: valid.length },
        {
          label: "Distinct projects",
          value: new Set(valid.map((s) => s.researchId)).size,
        },
        ...outcomes.map((o) => ({
          label: humanize(o),
          value: valid.filter((s) => s.decision === o).length,
        })),
        {
          label: "Released records missing valid decision",
          value: sessions.length - valid.length,
        },
      ],
      breakdowns: [
        {
          title: "Outcomes by program and defense stage",
          columns: [
            col("program", "Program"),
            col("stage", "Defense stage"),
            col("attempts", "Attempts"),
            col("projects", "Distinct projects"),
            ...outcomes.map((o) => col(o, humanize(o))),
          ],
          rows: [...groups.values()]
            .sort(
              (a, b) =>
                a.program.localeCompare(b.program) ||
                a.stage.localeCompare(b.stage),
            )
            .map((g) => ({
              program: g.program,
              stage: g.stage,
              attempts: g.attempts,
              projects: g.projects.size,
              ...Object.fromEntries(
                outcomes.map((o) => [o, g.decisions.get(humanize(o)) || 0]),
              ),
            })),
        },
      ],
      definitions: [
        "Only released decisions enter outcome counts. Date filters apply to release time in Asia/Manila, including the entire end date.",
        "One session is one attempt. A project may have multiple attempts but is counted once in distinct projects.",
        "All five decision categories remain separate. Missing or invalid decisions are data-quality exceptions excluded from valid-outcome counts.",
      ],
    };
  }
  const [advisers, unassigned] = await Promise.all([
    db.user.findMany({
      where: {
        ...collegeUserWhere(collegeId, "ADVISER"),
        status: "ACTIVE",
        ...(q.availability !== "all" && {
          isAcceptingAdvisees: q.availability === "accepting",
        }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        collegeId: true,
        program: { select: { code: true } },
        maxAdviseeGroups: true,
        isAcceptingAdvisees: true,
        memberships: {
          where: {
            projectRole: "ADVISER",
            leftAt: null,
            research: { status: { in: ACTIVE_ADVISEE_STATUSES } },
          },
          select: {
            researchId: true,
            research: {
              select: {
                collegeId: true,
                programId: true,
                academicYearId: true,
              },
            },
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    }),
    db.researchProject.count({
      where: {
        ...where,
        status: { in: ACTIVE_ADVISEE_STATUSES },
        members: { none: { projectRole: "ADVISER", leftAt: null } },
      },
    }),
  ]);
  const rows: Record<string, ReportCell>[] = advisers.map((a) => {
    const all = new Set(a.memberships.map((m) => m.researchId)).size;
    const selected = new Set(
      a.memberships
        .filter(
          (m) =>
            m.research.collegeId === collegeId &&
            (!q.programId || m.research.programId === q.programId) &&
            (!q.academicYearId ||
              m.research.academicYearId === q.academicYearId),
        )
        .map((m) => m.researchId),
    ).size;
    const load = loadMetrics(all, a.maxAdviseeGroups);
    return {
      id: a.id,
      adviser: `${a.firstName} ${a.lastName}`,
      facultyProgram:
        a.collegeId === collegeId
          ? a.program?.code || "Not assigned"
          : "External faculty",
      selectedGroups: selected,
      totalActiveLoad: all,
      capacity: a.maxAdviseeGroups,
      availableSlots: load.slots,
      utilization: load.utilization,
      accepting: a.isAcceptingAdvisees
        ? "Accepting requests"
        : "Closed to requests",
    };
  });
  return {
    columns: [
      col("adviser", "Adviser"),
      col("facultyProgram", "Faculty program"),
      col("selectedGroups", "Selected-cohort groups"),
      col("totalActiveLoad", "Total active load"),
      col("capacity", "Capacity"),
      col("availableSlots", "Available slots"),
      col("utilization", "Utilization"),
      col("accepting", "Availability"),
    ],
    rows,
    summary: [
      { label: "Eligible active advisers", value: rows.length },
      { label: "Unassigned active groups", value: unassigned },
      {
        label: "Selected-cohort assignments",
        value: rows.reduce((sum, r) => sum + Number(r.selectedGroups), 0),
      },
    ],
    definitions: [
      "Selected-cohort groups use the project program and academic year; eligible advisers with no matching groups remain visible.",
      "Total active load and capacity utilization cover all active assignments across cohorts and colleges under existing capacity rules. Other colleges’ project details are not exposed.",
      "Active statuses: draft, submitted, under review, revision, approved, and defense. Groups are deduplicated per adviser. Assignments across different advisers are not a unique-project total.",
      "Zero capacity shows No capacity. Utilization may exceed 100%. Available slots do not override the accepting-requests setting.",
      "This is current workload, not reconstructed historical workload.",
    ],
  };
}
export async function deanReport(
  user: AuthenticatedUser,
  q: MonitoringQuery,
  type: ReportType,
  exporting = false,
): Promise<DeanReport> {
  const collegeId = deanCollege(user, q.collegeId);
  if (
    q.search ||
    q.view !== "upcoming" ||
    (!exporting && q.format) ||
    (type !== "defense-outcomes" && (q.from || q.to || q.defenseType)) ||
    (type !== "research-progress" &&
      (q.researchTypeId || q.status !== "all")) ||
    (type !== "adviser-workload" && q.availability !== "all") ||
    (type === "adviser-workload" && q.stageId)
  )
    throw monitoringError("These filters are not supported by this report.");
  const scope = await monitoringScope(
    collegeId,
    q,
    type === "defense-outcomes",
  );
  const now = new Date();
  const dataset = await prisma.$transaction(
    (db) => reportDataset(db, collegeId, q, type, now),
    { isolationLevel: "RepeatableRead", timeout: 20000 },
  );
  const total = dataset.rows.length;
  if (exporting && total > 5000)
    throw monitoringError(
      "This report exceeds 5,000 rows. Narrow the filters before exporting.",
      422,
    );
  return {
    ...dataset,
    type,
    title: reportTitles[type],
    scope,
    generatedAt: now.toISOString(),
    timezone: TIMEZONE,
    filters: filterLabels(q, scope, type),
    total,
    page: q.page,
    pageSize: q.pageSize,
    rows: exporting
      ? dataset.rows
      : dataset.rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
  };
}
