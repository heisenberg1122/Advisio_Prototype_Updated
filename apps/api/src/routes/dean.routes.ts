import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { ACTIVE_ADVISEE_STATUSES, capacitySummary } from "../lib/adviser-capacity.js";

const router = Router();
const DEAN_ROLES = new Set(["RPO", "SYSTEM_ADMIN", "VPAA"]);

function requireDean(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.roles.some((role) => DEAN_ROLES.has(role))) {
    res.status(403).json({ error: "Dean access is required" });
    return;
  }
  next();
}

function daysSince(value: Date) {
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 86_400_000));
}

router.get("/dean/dashboard", requireAuth, requireDean, async (req: Request, res: Response) => {
  try {
    const requestedCollegeId = typeof req.query.collegeId === "string" ? req.query.collegeId : undefined;
    const collegeId = req.user!.roles.includes("SYSTEM_ADMIN")
      ? requestedCollegeId || req.user!.collegeId || undefined
      : req.user!.collegeId || undefined;

    if (!collegeId) {
      res.status(400).json({ error: "This dean account is not assigned to a college." });
      return;
    }

    const programId = typeof req.query.programId === "string" && req.query.programId !== "all"
      ? req.query.programId
      : undefined;
    const academicYearId = typeof req.query.academicYearId === "string" && req.query.academicYearId !== "all"
      ? req.query.academicYearId
      : undefined;

    const [college, programs, academicYears, users, projects, adviserUsers] = await Promise.all([
      prisma.college.findUnique({ where: { id: collegeId }, select: { id: true, code: true, name: true } }),
      prisma.program.findMany({ where: { collegeId, isActive: true }, orderBy: { name: "asc" } }),
      prisma.academicYear.findMany({ where: { isActive: true }, orderBy: { startDate: "desc" } }),
      prisma.user.findMany({
        where: {
          collegeId,
          ...(programId && { programId }),
          roles: { some: { role: { name: "RESEARCHER" } } },
        },
        include: { program: true, roles: { include: { role: true } }, memberships: { where: { leftAt: null }, select: { researchId: true } } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.researchProject.findMany({
        where: { collegeId, ...(programId && { programId }), ...(academicYearId && { academicYearId }) },
        include: {
          program: true,
          academicYear: true,
          researchType: true,
          members: { where: { leftAt: null }, include: { user: true } },
          workflowInstance: { include: { currentStage: true, workflow: { include: { stages: { orderBy: { sequence: "asc" } } } } } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.user.findMany({
        where: { collegeId, status: "ACTIVE", roles: { some: { role: { name: "ADVISER" } } } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          maxAdviseeGroups: true,
          isAcceptingAdvisees: true,
          adviserCapacityNote: true,
          _count: { select: { memberships: { where: { projectRole: "ADVISER", leftAt: null, research: { status: { in: ACTIVE_ADVISEE_STATUSES } } } } } },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);

    if (!college) {
      res.status(404).json({ error: "Assigned college was not found." });
      return;
    }

    const projectRows = projects.map((project) => {
      const stages = project.workflowInstance?.workflow.stages || [];
      const currentSequence = project.workflowInstance?.currentStage?.sequence || 0;
      const progress = project.completedAt || project.status === "COMPLETED"
        ? 100
        : stages.length ? Math.max(0, Math.round(((currentSequence - 1) / stages.length) * 100)) : 0;
      const adviser = project.members.find((member) => member.projectRole === "ADVISER");
      const students = project.members.filter((member) => member.projectRole === "LEADER" || member.projectRole === "MEMBER");
      const inactiveDays = daysSince(project.updatedAt);
      const risk = !adviser || inactiveDays >= 30 ? "high" : inactiveDays >= 14 ? "medium" : "low";
      const riskReason = !adviser ? "No adviser assigned" : inactiveDays >= 30 ? `No activity for ${inactiveDays} days` : inactiveDays >= 14 ? `Last activity ${inactiveDays} days ago` : "On schedule";
      return {
        id: project.id,
        title: project.title,
        program: project.program,
        academicYear: project.academicYear,
        researchType: project.researchType.name,
        status: project.status,
        stage: project.workflowInstance?.currentStage?.name || "Not started",
        progress,
        risk,
        riskReason,
        updatedAt: project.updatedAt,
        adviser: adviser ? `${adviser.user.firstName} ${adviser.user.lastName}` : null,
        students: students.map((member) => ({ id: member.user.id, name: `${member.user.firstName} ${member.user.lastName}` })),
      };
    });

    const projectById = new Map(projectRows.map((project) => [project.id, project]));
    const studentRows = users.map((user) => {
      const project = user.memberships.map((membership) => projectById.get(membership.researchId)).find(Boolean);
      return {
        id: user.id,
        universityId: user.universityId,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        program: user.program,
        accountStatus: user.status,
        project: project ? { id: project.id, title: project.title } : null,
        adviser: project?.adviser || null,
        stage: project?.stage || "No project",
        progress: project?.progress || 0,
        risk: project?.risk || "high",
        lastLoginAt: user.lastLoginAt,
      };
    });

    const advisers = adviserUsers.map(({ _count, ...adviser }) => {
      const attention = projects.filter((project) => project.members.some((member) => member.projectRole === "ADVISER" && member.user.id === adviser.id) && projectRows.find((item) => item.id === project.id)?.risk !== "low").length;
      return {
        id: adviser.id,
        name: `${adviser.firstName} ${adviser.lastName}`,
        email: adviser.email,
        groups: _count.memberships,
        attention,
        capacityNote: adviser.adviserCapacityNote,
        ...capacitySummary(adviser, _count.memberships),
      };
    });

    const stageCounts = new Map<string, number>();
    for (const project of projectRows) stageCounts.set(project.stage, (stageCounts.get(project.stage) || 0) + 1);
    const programSummary = programs.map((program) => {
      const rows = projectRows.filter((project) => project.program.id === program.id);
      return {
        id: program.id,
        code: program.code,
        name: program.name,
        students: studentRows.filter((student) => student.program?.id === program.id).length,
        projects: rows.length,
        averageProgress: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / rows.length) : 0,
        atRisk: rows.filter((row) => row.risk === "high").length,
      };
    });

    res.json({
      scope: { college, programs, academicYears },
      metrics: {
        students: studentRows.length,
        projects: projectRows.length,
        onTrack: projectRows.filter((project) => project.risk === "low").length,
        atRisk: projectRows.filter((project) => project.risk === "high").length,
        pendingAccounts: studentRows.filter((student) => student.accountStatus === "PENDING").length,
        withoutProject: studentRows.filter((student) => !student.project).length,
        withoutAdviser: projectRows.filter((project) => !project.adviser).length,
      },
      programSummary,
      stageDistribution: Array.from(stageCounts, ([stage, count]) => ({ stage, count })),
      attention: projectRows.filter((project) => project.risk !== "low").slice(0, 8),
      students: studentRows,
      projects: projectRows,
      advisers: advisers.sort((a, b) => b.groups - a.groups),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load dean dashboard" });
  }
});

router.patch("/dean/users/:id/status", requireAuth, requireDean, async (req: Request, res: Response) => {
  try {
    const status = String(req.body.status || "").toUpperCase();
    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'].includes(status)) {
      res.status(400).json({ error: "Invalid account status." });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id as string }, select: { id: true, collegeId: true } });
    if (!target || (!req.user!.roles.includes("SYSTEM_ADMIN") && target.collegeId !== req.user!.collegeId)) {
      res.status(404).json({ error: "User was not found in your college." });
      return;
    }
    const user = await prisma.user.update({ where: { id: target.id }, data: { status: status as any } });
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update account status" });
  }
});

export default router;
