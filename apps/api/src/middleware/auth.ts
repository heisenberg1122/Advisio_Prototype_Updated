import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { resolveJwtSecret } from "../lib/security-config.js";
import { prisma } from "../lib/prisma.js";
import { getPermissionsForRoles, InstitutionalRole } from "@research-management/auth";

const JWT_SECRET = resolveJwtSecret();

export interface AuthenticatedUser {
  id: string;
  email: string;
  universityId: string;
  firstName?: string;
  lastName?: string;
  roles: InstitutionalRole[];
  permissions: string[];
  collegeId?: string | null;
  programId?: string | null;
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

    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as { userId: string; sessionVersion?: number; purpose?: string };

    if (typeof decoded.userId !== "string" || (decoded.purpose && decoded.purpose !== "session")) throw new jwt.JsonWebTokenError("Invalid session");

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

    if (!user || user.status !== "ACTIVE" || (decoded.sessionVersion || 0) !== user.sessionVersion) {
      res.status(401).json({ error: "User not found or inactive" });
      return;
    }

    const roles = user.roles.map((ur) => ur.role.name as InstitutionalRole);
    const permissionSet = new Set<string>(getPermissionsForRoles(roles));

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
      collegeId: user.collegeId,
      programId: user.programId,
    };

    next();
  } catch (error) {
    if (!(error instanceof jwt.JsonWebTokenError) && !(error instanceof jwt.TokenExpiredError)) {
      res.status(503).json({ error: "Authentication service is temporarily unavailable." });
      return;
    }
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
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as { userId: string; sessionVersion?: number; purpose?: string };

      if (typeof decoded.userId !== "string" || (decoded.purpose && decoded.purpose !== "session")) throw new jwt.JsonWebTokenError("Invalid session");

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

      if (user && user.status === "ACTIVE" && (decoded.sessionVersion || 0) === user.sessionVersion) {
        const roles = user.roles.map((ur) => ur.role.name as InstitutionalRole);
        const permissionSet = new Set<string>(getPermissionsForRoles(roles));

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
          collegeId: user.collegeId,
          programId: user.programId,
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

export function generateToken(userId: string, sessionVersion = 0): string {
  return jwt.sign({ userId, sessionVersion, purpose: "session" }, JWT_SECRET, { expiresIn: "7d" });
}

