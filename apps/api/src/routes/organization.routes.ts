import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { collegeSchema, programSchema, academicYearSchema } from "@research-management/validations";
import { Permissions } from "@research-management/auth";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

const router = Router();

// ─── COLLEGES ────────────────────────────────────────────────────────
router.get("/colleges", async (_req: Request, res: Response) => {
  try {
    const colleges = await prisma.college.findMany({
      where: { isActive: true },
      include: {
        programs: {
          where: { isActive: true },
        },
      },
      orderBy: { name: "asc" },
    });
    res.json({ colleges });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch colleges" });
  }
});

router.post(
  "/colleges",
  requireAuth,
  requirePermission(Permissions.SYSTEM_CONFIGURE),
  validateBody(collegeSchema),
  async (req: Request, res: Response) => {
    try {
      const college = await prisma.college.create({
        data: req.body,
      });
      res.status(201).json({ college });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create college" });
    }
  }
);

// ─── PROGRAMS ────────────────────────────────────────────────────────
router.get("/programs", async (req: Request, res: Response) => {
  try {
    const { collegeId } = req.query;
    const programs = await prisma.program.findMany({
      where: {
        isActive: true,
        ...(collegeId && { collegeId: String(collegeId) }),
      },
      include: {
        college: true,
        researchTypes: true,
      },
      orderBy: { name: "asc" },
    });
    res.json({ programs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch programs" });
  }
});

router.post(
  "/programs",
  requireAuth,
  requirePermission(Permissions.SYSTEM_CONFIGURE),
  validateBody(programSchema),
  async (req: Request, res: Response) => {
    try {
      const program = await prisma.program.create({
        data: req.body,
      });
      res.status(201).json({ program });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create program" });
    }
  }
);

// ─── ACADEMIC YEARS ──────────────────────────────────────────────────
router.get("/academic-years", async (_req: Request, res: Response) => {
  try {
    const academicYears = await prisma.academicYear.findMany({
      where: { isActive: true },
      orderBy: { startDate: "desc" },
    });
    res.json({ academicYears });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch academic years" });
  }
});

router.post(
  "/academic-years",
  requireAuth,
  requirePermission(Permissions.SYSTEM_CONFIGURE),
  validateBody(academicYearSchema),
  async (req: Request, res: Response) => {
    try {
      const { name, startDate, endDate, isCurrent, isActive } = req.body;

      if (isCurrent) {
        // Reset previous isCurrent
        await prisma.academicYear.updateMany({
          where: { isCurrent: true },
          data: { isCurrent: false },
        });
      }

      const academicYear = await prisma.academicYear.create({
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isCurrent,
          isActive,
        },
      });
      res.status(201).json({ academicYear });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create academic year" });
    }
  }
);

export default router;
