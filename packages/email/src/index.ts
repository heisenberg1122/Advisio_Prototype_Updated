export * from "./client.js";
export * from "./delivery-diagnostics.js";
export * from "./templates/notifications.js";
export * from "./template-config.js";
export * from "./templates/welcome.js";
export * from "./templates/defense.js";

import { sendEmail, SendEmailResult } from "./client.js";
import { renderWelcomeEmail, WelcomeEmailProps } from "./templates/welcome.js";
import { renderDefenseScheduledEmail, DefenseScheduledEmailProps } from "./templates/defense.js";

export async function sendWelcomeNotification(props: WelcomeEmailProps): Promise<SendEmailResult> {
  const rendered = renderWelcomeEmail(props);
  return sendEmail({
    to: props.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}

export async function sendDefenseNotification(recipientEmail: string, props: DefenseScheduledEmailProps): Promise<SendEmailResult> {
  const rendered = renderDefenseScheduledEmail(props);
  return sendEmail({
    to: recipientEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}
