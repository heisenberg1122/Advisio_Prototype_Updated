import { randomUUID } from "node:crypto";
import type { SendEmailOptions, SendEmailResult } from "./client.js";

export function gmailConfigured(): boolean {
  return ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "GMAIL_SENDER_EMAIL"]
    .every((key) => Boolean(process.env[key]?.trim()));
}

function header(value: string): string {
  if (/[\r\n\0]/.test(value)) throw new Error("Invalid email header.");
  return value;
}

function address(value: string): string {
  if (!/^[^\s<>@,;:]+@[^\s<>@,;:]+\.[^\s<>@,;:]+$/.test(header(value))) {
    throw new Error("Invalid email address.");
  }
  return value;
}

function base64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
}

function subjectHeader(value: string): string {
  // Each encoded word must fit within RFC 2047's 75-character limit.
  const chunks: string[] = [];
  let current = "";
  for (const character of header(value)) {
    if (Buffer.byteLength(current + character) > 42) {
      chunks.push(current);
      current = "";
    }
    current += character;
  }
  chunks.push(current);
  return chunks.map((chunk) => `=?UTF-8?B?${Buffer.from(chunk).toString("base64")}?=`).join("\r\n ");
}

export async function sendGmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    if (!gmailConfigured()) throw new Error("Gmail delivery is not configured.");
    const sender = address(process.env.GMAIL_SENDER_EMAIL!.trim());
    // Gmail always sends as the dedicated system account, never as an app user.
    if (options.from && options.from !== sender) throw new Error("Gmail sender overrides are not supported.");
    const recipients = (Array.isArray(options.to) ? options.to : [options.to]).map(address);
    if (!recipients.length) throw new Error("At least one recipient is required.");
    header(options.subject);
    const boundary = `advisio-${randomUUID()}`;
    const raw = [
      `From: Advisio <${sender}>`,
      `To: ${recipients.join(", ")}`,
      `Subject: ${subjectHeader(options.subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      base64(options.text || "You have a new notification in Advisio."),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      base64(options.html),
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID!,
        client_secret: process.env.GMAIL_CLIENT_SECRET!,
        refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
        grant_type: "refresh_token",
      }),
    });
    if (!tokenResponse.ok) throw new Error(`Gmail authorization failed (HTTP ${tokenResponse.status}). Reauthorize the sender account.`);
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) throw new Error("Gmail authorization returned no access token.");
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url") }),
    });
    if (!response.ok) throw new Error(`Gmail delivery failed (HTTP ${response.status}).`);
    const message = await response.json() as { id?: string };
    if (!message.id) throw new Error("Gmail delivery returned no message ID.");
    return { success: true, messageId: message.id };
  } catch (error) {
    // Do not log Google response bodies or credentials.
    return { success: false, error: error instanceof Error ? error.message : "Gmail delivery failed." };
  }
}
