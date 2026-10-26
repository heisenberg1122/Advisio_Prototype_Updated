import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps/api/package.json"));
require("dotenv").config({ path: path.join(root, ".env") });
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--to" || !/^[^\s<>@,;:]+@[^\s<>@,;:]+\.[^\s<>@,;:]+$/.test(args[1])) {
  console.error("Usage: npm run email:test -- --to your-test-address@gmail.com");
  process.exit(1);
}
if (process.env.EMAIL_PROVIDER !== "gmail") {
  console.error("Set EMAIL_PROVIDER=gmail and configure the dedicated sender first.");
  process.exit(1);
}
const { sendEmail } = await import("../packages/email/dist/index.js");
const result = await sendEmail({
  to: args[1],
  subject: "Advisio email setup test",
  text: "Your Advisio system email integration is working. This is a setup test.",
  html: "<p>Your Advisio system email integration is working. This is a setup test.</p>",
});
if (!result.success) {
  console.error(result.error);
  process.exitCode = 1;
} else {
  console.log(`Gmail accepted the test email. Message ID: ${result.messageId}. Check the recipient inbox/spam folder.`);
}
