export type NotificationTemplate = {
  subject: string;
  heading: string;
  paragraphs: string[];
  button: string;
};

// Add a template here, then attach its key and variables to an event's
// emailNotification() metadata. All templates share the layout below.
export const notificationTemplates: Record<string, NotificationTemplate> = {
  account_approved: {
    subject: "Your Advisio account has been approved",
    heading: "Your account is approved",
    paragraphs: [
      "Your Advisio account has been approved. Sign in with your Google account to access your assigned workspace.",
    ],
    button: "Open Advisio",
  },
  workflow_invitation: {
    subject: "You’re invited to join {workflowName}",
    heading: "Workflow invitation",
    paragraphs: [
      "{actorName} has invited you to join {workflowName}.",
      "Open the invitation to review the details and accept or decline.",
    ],
    button: "View Invitation",
  },
  announcement: {
    subject: "{scope} announcement: {title}",
    heading: "{title}",
    paragraphs: ["An announcement from {actorName} for {scope}.", "{message}"],
    button: "Read Announcement",
  },
  submission_approved: {
    subject: "Approved: {title}",
    heading: "Requirement approved",
    paragraphs: ["Your requirement, {title}, has been approved.", "{message}"],
    button: "View Result",
  },
  submission_rejected: {
    subject: "Submission rejected: {title}",
    heading: "Submission decision",
    paragraphs: [
      "Your submission for {title} has been rejected.",
      "{message}",
      "Review the feedback and available next steps in Advisio.",
    ],
    button: "View Feedback",
  },
  submission_revision: {
    subject: "Revision requested: {title}",
    heading: "Changes requested",
    paragraphs: [
      "Changes have been requested to your submission for {title}.",
      "{message}",
      "Review the requested changes before resubmitting.",
    ],
    button: "Review and Revise",
  },
  requirement_created: {
    subject: "New requirement: {title}",
    heading: "A new requirement is available",
    paragraphs: [
      "{title} is now available in {workflowName}.",
      "{message}",
      "Deadline: {dueDate}",
    ],
    button: "View Requirements",
  },
  requirement_due: {
    subject: "Due soon: {title}",
    heading: "Your deadline is approaching",
    paragraphs: [
      "{title} still needs your attention.",
      "Deadline: {dueDate}",
      "{message}",
    ],
    button: "Open Requirement",
  },
  team_invitation: {
    subject: "{actorName} invited you to join {teamName}",
    heading: "Team workspace invitation",
    paragraphs: [
      "{actorName} has invited you to join {teamName}.",
      "Open Advisio to review the team invitation.",
    ],
    button: "View Team Invitation",
  },
  team_joined: {
    subject: "{actorName} joined {teamName}",
    heading: "Your team has a new member",
    paragraphs: [
      "{actorName} has accepted the invitation and joined {teamName}.",
    ],
    button: "Open Team Workspace",
  },
  defense_eligible: {
    subject: "Your team is eligible for defense",
    heading: "Defense eligibility approved",
    paragraphs: [
      "Your research team has been approved for the next defense cycle.",
      "{message}",
      "Eligibility does not mean a defense has been scheduled. Review the next steps in Advisio.",
    ],
    button: "View Defense Details",
  },
  workflow_completed: {
    subject: "Workflow completed: {workflowName}",
    heading: "Congratulations on completing your workflow",
    paragraphs: [
      "Your research team has successfully completed {workflowName}.",
      "{message}",
    ],
    button: "View Completed Workflow",
  },
  title_defended: {
    subject: "Title defense passed: {researchTitle}",
    heading: "Congratulations on your Title Defense",
    paragraphs: [
      "Your team has successfully passed its Title Defense for {researchTitle}.",
      "Official result: {result}",
      "Review the released feedback and any remaining requirements in Advisio.",
    ],
    button: "View Defense Result",
  },
  thesis_defended: {
    subject: "Thesis defense passed: {researchTitle}",
    heading: "Congratulations on your Thesis Defense",
    paragraphs: [
      "Your team has successfully passed its Thesis Defense for {researchTitle}.",
      "Official result: {result}",
      "Review the released feedback and any remaining requirements in Advisio.",
    ],
    button: "View Defense Result",
  },
};

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
const fill = (value: string, data: Record<string, string>) =>
  value.replace(/\{(\w+)\}/g, (_match, key: string) => {
    if (!(key in data))
      throw new Error(`Missing notification variable: ${key}`);
    return data[key];
  });

export function renderNotificationEmail(
  key: string,
  data: Record<string, string>,
  options: {
    webUrl: string;
    actionUrl?: string | null;
    logoUrl?: string;
    templates?: Record<string, NotificationTemplate>;
  },
) {
  const template = (options.templates || notificationTemplates)[key];
  if (!template) throw new Error(`Unknown notification template: ${key}`);
  const base = new URL(options.webUrl);
  if (!["https:", "http:"].includes(base.protocol))
    throw new Error("Invalid application URL.");
  const action = new URL(options.actionUrl || "/", base.origin);
  if (action.origin !== base.origin)
    throw new Error("Notification links must stay inside Advisio.");
  const logo = new URL(
    options.logoUrl || "/advisio-email-logo.png",
    base.origin,
  );
  if (!["https:", "http:"].includes(logo.protocol))
    throw new Error("Invalid email logo URL.");
  const subject = fill(template.subject, data).replace(/[\r\n]/g, " ");
  const heading = fill(template.heading, data);
  const paragraphs = template.paragraphs.map((paragraph) =>
    fill(paragraph, data),
  );
  const name = data.firstName || "there";
  const text = [
    `Hello ${name},`,
    heading,
    ...paragraphs,
    `${template.button}: ${action.href}`,
    "Advisio · Automated notification. Please take action inside the system.",
  ].join("\n\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#334155;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(heading)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
<tr><td align="center" style="padding:24px;border-bottom:1px solid #e2e8f0;"><img src="${escape(logo.href)}" alt="Advisio" width="144" style="display:block;width:144px;max-width:100%;height:auto;border:0;"></td></tr>
<tr><td style="padding:32px 28px;text-align:left;font-size:16px;line-height:1.65;word-break:break-word;">
<p style="margin:0 0 16px;">Hello ${escape(name)},</p><h1 style="margin:0 0 20px;color:#102c54;font-size:24px;line-height:1.3;">${escape(heading)}</h1>
${paragraphs.map((paragraph) => `<p style="margin:0 0 16px;white-space:pre-line;">${escape(paragraph)}</p>`).join("")}
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;"><tr><td bgcolor="#1261c9" style="border-radius:6px;"><a href="${escape(action.href)}" style="display:inline-block;padding:13px 22px;border:1px solid #1261c9;border-radius:6px;color:#fff;font-weight:bold;text-decoration:none;">${escape(template.button)}</a></td></tr></table>
<p style="margin:0;font-size:13px;color:#64748b;">If the button does not work, open:<br><a href="${escape(action.href)}" style="color:#1261c9;word-break:break-all;">${escape(action.href)}</a></p></td></tr>
<tr><td align="center" style="padding:20px 24px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;">Advisio · Research Management<br>Automated notification. Please take action inside the system.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}
