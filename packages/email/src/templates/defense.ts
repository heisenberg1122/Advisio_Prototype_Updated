export interface DefenseScheduledEmailProps {
  recipientName: string;
  researchTitle: string;
  defenseType: string; // "PROPOSAL" | "MIDTERM" | "FINAL"
  date: string;
  time: string;
  venue?: string;
  meetingLink?: string;
  panelists?: string[];
}

export function renderDefenseScheduledEmail(props: DefenseScheduledEmailProps): { html: string; text: string; subject: string } {
  const subject = `Notice of Scheduled Defense: ${props.researchTitle}`;
  const text = `
Dear ${props.recipientName},

You have a scheduled ${props.defenseType} defense for the research project:
"${props.researchTitle}"

Date: ${props.date}
Time: ${props.time}
Venue: ${props.venue || "Online"}
${props.meetingLink ? `Virtual Meeting Link: ${props.meetingLink}` : ""}
${props.panelists && props.panelists.length > 0 ? `Evaluation Panel: ${props.panelists.join(", ")}` : ""}

Please ensure your presentation deck and manuscript are submitted at least 48 hours prior to the scheduled time.

Best regards,
Advisio Research Defense Committee
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #0f766e; padding: 28px 32px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 6px 0 0 0; color: #99f6e4; font-size: 14px; }
    .content { padding: 32px; }
    .meta-box { background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .meta-row { margin: 6px 0; font-size: 14px; }
    .meta-label { color: #0f766e; font-weight: 600; width: 120px; display: inline-block; }
    .btn { display: inline-block; background: #0d9488; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 16px 0 8px 0; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Defense Schedule Confirmation</h1>
      <p>${props.defenseType} Evaluation Session</p>
    </div>
    <div class="content">
      <p>Dear <strong>${props.recipientName}</strong>,</p>
      <p>Your defense schedule has been confirmed for the following study:</p>
      <blockquote style="margin: 12px 0; padding-left: 14px; border-left: 3px solid #0d9488; font-weight: 600; color: #0f172a;">
        ${props.researchTitle}
      </blockquote>

      <div class="meta-box">
        <div class="meta-row"><span class="meta-label">Date:</span> <strong>${props.date}</strong></div>
        <div class="meta-row"><span class="meta-label">Time:</span> <strong>${props.time}</strong></div>
        <div class="meta-row"><span class="meta-label">Venue:</span> ${props.venue || "Virtual Conference Room"}</div>
        ${props.panelists && props.panelists.length > 0 ? `<div class="meta-row"><span class="meta-label">Panel:</span> ${props.panelists.join(", ")}</div>` : ""}
      </div>

      ${props.meetingLink ? `<a href="${props.meetingLink}" class="btn">Join Virtual Session</a>` : ""}
    </div>
    <div class="footer">
      Advisio Research Management System &bull; Official Notification
    </div>
  </div>
</body>
</html>
`.trim();

  return { html, text, subject };
}
