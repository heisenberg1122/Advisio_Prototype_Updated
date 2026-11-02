import { describe, expect, it } from "vitest";
import {
  acceptAccountInvitationSchema,
  inviteAccountSchema,
} from "./account-invitations.js";

const invite = {
  email: " Professor@Example.edu ",
  universityId: "FACULTY-001",
  firstName: "Demo",
  lastName: "Professor",
  collegeId: "a0000000-0000-4000-8000-000000000001",
  roleNames: ["RESEARCH_COORDINATOR"],
  verificationConfirmed: true,
  verificationNote: "Appointment verified by administrator",
};
describe("faculty account invitations", () => {
  it("normalizes email and deduplicates approved roles", () => {
    const parsed = inviteAccountSchema.parse({
      ...invite,
      roleNames: ["DEAN", "DEAN", "PANELIST"],
    });
    expect(parsed.email).toBe("professor@example.edu");
    expect(parsed.roleNames).toEqual(["DEAN", "PANELIST"]);
  });
  it.each(["SYSTEM_ADMIN", "RESEARCHER", "PROFESSOR"])(
    "rejects unapproved role %s",
    (role) => {
      expect(
        inviteAccountSchema.safeParse({ ...invite, roleNames: [role] }).success,
      ).toBe(false);
    },
  );
  it("requires verified identity, a note, and an active-college identifier", () => {
    for (const change of [
      { verificationConfirmed: false },
      { verificationNote: "short" },
      { collegeId: "" },
      { roleNames: [] },
    ]) {
      expect(
        inviteAccountSchema.safeParse({ ...invite, ...change }).success,
      ).toBe(false);
    }
  });
  it("requires a full token and a password within bcrypt's byte limit", () => {
    const token = "a".repeat(64);
    expect(
      acceptAccountInvitationSchema.safeParse({
        token,
        password: "A long unique password",
      }).success,
    ).toBe(true);
    expect(
      acceptAccountInvitationSchema.safeParse({ token, password: "short" })
        .success,
    ).toBe(false);
    expect(
      acceptAccountInvitationSchema.safeParse({
        token,
        password: "😀".repeat(20),
      }).success,
    ).toBe(false);
    expect(
      acceptAccountInvitationSchema.safeParse({
        token: "invalid",
        password: "A long unique password",
      }).success,
    ).toBe(false);
  });
});
