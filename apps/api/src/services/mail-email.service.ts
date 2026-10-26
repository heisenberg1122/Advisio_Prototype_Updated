import { sendEmail } from "@research-management/email";
import { prisma } from "../lib/prisma.js";

/** Called only after the authorized internal message transaction commits. */
export async function notifyMailRecipients(recipientIds: string[]) {
  if (process.env.MAIL_EMAIL_NOTIFICATIONS !== "true") return;
  try {
    const url = new URL(process.env.WEB_URL || "");
    if (!['http:', 'https:'].includes(url.protocol) ||
        (process.env.NODE_ENV === "production" && url.protocol !== "https:")) {
      throw new Error("A valid WEB_URL is required for mail email notifications.");
    }
    const recipients = await prisma.user.findMany({
      where: { id: { in: [...new Set(recipientIds)] }, status: "ACTIVE" },
      select: { email: true },
    });
    const link = url.origin;
    // One message per recipient keeps Bcc addresses private. Content and files
    // stay in the authenticated workspace, including signed research documents.
    for (const recipient of recipients) {
      const result = await sendEmail({
        to: recipient.email,
        subject: "You have a new message in Advisio",
        text: `You have a new message in Advisio. Sign in to read it: ${link}\nThis mailbox sends automatic notifications. Please reply inside Advisio.`,
        html: `<p>You have a new message in Advisio.</p><p>Sign in to read it: <a href="${link}">Open Advisio</a></p><p>This mailbox sends automatic notifications. Please reply inside Advisio.</p>`,
      });
      if (!result.success) console.error("Mail email notification failed:", result.error);
    }
  } catch {
    // External failures must never turn a committed message into a failed send
    // response, which could cause the user to send duplicate internal messages.
    console.error("Mail email notifications could not be delivered.");
  }
}
