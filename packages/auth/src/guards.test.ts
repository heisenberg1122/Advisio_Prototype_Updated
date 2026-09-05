import { describe, it, expect } from "vitest";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getPermissionsForRole,
  getPermissionsForRoles,
} from "./guards.js";
import { Permissions } from "./permissions.js";

describe("Auth RBAC Guards", () => {
  it("should correctly check a single permission with hasPermission", () => {
    const userPerms = [Permissions.RESEARCH_VIEW, Permissions.RESEARCH_CREATE];
    expect(hasPermission(userPerms, Permissions.RESEARCH_VIEW)).toBe(true);
    expect(hasPermission(userPerms, Permissions.RESEARCH_ARCHIVE)).toBe(false);
  });

  it("should check if any permission exists with hasAnyPermission", () => {
    const userPerms = [Permissions.RESEARCH_VIEW];
    expect(
      hasAnyPermission(userPerms, [
        Permissions.RESEARCH_VIEW,
        Permissions.RESEARCH_ARCHIVE,
      ])
    ).toBe(true);
    expect(
      hasAnyPermission(userPerms, [
        Permissions.RESEARCH_ARCHIVE,
        Permissions.USER_MANAGE,
      ])
    ).toBe(false);
  });

  it("should check if all permissions exist with hasAllPermissions", () => {
    const userPerms = [Permissions.RESEARCH_VIEW, Permissions.RESEARCH_CREATE];
    expect(
      hasAllPermissions(userPerms, [
        Permissions.RESEARCH_VIEW,
        Permissions.RESEARCH_CREATE,
      ])
    ).toBe(true);
    expect(
      hasAllPermissions(userPerms, [
        Permissions.RESEARCH_VIEW,
        Permissions.USER_MANAGE,
      ])
    ).toBe(false);
  });

  it("should return correct matrix permissions for SYSTEM_ADMIN", () => {
    const adminPerms = getPermissionsForRole("SYSTEM_ADMIN");
    expect(adminPerms.length).toBeGreaterThan(10);
    expect(adminPerms).toContain(Permissions.USER_MANAGE);
    expect(adminPerms).toContain(Permissions.AUDIT_VIEW);
  });

  it("should merge unique permissions across multiple roles with getPermissionsForRoles", () => {
    const combinedPerms = getPermissionsForRoles(["RESEARCHER", "ADVISER"]);
    expect(combinedPerms).toContain(Permissions.RESEARCH_VIEW);
    expect(combinedPerms).toContain(Permissions.RESEARCH_SUBMIT);
    // Ensure no duplicates
    const uniqueLength = new Set(combinedPerms).size;
    expect(combinedPerms.length).toBe(uniqueLength);
  });
});
