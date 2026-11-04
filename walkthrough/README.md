# ADVISIO role walkthrough production

Researcher, Dean, Research Coordinator, Faculty Adviser, and Panelist walkthroughs are authored. The engine reads a role script and generated timeline; it does not render anything for a visitor. The website serves a pre-rendered MP4 with native controls and a VTT track. The old public mock animation is replaced by this same optional player and written guide. The [Dean production plan](../docs/walkthroughs/dean-production-plan.md) describes its isolated recording server and commands. Shared commands default to Researcher; use `--role=dean` for Dean assets.

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

`npm run walkthrough:researcher:all` runs guide generation → ElevenLabs voice → timed capture → render and static publication → exported-media verification. Capture implementation is verified first in `--audit` mode, which deliberately makes short, **non-publishable** clips without captions or estimated speech. The browser viewport is fixed at 1366×768, with the output composed at 1920×1080. Timed production capture requires the matching generated voice. Attention cues and selected scrolling use the narration's character timestamps. The renderer uses restrained focus regions while retaining full navigation views. It rejects audit clips, capture errors, mismatched viewport dimensions, missing beats, stale script hashes, shorter-than-narration clips, and a runtime over ten minutes.

Run `node scripts/walkthrough/qa-player.mjs` against the local Vite server for four responsive player checks. It uses synthetic media only inside its test browser to exercise native playback, caption tracks and seeking. This test fixture never becomes walkthrough footage and is never published. It also tests the honest missing-media state.

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

The render command composes the product footage once with Remotion. FFmpeg creates the burned-in alternatives from the same measured caption data, measures narration loudness, applies two-pass normalization to -16 LUFS / -1.5 dBTP, encodes H.264/AAC with fast-start metadata and checks encoded runtime. It publishes web assets to `apps/web/public/walkthroughs/researcher/`. The two completed web MP4s are tracked with their captions and metadata so repository builds include playable media. Raw recordings, narration caches, private fixture manifests, and the original Researcher 1080p master remain under the ignored `.walkthrough/` directory, which is also excluded from Docker build context. The separately verified Dean, Coordinator, and Adviser releases include their finalized 1080p masters and available chapter videos. Generate/copy the completed bundle **before building the deployment artifact**. Avoid copying over a bundle on a live server; publish it through an atomic site build/deployment.

The evaluation guide embeds the component only for Researchers. `/walkthrough/research-dashboard` is the public companion. Both offer a written guide and transcript. Continue never depends on elapsed video time or guide completion. Until matching `media.json` and media files exist, the component truthfully reports that narration is unavailable; it does not play a mock video. The metadata script hash must match the generated web text.

## Release review

Review the inventory against current UI before every regeneration. Confirm real product captures, fictional identities, version-specific feedback, actual returned submission status, truthful defense/grade empty states, no third-party connection success, all spoken text captioned, caption safe margins, readable desktop detail, and mobile native captions. Listen to every narration beat for pronunciation, natural tutor delivery, pacing and audio clipping. Compare transcript against audio; view the full export for cursor drift, cropped panels, stale/failed states and transition artifacts. Validate actual exported playback/fullscreen/volume/captions on devices in addition to automated test fixtures. No background music is used.

Sources used for implementation: [Playwright recording](https://playwright.dev/docs/videos), [ElevenLabs timing endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps/), [Remotion metadata](https://www.remotion.dev/docs/dynamic-metadata), [Remotion recorded video](https://www.remotion.dev/docs/offthreadvideo). Motion follows restrained spotlight, annotation and progress patterns; no BrewedOps source/assets are copied.

The [Coordinator production plan](../docs/walkthroughs/coordinator-production-plan.md) covers its five chapter exports and isolated role handoffs. Use `--role=coordinator` for its cached assets.

The [Faculty Adviser production plan](../docs/walkthroughs/adviser-production-plan.md) describes the six-chapter recording, isolated fixture, review lifecycle, and cached-narration workflow. Use `--role=adviser` with shared commands.

## Shared role-video release

Run `npm run walkthrough:publish` to copy the verified Dean, Coordinator, Adviser, and three Panelist-variant deliverables into `apps/web/public/walkthroughs/` without regenerating narration or rendering video. It checks each script hash and verified MP4 byte count, copies an explicit release-file allowlist, and records SHA-256 checksums. Private credentials, demo manifests, capture evidence, and voice-provider caches stay local.

After building the web app, `/walkthroughs/index.html` lists the releases. The role players are `/walkthroughs/dean/index.html`, `/walkthroughs/coordinator/index.html`, and `/walkthroughs/adviser/index.html`. Each includes native video controls, selectable captions, chapter seeking, transcript, subtitles, 1080p master, and a captioned copy. Coordinator and Adviser also include their separate chapter downloads. The existing Researcher companion remains at `/walkthrough/research-dashboard`.

The [Panelist production plan](../docs/walkthroughs/panelist-production-plan.md) covers shared preparation scenes and separate structured/PDF evaluation variants. Generate narration once with `--role=panelist`, then derive the three release variants with `npm run walkthrough:panelist:variants`.

Panelist release pages are `/walkthroughs/panelist-structured/index.html`, `/walkthroughs/panelist-pdf/index.html`, and `/walkthroughs/panelist-preparation/index.html`. Choose the full evaluation video matching the defense's configured method; the preparation-only video is an optional quick reference. Each release includes its verified 1080p master, web/captioned copies, chapters, transcript, and subtitles.
