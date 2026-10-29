import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  audit: vi.fn(),
  sendEmail: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.findUnique, updateMany: mocks.updateMany },
    auditLog: { create: mocks.audit },
  },
}));
vi.mock("@research-management/email", () => ({ sendEmail: mocks.sendEmail }));
import {
  recoveryTokenHash,
  requestPasswordRecovery,
  resetPassword,
} from "./password-recovery.service.js";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("EMAIL_PROVIDER", "resend");
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("WEB_URL", "https://advisio.example");
  mocks.findUnique.mockResolvedValue({
    id: "user-1",
    email: "student@example.com",
    status: "ACTIVE",
    passwordHash: "stored-hash",
  });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.sendEmail.mockResolvedValue({ success: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("administrator password recovery", () => {
  it("sends an expiring admin notification, stores only the token hash, and audits without secrets", async () => {
    await expect(
      requestPasswordRecovery("student@example.com", "admin-1"),
    ).resolves.toContain("email sent");
    const message = mocks.sendEmail.mock.calls[0][0];
    expect(message.text).toContain("System Administrator");
    const token = message.text.match(/token=([a-f0-9]{64})/)[1];
    const data = mocks.updateMany.mock.calls[0][0].data;
    expect(data.passwordResetTokenHash).toBe(recoveryTokenHash(token));
    expect(data.passwordResetExpiresAt.getTime() - Date.now()).toBeGreaterThan(
      29 * 60_000,
    );
    expect(data).not.toHaveProperty("passwordHash");
    expect(mocks.audit).toHaveBeenCalledWith({
      data: {
        userId: "admin-1",
        action: "UPDATE",
        entityType: "PASSWORD_RESET_REQUEST",
        entityId: "user-1",
        newValues: { requestedByAdministrator: true },
      },
    });
  });
  it.each(["PENDING", "SUSPENDED", "INACTIVE"])(
    "rejects %s accounts",
    async (status) => {
      mocks.findUnique.mockResolvedValue({
        id: "user-1",
        status,
        passwordHash: "hash",
      });
      await expect(
        requestPasswordRecovery("student@example.com", "admin-1"),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(mocks.sendEmail).not.toHaveBeenCalled();
    },
  );
  it("rejects Google-only accounts", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "user-1",
      status: "ACTIVE",
      passwordHash: null,
    });
    await expect(
      requestPasswordRecovery("student@example.com", "admin-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("reports throttling instead of claiming an email was sent", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      requestPasswordRecovery("student@example.com", "admin-1"),
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
  it("clears the reserved token and reports failed delivery", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sendEmail.mockResolvedValue({ success: false });
    await expect(
      requestPasswordRecovery("student@example.com", "admin-1"),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(mocks.updateMany.mock.calls[1][0].data).toEqual({
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    });
    expect(mocks.audit).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it("preserves neutral public responses for unknown accounts", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(
      requestPasswordRecovery("unknown@example.com"),
    ).resolves.toContain("If an eligible account exists");
  });
  it("rejects expired reset links", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "user-1",
      status: "ACTIVE",
      passwordResetExpiresAt: new Date(Date.now() - 1000),
    });
    await expect(
      resetPassword("a".repeat(64), "NewPassword123!"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("consumes the link conditionally and revokes sessions when the new password is saved", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "user-1",
      status: "ACTIVE",
      passwordResetExpiresAt: new Date(Date.now() + 60_000),
    });
    await resetPassword("a".repeat(64), "NewPassword123!");
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          passwordResetTokenHash: recoveryTokenHash("a".repeat(64)),
          status: "ACTIVE",
        }),
        data: expect.objectContaining({
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          sessionVersion: { increment: 1 },
          passwordHash: expect.stringMatching(/^\$2/),
        }),
      }),
    );
  });
});
