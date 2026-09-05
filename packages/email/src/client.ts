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
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = options.from || process.env.EMAIL_FROM || "Advisio Notifications <notifications@advisio.edu.ph>";
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  // If no API key is provided (local development or tests), use mock delivery
  if (!apiKey) {
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
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
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
