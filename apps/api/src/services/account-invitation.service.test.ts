import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  transaction: vi.fn(),
  createUser: vi.fn(),
  grantMembership: vi.fn(),
  sendEmail: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: { $transaction: state.transaction },
}));
vi.mock("@research-management/email", async (original) => ({
  ...(await original<typeof import("@research-management/email")>()),
  sendEmail: state.sendEmail,
}));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-test-password") },
}));

import {
  acceptAccountInvitation,
  accountInvitationHash,
} from "./account-invitation.service.js";

const token = "a".repeat(64);
function acceptanceTransaction(rotateWhileWaiting: boolean) {
  const invitation = {
    id: "invitation",
    email: "faculty@example.invalid",
    universityId: "FACULTY-1",
    firstName: "Test",
    lastName: "Faculty",
    collegeId: "college-a",
    createdById: "administrator",
    roleNames: ["ADVISER"],
    status: "PENDING",
    deliveredAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    tokenHash: accountInvitationHash(token),
    college: { isActive: true },
  };
  const tx = {
    accountInvitation: {
      findUnique: vi.fn().mockImplementation(async () => ({ ...invitation })),
      updateMany: vi.fn().mockImplementation(async ({ where }: any) => {
        if (where.tokenHash && where.tokenHash !== invitation.tokenHash)
          return { count: 0 };
        invitation.status = "ACCEPTED";
        return { count: 1 };
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        status: "ACTIVE",
        roles: [{ role: { name: "SYSTEM_ADMIN" } }],
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      create: state.createUser,
    },
    $executeRaw: vi.fn().mockImplementation(async () => {
      // A concurrent Resend commits after validation and before the account lock is acquired.
      if (rotateWhileWaiting)
        invitation.tokenHash = accountInvitationHash("b".repeat(64));
    }),
    role: { findMany: vi.fn().mockResolvedValue([{ id: "adviser-role" }]) },
    collegeMembership: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: state.grantMembership,
    },
    userRole: { createMany: vi.fn() },
    facultyProfile: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  state.transaction.mockImplementation(
    async (work: (client: typeof tx) => unknown) => work(tx),
  );
  return invitation;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.createUser.mockResolvedValue({ id: "new-faculty" });
});

describe("invitation acceptance across concurrent token rotation", () => {
  it("rejects the replaced token before creating an account or granting college access", async () => {
    const invitation = acceptanceTransaction(true);
    await expect(
      acceptAccountInvitation(token, "Secure invitation password 42"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(invitation.status).toBe("PENDING");
    expect(state.createUser).not.toHaveBeenCalled();
    expect(state.grantMembership).not.toHaveBeenCalled();
  });
  it("still accepts an unchanged delivered token and grants the approved college role", async () => {
    const invitation = acceptanceTransaction(false);
    await expect(
      acceptAccountInvitation(token, "Secure invitation password 42"),
    ).resolves.toMatchObject({
      message: expect.stringContaining("account is ready"),
    });
    expect(invitation.status).toBe("ACCEPTED");
    expect(state.createUser).toHaveBeenCalledOnce();
    expect(state.grantMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "new-faculty",
          collegeId: "college-a",
          roleNames: ["ADVISER"],
        }),
      }),
    );
    expect(state.sendEmail).not.toHaveBeenCalled();
  });
});
