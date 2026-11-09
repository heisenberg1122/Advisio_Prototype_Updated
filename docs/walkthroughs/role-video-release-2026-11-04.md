# Role video release — November 4, 2026

> Historical release notes. The current website publishes written walkthroughs and transcripts. See [published written walkthroughs](../../walkthrough/README.md#published-written-walkthroughs).

This release adds the completed Dean (7:47), Research Coordinator (9:46), and Faculty Adviser (8:05) walkthroughs to the existing Researcher tutorial. All footage uses fictional records. Narration, comments, decisions, signatures, grades, and role handoffs follow the applicable workspace permissions.

## Viewing and downloads

After building or running the web app, open `/walkthroughs/index.html`. Individual pages are:

- `/walkthroughs/dean/index.html`
- `/walkthroughs/coordinator/index.html`
- `/walkthroughs/adviser/index.html`
- Existing Researcher companion: `/walkthrough/research-dashboard`

Each new role bundle includes a 1080p master, a web viewing copy, a captioned copy, subtitles, transcript, poster, chapter metadata, and a player with native controls and chapter seeking. Coordinator includes five chapter downloads; Adviser includes six, including manuscript review/endorsement and consultation guidance. Dean has fifteen seekable chapters within its complete videos.

The three new bundles total about 268 MiB, with twenty finalized MP4 files. `release.json` records SHA-256 checksums and sizes. Git attributes preserve the exact release-file bytes across platforms. `npm run walkthrough:publish` copies only explicitly allowed, previously verified deliverables; it does not generate narration or rerender video. Raw recordings, account manifests, database fixtures, tokens, provider responses, and voice caches remain ignored.

## Supporting changes

- The Dean research picker respects the existing college boundary. Researcher-panel access remains membership restricted.
- Signature previews and attachments use authorized document-version content URLs, allowing local files as well as cloud-backed files.
- Signing and official-copy reads use the correct storage provider and handle nullable Google Drive identifiers.
- Workflow resource upload/replacement supports configured local storage while retaining the existing Google Drive hierarchy.
- The Adviser decision dialog has room for a readable PDF and feedback column on desktop. Compact history dialogs, mobile stacking, theme colors, permissions, and decision handlers remain intact.
- Role scripts, isolated preparation/capture commands, exact narration timing, resumable captures, cached compositions, optional video-first release, chapter exports, and verification commands are documented under `docs/walkthroughs/`.

## Validation and delivery boundaries

All released videos were verified for codecs, dimensions, frame rate, audio, runtime, and captions. Published players passed desktop/mobile playback, chapter seeking, download links, overflow, browser-error, and source/build checksum checks. The recordings retain 153 Dean, 199 Coordinator, and 166 Adviser caption phrases.

The push updates `codex/qr-evaluation-local` and existing PR #7. It does not merge `main`. GitHub Actions and deployment results must be checked for the pushed commit separately from local test/build results. The evaluation deployment configuration has automatic deployment disabled; a successful Git push alone does not publish a live deployment.
