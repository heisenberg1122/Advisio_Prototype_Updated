import { describe, expect, it } from "vitest";
import { DASHBOARD_WORKSPACES } from "@research-management/auth";
import {
  eligibleTourWorkspace,
  readTourProgress,
  saveTourProgress,
} from "./workspace-tours";

describe("workspace guide authorization", () => {
  it.each(DASHBOARD_WORKSPACES)(
    "uses the selected $id workspace instead of the account's first role",
    (workspace) => {
      expect(
        eligibleTourWorkspace(
          { roles: ["RESEARCHER", workspace.role], college: null },
          workspace.routePrefix + "/dashboard",
        ),
      ).toBe(workspace.id);
    },
  );
  it.each([
    ["STUDENT", "/student", "researcher"],
    ["PROFESSOR", "/professor", "coordinator"],
    ["ADMIN", "/admin", "dean"],
  ])(
    "canonicalizes %s without creating another dashboard",
    (role, path, expected) => {
      expect(
        eligibleTourWorkspace({ roles: [role] }, path + "/dashboard"),
      ).toBe(expected);
    },
  );
  it("does not use an approved role from a different college", () => {
    const user = {
      roles: ["ADVISER", "PANELIST"],
      college: { id: "b", code: "B", name: "B" },
      collegeMemberships: [
        { college: { id: "a", code: "A", name: "A" }, roleNames: ["ADVISER"] },
        { college: { id: "b", code: "B", name: "B" }, roleNames: ["PANELIST"] },
      ],
    };
    expect(eligibleTourWorkspace(user, "/adviser/dashboard")).toBeNull();
    expect(eligibleTourWorkspace(user, "/panelist/dashboard")).toBe("panelist");
    expect(
      eligibleTourWorkspace({ ...user, college: null }, "/panelist/dashboard"),
    ).toBeNull();
  });
  it("keeps platform administrators eligible without granting unrelated college roles", () => {
    expect(
      eligibleTourWorkspace(
        {
          roles: ["SYSTEM_ADMIN"],
          collegeMemberships: [
            { college: { id: "a", name: "A", code: "A" }, roleNames: [] },
          ],
        },
        "/system-admin/dashboard",
      ),
    ).toBe("system-admin");
    expect(
      eligibleTourWorkspace({ roles: ["RESEARCHER"] }, "/panelist/dashboard"),
    ).toBeNull();
    expect(
      eligibleTourWorkspace(
        { roles: ["RESEARCHER"] },
        "/student-impostor/dashboard",
      ),
    ).toBeNull();
  });
});

describe("guide progress", () => {
  it("distinguishes completion from dismissal and ignores corrupt/legacy values", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const key = "intro";
    expect(readTourProgress(storage, key)).toBeNull();
    saveTourProgress(storage, key, "dismissed");
    expect(readTourProgress(storage, key)).toBe("dismissed");
    saveTourProgress(storage, key, "completed");
    expect(readTourProgress(storage, key)).toBe("completed");
    values.set(key, "invalid");
    expect(readTourProgress(storage, key)).toBeNull();
    expect(() =>
      saveTourProgress(
        {
          setItem: () => {
            throw new Error("Blocked");
          },
        },
        key,
        "completed",
      ),
    ).not.toThrow();
    expect(
      readTourProgress(
        {
          getItem: () => {
            throw new Error("Blocked");
          },
        },
        key,
      ),
    ).toBeNull();
  });
});
