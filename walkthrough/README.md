# ADVISIO role walkthrough production

Advisio publishes written guides and transcripts for Researchers, Deans, Research Coordinators, Faculty Advisers, and Panelists. The recording tools are for local review. Shared recording commands default to Researcher. Use `--role=dean` for Dean assets and see the [Dean production plan](../docs/walkthroughs/dean-production-plan.md) for setup.

## Source and audit

- [Complete feature inventory](../docs/walkthroughs/researcher-feature-inventory.md)
- [Audit report, editorial budgets and capture plan](../docs/walkthroughs/researcher-production-plan.md)
- [Full storyboard/narration](../docs/walkthroughs/researcher-storyboard.md)
- [Written companion](../docs/walkthroughs/researcher-evaluation-guide.md)
- `researcher/researcher-script.json` is the authoritative text, chapter order, routes, action names and confirmed pronunciation.

The reusable master uses generic onboarding language; study instructions remain in the surrounding evaluation page. It retains Jerry B. — Instructional & Tutorial and the confirmed “ad - vi - sho” pronunciation. Twelve existing narration segments are reused and twelve were replaced only after wording was finalized. Actual timing comes from narration alignment, not editorial budgets.

The introduction includes the supplied ADVISIO logo. Most footage stays in stationary Overview framing; Focus (1.045) and Detail (1.1) are semantic, bounded modes. The previous 1.3 scaling and click-following camera are removed. Motion for React controls product navigation, tabs, dialogs, page entry, progress and file-row changes. Remotion controls chapter fades, understated cursor/ripples, highlights and the illustrative configured-workflow diagram. Recorded data is never advanced by animation.

Use `node scripts/walkthrough/preview.mjs --chapters=introduction` or `--chapters=documents,timeline` for short 720p previews. These never publish or regenerate narration. Render the full production master only after affected previews pass.

## Local preparation

Use the repository's npm workspace and Node 22. Install with `npm ci`, then `npx playwright install chromium`. Remotion acquires its supported headless browser on first render. FFmpeg and ffprobe come from the locked project dependencies; system installation is unnecessary. On Windows x64 the render uses a local copy of Remotion's compositor with the self-contained FFmpeg pair. Remotion versions are pinned together. No Zod composition schema is used; the application's existing Zod version is unchanged.

Copy `.env.walkthrough.example` to **`.env.walkthrough.local` in the repository root**. Add `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`. This file is ignored by Git. Never place credentials in a role script, web environment variable, narration, screenshots or committed storage state. The voice generator checks available quota before requesting speech, then caches completed beats and raw provider responses. Caches are separated by voice and settings, so changing the narrator does not overwrite prior paid generation. Professional voices may require a paid account.

Start the existing isolated evaluation environment using `npm run evaluation:init-local` if needed, then `npm run evaluation:dev`. Reuse an already running evaluation server. `WALKTHROUGH_BASE_URL` must match its configured `EVALUATION_WEB_URL`, including localhost versus 127.0.0.1. Only loopback HTTP origins are accepted by this capture runner.

## Commands

```text
npm run walkthrough:researcher:guides
npm run test:walkthrough
npm run type-check:walkthrough
node scripts/walkthrough/capture-researcher.mjs --audit
npm run walkthrough:researcher:voice
npm run walkthrough:researcher:capture
npm run walkthrough:researcher:render
npm run walkthrough:researcher:verify
```

`npm run walkthrough:researcher:all` runs guide generation → ElevenLabs voice → timed capture → local render → exported-media verification. Capture implementation is verified first in `--audit` mode, which deliberately makes short, **non-publishable** clips without captions or estimated speech. The browser viewport is fixed at 1366×768, with the output composed at 1920×1080. Timed production capture requires the matching generated voice. Attention cues and selected scrolling use the narration's character timestamps. The renderer uses restrained focus regions while retaining full navigation views. It rejects audit clips, capture errors, mismatched viewport dimensions, missing beats, stale script hashes, shorter-than-narration clips, and a runtime over ten minutes.

