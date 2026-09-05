import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { InstitutionalRole } from "@research-management/auth";

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || "advisio-dev-secret-key-change-in-production";

export interface AuthenticatedUser {
  id: string;
  email: string;
  universityId: string;
  firstName?: string;
  lastName?: string;
  roles: InstitutionalRole[];
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    if (decoded.userId && decoded.userId.startsWith("demo-")) {
      req.user = {
        id: decoded.userId,
        email: "student@advisio.edu.ph",
        universityId: "UA-2026-DEMO",
        firstName: "Student",
        lastName: "Researcher",
        roles: ["RESEARCHER"],
        permissions: ["research.view", "research.create", "consultation.view", "consultation.request"],
      };
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      res.status(401).json({ error: "User not found or inactive" });
      return;
    }

    const roles = user.roles.map((ur) => ur.role.name as InstitutionalRole);
    const permissionSet = new Set<string>();

    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) {
        permissionSet.add(rp.permission.key);
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      universityId: user.universityId,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions: Array.from(permissionSet),
    };

    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired authentication token" });
  }
}

export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

      if (decoded.userId && decoded.userId.startsWith("demo-")) {
        req.user = {
          id: decoded.userId,
          email: "student@advisio.edu.ph",
          universityId: "UA-2026-DEMO",
          firstName: "Student",
          lastName: "Researcher",
          roles: ["RESEARCHER"],
          permissions: ["research.view", "research.create", "consultation.view", "consultation.request"],
        };
        next();
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (user && user.status === "ACTIVE") {
        const roles = user.roles.map((ur) => ur.role.name as InstitutionalRole);
        const permissionSet = new Set<string>();

        for (const ur of user.roles) {
          for (const rp of ur.role.permissions) {
            permissionSet.add(rp.permission.key);
          }
        }

        req.user = {
          id: user.id,
          email: user.email,
          universityId: user.universityId,
          firstName: user.firstName,
          lastName: user.lastName,
          roles,
          permissions: Array.from(permissionSet),
        };
        next();
        return;
      }
    }
  } catch {
    // Token is invalid/expired; leave req.user undefined
  }
  next();
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

