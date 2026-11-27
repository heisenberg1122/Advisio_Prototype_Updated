# Researcher offline workspace

Researchers open **Offline workspace** from the banner in their portal, or visit `/student/offline`. While connected, choose **Enable on this device**, then **Make available offline** for each desired manuscript version or workflow guide. This feature is opt-in because it stores research information on the device.

The workspace saves requirement instructions, deadline labels, last-known statuses, and submitted feedback. Private preparation drafts save into IndexedDB as the researcher types, including while disconnected. Researchers can export drafts as text files. The same task draft appears above its online task details; **Use as submission note** copies the text into the existing submission form for review. It does not submit anything.

After reconnecting, the workspace verifies the session and refreshes its snapshot. Researchers can also use **Refresh saved information**. Changed or revoked project access removes obsolete downloaded files. Workflow resource versions have separate identities so a replaced guide cannot be mistaken for the cached version. Drafts whose tasks are outside the refreshed snapshot remain exportable under **Other saved drafts**.

Submissions, approvals, signatures, grade releases, messages, and bookings require an online session and the existing server authorization. React Query mutations fail offline instead of waiting to replay on reconnection. Official submission times remain server-generated.

## Storage and access

- The production service worker caches public JavaScript, styles, and the application shell. It never caches API responses, uploads, third-party resources, or private document responses.
- Private data is stored in IndexedDB, scoped to the researcher, university, and college. A hash binds the saved identity to the existing sign-in token; the token is not copied into IndexedDB.
- After a disconnected reload, the saved identity opens only the offline workspace. It does not grant access to server-backed researcher pages or faculty portals. HTTP authentication or authorization rejection never triggers cached sign-in.
- Offline access ends at the current token expiry or seven days after enable/refresh, whichever comes first. Sign-out, a new sign-in, switching college, authentication rejection, and **Remove offline data** clear cached identities, files, and drafts.
- Each saved file is limited to 25 MB, with a 100 MB total file limit. Storage failures are reported rather than showing a successful save. Browser storage eviction can remove offline work; export important drafts.
- Offline access requires HTTPS (or localhost for testing), service workers, and IndexedDB. It is available in production builds, including the built local preview. It is disabled for evaluation sessions and the Vite development server. Live Google Docs require connectivity.

The worker validates its matching entry point before installing. Updates wait for existing tabs to close. Namecheap publishes the worker after the matching assets and index, and serves the worker without HTTP caching.

## Verification

Run `npm --workspace=web run test`, `npm --workspace=web run lint`, and `npm --workspace=web run build`.

Run `npm run test:offline:browser` with no `VITE_API_URL` configured. The browser regression uses a temporary local server and synthetic data, never the real API or database. Windows uses installed Chrome; other platforms use Playwright Chromium. It checks a real offline reload, saved-file retrieval, draft persistence, account isolation, portal restrictions, reconnection refresh, revoked-file pruning, authentication rejection, logout cleanup, and narrow-screen overflow. Screenshots are written under ignored `.local/offline-qa/`.

After pushing, check the CI run for that exact commit, then its Namecheap deployment and the matching Render API health revision. A successful Git push alone does not establish CI or deployment success.
