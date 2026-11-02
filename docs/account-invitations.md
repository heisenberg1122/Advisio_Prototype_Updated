# Faculty invitations and college access

One person has one account, one password, and a separate set of approved faculty roles for each college. Accepting an invitation adds college access; it never transfers the home college or replaces credentials. A person may be an Adviser in one college and a Panelist in another.

## Where to use it

- **System Admin → User Management → Invite user:** invite an Adviser, Professor Coordinator, Panelist, or Dean to an active college. For an existing person, use their current email and institutional ID. Manage roles offers an invitation shortcut for additional access.
- **Dean → Faculty Access:** invite Advisers or request Professor Coordinator and Panelist access in the Dean's active college. Deans cannot appoint Deans or choose another college. Adviser invitations for an existing person outside the college also require System Admin approval.
- **System Admin → User Management → Invitations:** review Dean requests, confirm institutional verification, and record an approval or rejection note. Approval sends the invitation; it does not immediately grant access.
- **Recipient:** open the email link. New users set their password; existing users sign in to the matching account and accept the college roles. Then choose **Open approved college**. With multiple colleges, use **profile menu → Active college** to switch.

Public password and Google registration create Researcher accounts only. Faculty self-registration is removed from both interfaces and rejected by the API. An existing Researcher may accept a faculty invitation on the same account after institutional verification; researcher access remains in the home college. Existing faculty access is preserved by a migration backfill.

## Authorization and records

`CollegeMembership` is authoritative for faculty access. `UserRole` retains the account's union of roles for compatibility and institution-wide System Admin access, but cannot grant a faculty role in another college. New faculty grants require invitation acceptance; role management can remove existing grants.

Switching colleges produces a signed session token bound to the selected college. The server validates membership, scopes permissions and academic directories, and checks document, project, review, task, workflow, and defense boundaries. Workflow ownership and project membership do not bypass the active college. The frontend clears queries when account, college, role, or portal changes and asks about unsaved forms before a college switch. Personal inbox conversations remain private to the account; academic contact directories use the active college.

Adviser capacity is an existing person-wide limit. Deans manage capacity for home-college faculty; System Admin manages shared faculty settings. Removing one college role preserves that person's other approved colleges and roles.

## Delivery and deployment

Invitation emails use the shared Advisio notification layout with the logo, recipient greeting, college and assigned roles, an **Accept invitation** button, a fallback link, and a plain-text alternative. The message explains the 48-hour, single-use link and the acceptance steps for new and existing accounts. Invitations are sent directly, independently of the notification email worker.

Configure `WEB_URL` with the web application URL (HTTPS in production), plus an existing supported email provider:

- Gmail: `EMAIL_PROVIDER=gmail`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER_EMAIL`.
- Resend: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` with a verified sender.

Mock delivery is refused. Missing configuration or delivery failure reports an error and grants no access. Invitations expire 48 hours after sending. Resend rotates the token and invalidates the old link, with a one-minute cooldown. Revoke cancels pending invitations or requests. Rejected requests grant nothing.

Apply these migrations before serving the feature: `20261101000000_account_invitations`, `20261101010000_college_memberships`, and `20261101010100_college_invitation_uniqueness`. The API deployment start command already runs `prisma migrate deploy`. Local verification uses a separate test database; deployment and real email delivery are separate steps.

Tokens contain 256 random bits, are stored only as SHA-256 hashes, and are consumed atomically. Links keep tokens in a fragment, including during sign-in, so HTTP access logs and referrers do not receive them. Token operations are rate limited. Issuer authority and college status are rechecked at acceptance; suspended accounts cannot be restored through invitations. Creation, review, acceptance, role changes, and revocation are audited.

## Verification

Tests cover new and existing accounts, same-person invitations from different colleges, Dean scope, admin approval and rejection, scoped role switching, cross-college record denial, password preservation, public faculty registration rejection, expired and revoked tokens, resend rotation, failed delivery, concurrent acceptance, and rate limits. Email transport is mocked in integration tests, so tests send no real invitations.
