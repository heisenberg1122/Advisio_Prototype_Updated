# Gmail sender setup

Advisio can send email from one dedicated Gmail or Google Workspace mailbox to
users' registered email addresses, including Gmail. Recipients do not authorize
Google access. This integration sends as the system account; replies belong in
Advisio's mail workspace.

## Authorize the system account

1. Sign into the dedicated sender account and open [Google Cloud Console](https://console.cloud.google.com/).
   Select or create the project for Advisio's email integration.
2. In **APIs & Services → Library**, enable **Gmail API**.
3. In **Google Auth Platform**, configure branding and audience. For a Workspace
   organization, use Internal if available and appropriate. For External testing,
   add only the system sender as a test user. Request the scope
   `https://www.googleapis.com/auth/gmail.send`.
4. Create an OAuth client of type **Web application**. Add this exact authorized
   redirect URI: `https://developers.google.com/oauthplayground`.
5. Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
   In its settings, enable **Use your own OAuth credentials** and enter the
   client ID and client secret from step 4. Use **Offline** access and consent
   prompting so Google can return a refresh token.
6. In Step 1 enter `https://www.googleapis.com/auth/gmail.send`, select
   **Authorize APIs**, and consent using the dedicated sender account.
7. In Step 2 select **Exchange authorization code for tokens**. Save the refresh
   token directly into your local environment or hosting secret settings.
   Keep the secret and tokens out of chat, screenshots, source control, and browser app variables.

External apps in Testing typically receive refresh tokens that expire after seven
days for this scope. Before relying on unattended production email, configure the
appropriate production audience and complete any verification Google requires,
then authorize again. A refresh token can also be revoked; reauthorize if Google
returns an authorization error. Use your own OAuth client in Playground rather
than the Playground's default credentials.

## Configure Advisio

Set these in the repository-root `.env` for local development. In production,
set them on the API host (Render), then restart/redeploy the API.

```dotenv
EMAIL_PROVIDER="gmail"
GMAIL_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GMAIL_CLIENT_SECRET="your-client-secret"
GMAIL_REFRESH_TOKEN="your-refresh-token"
GMAIL_SENDER_EMAIL="your-system-account@gmail.com"
MAIL_EMAIL_NOTIFICATIONS="true"
WEB_URL="http://localhost:3000"
```

Use the live HTTPS web address for `WEB_URL` in production. The sender address
must be the mailbox that granted consent. These Gmail settings are separate from
Google Sign-In and the Drive/Calendar integration. No `VITE_` secrets are needed.
Gmail delivery uses the dedicated address rather than `EMAIL_FROM`.

## Verify

1. Run `npm --workspace=@research-management/email run build`.
2. Send one test email to an address you control:
   `npm run email:test -- --to your-test-address@gmail.com`.
   The command makes a real send and reports Gmail acceptance or failure.
3. Check the recipient's inbox/spam folder and the sender's Sent folder.
4. Restart Advisio. Send internal mail to an authorized active user whose registered
   address you control. Verify that they receive an alert linking back to Advisio.
   Replies and sending saved drafts also trigger alerts; saving a draft does not.

Password recovery also supports the Gmail provider. Internal mail email alerts
contain a generic message and the application link. Message bodies, recipient
lists, and research attachments stay inside the authenticated application.
Each recipient receives a separate email, preserving Bcc privacy.

Email alerts are best effort after the internal message transaction commits.
Failures are logged by the API; they do not undo internal messages or retry
automatically. For the fourteen queued event templates, workflow/department
audiences, and automatic reminders, follow [Notification emails](notification-emails.md).
Those use a separate opt-in switch and persist retries. Gmail account sending
limits still apply, and API acceptance does not guarantee inbox placement.

Sources: [Sending mail](https://developers.google.com/workspace/gmail/api/guides/sending),
[OAuth server flow](https://developers.google.com/identity/protocols/oauth2/web-server),
[OAuth app audience and testing](https://support.google.com/cloud/answer/15549945).
