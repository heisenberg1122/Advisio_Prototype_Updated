import { createHash } from "node:crypto";
import { z } from "zod";
import { Permissions } from "@research-management/auth";
import { Prisma, prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../middleware/auth.js";
import { recordAudit } from "./audit.service.js";
import {
  calculateClassPeriod,
  type PeriodWeights,
} from "./class-record-calculation.js";

type Db = Prisma.TransactionClient | typeof prisma;
export const periodCode = z.enum(["PRELIM", "MIDTERM", "FINALS"]);
export const uuid = z.string().uuid();
const number = z
  .number()
  .finite()
  .min(0)
  .max(10000)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001,
    "Use at most two decimal places.",
  );
const mutation = {
  expectedRevision: z.number().int().min(0),
  reason: z.string().trim().max(500).default(""),
};
export const recordSettings = z.object({
  ...mutation,
  weights: z
    .object({
      MILESTONE: z.number().int().min(0).max(100),
      INDIVIDUAL: z.number().int().min(0).max(100),
      ATTENDANCE: z.number().int().min(0).max(100),
    })
    .strict()
    .refine(
      (w) => Object.values(w).reduce((a, b) => a + b, 0) === 100,
      "Category weights must total 100%.",
    )
    .nullable(),
  lateCredit: z.number().int().min(0).max(100),
  overallWeight: z.number().int().min(0).max(100).nullable(),
});
export const recordItem = z
  .object({
    ...mutation,
    title: z.string().trim().min(2).max(150),
    kind: z.enum(["MILESTONE", "INDIVIDUAL"]),
    maxPoints: z.number().int().min(1).max(10000),
    taskId: uuid.nullable().default(null),
  })
  .refine(
    (v) => (v.kind === "MILESTONE" ? !!v.taskId : !v.taskId),
    "Choose a requirement for a linked milestone.",
  );
export const recordScores = z.object({
  ...mutation,
  entries: z
    .array(
      z
        .object({
          itemId: uuid,
          studentId: uuid,
          state: z.enum(["GRADED", "UNGRADED", "MISSING", "EXCUSED"]),
          score: number.nullable(),
        })
        .refine(
          (v) => (v.state === "GRADED" ? v.score !== null : v.score === null),
          "Only graded entries accept a score.",
        ),
    )
    .min(1)
    .max(1000),
});
export const recordSession = z.object({
  ...mutation,
  title: z.string().trim().min(2).max(150),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (d) =>
        !Number.isNaN(Date.parse(d)) &&
        new Date(d).toISOString().slice(0, 10) === d,
      "Choose a valid date.",
    ),
});
export const recordMarks = z.object({
  ...mutation,
  entries: z
    .array(
      z.object({
        sessionId: uuid,
        studentId: uuid,
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]).nullable(),
      }),
    )
    .min(1)
    .max(1000),
});
export const recordRelease = z.object({
  ...mutation,
  expectedSourceToken: z.string().length(64),
  studentIds: z.array(uuid).min(1).max(1000).optional(),
});
export class ClassRecordError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}
function fail(message: string, status = 400): never {
  throw new ClassRecordError(message, status);
}

export async function assertClassRecordAccess(
  workflowId: string,
  user: AuthenticatedUser,
  teacher: boolean,
  db: Db = prisma,
) {
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    include: { researchTypes: { select: { id: true } } },
  });
  if (!workflow) return fail("Class not found.", 404);
  const type = await db.researchType.findUnique({
    where: { id: workflow.researchTypeId },
    select: { program: { select: { collegeId: true } } },
  });
  if (!type || type.program.collegeId !== user.collegeId)
    return fail("Switch to this class's authorized college first.", 403);
  if (teacher) {
    if (
      user.researcherPanel ||
      !user.roles.includes("RESEARCH_COORDINATOR") ||
      !user.permissions.includes(Permissions.WORKFLOW_EDIT) ||
      workflow.createdBy !== user.id
    )
      return fail("Only this class's professor can manage its record.", 403);
  } else {
    if (
      !user.roles.includes("RESEARCHER") ||
      !(await db.workflowEnrollment.findFirst({
        where: { workflowId, userId: user.id, status: "ACTIVE" },
        select: { id: true },
      }))
    )
      return fail("You are not an active researcher in this class.", 403);
  }
  return { ...workflow, collegeId: type.program.collegeId };
}

