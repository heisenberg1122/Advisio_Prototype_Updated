import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  sendEmail: vi.fn(),
  project: vi.fn(),
  submission: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    notification: { findMany: mocks.findMany, updateMany: mocks.updateMany },
    researchProject: { findFirst: mocks.project },
    taskSubmission: { findFirst: mocks.submission },
  },
}));
vi.mock("@research-management/email", async () => ({
  ...(await vi.importActual("@research-management/email")),
  sendEmail: mocks.sendEmail,
}));
import {
  emailNotification,
  processNotificationEmails,
  notificationEmailAction,
} from "./notification-email.service.js";
const job = {
  id: "n1",
  recipientId: "u1",
  title: "Approved",
  message: "Your account is active.",
  emailTemplate: "account_approved",
  emailData: {},
  emailAttempts: 0,
  actionUrl: "/login",
  recipient: { firstName: "Maria", email: "maria@gmail.com", status: "ACTIVE" },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NOTIFICATION_EMAILS_ENABLED", "true");
  vi.stubEnv("EMAIL_PROVIDER", "gmail");
  vi.stubEnv("WEB_URL", "https://advisio.example");
  vi.stubEnv("EMAIL_TEMPLATE_OVERRIDES_PATH", "");
  mocks.findMany.mockResolvedValue([job]);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.sendEmail.mockResolvedValue({ success: true, messageId: "g1" });
});
afterEach(() => vi.unstubAllEnvs());
describe("notification email queue", () => {
  it("resolves notification aliases to real recipient dashboard routes", () => {
    expect(
      notificationEmailAction(
        "/research/manuscript?projectId=p1",
        "researcher",
      ),
    ).toBe("/student/documents?projectId=p1");
    expect(
      notificationEmailAction("/research/manuscript?projectId=p1", "adviser"),
    ).toBe("/adviser/reviews?projectId=p1");
    expect(notificationEmailAction(null, "dean")).toBe(
      "/admin/dashboard?workspace=dean",
    );
  });
  it("persists event metadata and sends a personalized single-recipient email after claiming", async () => {
    expect(emailNotification("account_approved")).toMatchObject({
      emailTemplate: "account_approved",
      emailNextAttemptAt: expect.any(Date),
    });
    await processNotificationEmails();
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "maria@gmail.com",
        text: expect.stringContaining("Hello Maria"),
      }),
    );
    expect(mocks.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          emailSentAt: expect.any(Date),
          emailNextAttemptAt: null,
          emailLastError: null,
        },
      }),
    );
  });
  it("does not deliver when disabled, in mock mode, or another worker wins the claim", async () => {
    vi.stubEnv("NOTIFICATION_EMAILS_ENABLED", "false");
    await processNotificationEmails();
    expect(mocks.findMany).not.toHaveBeenCalled();
    vi.stubEnv("NOTIFICATION_EMAILS_ENABLED", "true");
    vi.stubEnv("EMAIL_PROVIDER", "mock");
    await processNotificationEmails();
    expect(mocks.findMany).not.toHaveBeenCalled();
    vi.stubEnv("EMAIL_PROVIDER", "gmail");
    mocks.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    await processNotificationEmails();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
  it("retries provider failures and stops after five attempts without marking success", async () => {
    mocks.sendEmail.mockResolvedValue({
      success: false,
      error: "secret provider response",
    });
    await processNotificationEmails();
    expect(mocks.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          emailNextAttemptAt: expect.any(Date),
          emailLastError: expect.not.stringContaining("secret"),
        },
      }),
    );
    mocks.findMany.mockResolvedValue([{ ...job, emailAttempts: 4 }]);
    await processNotificationEmails();
    expect(mocks.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { emailNextAttemptAt: null, emailLastError: expect.any(String) },
      }),
    );
  });
  it("suppresses inactive recipients and reminders whose task was submitted before delivery", async () => {
    mocks.findMany.mockResolvedValue([
      { ...job, recipient: { ...job.recipient, status: "SUSPENDED" } },
    ]);
    await processNotificationEmails();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    mocks.findMany.mockResolvedValue([
      {
        ...job,
        emailTemplate: "requirement_due",
        emailData: {
          researchId: "p1",
          taskId: "t1",
          dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      },
    ]);
    mocks.project.mockResolvedValue({ id: "p1" });
    mocks.submission.mockResolvedValue({ id: "s1" });
    await processNotificationEmails();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          emailNextAttemptAt: null,
          emailLastError: "Reminder no longer applicable.",
        },
      }),
    );
  });
  it("logs and persists only allowlisted diagnostics for Gmail authorization errors", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      mocks.sendEmail.mockResolvedValue({ success: false, errorCode: "GMAIL_INVALID_GRANT", error: "sensitive-provider-response" });
      await processNotificationEmails();
      expect(mocks.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ emailLastError: expect.stringContaining("[GMAIL_INVALID_GRANT]") }) }));
      expect(JSON.stringify(log.mock.calls)).not.toContain("sensitive-provider-response");
      expect(JSON.stringify(log.mock.calls)).toContain("GMAIL_INVALID_GRANT");
    } finally { log.mockRestore(); }
  });
});
