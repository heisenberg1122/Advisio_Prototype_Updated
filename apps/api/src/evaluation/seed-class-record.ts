import type {
  PrismaClient,
  ClassRecordItem,
  ClassRecordSession,
} from "@prisma/client";
import { calculateClassPeriod } from "../services/class-record-calculation.js";

// Called only by the evaluation workspace seeder with its private schema client.
export async function seedEvaluationClassRecord(
  db: PrismaClient,
  workflowId: string,
  professorId: string,
  dates: Date[],
  releasedAt: Date,
) {
  const enrollments = await db.workflowEnrollment.findMany({
    where: { workflowId, status: "ACTIVE" },
    orderBy: { userId: "asc" },
    include: {
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
              research: { workflowInstance: { workflowId } },
            },
            select: {
              research: { select: { id: true, title: true, groupName: true } },
            },
          },
        },
      },
    },
  });
  const weights = { MILESTONE: 0, INDIVIDUAL: 90, ATTENDANCE: 10 };
  const period = await db.classRecordPeriod.create({
    data: {
      workflowId,
      code: "PRELIM",
      weights,
      overallWeight: 30,
      lateCredit: 75,
      revision: 1,
    },
  });
  await db.classRecordPeriod.createMany({
    data: [
      { workflowId, code: "MIDTERM", overallWeight: 30 },
      { workflowId, code: "FINALS", overallWeight: 40 },
    ],
  });
  const items: Array<ClassRecordItem & { baseScore: number }> = [];
  for (const [title, maxPoints, baseScore] of [
    ["Research methods quiz", 20, 18],
    ["Literature review matrix", 50, 46],
    ["Research scope presentation", 30, 27],
  ] as const) {
    const item = await db.classRecordItem.create({
      data: {
        periodId: period.id,
        title,
        kind: "INDIVIDUAL",
        maxPoints,
        scores: {
          create: enrollments.map(({ user }, index) => ({
            studentId: user.id,
            state: "GRADED",
            score: baseScore - (index % 3),
          })),
        },
      },
    });
    items.push({ ...item, baseScore });
  }
  const sessions: ClassRecordSession[] = [];
  for (const [index, title] of [
    "Research orientation",
    "Literature review workshop",
    "Scope presentation workshop",
  ].entries()) {
    const session = await db.classRecordSession.create({
      data: {
        periodId: period.id,
        title,
        date: dates[index],
        marks: {
          create: enrollments.map(({ user }, studentIndex) => ({
            studentId: user.id,
            status: index === 2 && studentIndex % 2 === 0 ? "LATE" : "PRESENT",
          })),
        },
      },
    });
    sessions.push(session);
  }
  await db.classRecordRelease.createMany({
    data: enrollments.map(({ user }, index) => {
      const entries = items.map((item) => ({
        itemId: item.id,
        title: item.title,
        kind: item.kind,
        maxPoints: item.maxPoints,
        score: item.baseScore - (index % 3),
        state: "GRADED",
        source: null,
        sourceNote: null,
      }));
      const attendance = sessions.map((session, sessionIndex) => ({
        sessionId: session.id,
        title: session.title,
        date: session.date.toISOString().slice(0, 10),
        status: sessionIndex === 2 && index % 2 === 0 ? "LATE" : "PRESENT",
      }));
      return {
        periodId: period.id,
        studentId: user.id,
        releasedById: professorId,
        releasedByName: "Paolo Villanueva",
        releasedAt,
        snapshot: {
          version: 1,
          period: "PRELIM",
          studentName: `${user.lastName}, ${user.firstName}`,
          universityId: user.universityId,
          projects: user.memberships.map(({ research }) => ({
            id: research.id,
            name: research.groupName || research.title,
          })),
          entries,
          attendance,
          calculation: calculateClassPeriod(
            entries,
            attendance.map((a) => a.status),
            weights,
            75,
          ),
          weights,
          lateCredit: 75,
          overallWeight: 30,
          reason: "Fictional prelim record prepared for system evaluation.",
        },
      };
    }),
  });
}
