import { Request, Response, NextFunction } from "express";
import { Permission, InstitutionalRole, hasPermission } from "@research-management/auth";

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!hasPermission(req.user.permissions, permission)) {
      res.status(403).json({
        error: "Forbidden: insufficient permissions",
        requiredPermission: permission,
      });
      return;
    }

    next();
  };
}

export function requireRole(role: InstitutionalRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!req.user.roles.includes(role)) {
      res.status(403).json({
        error: "Forbidden: role unauthorized",
        requiredRole: role,
      });
      return;
    }

    next();
  };
}
