import { sendEmail, emailDeliveryDiagnostic } from "@research-management/email";

const keys = ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "GMAIL_SENDER_EMAIL"];
console.log("Gmail configuration (credential values are never printed):");
for (const key of keys) {
  const value = process.env[key] || "";
  const quoted = value.startsWith('"') || value.startsWith("'") || value.endsWith('"') || value.endsWith("'");
  console.log(`${key}: ${!value.trim() ? "MISSING" : quoted ? "HAS LITERAL QUOTES — remove quotes in the Render value field" : value !== value.trim() ? "HAS EXTRA WHITESPACE" : "present"}`);
}
console.log(`Email provider: ${process.env.EMAIL_PROVIDER === "gmail" ? "gmail" : "not set to gmail"}`);
console.log(`Event email worker: ${process.env.NOTIFICATION_EMAILS_ENABLED === "true" ? "enabled" : "disabled (value must be exactly true)"}`);
console.log(`Application URL: ${process.env.WEB_URL === "https://advisio-prototype-updated.vercel.app" ? "matches live Vercel site" : "does not match expected production URL"}`);

const args = process.argv.slice(2);
if (args.length) {
  if (args.length !== 2 || args[0] !== "--to" || !/^[^\s<>@,;:]+@[^\s<>@,;:]+\.[^\s<>@,;:]+$/.test(args[1])) {
    console.error("Optional real send: node apps/api/scripts/check-gmail.mjs --to YOUR_TEST_EMAIL");
    process.exit(1);
  }
  if (process.env.EMAIL_PROVIDER !== "gmail") {
    console.error("Set EMAIL_PROVIDER=gmail before testing delivery.");
    process.exit(1);
  }
  const result = await sendEmail({ to: args[1], subject: "Advisio Gmail connection test", text: "This is a manual test of your Advisio Gmail sender.", html: "<p>This is a manual test of your Advisio Gmail sender.</p>" });
  if (result.success) console.log("Gmail accepted the test email. Check the recipient inbox/spam folder and sender Sent folder.");
  else { console.error(emailDeliveryDiagnostic(result)); process.exitCode = 1; }
}
