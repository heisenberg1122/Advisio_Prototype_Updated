import { Router, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getCollegeScope } from "../lib/college-scope.js";

const router = Router();
const makeInviteCode = () => randomBytes(6).toString("hex").toUpperCase();

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaces = await prisma.researchWorkspace.findMany({
      where: { members: { some: { userId: req.user!.id, leftAt: null } } },
      include: {
        college: { select: { id: true, code: true, name: true } },
        program: { select: { id: true, code: true, name: true } },
        members: {
          where: { leftAt: null },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        projects: {
          select: { id: true, title: true, status: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ workspaces });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to load workspaces" });
  }
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user!.roles.includes("RESEARCHER")) {
      res
        .status(403)
        .json({ error: "Only researchers can create a research workspace." });
      return;
    }
    const scope = getCollegeScope(req.user!);
    if (scope.kind === "unassigned") {
      res
        .status(403)
        .json({
          error: "Your account has not been assigned to a college or school.",
        });
      return;
    }
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const mode =
      req.body.participationMode === "GROUP"
        ? "GROUP"
        : req.body.participationMode === "SOLO"
          ? "SOLO"
          : null;
    if (!name || name.length > 120 || !mode) {
      res
        .status(400)
        .json({
          error:
            "Provide a workspace name (up to 120 characters) and choose Solo or Group.",
        });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { collegeId: true, programId: true },
    });
    const collegeId =
      scope.kind === "college" ? scope.collegeId : user?.collegeId;
    const programId = user?.programId;
    if (!collegeId || !programId) {
      res
        .status(400)
        .json({
          error:
            "Complete your college and program profile before creating a workspace.",
        });
      return;
    }
    const accessMode =
      mode === "GROUP" && req.body.accessMode === "PUBLIC_OPEN"
        ? "PUBLIC_OPEN"
        : "INVITE_ONLY";
    const workspace = await prisma.researchWorkspace.create({
      data: {
        name,
        participationMode: mode,
        accessMode,
        inviteCode: makeInviteCode(),
        inviteCodeEnabled: mode === "GROUP",
        collegeId,
        programId,
        createdBy: req.user!.id,
        members: { create: { userId: req.user!.id, role: "LEADER" } },
      },
      include: { members: true, college: true, program: true, projects: true },
    });
    res.status(201).json({ workspace });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to create workspace" });
  }
});

router.get(
  "/join/:code/preview",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const workspace = await prisma.researchWorkspace.findFirst({
        where: {
          inviteCode: String(req.params.code).toUpperCase(),
          inviteCodeEnabled: true,
          participationMode: "GROUP",
        },
        include: {
          college: { select: { code: true, name: true } },
          program: { select: { code: true, name: true } },
          members: {
            where: { role: "LEADER", leftAt: null },
            include: { user: { select: { firstName: true, lastName: true } } },
          },
          _count: { select: { members: true, projects: true } },
        },
      });
      if (!workspace) {
        res
          .status(404)
          .json({ error: "Workspace invitation not found or disabled." });
        return;
      }
      const scope = getCollegeScope(req.user!);
      if (
        (scope.kind === "college" && scope.collegeId !== workspace.collegeId) ||
        (req.user!.programId && req.user!.programId !== workspace.programId)
      ) {
        res
          .status(403)
          .json({ error: "This workspace is outside your academic program." });
        return;
      }
      res.json({
        workspace: {
          id: workspace.id,
          name: workspace.name,
          accessMode: workspace.accessMode,
          college: workspace.college,
          program: workspace.program,
          leader: workspace.members[0]?.user || null,
          memberCount: workspace._count.members,
          projectCount: workspace._count.projects,
        },
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Failed to preview workspace" });
    }
  },
);

router.post("/join/:code", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspace = await prisma.researchWorkspace.findFirst({
      where: {
        inviteCode: String(req.params.code).toUpperCase(),
        inviteCodeEnabled: true,
        participationMode: "GROUP",
      },
    });
    if (!workspace) {
      res
        .status(404)
        .json({ error: "Workspace invitation not found or disabled." });
      return;
    }
    const scope = getCollegeScope(req.user!);
    if (
      (scope.kind === "college" && scope.collegeId !== workspace.collegeId) ||
      (req.user!.programId && req.user!.programId !== workspace.programId)
    ) {
      res
        .status(403)
        .json({ error: "This workspace is outside your academic program." });
      return;
    }
    const member = await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: req.user!.id },
      },
      update: { leftAt: null },
      create: {
        workspaceId: workspace.id,
        userId: req.user!.id,
        role: "MEMBER",
      },
    });
    res.json({ member, workspace: { id: workspace.id, name: workspace.name } });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to join workspace" });
  }
});

export default router;