Run `node scripts/walkthrough/qa-guides.mjs` against the local Vite server for four responsive checks of the written guide, transcript, and dashboard link. Pass the server origin as the first argument if it differs from `http://localhost:3100`.

All capture requests use a newly provisioned student/BSIT evaluation session. Authentication remains in memory. The seed is reused without changing core data, workflow rules or role permissions. The supplied version-three PDF is downloaded from the session's revision endpoint. Resubmission and Group Files creation use normal UI controls in that disposable session. No mail, invitations or external meeting requests are sent. Capture ends the session on success/failure. A session abandoned by a terminated process expires under the existing evaluation policy.

Playwright waits for application state and named elements. Short cursor pauses and remaining narration-length holds are reading time, not readiness sleeps. Action positions/times are recorded per beat for the video cursor and spotlight. Long actions fail if they exceed narration rather than truncating the action. Clip startup is trimmed from measured recording lengths after the real shell becomes visible. The capture report and screenshots must be reviewed after UI updates; the cursor overlay is an annotation of recorded actions.

## Outputs and delivery

Generated files are in `.walkthrough/researcher/` (ignored):

- `voice.json`, exact raw alignment, audio per beat and narration cache.
- `captures.json`, recorded action bounds/times, chapter/beat clips, audit screenshots and failure evidence.
- `timeline.json`: measured chapter and caption timing.
- `export/master-1080p.mp4`: 1920×1080 with burned-in captions.
- `export/researcher-web.mp4`: 1280×720 with native selectable captions.
- `export/researcher-captioned.mp4`: web-size burned-in alternative.
- Poster, SRT, VTT, full transcript, chapter metadata and `media.json`.

The render command composes and encodes footage under the ignored `.walkthrough/` directory for offline review. The `--publish` flag is retired. Use `npm run walkthrough:publish` to rebuild the written pages from the tracked transcripts and chapter data.

The public Researcher companion at `/walkthrough/research-dashboard` provides a written guide and transcript. Evaluation participants can continue to their activities without completing the guide.

## Release review

Review the inventory against current UI before every regeneration. Confirm real product captures, fictional identities, version-specific feedback, actual returned submission status, truthful defense/grade empty states, no third-party connection success, all spoken text captioned, caption safe margins, readable desktop detail, and mobile native captions. Listen to every narration beat for pronunciation, natural tutor delivery, pacing and audio clipping. Compare transcript against audio; view the full export for cursor drift, cropped panels, stale/failed states and transition artifacts. Review local exports for playback and captions on the target devices. No background music is used.

Sources used for implementation: [Playwright recording](https://playwright.dev/docs/videos), [ElevenLabs timing endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps/), [Remotion metadata](https://www.remotion.dev/docs/dynamic-metadata), [Remotion recorded video](https://www.remotion.dev/docs/offthreadvideo). Motion follows restrained spotlight, annotation and progress patterns; no BrewedOps source/assets are copied.

The [Coordinator production plan](../docs/walkthroughs/coordinator-production-plan.md) covers its five chapter exports and isolated role handoffs. Use `--role=coordinator` for its cached assets.

The [Faculty Adviser production plan](../docs/walkthroughs/adviser-production-plan.md) describes the six-chapter recording, isolated fixture, review lifecycle, and cached-narration workflow. Use `--role=adviser` with shared commands.

## Published written walkthroughs

Run `npm run walkthrough:publish` to rebuild the role pages and catalog in `apps/web/public/walkthroughs/`. The command reads tracked text and chapter data and refreshes the release checksums.

Open `/walkthroughs/index.html` to find the Dean, Coordinator, Adviser, and three Panelist guides. Each guide lists its chapters and provides the complete transcript. The Researcher guide remains at `/walkthrough/research-dashboard`.

The [Panelist production plan](../docs/walkthroughs/panelist-production-plan.md) describes the local structured, PDF, and preparation recording workflows.
