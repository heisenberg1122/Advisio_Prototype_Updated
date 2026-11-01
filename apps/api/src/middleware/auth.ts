import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { resolveJwtSecret } from "../lib/security-config.js";
import { prisma } from "../lib/prisma.js";
import { getPermissionsForRoles, InstitutionalRole } from "@research-management/auth";
import { resolveCollegeAuthorization } from "../lib/college-authorization.js";
import { enforceCollegeResourceBoundary } from "../lib/college-resource-boundary.js";

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
  researcherPanel?: boolean;
  primaryCollegeId?: string | null;
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

    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as { userId: string; sessionVersion?: number; purpose?: string; activeCollegeId?: string };

    if (typeof decoded.userId !== "string" || (decoded.purpose && decoded.purpose !== "session")) throw new jwt.JsonWebTokenError("Invalid session");

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        college: true,
        collegeMemberships: { include: { college: true } },
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

    const identityOnly = ["/api/auth/active-college", "/api/account-invitations/accept-existing"].includes(req.originalUrl.split("?")[0]);
    const context = resolveCollegeAuthorization(user, identityOnly ? undefined : decoded.activeCollegeId);
    const roles = context.roles;
    if (!roles.length && !identityOnly && !req.originalUrl.startsWith("/api/auth/")) { res.status(403).json({ error: "No approved role is available in the selected college." }); return; }
    const permissionSet = new Set<string>(getPermissionsForRoles(roles));

    for (const ur of user.roles) {
      if (!roles.includes(ur.role.name as InstitutionalRole)) continue;
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
      collegeId: context.collegeId,
      programId: context.programId,
      primaryCollegeId: user.collegeId,
    };

    // Panel context can only restrict an authenticated account's access.
    // Keep profile hydration role-complete so dashboard switching still works.
    if (req.get("X-Advisio-Panel") === "researcher" && !req.originalUrl.startsWith("/api/auth/")) {
      if (!roles.includes("RESEARCHER")) {
        res.status(403).json({ error: "The researcher panel is not assigned to your account." });
        return;
      }
      req.user.researcherPanel = true;
      req.user.roles = ["RESEARCHER"];
      req.user.permissions = getPermissionsForRoles(["RESEARCHER"]);
      for (const assignment of user.roles.filter(({ role }) => role.name === "RESEARCHER")) {
        for (const { permission } of assignment.role.permissions) {
          if (!req.user.permissions.includes(permission.key)) req.user.permissions.push(permission.key);
        }
      }

      // Cover project detail, documents, workflow, tasks and consultation requests.
      // Join-by-code and project creation deliberately have no project ID here.
      const researchId = req.params.researchId
        || (req.baseUrl === "/api/research" ? req.params.id : undefined)
        || req.query.researchId || req.query.groupId
        || req.body?.researchId || req.body?.groupId;
      if (researchId) {
        const membership = typeof researchId === "string" && await prisma.researchMember.findFirst({
          where: { researchId, userId: user.id, leftAt: null, projectRole: { in: ["LEADER", "MEMBER"] } },
          select: { id: true },
        });
        if (!membership) {
          res.status(403).json({ error: "You are not a current researcher in this project." });
          return;
        }
      }
    }

    await enforceCollegeResourceBoundary(req);
    next();
  } catch (error) {
    if ((error as any)?.statusCode === 403) { res.status(403).json({ error: (error as Error).message }); return; }
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
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as { userId: string; sessionVersion?: number; purpose?: string; activeCollegeId?: string };

      if (typeof decoded.userId !== "string" || (decoded.purpose && decoded.purpose !== "session")) throw new jwt.JsonWebTokenError("Invalid session");

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          college: true,
          collegeMemberships: { include: { college: true } },
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
        const context = resolveCollegeAuthorization(user, decoded.activeCollegeId);
        const roles = context.roles;
        const permissionSet = new Set<string>(getPermissionsForRoles(roles));

        for (const ur of user.roles) {
          if (!roles.includes(ur.role.name as InstitutionalRole)) continue;
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
          collegeId: context.collegeId,
          programId: context.programId,
          primaryCollegeId: user.collegeId,
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

export function generateToken(userId: string, sessionVersion = 0, activeCollegeId?: string): string {
  return jwt.sign({ userId, sessionVersion, purpose: "session", ...(activeCollegeId ? { activeCollegeId } : {}) }, JWT_SECRET, { expiresIn: "7d" });
}

