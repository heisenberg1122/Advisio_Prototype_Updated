import { Router, Request, Response } from "express";
import { prisma, InstitutionalRole } from "../lib/prisma.js";
import { Permissions } from "@research-management/auth";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

const router = Router();

// GET /api/users
router.get(
  "/",
  requireAuth,
  requirePermission(Permissions.USER_MANAGE),
  async (req: Request, res: Response) => {
    try {
      const { role, collegeId, programId, status } = req.query;

      const users = await prisma.user.findMany({
        where: {
          ...(status && { status: String(status) as any }),
          ...(collegeId && { collegeId: String(collegeId) }),
          ...(programId && { programId: String(programId) }),
          ...(role && {
            roles: {
              some: {
                role: {
                  name: String(role) as InstitutionalRole,
                },
              },
            },
          }),
        },
        select: {
          id: true,
          universityId: true,
          email: true,
          firstName: true,
          middleName: true,
          lastName: true,
          status: true,
          college: true,
          program: true,
          roles: {
            include: {
              role: true,
            },
          },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ users });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch users" });
    }
  }
);

// GET /api/users/:id
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        universityId: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
        status: true,
        college: true,
        program: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch user" });
  }
});

export default router;
