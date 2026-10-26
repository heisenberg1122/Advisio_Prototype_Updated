import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./client.js";

const message = { to: "student@gmail.com", subject: "Advisio — update", html: "<p>Résumé</p>", text: "Résumé" };
beforeEach(() => {
  vi.stubEnv("EMAIL_PROVIDER", "gmail");
  vi.stubEnv("GMAIL_CLIENT_ID", "client-id");
  vi.stubEnv("GMAIL_CLIENT_SECRET", "client-secret");
  vi.stubEnv("GMAIL_REFRESH_TOKEN", "refresh-token");
  vi.stubEnv("GMAIL_SENDER_EMAIL", "advisio@gmail.com");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Gmail delivery", () => {
  it("refreshes authorization and sends a Unicode MIME message as the system account", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "gmail-id" })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendEmail(message)).toEqual({ success: true, messageId: "gmail-id" });
    expect(fetchMock.mock.calls[0][1].body.get("grant_type")).toBe("refresh_token");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer access-token");
    const raw = Buffer.from(JSON.parse(fetchMock.mock.calls[1][1].body).raw, "base64url").toString();
    expect(raw).toContain("From: Advisio <advisio@gmail.com>");
    expect(raw).toContain("To: student@gmail.com");
    expect(raw).toContain(Buffer.from(message.subject).toString("base64"));
    expect(raw).toContain(Buffer.from(message.html).toString("base64"));
  });
  it("fails rather than falling back to mock delivery for missing Gmail credentials", async () => {
    vi.stubEnv("GMAIL_REFRESH_TOKEN", "");
    expect(await sendEmail(message)).toMatchObject({ success: false, error: "Gmail delivery is not configured.", errorCode: "GMAIL_NOT_CONFIGURED" });
  });
  it("rejects header injection and sender overrides before contacting Google", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    for (const override of [{ subject: "Hello\r\nBcc: victim@gmail.com" }, { to: "a@gmail.com\r\nBcc: b@gmail.com" }, { from: "other@gmail.com" }]) {
      expect((await sendEmail({ ...message, ...override })).success).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports authorization and send failures without exposing provider response secrets", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("secret-details", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await sendEmail(message)).error).toContain("authorization failed (HTTP 400)");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token" })))
      .mockResolvedValueOnce(new Response("secret-details", { status: 429 }));
    expect(await sendEmail(message)).toMatchObject({ success: false, error: "Gmail delivery failed (HTTP 429).", errorCode: "GMAIL_RATE_LIMITED" });
  });
  it.each(["invalid_client", "invalid_grant"])("identifies %s without echoing Google response bodies", async (error) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error, error_description: "sensitive-provider-description" }), { status: 400 })));
    const result = await sendEmail(message);
    expect(result.errorCode).toBe(error === "invalid_client" ? "GMAIL_INVALID_CLIENT" : "GMAIL_INVALID_GRANT");
    expect(JSON.stringify(result)).not.toContain("sensitive-provider-description");
  });
  it("identifies missing Gmail permissions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { errors: [{ reason: "insufficientPermissions" }], message: "private-details" } }), { status: 403 })));
    expect((await sendEmail(message)).errorCode).toBe("GMAIL_SCOPE_INSUFFICIENT");
  });
  it("disallows mock delivery in production and missing Resend credentials", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "mock"); vi.stubEnv("NODE_ENV", "production");
    expect((await sendEmail(message)).success).toBe(false);
    vi.stubEnv("EMAIL_PROVIDER", "resend"); vi.stubEnv("RESEND_API_KEY", "");
    expect((await sendEmail(message)).success).toBe(false);
  });
});
