import type { SendEmailResult } from "./client.js";

export const emailDeliveryDiagnostics: Record<string, string> = {
  GMAIL_NOT_CONFIGURED: "Gmail credentials are missing. Check the four GMAIL_* environment values.",
  GMAIL_INVALID_CLIENT: "Google rejected the OAuth client. Check the client ID and matching client secret for literal quotes or a rotated secret.",
  GMAIL_INVALID_GRANT: "Google rejected the refresh token. Generate a new refresh token using the same OAuth client and sender account.",
  GMAIL_AUTH_DENIED: "Google denied OAuth authorization. Check the OAuth client, consent, and account policy.",
  GMAIL_AUTH_FAILED: "Gmail authorization failed. Check the OAuth client credentials and refresh token.",
  GMAIL_SCOPE_INSUFFICIENT: "Gmail send permission is missing. Reauthorize the sender with the gmail.send scope.",
  GMAIL_API_DISABLED: "Gmail API is disabled or blocked for the OAuth project. Enable Gmail API in that project.",
  GMAIL_RATE_LIMITED: "Gmail rejected delivery because of a sending or rate limit. Check the sender account quota.",
  GMAIL_FORBIDDEN: "Gmail forbade delivery. Check the sender permissions, scope, and account policy.",
  GMAIL_UNAUTHORIZED: "Gmail rejected the access token. Reauthorize the sender account.",
  GMAIL_NETWORK_ERROR: "A Gmail network request failed or timed out. Check API connectivity and retry.",
  GMAIL_INVALID_RESPONSE: "Google returned an incomplete authorization or delivery response.",
  EMAIL_INVALID_MESSAGE: "The email sender, recipient, or message headers are invalid.",
  GMAIL_SEND_FAILED: "Gmail rejected the email. Check the Gmail API response status with a controlled sender test.",
};

// Never pass through raw provider bodies, exception messages, or arbitrary codes.
export function emailDeliveryDiagnostic(result: Pick<SendEmailResult, "errorCode">): string {
  const code = result.errorCode;
  return code && Object.hasOwn(emailDeliveryDiagnostics, code)
    ? `[${code}] ${emailDeliveryDiagnostics[code]}`
    : "Email provider rejected delivery. Check sender authorization and provider configuration.";
}
