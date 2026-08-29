import { Permission } from "./permissions.js";
import { InstitutionalRole } from "./roles.js";
import { ROLE_PERMISSIONS_MATRIX } from "./role-matrix.js";

export function hasPermission(
  userPermissions: Permission[] | string[],
  requiredPermission: Permission
): boolean {
  return userPermissions.includes(requiredPermission);
}

export function hasAnyPermission(
  userPermissions: Permission[] | string[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.some((p) => userPermissions.includes(p));
}

export function hasAllPermissions(
  userPermissions: Permission[] | string[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.every((p) => userPermissions.includes(p));
}

export function getPermissionsForRole(role: InstitutionalRole): Permission[] {
  return ROLE_PERMISSIONS_MATRIX[role] || [];
}

export function getPermissionsForRoles(roles: InstitutionalRole[]): Permission[] {
  const permSet = new Set<Permission>();
  for (const r of roles) {
    const rolePerms = ROLE_PERMISSIONS_MATRIX[r] || [];
    for (const p of rolePerms) {
      permSet.add(p);
    }
  }
  return Array.from(permSet);
}
