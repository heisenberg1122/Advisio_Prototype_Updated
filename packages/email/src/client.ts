import { sendGmail } from "./gmail.js";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const provider = process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : "mock");
  if (provider === "gmail") return sendGmail(options);
  if (!["mock", "resend"].includes(provider)) return { success: false, error: "Unknown email provider." };
  const apiKey = process.env.RESEND_API_KEY;
  const from = options.from || process.env.EMAIL_FROM || "Advisio Notifications <notifications@advisio.edu.ph>";
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  // If no API key is provided (local development or tests), use mock delivery
  if (provider === "mock") {
    if (process.env.NODE_ENV === "production") return { success: false, error: "A real email provider must be configured in production." };
    console.log(`\n📧 [Advisio Mock Email Delivery]`);
    console.log(`   To:      ${recipients.join(", ")}`);
    console.log(`   From:    ${from}`);
    console.log(`   Subject: ${options.subject}`);
    console.log(`   Content: ${options.text ? options.text.substring(0, 100) + "..." : "[HTML Payload]"}\n`);
    return {
      success: true,
      messageId: `mock-msg-${Date.now()}`,
    };
  }

  // Real delivery via Resend API
  if (!apiKey) return { success: false, error: "Resend delivery is not configured." };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error("Resend API delivery failure:", errData);
      return { success: false, error: errData };
    }

    const resJson = await response.json() as { id: string };
    return { success: true, messageId: resJson.id };
  } catch (err: any) {
    console.error("Email client network error:", err);
    return { success: false, error: err?.message || "Unknown delivery error" };
  }
}
