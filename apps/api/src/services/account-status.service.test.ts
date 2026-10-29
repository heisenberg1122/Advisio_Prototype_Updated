import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permissions } from "@research-management/auth";

const db = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  audit: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
  prisma: { $transaction: db.transaction },
}));
vi.mock("./notification-email.service.js", () => ({
  emailNotification: vi.fn(),
}));
import { changeAccountStatus } from "./account-status.service.js";

const actor = {
  id: "admin",
  email: "admin@example.com",
  universityId: "ADMIN",
  roles: ["SYSTEM_ADMIN" as const],
  permissions: [Permissions.USER_MANAGE, Permissions.ROLE_MANAGE],
};
const options = {
  actor,
  userId: "target",
  status: "INACTIVE" as const,
  verificationNote: "User has left the institution.",
};
beforeEach(() => {
  vi.resetAllMocks();
  db.findUnique.mockResolvedValue({
    id: "target",
    status: "ACTIVE",
    roles: [],
    sessionVersion: 4,
  });
  db.update.mockResolvedValue({ id: "target", status: "INACTIVE" });
  db.count.mockResolvedValue(2);
  // Deliberately expose no deletion or file-cleanup delegates: archive/restore
  // must work using only the account update and audit operations.
  db.transaction.mockImplementation((callback) =>
    callback({
      $executeRaw: db.execute,
      user: { findUnique: db.findUnique, update: db.update, count: db.count },
      auditLog: { create: db.audit },
    }),
  );
});

describe("account archive and restoration", () => {
  it("archives through a status-only update and audits the reason", async () => {
    await changeAccountStatus(options);
    expect(db.update.mock.calls[0][0].data).toEqual({
      status: "INACTIVE",
      sessionVersion: { increment: 1 },
    });
    expect(db.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "admin",
          entityId: "target",
          oldValues: { status: "ACTIVE" },
          newValues: {
            status: "INACTIVE",
            verificationNote: options.verificationNote,
            accountAction: "ARCHIVE",
          },
        }),
      }),
    );
  });
  it.each(["", "short", "x".repeat(2001)])(
    "rejects invalid archive reasons",
    async (verificationNote) => {
      await expect(
        changeAccountStatus({ ...options, verificationNote }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(db.update).not.toHaveBeenCalled();
    },
  );
  it.each([
    { ...actor, roles: ["DEAN" as const] },
    { ...actor, permissions: [Permissions.USER_MANAGE] },
  ])(
    "rejects archiving without administrator and role management access",
    async (limitedActor) => {
      await expect(
        changeAccountStatus({ ...options, actor: limitedActor }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(db.update).not.toHaveBeenCalled();
    },
  );
  it("rejects self-archiving", async () => {
    await expect(
      changeAccountStatus({ ...options, actor: { ...actor, id: "target" } }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.update).not.toHaveBeenCalled();
  });
  it("protects the last active system administrator", async () => {
    db.findUnique.mockResolvedValue({
      id: "target",
      status: "ACTIVE",
      roles: [{ role: { name: "SYSTEM_ADMIN" } }],
    });
    db.count.mockResolvedValue(1);
    await expect(changeAccountStatus(options)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(db.update).not.toHaveBeenCalled();
  });
  it("requires verified restoration and invalidates old sessions again", async () => {
    db.findUnique.mockResolvedValue({
      id: "target",
      status: "INACTIVE",
      roles: [],
    });
    await expect(
      changeAccountStatus({ ...options, status: "ACTIVE" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.update).not.toHaveBeenCalled();
    await changeAccountStatus({
      ...options,
      status: "ACTIVE",
      verificationConfirmed: true,
    });
    expect(db.update.mock.calls[0][0].data).toEqual({
      status: "ACTIVE",
      sessionVersion: { increment: 1 },
    });
    expect(db.audit.mock.calls[0][0].data.newValues.accountAction).toBe(
      "RESTORE",
    );
  });
  it("cannot move an archived account into suspension without restoration", async () => {
    db.findUnique.mockResolvedValue({
      id: "target",
      status: "INACTIVE",
      roles: [],
    });
    await expect(
      changeAccountStatus({ ...options, status: "SUSPENDED" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.update).not.toHaveBeenCalled();
  });
  it("keeps suspension separate from archiving", async () => {
    await changeAccountStatus({ ...options, status: "SUSPENDED" });
    expect(db.update.mock.calls[0][0].data.status).toBe("SUSPENDED");
    expect(db.audit.mock.calls[0][0].data.newValues).not.toHaveProperty(
      "accountAction",
    );
  });
});
