import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { loginSchema, registerSchema } from "@research-management/validations";
import { validateBody } from "../middleware/validate";
import { requireAuth, generateToken } from "../middleware/auth";

const router = Router();

// POST /api/auth/register
router.post("/register", validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { universityId, email, firstName, middleName, lastName, password, collegeId, programId } = req.body;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { universityId }],
      },
    });

    if (existingUser) {
      res.status(409).json({ error: "User with this email or university ID already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        universityId,
        email,
        firstName,
        middleName,
        lastName,
        passwordHash,
        collegeId: collegeId || null,
        programId: programId || null,
        status: "ACTIVE",
      },
    });

    // Assign default RESEARCHER institutional role if exists
    const defaultRole = await prisma.role.findFirst({
      where: { name: "RESEARCHER" },
    });

    if (defaultRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: defaultRole.id,
        },
      });
    }

    const token = generateToken(user.id);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user.id,
        universityId: user.universityId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to register user" });
  }
});

// POST /api/auth/login
router.post("/login", validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (user.status !== "ACTIVE") {
      res.status(403).json({ error: "Your account is not active. Please contact the administrator." });
      return;
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = generateToken(user.id);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        universityId: user.universityId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles.map((r) => r.role.name),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to login" });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
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

    res.json({
      user: {
        id: user.id,
        universityId: user.universityId,
        email: user.email,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        college: user.college,
        program: user.program,
        roles: req.user.roles,
        permissions: req.user.permissions,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch user profile" });
  }
});

export default router;