export async function listRecordClasses(
  user: AuthenticatedUser,
  teacher: boolean,
) {
  if (
    teacher &&
    (user.researcherPanel ||
      !user.roles.includes("RESEARCH_COORDINATOR") ||
      !user.permissions.includes(Permissions.WORKFLOW_EDIT))
  )
    return fail("Professor access is required.", 403);
  if (!teacher && !user.roles.includes("RESEARCHER"))
    return fail("Researcher access is required.", 403);
  if (!user.collegeId) return { classes: [] };
  // The canonical research type owns the college scope; templates can be reused.
  const types = await prisma.researchType.findMany({
    where: { program: { collegeId: user.collegeId } },
    select: { id: true },
  });
  const classes = await prisma.workflow.findMany({
    where: {
      researchTypeId: { in: types.map((t) => t.id) },
      ...(teacher
        ? { createdBy: user.id }
        : { enrollments: { some: { userId: user.id, status: "ACTIVE" } } }),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      _count: { select: { classRecordPeriods: true } },
      creator: { select: { firstName: true, lastName: true } },
    },
  });
  return {
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      ready: c._count.classRecordPeriods > 0,
      professor: `${c.creator.firstName} ${c.creator.lastName}`,
    })),
  };
}

async function audit(
  db: Db,
  workflowId: string,
  user: AuthenticatedUser,
  eventType: string,
  values: Record<string, unknown>,
) {
  await recordAudit(db, {
    userId: user.id,
    actorRoles: user.roles,
    action: "UPDATE",
    entityType: "ClassRecord",
    entityId: workflowId,
    category: "ACADEMIC",
    eventType,
    newValues: {
      actorName:
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        "Course professor",
      ...values,
    },
  });
}
export async function initializeClassRecord(
  workflowId: string,
  user: AuthenticatedUser,
) {
  return prisma.$transaction(async (tx) => {
    await assertClassRecordAccess(workflowId, user, true, tx);
    const result = await tx.classRecordPeriod.createMany({
      data: periodCode.options.map((code) => ({ workflowId, code })),
      skipDuplicates: true,
    });
    if (result.count)
      await audit(tx, workflowId, user, "CLASS_RECORD_CREATED", {
        periods: periodCode.options,
      });
    return { created: result.count };
  });
}

