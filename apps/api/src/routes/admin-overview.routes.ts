import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();
const administrativeEntities = [
  "USER",
  "USER_COLLEGE_ASSIGNMENT",
  "College",
  "Program",
  "ProgramMajor",
  "AcademicYear",
  "STORAGE_INTEGRATION",
  "SYSTEM_ANNOUNCEMENT",
];

router.get(
  "/admin/overview",
  requireAuth,
  requireRole("SYSTEM_ADMIN"),
  async (_req, res) => {
    try {
      // Calendar days and comparisons use the institution's timezone, including today.
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Manila",
      });
      const end = new Date(`${today}T00:00:00+08:00`);
      end.setUTCDate(end.getUTCDate() + 1);
      const start = new Date(end.getTime() - 30 * 86400000);
      const previousStart = new Date(start.getTime() - 30 * 86400000);
      const [
        totalAccounts,
        pendingAccounts,
        activeColleges,
        registeredProjects,
        registrations,
        previousRegistrations,
        colleges,
        activity,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: "PENDING" } }),
        prisma.college.count({ where: { isActive: true } }),
        prisma.researchProject.count(),
        prisma.$queryRaw<{ date: string; count: number }[]>`
        SELECT to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS date,
               count(*)::int AS count
        FROM users WHERE created_at >= ${start} AND created_at < ${end}
        GROUP BY 1 ORDER BY 1`,
        prisma.user.count({
          where: { createdAt: { gte: previousStart, lt: start } },
        }),
        prisma.college.findMany({
          select: {
            id: true,
            code: true,
            name: true,
            _count: { select: { researchProjects: true } },
          },
        }),
        prisma.auditLog.findMany({
          where: { entityType: { in: administrativeEntities } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 6,
          select: {
            id: true,
            action: true,
            entityType: true,
            createdAt: true,
            user: { select: { firstName: true, lastName: true } },
          },
        }),
      ]);
      const dailyCounts = new Map(
        registrations.map((row) => [row.date, row.count]),
      );
      const days = Array.from({ length: 30 }, (_, index) => {
        const date = new Date(
          start.getTime() + index * 86400000,
        ).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
        return { date, count: dailyCounts.get(date) || 0 };
      });
      res.set("Cache-Control", "no-store").json({
        generatedAt: new Date().toISOString(),
        metrics: {
          totalAccounts,
          pendingAccounts,
          activeColleges,
          registeredProjects,
        },
        registrations: {
          days,
          total: days.reduce((sum, day) => sum + day.count, 0),
          previousTotal: previousRegistrations,
        },
        colleges: colleges
          .map((college) => ({
            id: college.id,
            code: college.code,
            name: college.name,
            projects: college._count.researchProjects,
          }))
          .sort(
            (a, b) => b.projects - a.projects || a.code.localeCompare(b.code),
          ),
        activity: activity.map(({ user, ...event }) => ({
          ...event,
          actor: user
            ? `${user.firstName} ${user.lastName}`
            : "System / unavailable account",
        })),
      });
    } catch (error) {
      console.error("Admin overview could not be loaded", error);
      res
        .status(500)
        .json({
          error: "The system overview could not be loaded. Please try again.",
        });
    }
  },
);

export default router;
