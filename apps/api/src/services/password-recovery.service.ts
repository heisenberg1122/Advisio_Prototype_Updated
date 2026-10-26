import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { sendEmail } from "@research-management/email";
import { prisma } from "../lib/prisma.js";

export const recoveryTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
function fail(message: string, statusCode: number): never {
  throw Object.assign(new Error(message), { statusCode });
}
const neutralMessage =
  "If an eligible account exists, a password reset link will be sent to its email address.";

export async function requestPasswordRecovery(email: string) {
  const provider = process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : "mock");
  const configured = provider === "gmail"
    ? ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "GMAIL_SENDER_EMAIL"].every((key) => Boolean(process.env[key]?.trim()))
    : provider === "resend" && Boolean(process.env.RESEND_API_KEY);
  if (!configured || !process.env.WEB_URL)
    fail(
      "Password recovery email is not configured. Contact your administrator.",
      503,
    );
  const webUrl = new URL(process.env.WEB_URL!);
  if (
    !["http:", "https:"].includes(webUrl.protocol) ||
    (process.env.NODE_ENV === "production" && webUrl.protocol !== "https:")
  ) {
    fail(
      "Password recovery email is not configured. Contact your administrator.",
      503,
    );
  }
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user || user.status !== "ACTIVE") return neutralMessage;
  const token = randomBytes(32).toString("hex");
  const hash = recoveryTokenHash(token);
  const expiresAt = new Date(Date.now() + 30 * 60_000);
  // One email per minute per account; concurrent requests cannot replace each other's token.
  const reserved = await prisma.user.updateMany({
    where: {
      id: user.id,
      status: "ACTIVE",
      OR: [
        { passwordResetExpiresAt: null },
        { passwordResetExpiresAt: { lt: new Date(Date.now() + 29 * 60_000) } },
      ],
    },
    data: { passwordResetTokenHash: hash, passwordResetExpiresAt: expiresAt },
  });
  if (!reserved.count) return neutralMessage;
  const link = new URL("/reset-password", webUrl);
  link.searchParams.set("token", token);
  const text = `Reset your Advisio password using this link within 30 minutes: ${link.href}\nIf you did not request this, you can ignore this message.`;
  const escapedLink = link.href
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
  const delivery = await sendEmail({
    to: user.email,
    subject: "Reset your Advisio password",
    text,
    html: `<p>A password reset was requested for your Advisio account.</p><p><a href="${escapedLink}">Reset password</a></p><p>This link expires in 30 minutes. Ignore this message if you did not request it.</p>`,
  });
  if (!delivery.success) {
    await prisma.user.updateMany({
      where: { id: user.id, passwordResetTokenHash: hash },
      data: { passwordResetTokenHash: null, passwordResetExpiresAt: null },
    });
    // Keep the public response independent of account existence; provider failures are logged for operators.
    console.error("Password recovery email delivery failed.");
  }
  return neutralMessage;
}

export async function resetPassword(token: string, password: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    fail("This reset link is invalid or has expired.", 400);
  const hash = recoveryTokenHash(token);
  const user = await prisma.user.findUnique({
    where: { passwordResetTokenHash: hash },
    select: { id: true, status: true, passwordResetExpiresAt: true },
  });
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt <= new Date()
  )
    fail("This reset link is invalid or has expired.", 400);
  const passwordHash = await bcrypt.hash(password, 12);
  // Conditional consume makes concurrent submissions and replay safe.
  const changed = await prisma.user.updateMany({
    where: {
      id: user.id,
      status: "ACTIVE",
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: { gt: new Date() },
    },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      sessionVersion: { increment: 1 },
    },
  });
  if (!changed.count) fail("This reset link is invalid or has expired.", 400);
}
