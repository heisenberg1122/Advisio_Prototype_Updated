export interface WelcomeEmailProps {
  name: string;
  email: string;
  role: string;
  temporaryPassword?: string;
  loginUrl: string;
}

export function renderWelcomeEmail(props: WelcomeEmailProps): { html: string; text: string; subject: string } {
  const subject = `Welcome to Advisio - Your Research Management Account`;
  const text = `
Hello ${props.name},

Welcome to Advisio Research Management System. Your account has been provisioned with the role: ${props.role}.

Email: ${props.email}
${props.temporaryPassword ? `Temporary Password: ${props.temporaryPassword}` : ""}

Login here: ${props.loginUrl}

Please update your credentials upon initial sign-in.

Best regards,
The Advisio Research Office Team
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
    .header { background: #1e3a8a; padding: 28px 32px; color: #ffffff; text-align: left; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0 0; color: #93c5fd; font-size: 14px; }
    .content { padding: 32px; }
    .credentials { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .cred-item { margin: 6px 0; font-size: 14px; }
    .cred-label { color: #64748b; font-weight: 600; width: 130px; display: inline-block; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 16px 0 8px 0; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Advisio Research Portal</h1>
      <p>Institutional Research Management System</p>
    </div>
    <div class="content">
      <h2>Welcome, ${props.name}!</h2>
      <p>An institutional account has been created for you on the Advisio Research Management System with the role <strong>${props.role}</strong>.</p>
      
      <div class="credentials">
        <div class="cred-item"><span class="cred-label">Registered Email:</span> <code>${props.email}</code></div>
        ${props.temporaryPassword ? `<div class="cred-item"><span class="cred-label">Temporary Pass:</span> <code>${props.temporaryPassword}</code></div>` : ""}
      </div>

      <p>Click below to sign in and begin managing your research projects, reviews, and consultations:</p>
      
      <a href="${props.loginUrl}" class="btn">Sign In to Advisio</a>
      <p style="font-size: 13px; color: #64748b; margin-top: 16px;">If you did not expect this invitation, please contact your college research coordinator.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Advisio Research Office. All rights reserved.
    </div>
  </div>
</body>
</html>
`.trim();

  return { html, text, subject };
}
