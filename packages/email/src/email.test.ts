import { describe, it, expect, vi } from "vitest";
import { renderWelcomeEmail } from "./templates/welcome";
import { renderDefenseScheduledEmail } from "./templates/defense";
import { sendEmail, sendWelcomeNotification, sendDefenseNotification } from "./index";

describe("Email Package", () => {
  it("renders welcome email with provided credentials and institutional layout", () => {
    const rendered = renderWelcomeEmail({
      name: "Dr. Rachel Lim",
      email: "rachel.lim@advisio.edu.ph",
      role: "ADVISER",
      temporaryPassword: "TempPassword123!",
      loginUrl: "http://localhost:3000/login",
    });

    expect(rendered.subject).toContain("Welcome to Advisio");
    expect(rendered.html).toContain("Dr. Rachel Lim");
    expect(rendered.html).toContain("ADVISER");
    expect(rendered.html).toContain("TempPassword123!");
    expect(rendered.html).toContain("http://localhost:3000/login");
    expect(rendered.text).toContain("rachel.lim@advisio.edu.ph");
  });

  it("renders defense schedule notification with panel details", () => {
    const rendered = renderDefenseScheduledEmail({
      recipientName: "Juan Reyes",
      researchTitle: "AI Crop Yield Prediction System",
      defenseType: "PROPOSAL",
      date: "October 15, 2026",
      time: "10:00 AM - 12:00 PM",
      venue: "Conference Room B",
      meetingLink: "https://meet.google.com/abc-defg-hij",
      panelists: ["Dr. Rachel Lim", "Prof. Alan Turing"],
    });

    expect(rendered.subject).toContain("Notice of Scheduled Defense");
    expect(rendered.html).toContain("Juan Reyes");
    expect(rendered.html).toContain("AI Crop Yield Prediction System");
    expect(rendered.html).toContain("PROPOSAL Evaluation Session");
    expect(rendered.html).toContain("October 15, 2026");
    expect(rendered.html).toContain("Dr. Rachel Lim, Prof. Alan Turing");
    expect(rendered.html).toContain("https://meet.google.com/abc-defg-hij");
  });

  it("dispatches email in mock mode when RESEND_API_KEY is not configured", async () => {
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    const result = await sendEmail({
      to: "student@advisio.edu.ph",
      subject: "Test Mock Notification",
      html: "<p>Hello World</p>",
      text: "Hello World",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.messageId).toContain("mock-msg-");

    if (originalKey) process.env.RESEND_API_KEY = originalKey;
  });

  it("dispatches welcome and defense notifications via helper functions", async () => {
    const welcomeRes = await sendWelcomeNotification({
      name: "Maria Santos",
      email: "maria.santos@advisio.edu.ph",
      role: "RESEARCHER",
      loginUrl: "http://localhost:3000/login",
    });
    expect(welcomeRes.success).toBe(true);

    const defenseRes = await sendDefenseNotification("maria.santos@advisio.edu.ph", {
      recipientName: "Maria Santos",
      researchTitle: "Neural Network Weed Detection",
      defenseType: "FINAL",
      date: "November 20, 2026",
      time: "2:00 PM",
    });
    expect(defenseRes.success).toBe(true);
  });
});
