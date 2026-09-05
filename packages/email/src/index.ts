export * from "./client";
export * from "./templates/welcome";
export * from "./templates/defense";

import { sendEmail, SendEmailResult } from "./client";
import { renderWelcomeEmail, WelcomeEmailProps } from "./templates/welcome";
import { renderDefenseScheduledEmail, DefenseScheduledEmailProps } from "./templates/defense";

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
