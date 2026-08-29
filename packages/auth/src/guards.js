import { ROLE_PERMISSIONS_MATRIX } from "./role-matrix.js";
export function hasPermission(userPermissions, requiredPermission) {
    return userPermissions.includes(requiredPermission);
}
export function hasAnyPermission(userPermissions, requiredPermissions) {
    return requiredPermissions.some((p) => userPermissions.includes(p));
}
export function hasAllPermissions(userPermissions, requiredPermissions) {
    return requiredPermissions.every((p) => userPermissions.includes(p));
}
export function getPermissionsForRole(role) {
    return ROLE_PERMISSIONS_MATRIX[role] || [];
}
export function getPermissionsForRoles(roles) {
    const permSet = new Set();
    for (const r of roles) {
        const rolePerms = ROLE_PERMISSIONS_MATRIX[r] || [];
        for (const p of rolePerms) {
            permSet.add(p);
        }
    }
    return Array.from(permSet);
}
//# sourceMappingURL=guards.js.map