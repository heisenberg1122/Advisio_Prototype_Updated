# Google registration and onboarding

Signing in with a verified Google account automatically creates a pending Advisio
account when no linked identity or matching email exists. The user chooses
Researcher or Faculty, confirms their name, enters their official researcher/student
or faculty/employee ID, selects an active college and course/program, and accepts
the institutional research and privacy policies.

Researchers continue through the existing registration onboarding: academic
profile, research status, group setup, research interests, and review. Faculty
provide an academic title, designation, department, and areas of expertise. Both
flows finish pending administrator verification, consistent with normal registration.
Faculty selection requests the existing ADVISER role; it does not grant verified
faculty access automatically.

Signing in with Google again resumes incomplete onboarding and refreshes its
24-hour onboarding session. Existing pending researchers who originally registered
with email can also resume their unfinished registration through Google. Completed
pending accounts receive the normal approval notice. Approved returning users sign
in normally. Suspended and inactive accounts remain blocked.

Onboarding uses a hashed, expiring secret scoped to registration endpoints, rather
than a dashboard login token. It cannot access authenticated academic records.
An administrator cannot activate a Google registration before onboarding is complete.
The final profile submission consumes the secret. Duplicate institutional IDs are
refused rather than merging accounts or granting access to an existing identity.

## Configuration and deployment

- Keep `VITE_GOOGLE_SIGN_IN_CLIENT_ID` on the web app and the matching
  `GOOGLE_SIGN_IN_CLIENT_ID` on the API.
- The old `GOOGLE_SIGN_IN_ALLOW_SELF_SIGNUP` and
  `VITE_GOOGLE_SIGN_IN_ALLOW_SELF_SIGNUP` test-account switches are obsolete and
  no longer control Google registration. No flag change is needed to enable the
  new pending-registration flow.
- Apply migration `20261026110000_google_registration_onboarding` and regenerate
  the Prisma client, then deploy the API and web app together. The migration adds
  the persistent onboarding stage to users; it does not activate existing accounts.
- Older active `TEST-` Google accounts assigned only the Researcher role are moved
  into pending registration on their next Google sign-in, with old sessions
  revoked. They must supply a real institutional ID and complete onboarding.
  Accounts with administrator or other faculty roles are excluded from this transition.

## Manual walkthrough

1. Sign in with a new Google account. Choose Researcher, enter a unique student ID,
   college, and program, and continue through the existing onboarding steps.
2. Close the browser partway through and sign in again. Registration should resume
   without creating another user.
3. Submit the researcher profile. The account should wait for administrator
   verification. Once approved, the same Google account should enter its dashboard.
4. Repeat with a different Google account and choose Faculty. Submit the faculty
   details, approve the account after verification, and sign in again.
5. Attempt to reuse an existing institutional ID, resume an expired session, or sign
   in with a suspended account. Each should show the appropriate refusal or recovery
   message.

Automated tests and builds were not run for this change, as requested.
