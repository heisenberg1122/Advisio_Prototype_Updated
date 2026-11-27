# Offline support in researcher pages

Researchers use the existing Home, Tasks, Documents, and Guides pages while offline. Open the small **Offline settings** control in the researcher topbar and choose **Enable on this device** while connected. This saves the app and core researcher reads. After that, authorized information is refreshed on the device as those pages are used online. The legacy `/student/offline` bookmark redirects to Tasks with the settings panel open; there is no separate offline page or editor.

The same pages show saved requirement instructions, deadlines, last-known statuses, and feedback after a disconnected reload. A small status line identifies offline information and its saved time. The task's existing **Note for faculty** field saves locally as the researcher types and restores in the same field. There is no second preparation editor. Notes prepared offline, restored from the previous editor, or associated with changed requirements must be reviewed explicitly before submission. Export controls preserve a copy of the draft, including older drafts longer than the submission-note limit.

Choose **Make available offline** beside a stored manuscript version in the document viewer or beside a workflow guide. Saved PDFs open inside the existing viewer; guides open in a dialog on the same Tasks page. Live Google Docs require connectivity. **Offline settings** shows downloaded files and storage usage, supports removing downloads, exporting all local drafts, and clearing offline data.

After reconnecting, the app verifies the session, refreshes saved data, and updates the current page while preserving the note. **Refresh saved information** is also available in settings. Changed or revoked project access removes associated saved reads and downloaded files. Resource versions have separate identities so a replaced guide cannot be mistaken for the cached version. Drafts from removed requirements remain exportable through **Export local drafts**. Sections outside the supported pages show an online-required message in the normal researcher frame without redirecting to another offline destination.

Submissions, approvals, signatures, grade releases, messages, and bookings require an online session and the existing server authorization. React Query mutations fail offline instead of waiting to replay on reconnection. Official submission times remain server-generated.

## Storage and access

- The production service worker caches public JavaScript (including the PDF worker), styles, brand/college logos, and the application shell. It never caches API responses, uploads, third-party resources, or private document responses.
- Private data is stored in IndexedDB, scoped to the researcher, university, and college. A hash binds the saved identity to the existing sign-in token; the token is not copied into IndexedDB.
- An explicit GET allowlist saves researcher-page responses in IndexedDB, scoped to the account and college, including project and workflow associations for revocation cleanup. Auth responses, inbox messages, arbitrary URLs, and faculty reads are excluded. HTTP failures never become cached successes; denied reads are evicted.
- After a disconnected reload, the saved identity opens supported researcher pages using local information. It does not grant faculty access or allow mutations. Fresh network access waits for online session verification. HTTP authentication or authorization rejection never triggers cached sign-in.
- Offline access ends at the current token expiry or seven days after enable/refresh, whichever comes first. Sign-out, a new sign-in, switching college, authentication rejection, and **Remove offline data** clear cached identities, files, and drafts.
- Each saved file is limited to 25 MB, with a 100 MB total file limit. Storage failures are reported rather than showing a successful save. Browser storage eviction can remove offline work; export important drafts.
- Offline access requires HTTPS (or localhost for testing), service workers, and IndexedDB. It is available in production builds, including the built local preview. It is disabled for evaluation sessions and the Vite development server. Live Google Docs require connectivity.

The worker validates its matching entry point before installing. Updates wait for existing tabs to close. Namecheap publishes the worker after the matching assets and index, and serves the worker without HTTP caching.

## Verification

Run `npm --workspace=web run test`, `npm --workspace=web run lint`, and `npm --workspace=web run build`.

Run `npm run test:offline:browser` with no `VITE_API_URL` configured. The browser regression uses a temporary local server and synthetic data, never the real API or database. Windows uses installed Chrome; other platforms use Playwright Chromium. It checks the actual Home, Tasks, Documents and Guides pages through offline reloads, in-app PDF rendering, note persistence, account isolation, faculty restrictions, reconnection review, revoked-read/file pruning, authentication rejection, logout cleanup, and narrow-screen overflow. Screenshots are written under ignored `.local/offline-qa/`. The same regression runs in GitHub CI.

After pushing, check the CI run for that exact commit, then its Namecheap deployment and the matching Render API health revision. A successful Git push alone does not establish CI or deployment success.
