# Dean workspace walkthrough

The reusable Dean master has 15 chapters, 16 independently cached narration beats, and approximately 7 minutes 47 seconds of measured narration and transitions. It uses the configured ElevenLabs narrator and the existing ADVISIO pronunciation. No study instructions or questionnaires appear in the master.

## Faster production without replacing real interactions

- Reuse the existing Remotion composition, branding, caption alignment, audio normalization, cursor annotations, export formats, and fixed 1366 × 768 recording viewport.
- Generate one finalized narration segment per chapter (welcome and sign-in are separate beats). Exact provider timestamps control captions and action cues.
- Rehearse interactions before timed capture. Failed rehearsals save screenshots and screen text. Audit clips cannot pass the production render gate.
- Cache narration and save every completed capture. `--resume` repeats only unfinished beats with the same script and capture mode. Preserve the fixture when resuming, because approvals and signatures change its state.
- Render the Remotion framing once per beat and compose stationary recordings with native video filters. This avoids browser-decoding and repainting thousands of otherwise unchanged product frames. Recorded scrolling, native product transitions, cursor positions, restrained fades, and attention cues stay synchronized. Derive the 1080p master, 720p web version, and captioned alternative from that composition. The faster encoder preset preserves the quality target. The full Remotion renderer remains available for camera or diagram sequences; the hybrid path rejects those rather than silently dropping their animation.
- Use stationary overview framing, smooth scrolling where needed, small highlights, restrained cursor feedback, and chapter fades. Do not animate a successful product action that was not recorded.

## Actual interface corrections to the supplied outline

The current adviser screen offers **Invite adviser**, which opens Faculty Access, plus **Edit** controls for existing adviser capacity. It does not expose the outline's proposed Add Adviser button. This chapter demonstrates a capacity edit and records a reason; it does not pretend to reassign a group.

The faculty chapter submits a fictional Professor Coordinator access request. The recorded **Awaiting approval** state does not grant the requested role. Adviser invitations and requests requiring administrator approval are explained separately.

The signature chapter uses the real typed-signature, placement, password confirmation, declaration, signed-copy, and reply controls. This is an account-authenticated visual signature; the narration does not describe it as a certificate-based digital signature.

Manuscript review demonstrates a real passage comment on an assigned submitted PDF. It does not submit a permanent academic decision. Defense oversight shows readiness and an explicitly released outcome without accessing private panelist scores.

## Isolated recording environment

Run `npm run evaluation:init-local` once if the existing dedicated local PostgreSQL cluster is unavailable. The recording server reuses only that loopback cluster at `127.0.0.1:5436/advisio_evaluation`. It creates a new `walkthrough_dean_<random>` schema, independently of study sessions and normal development data.

`node --import tsx scripts/walkthrough/dean-server.mjs --fresh` prepares fictional data and starts the API on loopback port 5200 and Vite on port 3200. Native application authentication, college boundaries, document access, and signing permission checks remain enabled. External integration credentials are blank, email delivery is disabled, and background workers are not started. Credentials and the selected schema are kept only in the ignored `.walkthrough/dean/demo.json`. The account password is masked during the recorded sign-in and signing confirmation.

The fixture includes multiple programs and academic years, pending and active researchers, active and inactive projects, an adviser, an administrator-pending faculty request recipient, a signature request PDF, scheduled and completed defenses, a calendar activity, a submitted manuscript, and a sample archive referencing an approved version. Files stay in a dedicated subdirectory of local uploads. `--fresh` creates a new isolated fixture; it never deletes an existing schema.

The study environment intentionally blocks invitations, signing, and official-copy operations. This recorder uses a separate normal application server instead of relaxing those restrictions.

## Commands

```text
node --import tsx scripts/walkthrough/dean-server.mjs --fresh
node scripts/walkthrough/capture-dean.mjs --role=dean --audit
node scripts/walkthrough/voice.mjs --role=dean
node scripts/walkthrough/capture-dean.mjs --role=dean
node scripts/walkthrough/preview.mjs --role=dean --chapters=introduction,signatures,manuscripts --stills-only
node scripts/walkthrough/render.mjs --role=dean --native
node scripts/walkthrough/verify-export.mjs --role=dean
node scripts/walkthrough/preview-dean.mjs
node scripts/walkthrough/verify-dean-playback.mjs
```

After the mutating rehearsal, start the server with `--fresh` before the production capture. For recovery during the same run, use `--resume` with the capture command; do not create a new fixture midway through a production run. The `--only=<chapter ids>` option supports rehearsal diagnostics. A full production export still requires every beat.

The source of truth is `walkthrough/dean/dean-script.json`. Outputs remain under ignored `.walkthrough/dean/`, including raw clips, the 1080p master, two 720p alternatives, SRT/VTT captions, chapter metadata, poster, transcript, screenshots, and verification results. `--publish` is optional and only copies a reviewed static bundle into the web public directory; it does not deploy or push anything.

## Recording prerequisites repaired

The screen audit found that Dean's project picker excluded college projects even though the archive policy authorized that same college. The picker now uses the Dean's college boundary, with researcher-panel and other faculty assignment limits preserved. The old signature inbox now opens files through version-specific content endpoints instead of requiring Google Drive identifiers. Local signing and official-copy reads retain their recorded provider, and archive resolution handles an original with no Drive identifier. Permission, storage, and integrity tests cover these connections.

Review the preview contact sheet and exported media for readable text, real action results, narrator pronunciation, caption alignment, signed-copy status, correct request approval wording, and the absence of real personal information before sharing.
