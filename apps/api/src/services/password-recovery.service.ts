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

export async function requestPasswordRecovery(email: string, administratorId?: string) {
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
  if (!user || user.status !== "ACTIVE" || (administratorId && !user.passwordHash)) {
    if (administratorId) fail("Only active accounts with a local password can receive a reset link.", 409);
    return neutralMessage;
  }
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
  if (!reserved.count) {
    if (administratorId) fail("A reset link was recently requested. Wait one minute before trying again.", 429);
    return neutralMessage;
  }
  const link = new URL("/reset-password", webUrl);
  link.searchParams.set("token", token);
  const notice = administratorId
    ? "Your System Administrator requested a password reset for your Advisio account. Choose a new password using the link below. Your current password remains unchanged until you complete the reset."
    : "A password reset was requested for your Advisio account.";
  const text = `${notice}\nReset your Advisio password using this link within 30 minutes: ${link.href}\nIf this was unexpected, contact your System Administrator.`;
  const escapedLink = link.href
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
  const delivery = await sendEmail({
    to: user.email,
    subject: "Reset your Advisio password",
    text,
    html: `<p>${notice}</p><p><a href="${escapedLink}">Reset password</a></p><p>This link expires in 30 minutes and can only be used once. If this was unexpected, contact your System Administrator.</p>`,
  });
  if (!delivery.success) {
    await prisma.user.updateMany({
      where: { id: user.id, passwordResetTokenHash: hash },
      data: { passwordResetTokenHash: null, passwordResetExpiresAt: null },
    });
    // Keep the public response independent of account existence; provider failures are logged for operators.
    console.error("Password recovery email delivery failed.");
    if (administratorId) fail("The reset email could not be sent. Please try again later.", 503);
  }
  if (administratorId) {
    await prisma.auditLog.create({ data: {
      userId: administratorId, action: "UPDATE", entityType: "PASSWORD_RESET_REQUEST",
      entityId: user.id, newValues: { requestedByAdministrator: true },
    } });
    return "Password reset email sent. The link expires in 30 minutes.";
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