async function roster(workflowId: string, collegeId: string, db: Db) {
  const enrollments = await db.workflowEnrollment.findMany({
    where: {
      workflowId,
      status: "ACTIVE",
      user: {
        status: "ACTIVE",
        roles: { some: { role: { name: "RESEARCHER" } } },
      },
    },
    select: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          universityId: true,
          memberships: {
            where: {
              leftAt: null,
              projectRole: { in: ["LEADER", "MEMBER"] },
              research: { collegeId, workflowInstance: { workflowId } },
            },
            select: {
              research: { select: { id: true, title: true, groupName: true } },
            },
          },
        },
      },
    },
  });
  return enrollments
    .map(({ user }) => ({
      id: user.id,
      name: `${user.lastName}, ${user.firstName}`,
      universityId: user.universityId,
      projects: user.memberships.map((m) => ({
        id: m.research.id,
        name: m.research.groupName || m.research.title,
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

async function periodData(
  workflowId: string,
  code: string,
  collegeId: string,
  db: Db,
) {
  const period = await db.classRecordPeriod.findUnique({
    where: { workflowId_code: { workflowId, code } },
    include: {
      items: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { scores: true },
      },
      sessions: { orderBy: { date: "asc" }, include: { marks: true } },
    },
  });
  if (!period) return null;
  const students = await roster(workflowId, collegeId, db);
  const projectIds = [
    ...new Set(students.flatMap((s) => s.projects.map((p) => p.id))),
  ];
  const taskIds = period.items.flatMap((i) => (i.taskId ? [i.taskId] : []));
  const submissions =
    taskIds.length && projectIds.length
      ? await db.taskSubmission.findMany({
          where: { researchId: { in: projectIds }, taskId: { in: taskIds } },
          include: { grades: { where: { releasedAt: { not: null } } } },
        })
      : [];
  const releases = await db.classRecordRelease.findMany({
    where: {
      periodId: period.id,
      studentId: { in: students.map((s) => s.id) },
    },
    orderBy: [{ releasedAt: "desc" }, { id: "desc" }],
    select: { id: true, studentId: true, releasedAt: true, snapshot: true },
  });
  const rows = students.map((student) => {
    const entries = period.items.map((item) => {
      const own = item.scores.find((s) => s.studentId === student.id);
      const matches = item.taskId
        ? submissions.filter(
            (s) =>
              s.taskId === item.taskId &&
              student.projects.some((p) => p.id === s.researchId),
          )
        : [];
      const submission = matches.length === 1 ? matches[0] : null;
      const grade = submission?.grades.find(
        (g) =>
          g.documentVersionId === submission.documentVersionId &&
          g.maxPoints === item.maxPoints,
      );
      const source = grade
        ? {
            gradeId: grade.id,
            documentVersionId: grade.documentVersionId,
            taskId: item.taskId,
            submissionId: submission!.id,
            releasedAt: grade.releasedAt!.toISOString(),
          }
        : null;
      return {
        itemId: item.id,
        title: item.title,
        kind: item.kind,
        maxPoints: item.maxPoints,
        score:
          item.kind === "MILESTONE"
            ? grade?.releasedScore == null
              ? null
              : Number(grade.releasedScore)
            : own?.score == null
              ? null
              : Number(own.score),
        state:
          item.kind === "MILESTONE"
            ? grade
              ? "GRADED"
              : "UNGRADED"
            : own?.state || "UNGRADED",
        source,
        sourceNote:
          item.kind !== "MILESTONE"
            ? null
            : matches.length > 1
              ? "Multiple project submissions need review."
              : !grade
                ? "Awaiting a released grade for the current submission."
                : null,
      };
    });
    const attendance = period.sessions.map((session) => ({
      sessionId: session.id,
      title: session.title,
      date: session.date.toISOString().slice(0, 10),
      status:
        session.marks.find((m) => m.studentId === student.id)?.status || null,
    }));
    return {
      ...student,
      entries,
      attendance,
      calculation: calculateClassPeriod(
        entries,
        attendance.map((a) => a.status),
        period.weights as PeriodWeights | null,
        period.lateCredit,
      ),
      lastRelease: releases.find((r) => r.studentId === student.id) || null,
    };
  });
  const sourceToken = createHash("sha256")
    .update(
      JSON.stringify(
        rows.map((row) => [
          row.id,
          row.entries
            .filter((i) => i.kind === "MILESTONE")
            .map((i) => [i.itemId, i.score, i.source]),
        ]),
      ),
    )
    .digest("hex");
  return {
    id: period.id,
    code: period.code,
    revision: period.revision,
    weights: period.weights,
    overallWeight: period.overallWeight,
    lateCredit: period.lateCredit,
    sourceToken,
    items: period.items.map(({ id, title, kind, maxPoints, taskId }) => ({
      id,
      title,
      kind,
      maxPoints,
      taskId,
    })),
    sessions: period.sessions.map(({ id, title, date }) => ({
      id,
      title,
      date: date.toISOString().slice(0, 10),
    })),
    rows,
  };
}

export async function getClassRecord(
  workflowId: string,
  user: AuthenticatedUser,
) {
  const workflow = await assertClassRecordAccess(workflowId, user, true);
  const periods = await Promise.all(
    periodCode.options.map((code) =>
      periodData(workflowId, code, workflow.collegeId, prisma),
    ),
  );
  const tasks = await prisma.workflowTask.findMany({
    where: {
      stage: { workflowId, milestoneType: "STANDARD", requiresDocument: true },
      maxPoints: { not: null },
      classRecordItem: null,
    },
    orderBy: [{ stage: { sequence: "asc" } }, { sequence: "asc" }],
    select: {
      id: true,
      title: true,
      maxPoints: true,
      stage: { select: { name: true } },
    },
  });
  const history = await prisma.auditLog.findMany({
    where: { entityType: "ClassRecord", entityId: workflowId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, eventType: true, createdAt: true, newValues: true },
  });
  return {
    workflow: { id: workflow.id, name: workflow.name },
    periods: periods.filter((p) => p !== null),
    availableTasks: tasks,
    history,
  };
}

async function mutatePeriod<
  T extends { expectedRevision: number; reason: string },
>(
  workflowId: string,
  code: string,
  user: AuthenticatedUser,
  input: T,
  event: string,
  change: (
    db: Prisma.TransactionClient,
    period: any,
    data: NonNullable<Awaited<ReturnType<typeof periodData>>>,
  ) => Promise<Record<string, unknown>>,
) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const workflow = await assertClassRecordAccess(
          workflowId,
          user,
          true,
          tx,
        );
        const period = await tx.classRecordPeriod.findUnique({
          where: { workflowId_code: { workflowId, code } },
        });
        if (!period) return fail("Create the class record first.", 404);
        const lock = await tx.classRecordPeriod.updateMany({
          where: { id: period.id, revision: input.expectedRevision },
          data: { revision: { increment: 1 } },
        });
        if (!lock.count)
          return fail(
            "This period changed in another session. Reload before saving.",
            409,
          );
        const data = await periodData(workflowId, code, workflow.collegeId, tx);
        const changes = await change(tx, period, data!);
        await audit(tx, workflowId, user, event, {
          period: code,
          reason: input.reason,
          ...changes,
        });
        return { saved: true, revision: input.expectedRevision + 1 };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 20000,
      },
    );
  } catch (error: any) {
    if (["P2034", "P2002"].includes(error.code))
      return fail(
        "The record changed, or this requirement/date already exists. Reload before trying again.",
        409,
      );
    throw error;
  }
}
const correction = (reason: string) => {
  if (reason.trim().length < 5)
    fail("Add a correction note of at least 5 characters.");
};
export function saveRecordSettings(
  workflowId: string,
  code: string,
  user: AuthenticatedUser,
  input: z.infer<typeof recordSettings>,
) {
  return mutatePeriod(
    workflowId,
    code,
    user,
    input,
    "CLASS_RECORD_SETTINGS",
    async (tx, p, data) => {
      if (data.rows.some((r) => r.lastRelease)) correction(input.reason);
      await tx.classRecordPeriod.update({
        where: { id: p.id },
        data: {
          weights: input.weights === null ? Prisma.DbNull : input.weights,
          overallWeight: input.overallWeight,
          lateCredit: input.lateCredit,
        },
      });
      return {
        weights: input.weights,
        overallWeight: input.overallWeight,
        lateCredit: input.lateCredit,
      };
    },
  );
}
export function addRecordItem(
  workflowId: string,
  code: string,
  user: AuthenticatedUser,
  input: z.infer<typeof recordItem>,
) {
  return mutatePeriod(
    workflowId,
    code,
    user,
    input,
    "CLASS_RECORD_ACTIVITY_ADDED",
    async (tx, p) => {
      if (input.taskId) {
        const task = await tx.workflowTask.findFirst({
          where: {
            id: input.taskId,
            stage: {
              workflowId,
              milestoneType: "STANDARD",
              requiresDocument: true,
            },
          },
          select: { maxPoints: true },
        });
        if (!task || task.maxPoints !== input.maxPoints)
          fail(
            "Choose a graded requirement from this class with matching points.",
          );
      }
      const item = await tx.classRecordItem.create({
        data: {
          periodId: p.id,
          title: input.title,
          kind: input.kind,
          maxPoints: input.maxPoints,
          taskId: input.taskId,
        },
      });
      return {
        itemId: item.id,
        title: item.title,
        kind: item.kind,
        maxPoints: item.maxPoints,
      };
    },
  );
}
export function saveRecordScores(
  workflowId: string,
  code: string,
  user: AuthenticatedUser,
  input: z.infer<typeof recordScores>,
) {
  return mutatePeriod(
    workflowId,
    code,
    user,
    input,
    "CLASS_RECORD_SCORES_SAVED",
    async (tx, p, data) => {
      const keys = new Set<string>();
      const changes: unknown[] = [];
      for (const entry of input.entries) {
        const key = `${entry.itemId}:${entry.studentId}`;
        if (keys.has(key)) fail("Duplicate score entry.");
        keys.add(key);
        const item = data.items.find(
          (i) => i.id === entry.itemId && i.kind === "INDIVIDUAL",
        );
        const row = data.rows.find((r) => r.id === entry.studentId);
        if (!item || !row)
          fail(
            "Use an individual activity and an active researcher from this class.",
            403,
          );
        if (entry.score !== null && entry.score > item.maxPoints)
          fail(`A score cannot exceed ${item.maxPoints}.`);
        const old = row.entries.find((e) => e.itemId === entry.itemId)!;
        const score = entry.state === "MISSING" ? 0 : entry.score;
        if (old.state === entry.state && old.score === score) continue;
        if (old.state !== "UNGRADED" || row.lastRelease)
          correction(input.reason);
        await tx.classRecordScore.upsert({
          where: {
            itemId_studentId: {
              itemId: entry.itemId,
              studentId: entry.studentId,
            },
          },
          create: {
            itemId: entry.itemId,
            studentId: entry.studentId,
            state: entry.state,
            score,
          },
          update: { state: entry.state, score },
        });
        const change = {
          studentId: entry.studentId,
          itemId: entry.itemId,
          studentName: row.name,
          activityTitle: item.title,
          oldScore: old.score,
          oldState: old.state,
          newScore: score,
          newState: entry.state,
        };
        changes.push(change);
        await audit(tx, workflowId, user, "CLASS_RECORD_SCORE_CHANGED", {
          period: code,
          reason: input.reason,
          ...change,
        });
      }
      return { changedEntries: changes.length };
    },
  );
}
export function addRecordSession(
  workflowId: string,
  code: string,
  user: AuthenticatedUser,
  input: z.infer<typeof recordSession>,
) {
  return mutatePeriod(
    workflowId,
    code,
    user,
    input,
    "CLASS_RECORD_ATTENDANCE_DATE_ADDED",
    async (tx, p) => {
      const session = await tx.classRecordSession.create({
        data: {
          periodId: p.id,
          title: input.title,
          date: new Date(input.date + "T00:00:00.000Z"),
        },
      });
      return { sessionId: session.id, date: input.date, title: input.title };
    },
  );
}
export function saveRecordMarks(
  workflowId: string,
  code: string,
  user: AuthenticatedUser,
  input: z.infer<typeof recordMarks>,
) {
  return mutatePeriod(
    workflowId,
    code,
    user,
    input,
    "CLASS_RECORD_ATTENDANCE_SAVED",
    async (tx, p, data) => {
      const keys = new Set<string>();
      const changes: unknown[] = [];
      for (const entry of input.entries) {
        const key = `${entry.sessionId}:${entry.studentId}`;
        if (keys.has(key)) fail("Duplicate attendance entry.");
        keys.add(key);
        const row = data.rows.find((r) => r.id === entry.studentId);
        const old = row?.attendance.find(
          (a) => a.sessionId === entry.sessionId,
        );
        if (!old || !row)
          fail(
            "Use an attendance date and active researcher from this class.",
            403,
          );
        if (old.status === entry.status) continue;
        if (old.status !== null || row.lastRelease) correction(input.reason);
        if (entry.status === null)
          await tx.classRecordAttendance.deleteMany({
            where: { sessionId: entry.sessionId, studentId: entry.studentId },
          });
        else
          await tx.classRecordAttendance.upsert({
            where: {
              sessionId_studentId: {
                sessionId: entry.sessionId,
                studentId: entry.studentId,
              },
            },
            create: {
              sessionId: entry.sessionId,
              studentId: entry.studentId,
              status: entry.status,
            },
            update: { status: entry.status },
          });
        const change = {
          ...entry,
          studentName: row.name,
          sessionTitle: old.title,
          date: old.date,
          previousStatus: old.status,
        };
        changes.push(change);
        await audit(tx, workflowId, user, "CLASS_RECORD_ATTENDANCE_CHANGED", {
          period: code,
          reason: input.reason,
          ...change,
        });
      }
      return { changedEntries: changes.length };
    },
  );
}
export function releaseClassPeriod(
  workflowId: string,
  code: string,
  user: AuthenticatedUser,
  input: z.infer<typeof recordRelease>,
) {
  return mutatePeriod(
    workflowId,
    code,
    user,
    input,
    "CLASS_RECORD_GRADES_RELEASED",
    async (tx, p, data) => {
      if (data.sourceToken !== input.expectedSourceToken)
        fail(
          "The roster or linked milestone grades changed. Reload before releasing.",
          409,
        );
      const selected = input.studentIds
        ? data.rows.filter((r) => input.studentIds!.includes(r.id))
        : data.rows;
      if (
        !selected.length ||
        (input.studentIds && selected.length !== new Set(input.studentIds).size)
      )
        fail("Choose active researchers from this class.", 403);
      for (const row of selected) {
        if (!row.calculation.complete)
          fail(
            `Complete all activities and attendance for ${row.name} before releasing. Weighted categories also need eligible scores.`,
          );
        if (row.lastRelease) correction(input.reason);
      }
      for (const row of selected) {
        const snapshot = {
          version: 1,
          period: code,
          studentName: row.name,
          universityId: row.universityId,
          projects: row.projects,
          entries: row.entries,
          attendance: row.attendance,
          calculation: row.calculation,
          weights: data.weights,
          lateCredit: data.lateCredit,
          overallWeight: data.overallWeight,
          reason: input.reason,
        };
        await tx.classRecordRelease.create({
          data: {
            periodId: p.id,
            studentId: row.id,
            releasedById: user.id,
            releasedByName:
              `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              "Course professor",
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
          },
        });
        await audit(tx, workflowId, user, "CLASS_RECORD_GRADE_RELEASED", {
          period: code,
          studentId: row.id,
          studentName: row.name,
          score: row.calculation.score,
          reason: input.reason,
        });
      }
      return { releasedCount: selected.length };
    },
  );
}

export async function getMyClassRecord(
  workflowId: string,
  user: AuthenticatedUser,
) {
  const workflow = await assertClassRecordAccess(workflowId, user, false);
  // Never read draft score/attendance tables for a researcher response.
  const releases = await prisma.classRecordRelease.findMany({
    where: { studentId: user.id, period: { workflowId } },
    orderBy: [{ releasedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      releasedAt: true,
      releasedByName: true,
      snapshot: true,
      period: { select: { code: true } },
    },
  });
  const periods = periodCode.options.map((code) => ({
    code,
    release: releases.find((r) => r.period.code === code) || null,
  }));
  const latest = periods.map((p) => p.release?.snapshot as any);
  const configured =
    latest.every((s) => s && typeof s.overallWeight === "number") &&
    latest.reduce((n, s) => n + s.overallWeight, 0) === 100;
  const overall = configured
    ? Math.round(
        latest.reduce(
          (n, s) => n + (s.calculation.score * s.overallWeight) / 100,
          0,
        ) * 100,
      ) / 100
    : null;
  return {
    workflow: { id: workflow.id, name: workflow.name },
    periods,
    overall,
    history: releases.map(
      ({ id, releasedAt, releasedByName, period, snapshot }) => ({
        id,
        releasedAt,
        releasedByName,
        period: period.code,
        score: (snapshot as any).calculation.score,
      }),
    ),
  };
}
