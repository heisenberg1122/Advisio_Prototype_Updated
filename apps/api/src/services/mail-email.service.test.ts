import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), sendEmail: vi.fn() }));
vi.mock("../lib/prisma.js", () => ({ prisma: { user: { findMany: mocks.findMany } } }));
vi.mock("@research-management/email", () => ({ sendEmail: mocks.sendEmail }));
import { notifyMailRecipients } from "./mail-email.service.js";
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
describe("internal mail email alerts", () => {
  it("does nothing until explicitly enabled", async () => {
    vi.stubEnv("MAIL_EMAIL_NOTIFICATIONS", "false");
    await notifyMailRecipients(["user-a"]);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("sends separate alerts to active recipients without leaking other recipients or document content", async () => {
    vi.stubEnv("MAIL_EMAIL_NOTIFICATIONS", "true"); vi.stubEnv("WEB_URL", "https://advisio.example");
    mocks.findMany.mockResolvedValue([{ email: "a@gmail.com" }, { email: "b@gmail.com" }]);
    mocks.sendEmail.mockResolvedValue({ success: true });
    await notifyMailRecipients(["a", "b", "a"]);
    expect(mocks.findMany).toHaveBeenCalledWith({ where: { id: { in: ["a", "b"] }, status: "ACTIVE" }, select: { email: true } });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({ to: "a@gmail.com", subject: "You have a new message in Advisio" });
    expect(JSON.stringify(mocks.sendEmail.mock.calls[0])).not.toContain("b@gmail.com");
  });
  it("keeps the committed internal message successful when external delivery fails", async () => {
    vi.stubEnv("MAIL_EMAIL_NOTIFICATIONS", "true"); vi.stubEnv("WEB_URL", "https://advisio.example");
    mocks.findMany.mockRejectedValue(new Error("unavailable"));
    await expect(notifyMailRecipients(["a"])).resolves.toBeUndefined();
  });
});
