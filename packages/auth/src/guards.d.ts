import { Permission } from "./permissions.js";
import { InstitutionalRole } from "./roles.js";
export declare function hasPermission(userPermissions: Permission[] | string[], requiredPermission: Permission): boolean;
export declare function hasAnyPermission(userPermissions: Permission[] | string[], requiredPermissions: Permission[]): boolean;
export declare function hasAllPermissions(userPermissions: Permission[] | string[], requiredPermissions: Permission[]): boolean;
export declare function getPermissionsForRole(role: InstitutionalRole): Permission[];
export declare function getPermissionsForRoles(roles: InstitutionalRole[]): Permission[];
//# sourceMappingURL=guards.d.ts.map