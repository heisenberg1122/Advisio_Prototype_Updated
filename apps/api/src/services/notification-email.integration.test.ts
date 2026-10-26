import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const delivery = vi.hoisted(() => vi.fn());
vi.mock("@research-management/email", async () => ({
  ...(await vi.importActual("@research-management/email")),
  sendEmail: delivery,
}));
import { prisma } from "../lib/prisma.js";
import {
  emailNotification,
  processNotificationEmails,
} from "./notification-email.service.js";
import { changeAccountStatus } from "./account-status.service.js";
import {
  assertIsolatedIntegrationDatabase,
  cleanupIntegrationFixture,
  createIntegrationFixtureScope,
} from "../test/database-integration.js";

const databaseDescribe =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
databaseDescribe("transactional notification email delivery", () => {
  const fixture = createIntegrationFixtureScope(
    `notification-email-${crypto.randomUUID().slice(0, 8)}`,
  );
  let userId: string;
  const notification = (key: string) => ({
    recipientId: userId,
    audience: "account",
    type: "SYSTEM_ANNOUNCEMENT" as const,
    title: "Account approved",
    message: "Welcome to Advisio.",
    deduplicationKey: `${fixture.marker}:${key}`,
    ...emailNotification("account_approved"),
  });
  beforeAll(async () => {
    await assertIsolatedIntegrationDatabase(prisma);
    fixture.databaseVerified = true;
    vi.stubEnv("NOTIFICATION_EMAILS_ENABLED", "true");
    vi.stubEnv("EMAIL_PROVIDER", "gmail");
    vi.stubEnv("WEB_URL", "https://advisio.example");
    vi.stubEnv("EMAIL_TEMPLATE_OVERRIDES_PATH", "");
    const user = await prisma.user.create({
      data: {
        universityId: fixture.marker,
        email: `${fixture.marker}@example.invalid`,
        firstName: "Queue",
        lastName: "Test",
        passwordHash: "not-a-login-password",
        status: "ACTIVE",
      },
    });
    userId = user.id;
    fixture.userIds.push(user.id);
    delivery.mockResolvedValue({ success: true, messageId: "test-only" });
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await cleanupIntegrationFixture(prisma, fixture);
    await prisma.$disconnect();
  });
  it("rolls back the email job with its academic event", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.notification.create({ data: notification("rollback") });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(
      await prisma.notification.count({
        where: { deduplicationKey: `${fixture.marker}:rollback` },
      }),
    ).toBe(0);
    expect(delivery).not.toHaveBeenCalled();
  });
  it("deduplicates events, allows only one database lease, and records provider acceptance", async () => {
    await prisma.notification.createMany({
      data: [notification("once"), notification("once")],
      skipDuplicates: true,
    });
    const job = await prisma.notification.findUniqueOrThrow({
      where: { deduplicationKey: `${fixture.marker}:once` },
    });
    const lease = new Date(Date.now() + 120_000);
    const claims = await Promise.all(
      [1, 2].map(() =>
        prisma.notification.updateMany({
          where: { id: job.id, emailNextAttemptAt: { lte: new Date() } },
          data: { emailNextAttemptAt: lease },
        }),
      ),
    );
    expect(claims.map((claim) => claim.count).sort()).toEqual([0, 1]);
    await prisma.notification.update({
      where: { id: job.id },
      data: { emailNextAttemptAt: new Date(0) },
    });
    await processNotificationEmails();
    await processNotificationEmails();
    expect(delivery).toHaveBeenCalledTimes(1);
    const sent = await prisma.notification.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(sent.emailSentAt).toBeInstanceOf(Date);
    expect(sent.emailNextAttemptAt).toBeNull();
    expect(sent.emailAttempts).toBe(1);
  });
  it("persists retry state and recovers after a temporary provider failure", async () => {
    const job = await prisma.notification.create({
      data: notification("retry"),
    });
    delivery.mockResolvedValueOnce({ success: false });
    await processNotificationEmails();
    const retry = await prisma.notification.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(retry.emailSentAt).toBeNull();
    expect(retry.emailNextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
    await prisma.notification.update({
      where: { id: job.id },
      data: { emailNextAttemptAt: new Date(0) },
    });
    await processNotificationEmails();
    expect(
      (await prisma.notification.findUniqueOrThrow({ where: { id: job.id } }))
        .emailAttempts,
    ).toBe(2);
  });
  it("queues approval only after a Google account is administratively activated", async () => {
    const googleUser = await prisma.user.create({
      data: {
        universityId: `${fixture.marker}-google`,
        email: `${fixture.marker}-google@example.invalid`,
        firstName: "Google",
        lastName: "Researcher",
        passwordHash: "not-a-login-password",
        status: "PENDING",
        googleSubject: `${fixture.marker}-subject`,
        googleOnboardingStage: "COMPLETE",
      },
    });
    fixture.userIds.push(googleUser.id);
    const options = {
      actor: { id: userId, roles: ["SYSTEM_ADMIN"] } as any,
      userId: googleUser.id,
      status: "ACTIVE" as const,
      verificationConfirmed: true,
      verificationNote: "Identity and institutional affiliation verified.",
    };
    await changeAccountStatus(options);
    await changeAccountStatus(options);
    const notifications = await prisma.notification.findMany({
      where: { recipientId: googleUser.id, emailTemplate: "account_approved" },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].emailNextAttemptAt).toBeInstanceOf(Date);
  });
});
